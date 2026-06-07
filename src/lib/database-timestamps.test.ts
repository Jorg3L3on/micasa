import { describe, expect, it } from 'vitest'

import {
  toDatabaseTimestamp,
  transformPrismaWriteArgs,
  transformWriteDates,
} from '@/lib/database-timestamps'

describe('database timestamp conversion', () => {
  it('encodes an instant as Mexico City wall time for timestamp columns', () => {
    const currentInstant = new Date('2026-06-04T06:46:25.681Z')

    expect(toDatabaseTimestamp(currentInstant).toISOString()).toBe(
      '2026-06-04T00:46:25.681Z',
    )
  })

  it('preserves calendar date writes on the same civil day', () => {
    const calendarNoon = new Date('2026-06-04T12:00:00.000Z')

    expect(toDatabaseTimestamp(calendarNoon).toISOString()).toBe(
      '2026-06-04T06:00:00.000Z',
    )
  })

  it('converts nested Date values in write data', () => {
    const value = new Date('2026-06-04T06:46:25.681Z')
    const paymentDate = new Date('2026-06-04T12:00:00.000Z')

    expect(
      transformWriteDates({
        created_at: value,
        payment_date: paymentDate,
        lines: [{ paid_at: value }],
      }),
    ).toEqual({
      created_at: new Date('2026-06-04T00:46:25.681Z'),
      payment_date: paymentDate,
      lines: [{ paid_at: new Date('2026-06-04T00:46:25.681Z') }],
    })
  })

  it('only transforms Prisma write payloads, not where filters', () => {
    const value = new Date('2026-06-04T06:46:25.681Z')

    const args = transformPrismaWriteArgs(
      {
        where: { created_at: value },
        data: {
          paid_at: value,
          nested: {
            updateMany: {
              where: { created_at: value },
              data: { paid_at: value },
            },
          },
        },
      },
      'update',
    ) as {
      where: { created_at: Date }
      data: {
        paid_at: Date
        nested: {
          updateMany: {
            where: { created_at: Date }
            data: { paid_at: Date }
          }
        }
      }
    }

    expect(args.where.created_at).toBe(value)
    expect(args.data.paid_at.toISOString()).toBe('2026-06-04T00:46:25.681Z')
    expect(args.data.nested.updateMany.where.created_at).toBe(value)
    expect(args.data.nested.updateMany.data.paid_at.toISOString()).toBe(
      '2026-06-04T00:46:25.681Z',
    )
  })
})
