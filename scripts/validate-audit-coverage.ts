/**
 * Keeps the audit log complete (`npm run validate:audit-coverage`, part of `npm run ci`).
 *
 * Fails when:
 * 1. A model in prisma/schema.prisma is neither in AUDITED_MODELS nor in
 *    EXCLUDED_MODELS (src/lib/server/audit/audited-models.ts), or a listed
 *    model no longer exists.
 * 2. A route under src/app/api/** exports POST/PUT/PATCH/DELETE without opening
 *    an actor scope (withOwnerContext, withAdmin, runWithAuditActor,
 *    runAgentTool…) and is not in ROUTES_WITHOUT_ACTOR with its reason.
 * 3. App code calls $executeRaw / $executeRawUnsafe outside a $transaction callback.
 * 4. `set_config('micasa.audit_actor', …, false)` or a session-level
 *    `SET micasa.audit_actor` appears outside prisma/migrations (it would leak
 *    across pooled connections).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { AUDITED_MODEL_NAMES, EXCLUDED_MODELS } from '../src/lib/server/audit/audited-models'

const ROOT = process.cwd()
const errors: string[] = []

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (entry === 'node_modules' || entry === 'generated') continue
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}
const rel = (file: string) => path.relative(ROOT, file)
const isTest = (file: string) => /\.(test|spec)\.tsx?$/.test(file) || file.includes(`${path.sep}test${path.sep}`)

// 1. Models ----------------------------------------------------------------
const schema = readFileSync(path.resolve(ROOT, process.env.AUDIT_SCHEMA_PATH ?? 'prisma/schema.prisma'), 'utf8')
const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]!)
for (const model of models) {
  if (!AUDITED_MODEL_NAMES.has(model) && !(model in EXCLUDED_MODELS)) {
    errors.push(
      `prisma/schema.prisma: model ${model} is neither audited nor excluded. Add it to AUDITED_MODELS ` +
        `(and run npm run generate:audit-triggers) or to EXCLUDED_MODELS with the reason.`,
    )
  }
}
for (const listed of [...AUDITED_MODEL_NAMES, ...Object.keys(EXCLUDED_MODELS)]) {
  if (!models.includes(listed)) errors.push(`audited-models.ts: ${listed} is not a model in prisma/schema.prisma`)
}

// 2. Routes -----------------------------------------------------------------
/**
 * Mutating routes that legitimately open no actor scope here, with the reason.
 * Keys are paths relative to src/app/api.
 */
export const ROUTES_WITHOUT_ACTOR: Readonly<Record<string, string>> = {
  'auth/[...nextauth]/route.ts': 'NextAuth handlers; sign-in only reads, sign-out writes an AuthEvent (not audited)',
}

/** Turn on once every route is migrated (MIC-I7-4). */
const ROUTE_RULE_ENABLED = false

const ACTOR_SCOPE_CALLS = /\b(withOwnerContext|withAdmin|runWithAuditActor|runAgentTool|runAgentUserTool|withAuditedRoute)\s*\(/
const MUTATING_EXPORT = /export\s+(const|async\s+function|function)\s+(POST|PUT|PATCH|DELETE)\b/

if (ROUTE_RULE_ENABLED) {
  const apiDir = path.join(ROOT, 'src/app/api')
  for (const file of walk(apiDir).filter((f) => /route\.tsx?$/.test(f))) {
    const source = readFileSync(file, 'utf8')
    if (!MUTATING_EXPORT.test(source)) continue
    const key = path.relative(apiDir, file).split(path.sep).join('/')
    if (key in ROUTES_WITHOUT_ACTOR) continue
    if (!ACTOR_SCOPE_CALLS.test(source)) {
      errors.push(
        `${rel(file)}: mutating route without an actor scope. Wrap the handler in withOwnerContext / withAdmin ` +
          `(or runWithAuditActor), or add it to ROUTES_WITHOUT_ACTOR with the reason.`,
      )
    }
  }
}

// 3. Raw writes outside a transaction ----------------------------------------
const RAW_ALLOWED = new Set(['src/lib/server/audit/prisma-audit-layer.ts'])
const isTransactionCallback = (node: ts.Node): boolean => {
  const call = node.parent
  return (
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
    !!call &&
    ts.isCallExpression(call) &&
    ts.isPropertyAccessExpression(call.expression) &&
    call.expression.name.text === '$transaction'
  )
}
const appFiles = walk(path.join(ROOT, 'src')).filter(
  (f) => /\.tsx?$/.test(f) && !isTest(f) && !RAW_ALLOWED.has(rel(f)),
)
for (const file of appFiles) {
  const text = readFileSync(file, 'utf8')
  if (!text.includes('$executeRaw')) continue
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const visit = (node: ts.Node) => {
    const target = ts.isTaggedTemplateExpression(node) ? node.tag : ts.isCallExpression(node) ? node.expression : null
    if (target && ts.isPropertyAccessExpression(target) && /^\$executeRaw(Unsafe)?$/.test(target.name.text)) {
      let p: ts.Node | undefined = node.parent
      let inside = false
      while (p) {
        if (isTransactionCallback(p)) {
          inside = true
          break
        }
        p = p.parent
      }
      if (!inside) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
        errors.push(`${rel(file)}:${line}: ${target.name.text} outside a $transaction callback (its rows would have no actor)`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}

// 4. Session-level actor setting --------------------------------------------
const SESSION_SET = [
  /set_config\(\s*'micasa\.audit_actor'[^;]*?,\s*false\s*\)/i,
  /\bSET\s+(SESSION\s+)?micasa\.audit_actor\b/i,
]
const settingFiles = [
  ...walk(path.join(ROOT, 'src')),
  ...walk(path.join(ROOT, 'scripts')).filter((f) => !f.includes(`${path.sep}spikes${path.sep}`)),
  ...walk(path.join(ROOT, 'prisma')).filter((f) => !f.includes(`${path.sep}migrations${path.sep}`)),
].filter((f) => /\.(ts|tsx|mjs|js|sql)$/.test(f) && rel(f) !== 'scripts/validate-audit-coverage.ts')
for (const file of settingFiles) {
  const text = readFileSync(file, 'utf8')
  if (!text.includes('micasa.audit_actor')) continue
  for (const re of SESSION_SET) {
    if (re.test(text)) {
      errors.push(`${rel(file)}: session-level micasa.audit_actor (use set_config(…, true) inside the transaction)`)
    }
  }
}

if (errors.length) {
  console.error(`validate:audit-coverage: ${errors.length} problem(s)\n`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}
console.log(
  `validate:audit-coverage: ok (${AUDITED_MODEL_NAMES.size} audited, ${Object.keys(EXCLUDED_MODELS).length} excluded` +
    `${ROUTE_RULE_ENABLED ? ', routes checked' : ''})`,
)
