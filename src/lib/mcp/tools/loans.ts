import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import {
  batchUpdateLoanPaymentsForOwner,
  createLoanForOwnerWithProgress,
  deleteLoanForOwner,
  getLoanByIdForOwner,
  listLoansByOwner,
  updateLoanPaymentForOwner,
  updateLoanScheduleForOwner,
} from '@/lib/finance/loan.service';
import { createLoanSchema, updateLoanPaymentSchema } from '@/schemas/loan.schema';
import {
  confirmSchema,
  ownerIdSchema,
  ownerTypeSchema,
  runAgentTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';
import { resolveWalletRef } from '@/lib/mcp/resolvers';

const ownerArgs = {
  ownerType: ownerTypeSchema,
  ownerId: ownerIdSchema,
};

const dateYmdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato requerido: YYYY-MM-DD');

export function registerLoanTools(server: McpServer) {
  server.registerTool(
    'list_loans',
    {
      title: 'Listar préstamos',
      description:
        'Préstamos del contexto con progreso y calendario de pagos. Pasa year y month (1-12) para ver solo las cuotas de ese mes (p. ej. "¿cuánto pago en diciembre?").',
      inputSchema: z.object({
        ownerType: ownerTypeSchema,
        ownerId: ownerIdSchema,
        year: z.number().int().min(2000).max(2100).optional(),
        month: z.number().int().min(1).max(12).optional(),
        includeInactive: z
          .boolean()
          .default(false)
          .describe('Incluir préstamos pagados, pausados o cancelados.'),
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool('list_loans', ctx as McpToolContext, args, 'read', async (agent) => {
        const loans = await listLoansByOwner(agent.ownerFilter);
        const visible = args.includeInactive
          ? loans
          : loans.filter((loan) => loan.status === 'ACTIVE');

        const monthPrefix =
          args.year != null && args.month != null
            ? `${args.year}-${String(args.month).padStart(2, '0')}`
            : null;

        let monthTotalDue = 0;

        const items = visible.map((loan) => {
          const payments = loan.payments ?? [];
          const monthPayments = monthPrefix
            ? payments.filter((p) => p.dueDate.startsWith(monthPrefix))
            : null;

          if (monthPayments) {
            monthTotalDue += monthPayments
              .filter((p) => p.status === 'SCHEDULED')
              .reduce((sum, p) => sum + p.amount, 0);
          }

          return {
            id: loan.id,
            name: loan.name,
            lender: loan.lender,
            type: loan.type,
            status: loan.status,
            frequency: loan.frequency,
            paymentSource: loan.paymentSource,
            paymentAmount: loan.paymentAmount,
            totalPayable: loan.totalPayable,
            paidAmount: loan.paidAmount,
            remainingAmount: loan.remainingAmount,
            paidPayments: loan.paidPayments,
            remainingPayments: loan.remainingPayments,
            nextPayment: loan.nextPayment,
            ...(monthPayments ? { monthPayments } : {}),
          };
        });

        return {
          loans: items,
          ...(monthPrefix
            ? { month: monthPrefix, monthScheduledTotal: monthTotalDue }
            : {}),
        };
      }),
  );

  server.registerTool(
    'get_loan',
    {
      title: 'Detalle de préstamo',
      description:
        'Detalle de un préstamo con calendario de cuotas. Opcional year/month filtra cuotas del mes.',
      inputSchema: z.object({
        ...ownerArgs,
        loan_id: z.number().int().positive(),
        year: z.number().int().min(2000).max(2100).optional(),
        month: z.number().int().min(1).max(12).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool('get_loan', ctx as McpToolContext, args, 'read', async (agent) => {
        const loan = await getLoanByIdForOwner(args.loan_id, agent.ownerFilter);
        const monthPrefix =
          args.year != null && args.month != null
            ? `${args.year}-${String(args.month).padStart(2, '0')}`
            : null;
        const payments = loan.payments ?? [];
        const monthPayments = monthPrefix
          ? payments.filter((p) => p.dueDate.startsWith(monthPrefix))
          : payments;

        return {
          loan: {
            id: loan.id,
            name: loan.name,
            lender: loan.lender,
            status: loan.status,
            paymentAmount: loan.paymentAmount,
            paymentCount: loan.paymentCount,
            paidPayments: loan.paidPayments,
            remainingPayments: loan.remainingPayments,
            nextPayment: loan.nextPayment,
          },
          calendar: monthPayments,
        };
      }),
  );

  server.registerTool(
    'create_loan',
    {
      title: 'Crear préstamo',
      description:
        'Alta de préstamo personal con calendario. paid_payments_count marca cuotas ya pagadas fuera de MiCasa (sin mover billeteras).',
      inputSchema: z.object({
        ...ownerArgs,
        name: z.string().trim().min(1),
        lender: z.string().trim().min(1).default('Prestamista'),
        payment_amount: z.number().positive(),
        payment_count: z.number().int().positive(),
        start_date: dateYmdSchema.describe('Fecha de la primera cuota pendiente.'),
        frequency: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY']).default('MONTHLY'),
        paid_payments_count: z.number().int().min(0).default(0),
        payment_source: z
          .enum(['WALLET', 'PAYROLL_DEDUCTION'])
          .default('PAYROLL_DEDUCTION'),
        source_wallet_id: z.number().int().positive().optional(),
        notes: z.string().trim().max(500).optional(),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (args, ctx) =>
      runAgentTool('create_loan', ctx as McpToolContext, args, 'write', async (agent) => {
        const loanType =
          args.payment_source === 'WALLET' ? 'PERSONAL' : 'PAYROLL';
        const parsed = createLoanSchema.parse({
          name: args.name,
          lender: args.lender,
          type: loanType,
          principalAmount: args.payment_amount * args.payment_count,
          paymentAmount: args.payment_amount,
          paymentCount: args.payment_count,
          frequency: args.frequency,
          startDate: args.start_date,
          paymentSource: args.payment_source,
          sourceWalletId: args.source_wallet_id ?? null,
          notes: args.notes ?? null,
        });

        const loan = await createLoanForOwnerWithProgress(
          agent.ownerType,
          agent.ownerId,
          agent.ownerFilter,
          { ...parsed, paidPaymentsCount: args.paid_payments_count },
        );

        return { loan_id: loan.id, name: loan.name, paidPayments: loan.paidPayments };
      }),
  );

  server.registerTool(
    'update_loan',
    {
      title: 'Actualizar préstamo',
      description:
        'Corrige nombre, montos, progreso o próxima fecha. No duplica cuotas pagadas.',
      inputSchema: z.object({
        ...ownerArgs,
        loan_id: z.number().int().positive(),
        name: z.string().trim().min(1).optional(),
        lender: z.string().trim().min(1).optional(),
        payment_amount: z.number().positive().optional(),
        payment_count: z.number().int().positive().optional(),
        next_payment_date: dateYmdSchema.optional(),
        status: z.enum(['ACTIVE', 'PAUSED', 'CANCELLED']).optional(),
        notes: z.string().trim().max(500).optional().nullable(),
      }),
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool('update_loan', ctx as McpToolContext, args, 'write', async (agent) => {
        const loan = await updateLoanScheduleForOwner(args.loan_id, agent.ownerFilter, {
          ...(args.name != null ? { name: args.name } : {}),
          ...(args.lender != null ? { lender: args.lender } : {}),
          ...(args.payment_amount != null ? { paymentAmount: args.payment_amount } : {}),
          ...(args.payment_count != null ? { paymentCount: args.payment_count } : {}),
          ...(args.next_payment_date != null
            ? { nextPaymentDate: args.next_payment_date }
            : {}),
          ...(args.status != null ? { status: args.status } : {}),
          ...(args.notes !== undefined ? { notes: args.notes } : {}),
        });
        return {
          loan_id: loan.id,
          name: loan.name,
          paidPayments: loan.paidPayments,
          remainingPayments: loan.remainingPayments,
        };
      }),
  );

  server.registerTool(
    'add_loan_payment',
    {
      title: 'Registrar acción sobre cuota de préstamo',
      description:
        'Marca cuota(s) de préstamo: MARK_PAID descuenta billetera origen; MARK_PAID_EXTERNAL solo bitácora; SKIP omite la cuota. Batch con payment_ids (solo MARK_PAID o MARK_PAID_EXTERNAL).',
      inputSchema: z
        .object({
          ...ownerArgs,
          payment_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe('Cuota individual (alternativa a payment_ids).'),
          payment_ids: z
            .array(z.number().int().positive())
            .min(1)
            .optional()
            .describe('Varias cuotas pendientes en lote.'),
          action: z
            .enum(['MARK_PAID', 'MARK_PAID_EXTERNAL', 'SKIP'])
            .default('MARK_PAID_EXTERNAL')
            .describe(
              'MARK_PAID = descuenta billetera; MARK_PAID_EXTERNAL = pagado fuera; SKIP = omitir cuota.',
            ),
          paid_at: dateYmdSchema.optional(),
          note: z.string().trim().max(500).optional(),
          source_wallet_id: z.number().int().positive().optional(),
          source_wallet_name: z
            .string()
            .trim()
            .min(1)
            .optional()
            .describe('Billetera origen (MARK_PAID).'),
        })
        .superRefine((data, ctxRef) => {
          if (data.payment_id == null && data.payment_ids == null) {
            ctxRef.addIssue({
              code: 'custom',
              message: 'Indica payment_id o payment_ids',
              path: ['payment_id'],
            });
          }
          if (data.payment_id != null && data.payment_ids != null) {
            ctxRef.addIssue({
              code: 'custom',
              message: 'Usa payment_id o payment_ids, no ambos',
              path: ['payment_ids'],
            });
          }
          if (data.action === 'SKIP' && data.payment_ids != null) {
            ctxRef.addIssue({
              code: 'custom',
              message: 'SKIP solo aplica a una cuota (payment_id)',
              path: ['action'],
            });
          }
          if (
            data.payment_ids != null &&
            data.action !== 'MARK_PAID' &&
            data.action !== 'MARK_PAID_EXTERNAL'
          ) {
            ctxRef.addIssue({
              code: 'custom',
              message: 'En lote solo MARK_PAID o MARK_PAID_EXTERNAL',
              path: ['action'],
            });
          }
          if (
            data.action === 'MARK_PAID' &&
            !data.source_wallet_id &&
            !data.source_wallet_name &&
            data.payment_ids == null
          ) {
            ctxRef.addIssue({
              code: 'custom',
              message: 'MARK_PAID requiere source_wallet_id o source_wallet_name',
              path: ['source_wallet_id'],
            });
          }
        }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (args, ctx) =>
      runAgentTool('add_loan_payment', ctx as McpToolContext, args, 'write', async (agent) => {
        let sourceWalletId = args.source_wallet_id;
        if (args.source_wallet_name && sourceWalletId == null) {
          sourceWalletId = (
            await resolveWalletRef(agent.ownerFilter, undefined, args.source_wallet_name)
          ).id;
        }

        if (args.payment_ids != null) {
          const payments = await batchUpdateLoanPaymentsForOwner(agent.ownerFilter, {
            paymentIds: args.payment_ids,
            action: args.action as 'MARK_PAID' | 'MARK_PAID_EXTERNAL',
            paidAt: args.paid_at,
            sourceWalletId: sourceWalletId ?? null,
            note: args.note ?? null,
          });
          return {
            batch: true,
            count: payments.length,
            payments: payments.map((payment) => ({
              payment_id: payment.id,
              loan_id: payment.loanId,
              status: payment.status,
            })),
          };
        }

        const input = updateLoanPaymentSchema.parse({
          action: args.action,
          paidAt: args.paid_at,
          sourceWalletId: sourceWalletId ?? null,
          note: args.note ?? null,
        });

        const payment = await updateLoanPaymentForOwner(
          args.payment_id!,
          agent.ownerFilter,
          input,
        );

        return {
          payment_id: payment.id,
          loan_id: payment.loanId,
          status: payment.status,
          action: args.action,
        };
      }),
  );

  server.registerTool(
    'delete_loan',
    {
      title: 'Eliminar préstamo',
      description: 'Elimina el préstamo y revierte movimientos generados. Requiere confirm: true.',
      inputSchema: z.object({
        ...ownerArgs,
        loan_id: z.number().int().positive(),
        confirm: confirmSchema,
      }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool('delete_loan', ctx as McpToolContext, args, 'write', async (agent) => {
        const result = await deleteLoanForOwner(args.loan_id, agent.ownerFilter);
        return { deleted: true, ...result };
      }),
  );
}
