import { describe, expect, it } from 'vitest'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  DATE_ONLY_FIELDS,
  dateOnlyFieldNames,
  dateOnlyFieldNamesFromSchema,
  toDatabaseTimestamp,
  transformPrismaReadResult,
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

  it('keeps DATE_ONLY_FIELDS equal to every @db.Date column and does not shift them', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    const fromSchema = dateOnlyFieldNamesFromSchema(schema)
    expect(DATE_ONLY_FIELDS).toEqual(fromSchema)
    expect(dateOnlyFieldNames()).toBe(DATE_ONLY_FIELDS)

    const anchor = new Date('2026-09-12T00:00:00.000Z')
    const createdAt = new Date('2026-06-04T06:46:25.681Z')
    const args = transformPrismaWriteArgs(
      {
        data: {
          anchor_statement_end: anchor,
          valid_until: anchor,
          created_at: createdAt,
        },
      },
      'create',
      'CreditCardPaymentPlan',
    ) as {
      data: {
        anchor_statement_end: Date
        valid_until: Date
        created_at: Date
      }
    }

    expect(args.data.anchor_statement_end.toISOString()).toBe('2026-09-12T00:00:00.000Z')
    expect(args.data.valid_until.toISOString()).toBe('2026-09-12T00:00:00.000Z')
    expect(args.data.created_at.toISOString()).toBe('2026-06-04T00:46:25.681Z')
  })

  it('preserves LoanPayment due_date and still shifts other due_date timestamps', () => {
    const civilDay = new Date('2026-09-01T00:00:00.000Z')
    const noon = new Date('2026-09-01T12:00:00.000Z')

    const loanArgs = transformPrismaWriteArgs(
      {
        data: {
          payments: {
            create: [{ due_date: civilDay }],
          },
        },
      },
      'create',
      'Loan',
    ) as { data: { payments: { create: Array<{ due_date: Date }> } } }

    const cardArgs = transformPrismaWriteArgs(
      { data: { due_date: noon } },
      'create',
      'CreditCardScheduledPayment',
    ) as { data: { due_date: Date } }

    expect(loanArgs.data.payments.create[0]!.due_date.toISOString()).toBe(
      '2026-09-01T00:00:00.000Z',
    )
    expect(cardArgs.data.due_date.toISOString()).toBe('2026-09-01T06:00:00.000Z')
  })

  it('normalizes LoanPayment due_date on read and leaves card due_date alone', () => {
    const read = transformPrismaReadResult(
      {
        payments: [{ due_date: new Date('2026-09-01T06:00:00.000Z') }],
      },
      'findMany',
      'Loan',
    ) as { payments: Array<{ due_date: Date }> }
    const card = transformPrismaReadResult(
      { due_date: new Date('2026-09-01T06:00:00.000Z') },
      'findMany',
      'CreditCardScheduledPayment',
    ) as { due_date: Date }

    expect(read.payments[0]!.due_date.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(card.due_date.toISOString()).toBe('2026-09-01T06:00:00.000Z')
  })

  it('reads DATE columns back on the same UTC civil day', () => {
    const read = transformPrismaReadResult(
      {
        anchor_statement_end: new Date('2026-09-12T00:00:00.000Z'),
        valid_until: new Date('2026-10-20T06:00:00.000Z'),
        created_at: new Date('2026-06-04T06:46:25.681Z'),
      },
      'findMany',
    ) as {
      anchor_statement_end: Date
      valid_until: Date
      created_at: Date
    }

    expect(read.anchor_statement_end.toISOString()).toBe('2026-09-12T00:00:00.000Z')
    expect(read.valid_until.toISOString()).toBe('2026-10-20T00:00:00.000Z')
    expect(read.created_at.toISOString()).toBe('2026-06-04T06:46:25.681Z')
  })
})
