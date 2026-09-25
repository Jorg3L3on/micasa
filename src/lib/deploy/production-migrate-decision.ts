/**
 * Pure decision for production Prisma migrations during the Vercel build.
 * The build script must call these helpers and must not reimplement the rules.
 *
 * `prisma migrate deploy` runs only when VERCEL_ENV is exactly `production`.
 * Preview, development, local, and GitHub CI skip it even if DATABASE_URL is set.
 */

export const VERCEL_PRODUCTION_ENV = 'production'

/** Direct/unpooled first. `DATABASE_URL` is the pooled fallback the app already uses. */
export const MIGRATION_DATABASE_URL_KEYS = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DIRECT_URL',
  'DATABASE_URL',
] as const

export type MigrationDatabaseUrlKey = (typeof MIGRATION_DATABASE_URL_KEYS)[number]

export type EnvLike = Readonly<Record<string, string | undefined>>

export type ResolvedMigrationDatabaseUrl = {
  key: MigrationDatabaseUrlKey
  value: string
}

export type ProductionMigratePlan =
  | { action: 'skip'; vercelEnvLabel: string }
  | { action: 'migrate'; urlKey: MigrationDatabaseUrlKey; pooled: boolean }
  | { action: 'fail'; reason: 'missing-database-url' }

const KNOWN_VERCEL_ENVS = new Set(['production', 'preview', 'development'])

export const shouldRunMigrateDeploy = (
  vercelEnv: string | undefined | null,
): boolean => vercelEnv === VERCEL_PRODUCTION_ENV

/** Log label only. Unexpected values are not echoed (they might not be an env name). */
export const formatVercelEnvForLog = (
  vercelEnv: string | undefined | null,
): string => {
  if (vercelEnv === undefined || vercelEnv === null) return 'unset'
  if (vercelEnv === '') return 'empty'
  if (KNOWN_VERCEL_ENVS.has(vercelEnv)) return vercelEnv
  return 'unexpected'
}

export const resolveMigrationDatabaseUrl = (
  env: EnvLike,
): ResolvedMigrationDatabaseUrl | null => {
  for (const key of MIGRATION_DATABASE_URL_KEYS) {
    const value = env[key]?.trim()
    if (value) return { key, value }
  }
  return null
}

/** Neon/Vercel pooler hosts and explicit PgBouncer URLs are a poor fit for DDL. */
export const isPooledDatabaseUrl = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname
    if (hostname.includes('-pooler')) return true
  } catch {
    // Non-URL strings still count when they opt into PgBouncer.
  }
  return /(?:^|[?&])pgbouncer=true(?:&|$)/i.test(url)
}

export const planProductionMigrate = (env: EnvLike): ProductionMigratePlan => {
  if (!shouldRunMigrateDeploy(env.VERCEL_ENV)) {
    return {
      action: 'skip',
      vercelEnvLabel: formatVercelEnvForLog(env.VERCEL_ENV),
    }
  }

  const resolved = resolveMigrationDatabaseUrl(env)
  if (!resolved) {
    return { action: 'fail', reason: 'missing-database-url' }
  }

  return {
    action: 'migrate',
    urlKey: resolved.key,
    pooled: isPooledDatabaseUrl(resolved.value),
  }
}
