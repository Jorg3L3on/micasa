import { PrismaClient } from '@/generated/prisma/client'
import { transformPrismaWriteArgs } from '@/lib/database-timestamps'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const LOCAL_TIMESTAMP_WRITES = Symbol.for('micasa.localTimestampWrites')
/** Bump when adding models so long-lived `npm run dev` drops a stale singleton. */
const PRISMA_CLIENT_GENERATION = 3

type TaggedPrismaClient = PrismaClient & {
  [LOCAL_TIMESTAMP_WRITES]?: true
}

function createBasePrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === 'production') {
    return new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) })
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter: new PrismaPg(pool) })
}

function createPrismaClient(): PrismaClient {
  const prisma = createBasePrismaClient().$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          return query(transformPrismaWriteArgs(args, operation) as typeof args)
        },
      },
    },
  }) as unknown as TaggedPrismaClient

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
      creditCardScheduledPayment?: { findMany?: unknown }
    }
  ).creditCardScheduledPayment
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
