import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import {
  batchUpdateLoanPaymentsForOwner,
  createLoanForOwnerWithProgress,
  getLoanByIdForOwner,
  listLoansByOwner,
  updateLoanPaymentForOwner,
  updateLoanScheduleForOwner,
} from '@/lib/finance/loan.service';
import {
  listLendersByOwner,
  payLenderForOwner,
} from '@/lib/finance/lender.service';
import type { LenderListItem } from '@/types/lenders';
import { createLoanSchema, updateLoanPaymentSchema } from '@/schemas/loan.schema';
import { defineOwnerTool } from '@/lib/mcp/define-tool';
import { McpToolError } from '@/lib/mcp/errors';
import { dateYmd, month, pagination, year } from '@/lib/mcp/schemas';
import { out, paginate } from '@/lib/mcp/shapes';
import { resolveWalletRef } from '@/lib/mcp/resolvers';

/** Cross-field rules of add_loan_payment (single vs batch, SKIP, wallet). */
const assertLoanPaymentArgs = (args: {
  payment_id?: number;
  payment_ids?: number[];
  action: 'MARK_PAID' | 'MARK_PAID_EXTERNAL' | 'SKIP';
  source_wallet_id?: number;
  source_wallet_name?: string;
}) => {
  if (args.payment_id == null && args.payment_ids == null) {
    throw new McpToolError('VALIDATION', 'Indica payment_id o payment_ids');
  }
  if (args.payment_id != null && args.payment_ids != null) {
    throw new McpToolError('VALIDATION', 'Usa payment_id o payment_ids, no ambos');
  }
  if (args.payment_ids != null && args.action === 'SKIP') {
    throw new McpToolError('VALIDATION', 'SKIP solo aplica a una cuota (payment_id)');
  }
  if (
    args.action === 'MARK_PAID' &&
    args.payment_ids == null &&
    args.source_wallet_id == null &&
    !args.source_wallet_name
  ) {
    throw new McpToolError(
      'VALIDATION',
      'MARK_PAID requiere source_wallet_id o source_wallet_name',
    );
  }
};

const activeLoanPayments = (
  loans: LenderListItem['loans'],
  pick: 'overduePayment' | 'nextPayment',
) =>
  loans
    .filter((loan) => loan.status === 'ACTIVE')
    .map((loan) => loan[pick])
    .filter((payment): payment is NonNullable<typeof payment> => payment != null);

/** MCP list_lenders row. Existing nextPayment* fields stay the pay window. */
export const mapLenderForMcpList = (lender: LenderListItem) => {
  const overdue = activeLoanPayments(lender.loans, 'overduePayment').sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );
  const upcoming = activeLoanPayments(lender.loans, 'nextPayment').sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );

  return {
    id: lender.id,
    name: lender.name,
    remainingPrincipal: lender.remainingPrincipal,
    activeContractCount: lender.activeContractCount,
    payrollOnly: lender.payrollOnly,
    nextPaymentAmount: lender.payWindow.amount,
    nextPaymentDate: lender.payWindow.commitmentDate,
    nextPaymentDateEnd: lender.payWindow.commitmentDateEnd,
    canPayAmount: lender.payWindow.amount,
    canPay: lender.payWindow.canPay,
    overduePaymentAmount: overdue.reduce((sum, payment) => sum + payment.amount, 0),
    overduePaymentDate: overdue[0]?.dueDate ?? null,
    upcomingPaymentAmount: upcoming.reduce((sum, payment) => sum + payment.amount, 0),
    upcomingPaymentDate: upcoming[0]?.dueDate ?? null,
    loans: lender.loans.map((loan) => ({
      id: loan.id,
      name: loan.name,
      status: loan.status,
      remainingAmount: loan.remainingAmount,
      paymentSource: loan.paymentSource,
    })),
  };
};

export function registerLoanTools(server: McpServer) {
  defineOwnerTool(server, {
    name: 'list_loans',
    title: 'Listar préstamos',
    description:
      'Préstamos del contexto con progreso, cuota vencida y próxima cuota. Con year y month agrega las cuotas de ese mes y su total (p. ej. "¿cuánto pago en diciembre?"); include_schedule agrega el calendario completo. Detalle de uno: get_loan.',
    scope: 'read',
    input: {
      year: year.optional().describe('Con month: cuotas de ese mes.'),
      month: month.optional().describe('Con year: cuotas de ese mes.'),
      include_inactive: z
        .boolean()
        .default(false)
        .describe('Incluir préstamos pagados, pausados o cancelados.'),
      include_schedule: z
        .boolean()
        .default(false)
        .describe('true = agrega el calendario completo de cuotas (payments) de cada préstamo.'),
      ...pagination,
    },
    output: {
      loans: out.list({
        id: z.number(),
        name: z.string(),
        status: z.string(),
        remaining_amount: out.money,
      }),
      month: z.string().optional(),
      month_scheduled_total: out.money.optional(),
      ...out.page,
    },
    run: async (agent, args) => {
      const loans = await listLoansByOwner(agent.ownerFilter);
      const visible = args.include_inactive
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
          lenderId: loan.lenderId,
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
          overduePayment: loan.overduePayment,
          nextPayment: loan.nextPayment,
          ...(monthPayments ? { monthPayments } : {}),
          ...(args.include_schedule ? { payments } : {}),
        };
      });

      return {
        ...paginate('loans', items, args),
        ...(monthPrefix
          ? { month: monthPrefix, month_scheduled_total: monthTotalDue }
          : {}),
      };
    },
  });

  defineOwnerTool(server, {
    name: 'list_lenders',
    title: 'Listar prestamistas',
    description:
      'Prestamistas con capital pendiente. nextPaymentAmount / canPayAmount = ventana de pago de pay_lender; overduePayment* = cuotas vencidas; upcomingPayment* = siguiente cuota sin pagar.',
    scope: 'read',
    input: { ...pagination },
    output: {
      lenders: out.list({
        id: z.number(),
        name: z.string(),
        remaining_principal: out.money,
        next_payment_amount: out.money,
      }),
      ...out.page,
    },
    run: async (agent, args) => {
      const lenders = await listLendersByOwner(agent.ownerFilter);
      return paginate('lenders', lenders.map(mapLenderForMcpList), args);
    },
  });

  defineOwnerTool(server, {
    name: 'pay_lender',
    title: 'Pagar prestamista',
    description:
      'Un desembolso que cubre la ventana de pago del prestamista (nómina no entra). exclude_payment_ids saca contratos del periodo; amount menor = pago parcial, mayor = abono a capital al final. Cuotas sueltas: add_loan_payment.',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: false },
    input: {
      lender_id: z.number().int().positive().describe('Id de list_lenders.'),
      mode: z.enum(['WALLET', 'EXTERNAL']).default('WALLET').describe('WALLET descuenta una billetera; EXTERNAL solo lo registra.'),
      paid_at: dateYmd.optional(),
      source_wallet_id: z.number().int().positive().optional().describe('WALLET: billetera que paga.'),
      wallet_name: z.string().trim().min(1).optional().describe('WALLET: nombre de la billetera (alternativa a source_wallet_id).'),
      exclude_payment_ids: z.array(z.number().int().positive()).optional().describe('Cuotas que quedan fuera de este pago.'),
      amount: z.number().positive().optional().describe('Default: la ventana completa.'),
      note: z.string().trim().max(500).optional().describe('Nota opcional.'),
    },
    run: async (agent, args) => {
      let sourceWalletId: number | null = null;
      if ((args.mode ?? 'WALLET') === 'WALLET') {
        const wallet = await resolveWalletRef(
          agent.ownerFilter,
          args.source_wallet_id,
          args.wallet_name,
        );
        sourceWalletId = wallet.id;
      }
      const result = await payLenderForOwner(args.lender_id, agent.ownerFilter, {
        mode: args.mode ?? 'WALLET',
        paidAt: args.paid_at,
        sourceWalletId,
        note: args.note ?? null,
        excludePaymentIds: args.exclude_payment_ids,
        amount: args.amount ?? null,
      });
      return {
        lender_id: result.lender.id,
        payment_id: result.payment.id,
        amount: result.payment.amount,
        mode: result.payment.mode,
        installmentCount: result.payment.installmentCount,
      };
    },
  });

  defineOwnerTool(server, {
    name: 'get_loan',
    title: 'Detalle de préstamo',
    description:
      'Detalle de un préstamo con su calendario de cuotas. year y month opcionales filtran las cuotas de ese mes.',
    scope: 'read',
    input: {
      loan_id: z.number().int().positive().describe('Préstamo, de list_loans.'),
      year: year.optional().describe('Con month: solo las cuotas de ese mes.'),
      month: month.optional().describe('Con year: solo las cuotas de ese mes.'),
    },
    output: {
      loan: out.row({ id: z.number(), name: z.string(), status: z.string() }),
      calendar: out.list({ id: z.number(), due_date: z.string(), amount: out.money, status: z.string() }),
    },
    run: async (agent, args) => {
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
          lenderId: loan.lenderId,
          status: loan.status,
          paymentAmount: loan.paymentAmount,
          paymentCount: loan.paymentCount,
          paidPayments: loan.paidPayments,
          remainingPayments: loan.remainingPayments,
          overduePayment: loan.overduePayment,
          nextPayment: loan.nextPayment,
        },
        calendar: monthPayments,
      };
    },
  });

  defineOwnerTool(server, {
    name: 'create_loan',
    title: 'Crear préstamo',
    description:
      'Alta de préstamo con calendario de cuotas. paid_payments_count marca cuotas ya pagadas fuera de MiCasa (sin mover billeteras).',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: false },
    input: {
      name: z.string().trim().min(1).describe('Nombre del préstamo.'),
      lender: z.string().trim().min(1).default('Prestamista').describe('Nombre del prestamista.'),
      payment_amount: z.number().positive().describe('Monto de cada cuota.'),
      payment_count: z.number().int().positive().describe('Total de cuotas.'),
      start_date: dateYmd.describe('Fecha de la primera cuota pendiente.'),
      frequency: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY']).default('MONTHLY').describe('Periodicidad de las cuotas.'),
      paid_payments_count: z.number().int().min(0).default(0).describe('Cuotas ya pagadas fuera de MiCasa.'),
      payment_source: z
        .enum(['WALLET', 'PAYROLL_DEDUCTION'])
        .default('PAYROLL_DEDUCTION').describe('WALLET = se paga desde una billetera; PAYROLL_DEDUCTION = por nómina.'),
      source_wallet_id: z.number().int().positive().optional().describe('WALLET: billetera que paga.'),
      notes: z.string().trim().max(500).optional().describe('Notas opcionales.'),
    },
    run: async (agent, args) => {
      const loanType = args.payment_source === 'WALLET' ? 'PERSONAL' : 'PAYROLL';
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
    },
  });

  defineOwnerTool(server, {
    name: 'update_loan',
    title: 'Actualizar préstamo',
    description:
      'Corrige nombre, prestamista, montos, número de cuotas, próxima fecha, estado o notas. No duplica cuotas pagadas. Para borrarlo usa delete con kind loan.',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: true },
    input: {
      loan_id: z.number().int().positive().describe('Préstamo, de list_loans.'),
      name: z.string().trim().min(1).optional().describe('Nuevo nombre.'),
      lender: z.string().trim().min(1).optional().describe('Nuevo prestamista.'),
      payment_amount: z.number().positive().optional().describe('Nuevo monto de cuota.'),
      payment_count: z.number().int().positive().optional().describe('Nuevo total de cuotas (no menor a las pagadas).'),
      next_payment_date: dateYmd.optional(),
      status: z.enum(['ACTIVE', 'PAUSED', 'CANCELLED']).optional().describe('ACTIVE, PAUSED o CANCELLED.'),
      notes: z.string().trim().max(500).optional().nullable().describe('null las borra.'),
    },
    run: async (agent, args) => {
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
    },
  });

  defineOwnerTool(server, {
    name: 'add_loan_payment',
    title: 'Registrar acción sobre cuota de préstamo',
    description:
      'Marca cuota(s) de préstamo: MARK_PAID descuenta la billetera origen, MARK_PAID_EXTERNAL solo deja bitácora, SKIP la omite. Lote con payment_ids (sin SKIP). Ventana completa de un prestamista: pay_lender.',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: false },
    input: {
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
      paid_at: dateYmd.optional(),
      note: z.string().trim().max(500).optional().describe('Nota opcional.'),
      source_wallet_id: z.number().int().positive().optional().describe('MARK_PAID: billetera que paga.'),
      source_wallet_name: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe('Billetera origen (MARK_PAID).'),
    },
    run: async (agent, args) => {
      assertLoanPaymentArgs(args);

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
    },
  });
}
