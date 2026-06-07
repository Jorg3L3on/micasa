import { PrismaClient } from '@/generated/prisma/client'
import { transformPrismaWriteArgs } from '@/lib/database-timestamps'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const LOCAL_TIMESTAMP_WRITES = Symbol.for('micasa.localTimestampWrites')

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

const globalForPrisma = globalThis as unknown as {
  prisma: TaggedPrismaClient | undefined
}

const prisma = globalForPrisma.prisma?.[LOCAL_TIMESTAMP_WRITES]
  ? globalForPrisma.prisma
  : createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
