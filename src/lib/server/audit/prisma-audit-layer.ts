/**
 * Guarantees that every write to an audited model runs inside a transaction
 * that first ran `set_config('micasa.audit_actor', <actor json>, true)`.
 * Validated by the MIC-I7-1 spike (docs/audit-spike.md, variant D).
 *
 * - `$transaction(fn)`: `set_config` before the callback. The `tx` client is
 *   handed over untouched, so writes inside it are never wrapped twice.
 * - `$transaction([...])`: `set_config` prepended to the batch; its result is
 *   dropped from the returned array.
 * - `prisma.<auditedModel>.<write>(args)` on the ROOT client: re-issued as
 *   `$transaction(tx => tx.<model>.<write>(args))`. A root-client write made
 *   inside another transaction's callback therefore still gets its own actor.
 *   The returned object keeps `requestTransaction` and the `PrismaPromise` tag
 *   of the original lazy promise, so it still works inside `$transaction([...])`
 *   (pinned by src/test/db/prisma-audit-layer.db.test.ts).
 *
 * No actor in scope on an audited write is a bug in the entry point: it throws
 * outside production; in production the write goes through without the
 * setting (the trigger records SYSTEM + missing_actor) and `audit.actor_missing`
 * is logged. Read-only transactions never need an actor.
 */
import { logFinanceEvent } from '@/lib/observability/finance-log'
import { AUDITED_MODEL_NAMES } from './audited-models'
import { captureAuditScope, getAuditActor, runInAuditScope, serializeAuditActor } from './audit-context'

export const AUDIT_WRITE_OPERATIONS: ReadonlySet<string> = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
])

/**
 * Timeout of the transaction a standalone write is wrapped in. Before the audit
 * layer that write had no transaction timeout at all; Prisma's 5s default would
 * fail a slow single statement (cold Neon compute, large deleteMany).
 */
export const AUTO_WRAP_TIMEOUT_MS = 20_000

export class AuditActorMissingError extends Error {
  constructor(model: string, operation: string) {
    super(
      `Audit actor missing for ${model}.${operation}: run the entry point inside ` +
        'withOwnerContext / withAdmin / runAgentTool / runWithAuditActor.',
    )
    this.name = 'AuditActorMissingError'
  }
}

const reportMissingActor = (model: string, operation: string) => {
  if (process.env.NODE_ENV !== 'production') throw new AuditActorMissingError(model, operation)
  logFinanceEvent('warn', 'audit.actor_missing', { model, operation })
}

const modelOfDelegate = (prop: string) => prop.charAt(0).toUpperCase() + prop.slice(1)

const isAuditedDelegate = (prop: string | symbol): prop is string =>
  typeof prop === 'string' && !prop.startsWith('$') && AUDITED_MODEL_NAMES.has(modelOfDelegate(prop))

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyClient = Record<string | symbol, any>

const SET_ACTOR = (client: AnyClient, json: string) =>
  client.$executeRaw`SELECT set_config('micasa.audit_actor', ${json}, true)`

/**
 * Without an actor, the `tx` handed to a callback reports audited writes as
 * missing-actor (it cannot wrap them: they already run in the transaction).
 */
const guardTxWithoutActor = (tx: AnyClient): AnyClient =>
  new Proxy(tx, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (!isAuditedDelegate(prop)) return value
      return new Proxy(value, {
        get(delegate, op, dReceiver) {
          const fn = Reflect.get(delegate, op, dReceiver)
          if (typeof op !== 'string' || !AUDIT_WRITE_OPERATIONS.has(op)) return fn
          return (...args: unknown[]) => {
            reportMissingActor(modelOfDelegate(prop), op)
            return fn.apply(delegate, args)
          }
        },
      })
    },
  })

const wrapTransaction = (target: AnyClient) =>
  (arg: unknown, options?: unknown) => {
    const actor = getAuditActor()
    const json = actor ? serializeAuditActor(actor) : null
    if (typeof arg === 'function') {
      return target.$transaction(async (tx: AnyClient) => {
        if (json) {
          await SET_ACTOR(tx, json)
          return arg(tx)
        }
        return arg(guardTxWithoutActor(tx))
      }, options)
    }
    if (!Array.isArray(arg) || !json) return target.$transaction(arg, options)
    return target
      .$transaction([SET_ACTOR(target, json), ...arg], options)
      .then((results: unknown[]) => results.slice(1))
  }

/** Wraps a root-client write so a standalone call runs in its own audited transaction. */
const wrapWrite = (root: AnyClient, delegateName: string, operation: string, lazy: AnyClient, args: unknown[]) => {
  const model = modelOfDelegate(delegateName)
  // The write is lazy: it may be awaited after the caller's scope ended
  // (`run(() => prisma.x.create(…))`), so keep the scope it was created in.
  const scope = captureAuditScope()
  let run: Promise<unknown> | undefined
  const start = (): Promise<unknown> => {
    if (scope) {
      return runInAuditScope(scope, () =>
        root.$transaction((tx: AnyClient) => tx[delegateName][operation](...args), {
          timeout: AUTO_WRAP_TIMEOUT_MS,
        }),
      )
    }
    try {
      reportMissingActor(model, operation)
    } catch (error) {
      return Promise.reject(error)
    }
    return Promise.resolve(lazy)
  }
  const exec = (): Promise<unknown> => {
    if (!run) run = start()
    return run
  }
  return {
    then: (onFulfilled?: any, onRejected?: any) => exec().then(onFulfilled, onRejected),
    catch: (onRejected?: any) => exec().catch(onRejected),
    finally: (onFinally?: any) => exec().finally(onFinally),
    // Inside $transaction([...]) Prisma runs the original lazy promise in its batch.
    requestTransaction: (...p: unknown[]) => {
      if (!scope && !getAuditActor()) reportMissingActor(model, operation)
      return lazy.requestTransaction(...p)
    },
    [Symbol.toStringTag]: 'PrismaPromise',
  }
}

export const withAuditLayer = <C extends object>(client: C): C => {
  const delegates = new Map<string, unknown>()
  const transaction = wrapTransaction(client as AnyClient)
  const root: AnyClient = new Proxy(client as AnyClient, {
    get(target, prop, receiver) {
      if (prop === '$transaction') return transaction
      const value = Reflect.get(target, prop, receiver)
      if (!isAuditedDelegate(prop) || value == null) return value
      let wrapped = delegates.get(prop)
      if (!wrapped) {
        wrapped = new Proxy(value, {
          get(delegate, op, dReceiver) {
            const fn = Reflect.get(delegate, op, dReceiver)
            if (typeof op !== 'string' || !AUDIT_WRITE_OPERATIONS.has(op)) return fn
            return (...args: unknown[]) => wrapWrite(root, prop, op, fn.apply(delegate, args), args)
          },
        })
        delegates.set(prop, wrapped)
      }
      return wrapped
    },
  })
  return root as C
}
/* eslint-enable @typescript-eslint/no-explicit-any */
