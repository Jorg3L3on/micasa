import prisma from '@/lib/prisma';
import { PaymentMethodType } from '@/generated/prisma/client';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { Prisma } from '@/generated/prisma/client';

export const fetchFortnightsCurrent = async (
  where: Prisma.FortnightWhereInput,
) =>
  prisma.fortnight.findMany({
    where,
    select: {
      id: true,
      start_date: true,
      end_date: true,
      month: true,
      year: true,
      period: true,
    },
  });

export const fetchFortnightsPrev = async (where: Prisma.FortnightWhereInput) =>
  prisma.fortnight.findMany({
    where,
    select: { id: true, start_date: true, end_date: true },
  });

export const fetchExpensesCurrent = async (
  where: Prisma.ExpenseWhereInput,
) =>
  prisma.expense.findMany({
    where,
    include: {
      category: { select: { name: true, icon: true } },
      expense_template: { select: { is_recurring: true } },
    },
  });

export const fetchIncomeCurrent = async (
  ownerFilter: OwnerFilter,
  fortnightIds: number[],
) =>
  prisma.income.findMany({
    where: {
      ...ownerFilter,
      fortnight_id: { in: fortnightIds },
    },
    include: { user: { select: { id: true, name: true } } },
  });

export const fetchExpensesPrev = async (where: Prisma.ExpenseWhereInput) =>
  prisma.expense.findMany({
    where,
    select: { amount: true, is_paid: true },
  });

export const fetchIncomePrev = async (
  ownerFilter: OwnerFilter,
  fortnightIds: number[],
) =>
  prisma.income.findMany({
    where: {
      ...ownerFilter,
      fortnight_id: { in: fortnightIds },
    },
    select: { amount: true },
  });

export const fetchUpcomingExpenses = async (where: Prisma.ExpenseWhereInput) =>
  prisma.expense.findMany({
    where,
    include: {
      fortnight: {
        select: {
          start_date: true,
          end_date: true,
          month: true,
          year: true,
        },
      },
      category: { select: { name: true, icon: true } },
    },
    orderBy: { created_at: 'desc' },
  });

export const fetchIncomeWithUser = async (
  ownerFilter: OwnerFilter,
  fortnightIds: number[],
) =>
  prisma.income.findMany({
    where: {
      ...ownerFilter,
      fortnight_id: { in: fortnightIds },
    },
    include: { user: { select: { id: true, name: true } } },
  });

export const fetchDashboardWalletSnapshot = async (ownerFilter: OwnerFilter) =>
  prisma.wallet.findMany({
    where: {
      ...ownerFilter,
      active: true,
      type: {
        in: [
          PaymentMethodType.CASH,
          PaymentMethodType.DEBIT_CARD,
          PaymentMethodType.CREDIT_CARD,
          PaymentMethodType.DEPARTMENT_STORE_CARD,
        ],
      },
    },
    select: {
      amount: true,
      credit_limit: true,
      temporary_credit_limit: true,
      type: true,
    },
  });

export const fetchRecentExpenses = async (ownerFilter: OwnerFilter) =>
  prisma.expense.findMany({
    where: ownerFilter,
    take: 10,
    orderBy: { created_at: 'desc' },
    include: {
      category: { select: { name: true, icon: true } },
      fortnight: { select: { label: true, month: true, year: true } },
    },
  });

export const fetchRecentIncomes = async (ownerFilter: OwnerFilter) =>
  prisma.income.findMany({
    where: { ...ownerFilter, source: { not: '__OVERRIDE__' } },
    take: 10,
    orderBy: { created_at: 'desc' },
    include: {
      user: { select: { name: true } },
      fortnight: { select: { label: true } },
    },
  });

export const fetchRecentLoanPayments = async (ownerFilter: OwnerFilter) =>
  prisma.loanPayment.findMany({
    where: {
      status: 'PAID',
      paid_at: { not: null },
      loan: ownerFilter,
    },
    take: 10,
    orderBy: { updated_at: 'desc' },
    include: {
      loan: { select: { name: true, lender: true } },
    },
  });
