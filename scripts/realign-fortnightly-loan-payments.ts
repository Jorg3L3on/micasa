/**
 * Realigns SCHEDULED due dates for FORTNIGHTLY loans to calendar-quincena anchors.
 * PAID, SKIPPED, and CANCELLED installments are left unchanged.
 */
import { formatCalendarDate } from '../src/lib/calendar-dates';
import { generateLoanPaymentSchedule } from '../src/lib/finance/loan-schedule';
import prisma from '../src/lib/prisma';

async function main() {
  const loans = await prisma.loan.findMany({
    where: {
      frequency: 'FORTNIGHTLY',
      status: { in: ['ACTIVE', 'PAUSED', 'PAID_OFF'] },
    },
    include: {
      payments: {
        orderBy: { sequence: 'asc' },
      },
    },
  });

  if (loans.length === 0) {
    console.log('No fortnightly loans found.');
    return;
  }

  let loansUpdated = 0;
  let paymentsUpdated = 0;

  for (const loan of loans) {
    const schedule = generateLoanPaymentSchedule({
      startDate: loan.start_date,
      paymentAmount: Number(loan.payment_amount),
      paymentCount: loan.payment_count,
      frequency: 'FORTNIGHTLY',
    });
    const scheduleBySequence = new Map(
      schedule.map((payment) => [payment.sequence, payment.dueDate]),
    );

    let loanChanged = false;

    for (const payment of loan.payments) {
      if (payment.status !== 'SCHEDULED') continue;

      const nextDueDate = scheduleBySequence.get(payment.sequence);
      if (!nextDueDate) continue;

      const currentYmd = formatCalendarDate(payment.due_date);
      const nextYmd = formatCalendarDate(nextDueDate);
      if (currentYmd === nextYmd) continue;

      await prisma.loanPayment.update({
        where: { id: payment.id },
        data: { due_date: nextDueDate },
      });

      loanChanged = true;
      paymentsUpdated += 1;
      console.log(
        `  loan ${loan.id} (${loan.name}) payment #${payment.sequence}: ${currentYmd} -> ${nextYmd}`,
      );
    }

    if (loanChanged) loansUpdated += 1;
  }

  console.log(
    `\nUpdated ${paymentsUpdated} scheduled payment(s) across ${loansUpdated} loan(s).`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
