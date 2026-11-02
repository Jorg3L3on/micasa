import { PrismaClient } from '@/generated/prisma/client'
import {
  transformPrismaReadResult,
  transformPrismaWriteArgs,
} from '@/lib/database-timestamps'
import { withAuditLayer } from '@/lib/server/audit/prisma-audit-layer'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const LOCAL_TIMESTAMP_WRITES = Symbol.for('micasa.localTimestampWrites')
/** Bump when adding models so long-lived `npm run dev` drops a stale singleton. */
const PRISMA_CLIENT_GENERATION = 7

/**
 * Every audited write runs in its own transaction (see prisma-audit-layer.ts),
 * so a burst of writes queues for pool connections; 10s instead of Prisma's 2s.
 */
const transactionOptions = { maxWait: 10_000 }

type TaggedPrismaClient = PrismaClient & {
  [LOCAL_TIMESTAMP_WRITES]?: true
}

function createBasePrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === 'production') {
    return new PrismaClient({
      adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
      transactionOptions,
    })
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter: new PrismaPg(pool), transactionOptions })
}

function createPrismaClient(): PrismaClient {
  const extended = createBasePrismaClient().$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(
            transformPrismaWriteArgs(args, operation, model) as typeof args,
          )
          return transformPrismaReadResult(result, operation, model)
        },
      },
    },
  })
  // Audit: every audited write runs in a transaction that sets the actor.
  const prisma = withAuditLayer(extended) as unknown as TaggedPrismaClient

  prisma[LOCAL_TIMESTAMP_WRITES] = true
  return prisma
}

function isCurrentPrismaClient(
  client: TaggedPrismaClient | undefined,
): client is TaggedPrismaClient {
  if (!client?.[LOCAL_TIMESTAMP_WRITES]) return false
  // Guard against HMR keeping a client generated before a new model existed.
  const delegate = (
    client as TaggedPrismaClient & {
      lender?: { findMany?: unknown }
    }
  ).lender
  return typeof delegate?.findMany === 'function'
}

const globalForPrisma = globalThis as unknown as {
  prisma: TaggedPrismaClient | undefined
  prismaGeneration?: number
}

const prisma =
  isCurrentPrismaClient(globalForPrisma.prisma) &&
  globalForPrisma.prismaGeneration === PRISMA_CLIENT_GENERATION
    ? globalForPrisma.prisma
    : createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaGeneration = PRISMA_CLIENT_GENERATION
}

export default prisma
