/**
 * Vercel production build: migrate, then generate the client, then `next build`.
 *
 * Migrations run only when VERCEL_ENV is exactly `production`. Preview,
 * development, GitHub Actions, and local `npm run build` skip them.
 * A failed migrate exits non-zero so Vercel does not promote the deployment.
 */
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  planProductionMigrate,
  type EnvLike,
} from '../src/lib/deploy/production-migrate-decision'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const prismaBin = join(root, 'node_modules', '.bin', 'prisma')
const nextBin = join(root, 'node_modules', '.bin', 'next')

const log = (message: string) => {
  console.log(`[vercel-build] ${message}`)
}

const run = (
  bin: string,
  args: readonly string[],
  extraEnv?: Record<string, string>,
) => {
  const result = spawnSync(bin, args, {
    cwd: root,
    stdio: 'inherit',
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
  })

  if (result.error) {
    console.error(`[vercel-build] Failed to start ${bin}: ${result.error.message}`)
    process.exit(1)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

export const runVercelBuild = (env: EnvLike = process.env) => {
  const plan = planProductionMigrate(env)

  if (plan.action === 'skip') {
    log(
      `Skipping prisma migrate deploy (VERCEL_ENV=${plan.vercelEnvLabel}). Migrations run only when VERCEL_ENV is exactly "production".`,
    )
  } else if (plan.action === 'fail') {
    console.error(
      '[vercel-build] VERCEL_ENV=production but no database URL is set. Expected DATABASE_URL_UNPOOLED, POSTGRES_URL_NON_POOLING, DIRECT_URL, or DATABASE_URL. Aborting before next build.',
    )
    process.exit(1)
  } else {
    const url = env[plan.urlKey]?.trim()
    if (!url) {
      console.error(
        '[vercel-build] Migration URL was empty at execution time. Aborting before next build.',
      )
      process.exit(1)
    }

    if (plan.pooled) {
      console.warn(
        `[vercel-build] Connection from ${plan.urlKey} looks pooled (hostname contains "-pooler" or pgbouncer=true). Prefer DATABASE_URL_UNPOOLED, POSTGRES_URL_NON_POOLING, or DIRECT_URL for migrations.`,
      )
    }

    log(`Running prisma migrate deploy (connection env: ${plan.urlKey}).`)
    run(prismaBin, ['migrate', 'deploy'], { DATABASE_URL: url })
  }

  log('Running prisma generate.')
  run(prismaBin, ['generate'])

  log('Running next build.')
  run(nextBin, ['build'])
}

const isDirectRun = process.argv[1]
  ? resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
  : false

if (isDirectRun) {
  runVercelBuild()
}
