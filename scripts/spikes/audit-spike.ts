/**
 * MIC-I7-1 spike: can the app guarantee `set_config('micasa.audit_actor', json, true)`
 * on every write to an audited model, with Prisma 7 + adapter-pg / adapter-neon?
 *
 * Throwaway research code (not imported by the app). Results: docs/audit-spike.md.
 *
 *   SPIKE_TARGET=pg   SPIKE_PG_URL=postgresql://…/micasa_audit_spike npx tsx --tsconfig tsconfig.json scripts/spikes/audit-spike.ts
 *   SPIKE_TARGET=neon SPIKE_NEON_HOST=ep-…-pooler.….neon.tech         npx tsx --tsconfig tsconfig.json scripts/spikes/audit-spike.ts
 *
 * For neon, the role and password come from DATABASE_URL in .env.local and only the
 * host is swapped; the script refuses to run unless the host is SPIKE_NEON_HOST and
 * differs from the .env.local host (never production).
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { PrismaClient, Prisma } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool } from 'pg'

type Target = 'pg' | 'neon'
const TARGET = (process.env.SPIKE_TARGET ?? 'pg') as Target

function envLocalDatabaseUrl(): string {
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find((l) => l.startsWith('DATABASE_URL='))
  if (!line) throw new Error('DATABASE_URL missing in .env.local')
  return line.slice('DATABASE_URL='.length).replace(/^"|"$/g, '')
}

function connectionString(): string {
  if (TARGET === 'pg') {
    const url = process.env.SPIKE_PG_URL
    if (!url || !/localhost|127\.0\.0\.1/.test(url)) throw new Error('SPIKE_PG_URL must be local')
    return url
  }
  const host = process.env.SPIKE_NEON_HOST
  if (!host) throw new Error('SPIKE_NEON_HOST required')
  const url = new URL(envLocalDatabaseUrl())
  if (url.hostname === host) throw new Error('refusing: SPIKE_NEON_HOST is the .env.local (production) host')
  url.hostname = host
  return url.toString()
}

const CONN = connectionString()

// ---------------------------------------------------------------------------
// Actor context + audit layer (the mechanism under test)
// ---------------------------------------------------------------------------

type AuditActor = { v: 1; source: string; user_id: number | null; batch_id: string; label?: string }
type Scope = { actor: AuditActor; inTx?: boolean }
const als = new AsyncLocalStorage<Scope>()

const AUDITED = new Set(['Expense', 'Wallet', 'User'])
const WRITE_OPS = new Set([
  'create', 'createMany', 'createManyAndReturn', 'update', 'updateMany',
  'updateManyAndReturn', 'upsert', 'delete', 'deleteMany',
])

const counters = { txOpened: 0, autoWrapped: 0 }

function actorJson(): string | null {
  const actor = als.getStore()?.actor
  return actor ? JSON.stringify(actor) : null
}

function delegateName(model: string) {
  return model.charAt(0).toLowerCase() + model.slice(1)
}

type Client = PrismaClient

/**
 * Variant A (as specified in MIC-I7-3): `$allOperations` re-emits a root write as
 * `$transaction(tx => tx[model][op](args))`; an AsyncLocalStorage "inTx" mark
 * lets writes inside a transaction pass through.
 */
function withAuditLayerA(base: Client): Client {
  const extended = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!AUDITED.has(model) || !WRITE_OPS.has(operation)) return query(args)
          if (als.getStore()?.inTx) return query(args)
          counters.autoWrapped++
          return proxied.$transaction(async (tx) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (tx as any)[delegateName(model)][operation](args),
          )
        },
      },
    },
  }) as unknown as Client
  const proxied = wrapTransaction(extended)
  return proxied
}

/** Proxy over `$transaction`: set_config first, then mark the scope as in-transaction. */
function wrapTransaction(client: Client): Client {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop !== '$transaction') return Reflect.get(target, prop, receiver)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (arg: any, options?: any) => {
        counters.txOpened++
        const scope = als.getStore()
        const json = actorJson()
        if (typeof arg === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return target.$transaction(async (tx: any) => {
            await tx.$executeRaw`select set_config('micasa.audit_actor', ${json}, true)`
            return als.run({ ...(scope ?? { actor: undefined as never }), inTx: true }, () => arg(tx))
          }, options)
        }
        // Array form: prepend the setting. Run inside an inTx scope so the
        // extension does not try to re-wrap batch items.
        return als.run({ ...(scope ?? { actor: undefined as never }), inTx: true }, () =>
          target
            .$transaction(
              [target.$executeRaw`select set_config('micasa.audit_actor', ${json}, true)`, ...arg],
              options,
            )
            .then((results: unknown[]) => results.slice(1)),
        )
      }
    },
  })
}

/**
 * Variant D (alternative): no ALS "inTx" mark. A Proxy over the ROOT client's model
 * delegates turns a standalone write into `$transaction(tx => tx.model.op(args))`;
 * the `tx` client is never proxied, so its writes pass through. A root write made
 * by mistake inside a callback still gets its own audited transaction.
 * Array-form batches keep working because the returned object forwards
 * `requestTransaction` to the original lazy PrismaPromise.
 */
function withAuditLayerD(base: Client, mode: 'callback' | 'array' = 'callback'): Client {
  const withTx = wrapTransactionNoMark(base)
  const delegates = new Map<string, unknown>()
  return new Proxy(withTx, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof prop !== 'string') return value
      const model = prop.charAt(0).toUpperCase() + prop.slice(1)
      if (!AUDITED.has(model)) return value
      if (!delegates.has(prop)) {
        delegates.set(
          prop,
          new Proxy(value as object, {
            get(dTarget, op, dReceiver) {
              const fn = Reflect.get(dTarget, op, dReceiver)
              if (typeof op !== 'string' || !WRITE_OPS.has(op)) return fn
              return (args: unknown) => {
                const lazy = (fn as (a: unknown) => Prisma.PrismaPromise<unknown>).call(dTarget, args)
                let run: Promise<unknown> | undefined
                const exec = () => {
                  counters.autoWrapped++
                  run ??=
                    mode === 'array'
                      ? // One batch: BEGIN, set_config, write, COMMIT (no callback round trip).
                        withTx.$transaction([lazy]).then((r) => r[0])
                      : withTx.$transaction(async (tx) =>
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (tx as any)[prop][op](args),
                        )
                  return run
                }
                return {
                  then: (a?: never, b?: never) => exec().then(a, b),
                  catch: (b?: never) => exec().catch(b),
                  finally: (f?: never) => exec().finally(f),
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  requestTransaction: (...p: unknown[]) => (lazy as any).requestTransaction(...p),
                  [Symbol.toStringTag]: 'PrismaPromise',
                }
              }
            },
          }),
        )
      }
      return delegates.get(prop)
    },
  })
}

function wrapTransactionNoMark(client: Client): Client {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop !== '$transaction') return Reflect.get(target, prop, receiver)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (arg: any, options?: any) => {
        counters.txOpened++
        const json = actorJson()
        if (typeof arg === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return target.$transaction(async (tx: any) => {
            await tx.$executeRaw`select set_config('micasa.audit_actor', ${json}, true)`
            return arg(tx)
          }, options)
        }
        return target
          .$transaction([target.$executeRaw`select set_config('micasa.audit_actor', ${json}, true)`, ...arg], options)
          .then((results: unknown[]) => results.slice(1))
      }
    },
  })
}

function newBase(poolMax?: number, maxWait?: number): Client {
  const transactionOptions = maxWait ? { maxWait, timeout: maxWait } : undefined
  if (TARGET === 'pg') {
    const pool = new Pool({ connectionString: CONN, ...(poolMax ? { max: poolMax } : {}) })
    return new PrismaClient({ adapter: new PrismaPg(pool), transactionOptions })
  }
  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString: CONN, ...(poolMax ? { max: poolMax } : {}) }),
    transactionOptions,
  })
}

// ---------------------------------------------------------------------------
// Test trigger (stand-in for audit.row_change())
// ---------------------------------------------------------------------------

const SETUP_SQL = [
  `create schema if not exists audit_spike`,
  `create table if not exists audit_spike.log (
     id bigserial primary key,
     occurred_at timestamptz not null default now(),
     txid xid8 not null default pg_current_xact_id(),
     entity_type text not null,
     entity_id text,
     action text not null,
     actor jsonb,
     raw_setting text,
     missing_actor boolean not null,
     changed_fields text[],
     before jsonb,
     after jsonb
   )`,
  `create or replace function audit_spike.row_change() returns trigger
   language plpgsql security definer set search_path = pg_catalog, public as $fn$
   declare
     raw text := current_setting('micasa.audit_actor', true);
     actor jsonb;
     old_j jsonb;
     new_j jsonb;
     changed text[];
     deny constant text := '(password|hash|secret|token)';
   begin
     if raw is not null and raw <> '' and raw <> 'null' then actor := raw::jsonb; end if;
     if TG_OP in ('UPDATE', 'DELETE') then
       select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into old_j
       from jsonb_each(to_jsonb(OLD)) e(k, v) where k !~* deny;
     end if;
     if TG_OP in ('INSERT', 'UPDATE') then
       select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into new_j
       from jsonb_each(to_jsonb(NEW)) e(k, v) where k !~* deny;
     end if;
     if TG_OP = 'UPDATE' then
       select array_agg(k order by k) into changed
       from jsonb_each(new_j) n(k, v) where old_j -> k is distinct from v;
       if changed is null then return null; end if;
     end if;
     insert into audit_spike.log (entity_type, entity_id, action, actor, raw_setting, missing_actor, changed_fields, before, after)
     values (TG_TABLE_NAME, coalesce(new_j ->> 'id', old_j ->> 'id'), TG_OP, actor, raw, actor is null, changed, old_j, new_j);
     return null;
   end
   $fn$`,
  `drop trigger if exists audit_spike_row_change on "Expense"`,
  `create trigger audit_spike_row_change after insert or update or delete on "Expense" for each row execute function audit_spike.row_change()`,
  `drop trigger if exists audit_spike_row_change on "Wallet"`,
  `create trigger audit_spike_row_change after insert or update or delete on "Wallet" for each row execute function audit_spike.row_change()`,
  `drop trigger if exists audit_spike_row_change on "User"`,
  `create trigger audit_spike_row_change after insert or update or delete on "User" for each row execute function audit_spike.row_change()`,
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type LogRow = {
  id: bigint
  txid: string
  entity_type: string
  entity_id: string
  action: string
  actor: AuditActor | null
  raw_setting: string | null
  missing_actor: boolean
  changed_fields: string[] | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

const results: { n: string; name: string; ok: boolean; detail: string }[] = []
function record(n: string, name: string, ok: boolean, detail: string) {
  results.push({ n, name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} [${n}] ${name} — ${detail}`)
}

async function logSince(root: Client, sinceId: bigint): Promise<LogRow[]> {
  return root.$queryRawUnsafe<LogRow[]>(
    `select id, txid::text as txid, entity_type, entity_id, action, actor, raw_setting, missing_actor, changed_fields, before, after
       from audit_spike.log where id > $1 order by id`,
    sinceId,
  )
}

async function lastLogId(root: Client): Promise<bigint> {
  const [row] = await root.$queryRawUnsafe<{ id: bigint | null }[]>(`select max(id) as id from audit_spike.log`)
  return row?.id ?? BigInt(0)
}

function actor(label: string): AuditActor {
  return { v: 1, source: 'WEB', user_id: 1, batch_id: randomUUID(), label }
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]!
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`target=${TARGET} host=${new URL(CONN).hostname}`)
  const raw = newBase()
  for (const sql of SETUP_SQL) await raw.$executeRawUnsafe(sql)

  // Fixture rows owned by the spike only.
  const tag = `audit-spike-${Date.now()}`
  const user = await raw.user.create({
    data: { name: tag, email: `${tag}@spike.invalid`, password: 'not-a-real-hash' },
  })
  const fortnight = await raw.fortnight.create({
    data: {
      user_id: user.id, month: 1, year: 1999, period: 'FIRST', label: tag,
      start_date: new Date('1998-12-31T12:00:00Z'), end_date: new Date('1999-01-14T12:00:00Z'),
    },
  })
  const wallets = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      raw.wallet.create({ data: { user_id: user.id, name: `${tag}-w${i}`, type: 'CASH', amount: 0 } }),
    ),
  )
  const expense = await raw.expense.create({
    data: { user_id: user.id, fortnight_id: fortnight.id, description: `${tag} luz`, amount: 100 },
  })

  const A = withAuditLayerA(newBase())
  const D = withAuditLayerD(newBase())

  try {
    // 1 — Proxy over interactive $transaction: set_config visible to the trigger.
    {
      const since = await lastLogId(raw)
      const a = actor('t1')
      await als.run({ actor: a }, () =>
        A.$transaction(async (tx) => {
          await tx.expense.update({ where: { id: expense.id }, data: { description: `${tag} luz CFE` } })
          await tx.wallet.update({ where: { id: wallets[0]!.id }, data: { name: `${tag}-w0-renamed` } })
        }),
      )
      const rows = await logSince(raw, since)
      const ok =
        rows.length === 2 &&
        rows.every((r) => r.actor?.batch_id === a.batch_id && !r.missing_actor) &&
        rows[0]!.txid === rows[1]!.txid
      record('1', 'interactive $transaction proxy sets actor', ok, `${rows.length} rows, actor batch match=${rows.every((r) => r.actor?.batch_id === a.batch_id)}, same txid=${rows[0]?.txid === rows[1]?.txid}`)
    }

    // 2 — Auto-wrap of root writes, 20 concurrent, default pool.
    for (const [name, client] of [['A', A], ['D', D]] as const) {
      const since = await lastLogId(raw)
      const a = actor(`t2-${name}`)
      const before = { ...counters }
      const t0 = performance.now()
      await als.run({ actor: a }, () =>
        Promise.all(wallets.map((w) => client.wallet.update({ where: { id: w.id }, data: { amount: { increment: 1 } } }))),
      )
      const ms = performance.now() - t0
      const rows = await logSince(raw, since)
      const ok = rows.length === 20 && rows.every((r) => r.actor?.batch_id === a.batch_id)
      record('2', `variant ${name}: 20 concurrent auto-wrapped writes (default pool)`, ok, `${rows.length}/20 rows with actor, ${Math.round(ms)} ms total, tx opened ${counters.txOpened - before.txOpened}`)
    }
    // 2b — same row, 20 concurrent increments (row lock contention) + a tiny pool.
    for (const [name, mk, maxWait] of [
      ['A', withAuditLayerA, undefined],
      ['D', withAuditLayerD, undefined],
      ['A maxWait=20s', withAuditLayerA, 20_000],
      ['D maxWait=20s', withAuditLayerD, 20_000],
    ] as const) {
      const tiny = mk(newBase(2, maxWait))
      const since = await lastLogId(raw)
      const a = actor(`t2b-${name}`)
      const t0 = performance.now()
      let error = ''
      try {
        await als.run({ actor: a }, () =>
          Promise.all(Array.from({ length: 20 }, () =>
            tiny.wallet.update({ where: { id: wallets[1]!.id }, data: { amount: { increment: 1 } } }))),
        )
      } catch (e) {
        error = (e as Error).message.split('\n').slice(-1)[0]!
      }
      const ms = performance.now() - t0
      const rows = await logSince(raw, since)
      record('2', `variant ${name}: 20 concurrent increments on one row, pool max=2`, !error && rows.length === 20, error ? `error: ${error}` : `${rows.length}/20 rows, ${Math.round(ms)} ms`)
      await tiny.$disconnect()
    }

    // 3 — writes inside a transaction are not wrapped again; extension applies to tx.
    {
      const before = { ...counters }
      await als.run({ actor: actor('t3') }, () =>
        A.$transaction(async (tx) => {
          for (let i = 0; i < 3; i++) await tx.wallet.update({ where: { id: wallets[2]!.id }, data: { amount: { increment: 1 } } })
        }),
      )
      const opened = counters.txOpened - before.txOpened
      const wrapped = counters.autoWrapped - before.autoWrapped
      record('3', 'variant A: no double wrap inside interactive tx', opened === 1 && wrapped === 0, `tx opened=${opened}, auto-wrapped=${wrapped} for 3 writes`)
    }
    // 3b — the hazard: root client used inside a callback (instead of tx).
    for (const [name, client] of [['A', A], ['D', D]] as const) {
      const since = await lastLogId(raw)
      const a = actor(`t3b-${name}`)
      await als.run({ actor: a }, () =>
        client.$transaction(async () => {
          await client.wallet.update({ where: { id: wallets[3]!.id }, data: { amount: { increment: 1 } } })
        }),
      )
      const rows = await logSince(raw, since)
      const ok = rows.length === 1 && rows[0]!.actor?.batch_id === a.batch_id
      record('3', `variant ${name}: root client used inside a callback`, ok, rows.map((r) => `actor=${r.actor ? 'set' : 'MISSING'} raw=${JSON.stringify(r.raw_setting)}`).join(', ') || 'no rows')
    }

    // 4 — array form.
    for (const [name, client] of [['A', A], ['D', D]] as const) {
      const since = await lastLogId(raw)
      const a = actor(`t4-${name}`)
      let error = ''
      let ret: unknown[] = []
      try {
        ret = await als.run({ actor: a }, () =>
          client.$transaction([
            client.wallet.update({ where: { id: wallets[4]!.id }, data: { amount: { increment: 5 } } }),
            client.expense.update({ where: { id: expense.id }, data: { amount: name === 'A' ? 101 : 102 } }),
          ]),
        )
      } catch (e) {
        error = (e as Error).message.split('\n').slice(-2).join(' ')
      }
      const rows = await logSince(raw, since)
      const ok = !error && rows.length === 2 && rows.every((r) => r.actor?.batch_id === a.batch_id) && rows[0]!.txid === rows[1]!.txid && ret.length === 2
      record('4', `variant ${name}: array $transaction with prepended set_config`, ok, error ? `error: ${error}` : `${rows.length} rows, same txid=${rows[0]?.txid === rows[1]?.txid}, results=${ret.length}`)
    }

    // 5 — no leak between consecutive transactions on one pooled connection.
    {
      const one = newBase(1)
      const seen: (string | null)[] = []
      await one.$transaction(async (tx) => {
        await tx.$executeRaw`select set_config('micasa.audit_actor', ${JSON.stringify(actor('t5'))}, true)`
      })
      for (let i = 0; i < 5; i++) {
        const r = await one.$transaction(async (tx) =>
          tx.$queryRaw<{ s: string | null }[]>`select current_setting('micasa.audit_actor', true) as s`,
        )
        seen.push(r[0]!.s)
      }
      const outside = await one.$queryRaw<{ s: string | null }[]>`select current_setting('micasa.audit_actor', true) as s`
      const ok = seen.every((s) => s === null || s === '') && (outside[0]!.s === null || outside[0]!.s === '')
      record('5', 'setting does not leak to the next transaction (pool max=1)', ok, `next tx saw ${JSON.stringify(seen)}; outside tx ${JSON.stringify(outside[0]!.s)}`)

      // Leak check across many sessions behind the pooler: 30 concurrent tx with
      // set_config, then 30 concurrent reads with none.
      const many = newBase(10)
      await Promise.all(Array.from({ length: 30 }, (_, i) =>
        many.$transaction(async (tx) => {
          await tx.$executeRaw`select set_config('micasa.audit_actor', ${JSON.stringify(actor(`t5-${i}`))}, true)`
          await tx.$executeRaw`select pg_sleep(0.02)`
        })))
      const reads = await Promise.all(Array.from({ length: 30 }, () =>
        many.$transaction(async (tx) => tx.$queryRaw<{ s: string | null; pid: number }[]>`select current_setting('micasa.audit_actor', true) as s, pg_backend_pid() as pid`)))
      const leaked = reads.filter((r) => r[0]!.s)
      const pids = new Set(reads.map((r) => r[0]!.pid))
      record('5', '30 concurrent reads after 30 set_config tx (pool max=10)', leaked.length === 0, `leaked=${leaked.length}, distinct backend pids=${pids.size}`)

      // What a session-level set (is_local=false) would do: it leaks. Reset after.
      await one.$executeRaw`select set_config('micasa.audit_actor', '{"v":1,"source":"LEAK"}', false)`
      const after = await one.$transaction(async (tx) =>
        tx.$queryRaw<{ s: string | null }[]>`select current_setting('micasa.audit_actor', true) as s`)
      await one.$executeRaw`reset micasa.audit_actor`
      record('5', 'control: session-level set_config(…, false) DOES leak', !!after[0]!.s, `next tx saw ${JSON.stringify(after[0]!.s)} (validator must forbid is_local=false)`)
      await one.$disconnect()
      await many.$disconnect()
    }

    // 6 — latency of a simple write: plain vs auto-wrapped (sequential).
    {
      const plain = newBase()
      const N = 25
      const time = async (fn: () => Promise<unknown>) => {
        await fn()
        const xs: number[] = []
        for (let i = 0; i < N; i++) {
          const t0 = performance.now()
          await fn()
          xs.push(performance.now() - t0)
        }
        return median(xs)
      }
      const where = { id: wallets[5]!.id }
      const rtt = await time(() => plain.$queryRaw`select 1`)
      const base = await time(() => plain.wallet.update({ where, data: { amount: { increment: 1 } } }))
      const wrappedA = await als.run({ actor: actor('t6') }, () =>
        time(() => A.wallet.update({ where, data: { amount: { increment: 1 } } })))
      const wrappedD = await als.run({ actor: actor('t6') }, () =>
        time(() => D.wallet.update({ where, data: { amount: { increment: 1 } } })))
      const Darr = withAuditLayerD(newBase(), 'array')
      const wrappedDarr = await als.run({ actor: actor('t6') }, () =>
        time(() => Darr.wallet.update({ where, data: { amount: { increment: 1 } } })))
      await Darr.$disconnect()
      const r = (x: number) => Math.round(x * 10) / 10
      record('6', 'latency per simple write (median of 25)', true,
        `select1=${r(rtt)}ms plain=${r(base)}ms wrappedA=${r(wrappedA)}ms (+${r(wrappedA - base)}) wrappedD=${r(wrappedD)}ms (+${r(wrappedD - base)}) wrappedD-array=${r(wrappedDarr)}ms (+${r(wrappedDarr - base)})`)
      console.log(`METRIC overhead_ms_A=${Math.round(wrappedA - base)} overhead_ms_D=${Math.round(wrappedD - base)} overhead_ms_D_array=${Math.round(wrappedDarr - base)} rtt_ms=${r(rtt)}`)
      await plain.$disconnect()
    }

    // 7 — trigger diff: Expense update, Wallet increment, deleteMany, denylist, no-op update.
    {
      const since = await lastLogId(raw)
      await als.run({ actor: actor('t7') }, async () => {
        await A.expense.update({ where: { id: expense.id }, data: { amount: 250.5, is_paid: true } })
        await A.wallet.update({ where: { id: wallets[6]!.id }, data: { amount: { increment: 12.34 } } })
        await A.wallet.update({ where: { id: wallets[6]!.id }, data: { name: wallets[6]!.name } }) // no-op
        await A.user.update({ where: { id: user.id }, data: { name: `${tag}-renamed`, password: 'changed' } })
        await A.wallet.deleteMany({ where: { id: { in: [wallets[18]!.id, wallets[19]!.id] } } })
      })
      const rows = await logSince(raw, since)
      const exp = rows.find((r) => r.entity_type === 'Expense')
      const inc = rows.filter((r) => r.entity_type === 'Wallet' && r.action === 'UPDATE')
      const usr = rows.find((r) => r.entity_type === 'User')
      const del = rows.filter((r) => r.action === 'DELETE')
      record('7', 'Expense update changed_fields + before/after', !!exp && exp.changed_fields?.join(',') === 'amount,is_paid',
        `changed=${exp?.changed_fields} before.amount=${exp?.before?.amount} after.amount=${exp?.after?.amount}`)
      record('7', 'Wallet increment exact before/after; no-op update writes nothing', inc.length === 1 && Number(inc[0]!.after!.amount) - Number(inc[0]!.before!.amount) === 12.34,
        `rows=${inc.length} before=${inc[0]?.before?.amount} after=${inc[0]?.after?.amount}`)
      record('7', 'User denylist strips password', !!usr && !('password' in (usr.before ?? {})) && !('password' in (usr.after ?? {})) && usr.changed_fields?.join(',') === 'name',
        `changed=${usr?.changed_fields} keys=${Object.keys(usr?.after ?? {}).join(',')}`)
      record('7', 'deleteMany logs one row per deleted row', del.length === 2 && del.every((r) => r.before && !r.after),
        `delete rows=${del.length} ids=${del.map((r) => r.entity_id).join(',')}`)
    }

    // 7b — write with no actor in scope (variant A passes through untouched) → missing_actor.
    {
      const since = await lastLogId(raw)
      await raw.expense.update({ where: { id: expense.id }, data: { description: `${tag} sin actor` } })
      const rows = await logSince(raw, since)
      record('7', 'write without actor is logged as missing_actor', rows.length === 1 && rows[0]!.missing_actor,
        `missing_actor=${rows[0]?.missing_actor} raw=${JSON.stringify(rows[0]?.raw_setting)}`)
    }

    console.log(`FIXTURE expense_id=${expense.id} wallet_id=${wallets[7]!.id} user_id=${user.id}`)
  } finally {
    if (process.env.SPIKE_KEEP !== '1') {
      await raw.expense.deleteMany({ where: { user_id: user.id } })
      await raw.wallet.deleteMany({ where: { user_id: user.id } })
      await raw.fortnight.deleteMany({ where: { user_id: user.id } })
      await raw.user.delete({ where: { id: user.id } })
    }
    await Promise.all([raw.$disconnect(), A.$disconnect(), D.$disconnect()])
  }

  const failed = results.filter((r) => !r.ok && !r.name.startsWith('control'))
  console.log(`\nSUMMARY target=${TARGET} pass=${results.length - failed.length} fail=${failed.length}`)
  process.exitCode = failed.length ? 1 : 0
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
