import { describe, expect, it } from 'vitest'
import {
  formatVercelEnvForLog,
  isPooledDatabaseUrl,
  planProductionMigrate,
  resolveMigrationDatabaseUrl,
  shouldRunMigrateDeploy,
} from '@/lib/deploy/production-migrate-decision'

const DIRECT = 'postgresql://app:secret@db.invalid:5432/app'
const POOLED = 'postgresql://app:secret@db-pooler.invalid:5432/app'

describe('shouldRunMigrateDeploy', () => {
  it('migrates only when VERCEL_ENV is exactly production', () => {
    expect(shouldRunMigrateDeploy('production')).toBe(true)
  })

  it.each([
    'preview',
    'development',
    '',
    undefined,
    null,
    'Production',
    'production ',
    ' production',
  ])('does not migrate when VERCEL_ENV is %j', (vercelEnv) => {
    expect(shouldRunMigrateDeploy(vercelEnv)).toBe(false)
  })
})

describe('planProductionMigrate', () => {
  it('skips preview, development, empty, and unset even when a database URL is set', () => {
    for (const vercelEnv of ['preview', 'development', '', undefined] as const) {
      const plan = planProductionMigrate({
        VERCEL_ENV: vercelEnv,
        DATABASE_URL: DIRECT,
      })
      expect(plan.action).toBe('skip')
    }
  })

  it('migrates in production and prefers a direct URL over DATABASE_URL', () => {
    expect(
      planProductionMigrate({
        VERCEL_ENV: 'production',
        DATABASE_URL: POOLED,
        DATABASE_URL_UNPOOLED: DIRECT,
      }),
    ).toEqual({
      action: 'migrate',
      urlKey: 'DATABASE_URL_UNPOOLED',
      pooled: false,
    })
  })

  it('falls back to DATABASE_URL and flags a pooled connection', () => {
    expect(
      planProductionMigrate({
        VERCEL_ENV: 'production',
        DATABASE_URL: POOLED,
      }),
    ).toEqual({
      action: 'migrate',
      urlKey: 'DATABASE_URL',
      pooled: true,
    })
  })

  it('fails closed in production when no database URL is set', () => {
    expect(
      planProductionMigrate({
        VERCEL_ENV: 'production',
        DATABASE_URL: '   ',
        DATABASE_URL_UNPOOLED: '',
      }),
    ).toEqual({ action: 'fail', reason: 'missing-database-url' })
  })
})

describe('resolveMigrationDatabaseUrl', () => {
  it('uses the first non-blank key in direct-then-pooled order', () => {
    expect(
      resolveMigrationDatabaseUrl({
        DATABASE_URL_UNPOOLED: '  ',
        POSTGRES_URL_NON_POOLING: DIRECT,
        DIRECT_URL: 'postgresql://app:secret@other.invalid:5432/app',
        DATABASE_URL: POOLED,
      }),
    ).toEqual({ key: 'POSTGRES_URL_NON_POOLING', value: DIRECT })
  })

  it('returns null when every candidate is missing or blank', () => {
    expect(resolveMigrationDatabaseUrl({})).toBeNull()
    expect(resolveMigrationDatabaseUrl({ DATABASE_URL: '  ' })).toBeNull()
  })
})

describe('isPooledDatabaseUrl', () => {
  it('detects a pooler host and pgbouncer=true without treating a direct URL as pooled', () => {
    expect(isPooledDatabaseUrl(POOLED)).toBe(true)
    expect(isPooledDatabaseUrl(`${DIRECT}?pgbouncer=true`)).toBe(true)
    expect(isPooledDatabaseUrl(DIRECT)).toBe(false)
    expect(isPooledDatabaseUrl('not a url')).toBe(false)
  })
})

describe('formatVercelEnvForLog', () => {
  it('labels known values and hides anything else', () => {
    expect(formatVercelEnvForLog(undefined)).toBe('unset')
    expect(formatVercelEnvForLog(null)).toBe('unset')
    expect(formatVercelEnvForLog('')).toBe('empty')
    expect(formatVercelEnvForLog('preview')).toBe('preview')
    expect(formatVercelEnvForLog('postgresql://app:secret@db.invalid/app')).toBe(
      'unexpected',
    )
  })
})
