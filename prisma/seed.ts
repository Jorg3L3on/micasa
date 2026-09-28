import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  PaymentMethodType,
  FortnightPeriod,
  HouseRole,
} from '@/generated/prisma/client';
import { hash } from 'bcryptjs';
import {
  addCalendarDays,
  formatCalendarDate,
  parseCalendarDate,
  todayCalendarDate,
} from '@/lib/calendar-dates';
import { getCanonicalFortnightBounds } from '@/lib/finance/budget-period-windows';
import { getCurrentCalendarFortnightRef } from '@/lib/fortnight-calendar';
import { generateLoanPaymentSchedule } from '@/lib/finance/loan-schedule';
import { seedDefaultCategoriesForOwner } from '@/lib/finance/category-seed.service';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function requireCategory(
  owner: { user_id: number } | { house_id: number },
  name: string,
) {
  const category = await prisma.category.findFirst({
    where: { ...owner, name },
  });
  if (!category) {
    throw new Error(`Seed category not found: ${name}`);
  }
  return category;
}

async function main() {
  /**
   * CLEAN DATABASE (order respects FK constraints)
   * Seeded users share SEED_PASSWORD, or the placeholder demo-password.
   */
  await prisma.creditCardStatementImport.deleteMany();
  await prisma.creditCardPayment.deleteMany();
  await prisma.budgetPeriod.deleteMany();
  await prisma.budgetAllocation.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.income.deleteMany();
  await prisma.lenderPayment.deleteMany();
  await prisma.loanPayment.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.lender.deleteMany();
  await prisma.expenseTemplate.deleteMany();
  await prisma.incomeTemplate.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.category.deleteMany();
  await prisma.fortnight.deleteMany();
  await prisma.houseMember.deleteMany();
  await prisma.house.deleteMany();
  await prisma.user.deleteMany();

  // ─────────────────────────────────────────────
  // USERS
  // ─────────────────────────────────────────────
  const seedPassword = process.env.SEED_PASSWORD?.trim() || 'demo-password';
  const password = await hash(seedPassword, 10);

  const ana = await prisma.user.create({
    data: { name: 'Ana Demo', email: 'ana@example.com', password, onboarding_completed: true },
  });
  const luis = await prisma.user.create({
    data: { name: 'Luis Demo', email: 'luis@example.com', password, onboarding_completed: true },
  });

  // ─────────────────────────────────────────────
  // HOUSES
  // ─────────────────────────────────────────────
  const casaDemo = await prisma.house.create({
    data: { name: 'Hogar', owner_id: ana.id },
  });
  const casaNorte = await prisma.house.create({
    data: { name: 'Casa Norte', owner_id: luis.id },
  });

  await prisma.houseMember.createMany({
    data: [
      { house_id: casaDemo.id, user_id: ana.id, role: HouseRole.OWNER },
      { house_id: casaNorte.id,     user_id: luis.id,  role: HouseRole.OWNER },
      { house_id: casaDemo.id, user_id: luis.id,  role: HouseRole.MEMBER },
    ],
  });

  // ─────────────────────────────────────────────
  // CATEGORIES (default catalog cloned per owner)
  // ─────────────────────────────────────────────
  await seedDefaultCategoriesForOwner(prisma, { userId: ana.id });
  await seedDefaultCategoriesForOwner(prisma, { userId: luis.id });
  await seedDefaultCategoriesForOwner(prisma, { houseId: casaDemo.id });
  await seedDefaultCategoriesForOwner(prisma, { houseId: casaNorte.id });

  const catAnaVivienda = await requireCategory({ user_id: ana.id }, 'Vivienda');
  const catAnaSalario = await requireCategory({ user_id: ana.id }, 'Salario');
  const catLuisTransporte = await requireCategory({ user_id: luis.id }, 'Transporte');
  const catLuisIngreso = await requireCategory({ user_id: luis.id }, 'Otro ingreso');
  const catCasa = await requireCategory({ house_id: casaDemo.id }, 'Vivienda');
  const catComidaHouse = await requireCategory({ house_id: casaDemo.id }, 'Comida');
  const catServiciosHouse = await requireCategory(
    { house_id: casaDemo.id },
    'Servicios y suscripciones',
  );
  const catSalarioHouse = await requireCategory({ house_id: casaDemo.id }, 'Salario');

  // ─────────────────────────────────────────────
  // WALLETS
  // Five cards with invented cut/pay days, split across people and both houses.
  // Ana holds one card, Luis holds one, Hogar holds three. Casa Norte is cash-only.
  // ─────────────────────────────────────────────
  const walletAnaEfectivo = await prisma.wallet.create({
    data: { name: 'Efectivo', type: PaymentMethodType.CASH, amount: 800, user_id: ana.id },
  });
  const walletAnaDebito = await prisma.wallet.create({
    data: { name: 'Débito nómina', type: PaymentMethodType.DEBIT_CARD, amount: 12000, user_id: ana.id },
  });
  const walletAnaCredito = await prisma.wallet.create({
    data: {
      name: 'Crédito A',
      type: PaymentMethodType.CREDIT_CARD,
      amount: 2200,
      cutoff_day: 6,
      due_day: 21,
      credit_limit: 9000,
      user_id: ana.id,
    },
  });

  const walletLuisDebito = await prisma.wallet.create({
    data: { name: 'Débito ahorro', type: PaymentMethodType.DEBIT_CARD, amount: 6500, user_id: luis.id },
  });
  const walletLuisTienda = await prisma.wallet.create({
    data: {
      name: 'Tienda departamental',
      type: PaymentMethodType.DEPARTMENT_STORE_CARD,
      amount: 800,
      cutoff_day: 19,
      due_day: 9,
      credit_limit: 5000,
      user_id: luis.id,
    },
  });

  const walletCasaDebito = await prisma.wallet.create({
    data: { name: 'Débito casa', type: PaymentMethodType.DEBIT_CARD, amount: 22000, house_id: casaDemo.id },
  });
  const walletCasaEfectivo = await prisma.wallet.create({
    data: { name: 'Efectivo', type: PaymentMethodType.CASH, amount: 1500, house_id: casaDemo.id },
  });
  const walletCasaCredito = await prisma.wallet.create({
    data: {
      name: 'Tarjeta del hogar',
      type: PaymentMethodType.CREDIT_CARD,
      amount: 4800,
      cutoff_day: 12,
      due_day: 27,
      credit_limit: 20000,
      minimum_payment: 850,
      apr_annual: 0.36,
      cat_annual: 0.48,
      house_id: casaDemo.id,
    },
  });
  const walletCasaDigital = await prisma.wallet.create({
    data: {
      name: 'Tarjeta digital',
      type: PaymentMethodType.CREDIT_CARD,
      amount: 600,
      cutoff_day: 11,
      due_day: 26,
      credit_limit: 4000,
      minimum_payment: 180,
      apr_annual: 0.42,
      cat_annual: 0.55,
      house_id: casaDemo.id,
    },
  });
  await prisma.wallet.create({
    data: {
      name: 'Tienda del hogar',
      type: PaymentMethodType.DEPARTMENT_STORE_CARD,
      amount: 1500,
      cutoff_day: 27,
      due_day: 14,
      credit_limit: 7000,
      minimum_payment: 300,
      apr_annual: 0.48,
      cat_annual: 0.62,
      house_id: casaDemo.id,
    },
  });

  await prisma.wallet.create({
    data: { name: 'Débito reserva', type: PaymentMethodType.DEBIT_CARD, amount: 3000, house_id: casaNorte.id },
  });

  // ─────────────────────────────────────────────
  // INCOME TEMPLATES
  // One personal salary, one personal side income, one house contribution.
  // ─────────────────────────────────────────────
  const itNominaAna = await prisma.incomeTemplate.create({
    data: {
      name: 'Nómina',
      suggested_amount: 8500,
      source: 'Salario',
      applies_first_fortnight: true,
      applies_second_fortnight: true,
      active: true,
      user_id: ana.id,
      category_id: catAnaSalario.id,
      wallet_id: walletAnaDebito.id,
    },
  });
  const itHonorariosLuis = await prisma.incomeTemplate.create({
    data: {
      name: 'Honorarios',
      suggested_amount: 4000,
      source: 'Otro ingreso',
      applies_first_fortnight: true,
      applies_second_fortnight: false,
      active: true,
      user_id: luis.id,
      category_id: catLuisIngreso.id,
      wallet_id: walletLuisDebito.id,
    },
  });
  const itAportacion = await prisma.incomeTemplate.create({
    data: {
      name: 'Aportación',
      suggested_amount: 18500,
      source: 'Salario',
      applies_first_fortnight: true,
      applies_second_fortnight: true,
      active: true,
      house_id: casaDemo.id,
      category_id: catSalarioHouse.id,
      wallet_id: walletCasaDebito.id,
    },
  });

  // ─────────────────────────────────────────────
  // EXPENSE TEMPLATES
  // Short recurring set. Loan payments live on Loan rows, not as a template pair.
  // ─────────────────────────────────────────────
  const etAnaRenta = await prisma.expenseTemplate.create({
    data: {
      name: 'Renta',
      suggested_amount: 7200,
      is_recurring: true,
      applies_first_fortnight: true,
      applies_second_fortnight: false,
      due_day: 6,
      due_day_first_fortnight: 6,
      category_id: catAnaVivienda.id,
      wallet_id: walletAnaDebito.id,
      user_id: ana.id,
    },
  });
  const etAnaInternet = await prisma.expenseTemplate.create({
    data: {
      name: 'Internet',
      suggested_amount: 480,
      is_recurring: true,
      applies_first_fortnight: true,
      applies_second_fortnight: true,
      due_day: 8,
      due_day_first_fortnight: 8,
      due_day_second_fortnight: 22,
      category_id: catAnaVivienda.id,
      wallet_id: walletAnaDebito.id,
      user_id: ana.id,
    },
  });
  const etLuisTransporte = await prisma.expenseTemplate.create({
    data: {
      name: 'Transporte',
      suggested_amount: 350,
      is_recurring: true,
      applies_first_fortnight: true,
      applies_second_fortnight: true,
      due_day: 4,
      due_day_first_fortnight: 4,
      due_day_second_fortnight: 18,
      category_id: catLuisTransporte.id,
      wallet_id: walletLuisDebito.id,
      user_id: luis.id,
    },
  });
  const etSuper = await prisma.expenseTemplate.create({
    data: {
      name: 'Supermercado',
      suggested_amount: 1600,
      is_recurring: true,
      applies_first_fortnight: true,
      applies_second_fortnight: true,
      due_day: 12,
      due_day_first_fortnight: 12,
      due_day_second_fortnight: 26,
      category_id: catComidaHouse.id,
      wallet_id: walletCasaDebito.id,
      house_id: casaDemo.id,
    },
  });
  const etLuz = await prisma.expenseTemplate.create({
    data: {
      name: 'Luz',
      suggested_amount: 380,
      is_recurring: true,
      applies_first_fortnight: false,
      applies_second_fortnight: true,
      due_day: 20,
      due_day_second_fortnight: 20,
      category_id: catCasa.id,
      wallet_id: walletCasaDebito.id,
      house_id: casaDemo.id,
    },
  });
  const etTelefono = await prisma.expenseTemplate.create({
    data: {
      name: 'Teléfono',
      suggested_amount: 290,
      is_recurring: true,
      applies_first_fortnight: true,
      applies_second_fortnight: false,
      due_day: 9,
      due_day_first_fortnight: 9,
      category_id: catServiciosHouse.id,
      wallet_id: walletCasaEfectivo.id,
      house_id: casaDemo.id,
    },
  });
  const etRentaCasa = await prisma.expenseTemplate.create({
    data: {
      name: 'Renta',
      suggested_amount: 6800,
      is_recurring: true,
      applies_first_fortnight: false,
      applies_second_fortnight: true,
      due_day: 16,
      due_day_second_fortnight: 16,
      category_id: catCasa.id,
      wallet_id: walletCasaDebito.id,
      house_id: casaDemo.id,
    },
  });

  // ─────────────────────────────────────────────
  // FORTNIGHTS
  // Ana: Jul–Aug. Luis: June only. House: May–Jul. No copied statement month.
  // ─────────────────────────────────────────────
  const bounds = (year: number, month: number, period: FortnightPeriod) =>
    getCanonicalFortnightBounds(year, month, period);

  const createFortnight = async (
    year: number,
    month: number,
    period: FortnightPeriod,
    label: string,
    owner: { user_id: number } | { house_id: number },
  ) => {
    const window = bounds(year, month, period);
    return prisma.fortnight.create({
      data: {
        year,
        month,
        period,
        start_date: window.start_date,
        end_date: window.end_date,
        label,
        ...owner,
      },
    });
  };

  const fAnaJulFirst = await createFortnight(2026, 7, FortnightPeriod.FIRST, 'Primera quincena - Julio 2026', { user_id: ana.id });
  const fAnaJulSecond = await createFortnight(2026, 7, FortnightPeriod.SECOND, 'Segunda quincena - Julio 2026', { user_id: ana.id });
  const fAnaAugFirst = await createFortnight(2026, 8, FortnightPeriod.FIRST, 'Primera quincena - Agosto 2026', { user_id: ana.id });
  const fAnaAugSecond = await createFortnight(2026, 8, FortnightPeriod.SECOND, 'Segunda quincena - Agosto 2026', { user_id: ana.id });

  const fLuisJunFirst = await createFortnight(2026, 6, FortnightPeriod.FIRST, 'Primera quincena - Junio 2026', { user_id: luis.id });
  const fLuisJunSecond = await createFortnight(2026, 6, FortnightPeriod.SECOND, 'Segunda quincena - Junio 2026', { user_id: luis.id });

  const fHouseMayFirst = await createFortnight(2026, 5, FortnightPeriod.FIRST, 'Primera quincena - Mayo 2026', { house_id: casaDemo.id });
  const fHouseMaySecond = await createFortnight(2026, 5, FortnightPeriod.SECOND, 'Segunda quincena - Mayo 2026', { house_id: casaDemo.id });
  const fHouseJunFirst = await createFortnight(2026, 6, FortnightPeriod.FIRST, 'Primera quincena - Junio 2026', { house_id: casaDemo.id });
  const fHouseJunSecond = await createFortnight(2026, 6, FortnightPeriod.SECOND, 'Segunda quincena - Junio 2026', { house_id: casaDemo.id });
  const fHouseJulFirst = await createFortnight(2026, 7, FortnightPeriod.FIRST, 'Primera quincena - Julio 2026', { house_id: casaDemo.id });
  const fHouseJulSecond = await createFortnight(2026, 7, FortnightPeriod.SECOND, 'Segunda quincena - Julio 2026', { house_id: casaDemo.id });

  // ─────────────────────────────────────────────
  // BUDGET (house, July). Allocations sum to the total.
  // ─────────────────────────────────────────────
  const budgetDespensa = await prisma.budget.create({
    data: {
      name: 'Despensa',
      total_amount: 2500,
      frequency: 'BIWEEKLY',
      recurrent: false,
      active: false,
      start_date: fHouseJulFirst.start_date,
      end_date: fHouseJulSecond.end_date,
      house_id: casaDemo.id,
    },
  });
  await prisma.budgetAllocation.createMany({
    data: [
      {
        budget_id: budgetDespensa.id,
        wallet_id: walletCasaDebito.id,
        category_id: catComidaHouse.id,
        amount: 1500,
      },
      {
        budget_id: budgetDespensa.id,
        wallet_id: walletCasaEfectivo.id,
        category_id: catComidaHouse.id,
        amount: 1000,
      },
    ],
  });
  await prisma.budgetPeriod.createMany({
    data: [
      {
        budget_id: budgetDespensa.id,
        start_date: fHouseJulFirst.start_date,
        end_date: fHouseJulFirst.end_date,
      },
      {
        budget_id: budgetDespensa.id,
        start_date: fHouseJulSecond.start_date,
        end_date: fHouseJulSecond.end_date,
      },
    ],
  });

  // ─────────────────────────────────────────────
  // INCOMES
  // ─────────────────────────────────────────────
  await prisma.income.createMany({
    data: [
      { fortnight_id: fAnaJulFirst.id, user_id: ana.id, amount: 8500, source: 'Salario', received_at: parseCalendarDate('2026-07-01'), income_template_id: itNominaAna.id, wallet_id: walletAnaDebito.id, category_id: catAnaSalario.id },
      { fortnight_id: fAnaJulSecond.id, user_id: ana.id, amount: 8500, source: 'Salario', received_at: parseCalendarDate('2026-07-16'), income_template_id: itNominaAna.id, wallet_id: walletAnaDebito.id, category_id: catAnaSalario.id },
      { fortnight_id: fAnaAugFirst.id, user_id: ana.id, amount: 8500, source: 'Salario', received_at: parseCalendarDate('2026-08-01'), income_template_id: itNominaAna.id, wallet_id: walletAnaDebito.id, category_id: catAnaSalario.id },
      { fortnight_id: fAnaAugSecond.id, user_id: ana.id, amount: 8500, source: 'Salario', received_at: parseCalendarDate('2026-08-16'), income_template_id: itNominaAna.id, wallet_id: walletAnaDebito.id, category_id: catAnaSalario.id },
      { fortnight_id: fLuisJunFirst.id, user_id: luis.id, amount: 4000, source: 'Otro ingreso', received_at: parseCalendarDate('2026-06-01'), income_template_id: itHonorariosLuis.id, wallet_id: walletLuisDebito.id, category_id: catLuisIngreso.id },
      { fortnight_id: fHouseMayFirst.id, house_id: casaDemo.id, amount: 18500, source: 'Salario', received_at: parseCalendarDate('2026-05-01'), income_template_id: itAportacion.id, wallet_id: walletCasaDebito.id, category_id: catSalarioHouse.id },
      { fortnight_id: fHouseMaySecond.id, house_id: casaDemo.id, amount: 18500, source: 'Salario', received_at: parseCalendarDate('2026-05-16'), income_template_id: itAportacion.id, wallet_id: walletCasaDebito.id, category_id: catSalarioHouse.id },
      { fortnight_id: fHouseJunFirst.id, house_id: casaDemo.id, amount: 18500, source: 'Salario', received_at: parseCalendarDate('2026-06-01'), income_template_id: itAportacion.id, wallet_id: walletCasaDebito.id, category_id: catSalarioHouse.id },
      { fortnight_id: fHouseJunSecond.id, house_id: casaDemo.id, amount: 18500, source: 'Salario', received_at: parseCalendarDate('2026-06-16'), income_template_id: itAportacion.id, wallet_id: walletCasaDebito.id, category_id: catSalarioHouse.id },
      { fortnight_id: fHouseJulFirst.id, house_id: casaDemo.id, amount: 18500, source: 'Salario', received_at: parseCalendarDate('2026-07-01'), income_template_id: itAportacion.id, wallet_id: walletCasaDebito.id, category_id: catSalarioHouse.id },
      { fortnight_id: fHouseJulSecond.id, house_id: casaDemo.id, amount: 18500, source: 'Salario', received_at: parseCalendarDate('2026-07-16'), income_template_id: itAportacion.id, wallet_id: walletCasaDebito.id, category_id: catSalarioHouse.id },
    ],
  });

  // ─────────────────────────────────────────────
  // EXPENSES
  // ─────────────────────────────────────────────
  await prisma.expense.createMany({
    data: [
      { fortnight_id: fAnaJulFirst.id, user_id: ana.id, description: 'Renta', amount: 7200, is_paid: false, due_day: 6, category_id: catAnaVivienda.id, wallet_id: walletAnaDebito.id, expense_template_id: etAnaRenta.id },
      { fortnight_id: fAnaJulFirst.id, user_id: ana.id, description: 'Internet', amount: 480, is_paid: true, payment_date: parseCalendarDate('2026-07-08'), category_id: catAnaVivienda.id, wallet_id: walletAnaDebito.id, expense_template_id: etAnaInternet.id },
      { fortnight_id: fAnaJulSecond.id, user_id: ana.id, description: 'Internet', amount: 480, is_paid: false, due_day: 22, category_id: catAnaVivienda.id, wallet_id: walletAnaDebito.id, expense_template_id: etAnaInternet.id },
      { fortnight_id: fAnaJulSecond.id, user_id: ana.id, description: 'Mercado', amount: 120, is_paid: true, payment_date: parseCalendarDate('2026-07-18'), category_id: catAnaVivienda.id, wallet_id: walletAnaEfectivo.id },
      { fortnight_id: fAnaAugFirst.id, user_id: ana.id, description: 'Renta', amount: 7200, is_paid: false, due_day: 6, category_id: catAnaVivienda.id, wallet_id: walletAnaDebito.id, expense_template_id: etAnaRenta.id },
      { fortnight_id: fLuisJunFirst.id, user_id: luis.id, description: 'Transporte', amount: 350, is_paid: true, payment_date: parseCalendarDate('2026-06-04'), category_id: catLuisTransporte.id, wallet_id: walletLuisDebito.id, expense_template_id: etLuisTransporte.id },
      { fortnight_id: fLuisJunSecond.id, user_id: luis.id, description: 'Transporte', amount: 350, is_paid: false, due_day: 18, category_id: catLuisTransporte.id, wallet_id: walletLuisDebito.id, expense_template_id: etLuisTransporte.id },
      { fortnight_id: fLuisJunSecond.id, user_id: luis.id, description: 'Compra en tienda', amount: 250, is_paid: true, payment_date: parseCalendarDate('2026-06-20'), category_id: catLuisTransporte.id, wallet_id: walletLuisTienda.id },
      { fortnight_id: fHouseMayFirst.id, house_id: casaDemo.id, description: 'Supermercado', amount: 1600, is_paid: true, payment_date: parseCalendarDate('2026-05-12'), category_id: catComidaHouse.id, wallet_id: walletCasaDebito.id, expense_template_id: etSuper.id },
      { fortnight_id: fHouseMayFirst.id, house_id: casaDemo.id, description: 'Teléfono', amount: 290, is_paid: true, payment_date: parseCalendarDate('2026-05-09'), category_id: catServiciosHouse.id, wallet_id: walletCasaEfectivo.id, expense_template_id: etTelefono.id },
      { fortnight_id: fHouseMaySecond.id, house_id: casaDemo.id, description: 'Supermercado', amount: 1600, is_paid: true, payment_date: parseCalendarDate('2026-05-26'), category_id: catComidaHouse.id, wallet_id: walletCasaDebito.id, expense_template_id: etSuper.id },
      { fortnight_id: fHouseMaySecond.id, house_id: casaDemo.id, description: 'Luz', amount: 380, is_paid: true, payment_date: parseCalendarDate('2026-05-20'), category_id: catCasa.id, wallet_id: walletCasaDebito.id, expense_template_id: etLuz.id },
      { fortnight_id: fHouseMaySecond.id, house_id: casaDemo.id, description: 'Renta', amount: 6800, is_paid: true, payment_date: parseCalendarDate('2026-05-16'), category_id: catCasa.id, wallet_id: walletCasaDebito.id, expense_template_id: etRentaCasa.id },
      { fortnight_id: fHouseJunFirst.id, house_id: casaDemo.id, description: 'Supermercado', amount: 1600, is_paid: true, payment_date: parseCalendarDate('2026-06-12'), category_id: catComidaHouse.id, wallet_id: walletCasaDebito.id, expense_template_id: etSuper.id },
      { fortnight_id: fHouseJulSecond.id, house_id: casaDemo.id, description: 'Renta', amount: 6800, is_paid: true, payment_date: parseCalendarDate('2026-07-16'), category_id: catCasa.id, wallet_id: walletCasaDebito.id, expense_template_id: etRentaCasa.id },
      { fortnight_id: fHouseJulSecond.id, house_id: casaDemo.id, description: 'Luz', amount: 380, is_paid: true, payment_date: parseCalendarDate('2026-07-20'), category_id: catCasa.id, wallet_id: walletCasaDebito.id, expense_template_id: etLuz.id },
    ],
  });

  // ─────────────────────────────────────────────
  // LOANS
  // One wallet loan on Ana, one payroll loan on Luis, one wallet loan on the house.
  // ─────────────────────────────────────────────
  const lenderAna = await prisma.lender.create({
    data: { name: 'Cooperativa', user_id: ana.id },
  });
  const lenderLuis = await prisma.lender.create({
    data: { name: 'Patronal', user_id: luis.id },
  });
  const lenderCasa = await prisma.lender.create({
    data: { name: 'Caja del barrio', house_id: casaDemo.id },
  });

  const createScheduledLoan = async (input: {
    name: string;
    lenderName: string;
    lenderId: number;
    type: 'PERSONAL' | 'PAYROLL';
    paymentAmount: number;
    paymentCount: number;
    frequency: 'MONTHLY' | 'FORTNIGHTLY';
    startDate: string;
    paymentSource: 'WALLET' | 'PAYROLL_DEDUCTION';
    owner: { user_id: number } | { house_id: number };
    sourceWalletId?: number;
    incomeTemplateId?: number;
    notes: string;
  }) => {
    const schedule = generateLoanPaymentSchedule({
      startDate: parseCalendarDate(input.startDate),
      paymentAmount: input.paymentAmount,
      paymentCount: input.paymentCount,
      frequency: input.frequency,
    });
    await prisma.loan.create({
      data: {
        name: input.name,
        lender: input.lenderName,
        lender_id: input.lenderId,
        type: input.type,
        status: 'ACTIVE',
        principal_amount: input.paymentAmount * input.paymentCount,
        payment_amount: input.paymentAmount,
        payment_count: input.paymentCount,
        frequency: input.frequency,
        start_date: parseCalendarDate(input.startDate),
        payment_source: input.paymentSource,
        ...input.owner,
        source_wallet_id: input.sourceWalletId,
        income_template_id: input.incomeTemplateId,
        notes: input.notes,
        payments: {
          create: schedule.map((payment) => ({
            sequence: payment.sequence,
            due_date: payment.dueDate,
            amount: payment.amount.toString(),
            source_wallet_id: input.sourceWalletId,
          })),
        },
      },
    });
  };

  await createScheduledLoan({
    name: 'Préstamo personal',
    lenderName: 'Cooperativa',
    lenderId: lenderAna.id,
    type: 'PERSONAL',
    paymentAmount: 1500,
    paymentCount: 6,
    frequency: 'MONTHLY',
    startDate: '2026-07-01',
    paymentSource: 'WALLET',
    owner: { user_id: ana.id },
    sourceWalletId: walletAnaDebito.id,
    notes: 'Seis mensualidades demo pagadas desde el débito personal',
  });
  await createScheduledLoan({
    name: 'Descuento de nómina',
    lenderName: 'Patronal',
    lenderId: lenderLuis.id,
    type: 'PAYROLL',
    paymentAmount: 900,
    paymentCount: 10,
    frequency: 'FORTNIGHTLY',
    startDate: '2026-06-01',
    paymentSource: 'PAYROLL_DEDUCTION',
    owner: { user_id: luis.id },
    incomeTemplateId: itHonorariosLuis.id,
    notes: 'Diez descuentos quincenales demo sobre honorarios',
  });
  const lenderFondo = await prisma.lender.create({
    data: { name: 'Fondo vecinal', house_id: casaDemo.id },
  });
  const lenderTaller = await prisma.lender.create({
    data: { name: 'Taller Norte', house_id: casaDemo.id },
  });
  await createScheduledLoan({
    name: 'Préstamo del hogar',
    lenderName: 'Caja del barrio',
    lenderId: lenderCasa.id,
    type: 'PERSONAL',
    paymentAmount: 1800,
    paymentCount: 12,
    frequency: 'MONTHLY',
    startDate: '2026-05-02',
    paymentSource: 'WALLET',
    owner: { house_id: casaDemo.id },
    sourceWalletId: walletCasaDebito.id,
    notes: 'Doce mensualidades demo de la casa',
  });
  await createScheduledLoan({
    name: 'Refrigerador',
    lenderName: 'Fondo vecinal',
    lenderId: lenderFondo.id,
    type: 'PERSONAL',
    paymentAmount: 950,
    paymentCount: 8,
    frequency: 'MONTHLY',
    startDate: '2026-06-10',
    paymentSource: 'WALLET',
    owner: { house_id: casaDemo.id },
    sourceWalletId: walletCasaDebito.id,
    notes: 'Ocho mensualidades demo del refrigerador',
  });
  await createScheduledLoan({
    name: 'Bicicleta',
    lenderName: 'Taller Norte',
    lenderId: lenderTaller.id,
    type: 'PERSONAL',
    paymentAmount: 640,
    paymentCount: 6,
    frequency: 'MONTHLY',
    startDate: '2026-07-12',
    paymentSource: 'WALLET',
    owner: { house_id: casaDemo.id },
    sourceWalletId: walletCasaDebito.id,
    notes: 'Seis mensualidades demo de la bicicleta',
  });

  // ─────────────────────────────────────────────
  // INSTALLMENTS (two purchases, different cards and terms)
  // ─────────────────────────────────────────────
  await prisma.expense.createMany({
    data: [
      {
        fortnight_id: fAnaJulFirst.id,
        user_id: ana.id,
        description: 'Audífonos a meses',
        amount: 450,
        is_paid: true,
        payment_date: parseCalendarDate('2026-06-20'),
        category_id: catAnaVivienda.id,
        wallet_id: walletAnaCredito.id,
        credit_installment_current: 2,
        credit_installment_total: 9,
      },
      {
        fortnight_id: fHouseJunFirst.id,
        house_id: casaDemo.id,
        description: 'Licuadora a meses',
        amount: 600,
        is_paid: true,
        payment_date: parseCalendarDate('2026-06-05'),
        category_id: catComidaHouse.id,
        wallet_id: walletCasaDigital.id,
        credit_installment_current: 1,
        credit_installment_total: 4,
      },
    ],
  });

  const today = todayCalendarDate();
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
  const monthEnd = (year: number, month: number) => {
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const firstNext = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    return addCalendarDays(firstNext, -1);
  };
  const endDay = Number(monthEnd(todayYear, todayMonth).slice(8, 10));
  const dueDay = todayDay < endDay ? todayDay + 1 : todayDay;
  await prisma.wallet.update({
    where: { id: walletCasaCredito.id },
    data: { due_day: dueDay, cutoff_day: Math.max(1, dueDay - 15) },
  });

  const houseLoanIds = (
    await prisma.loan.findMany({
      where: { house_id: casaDemo.id },
      select: { id: true },
    })
  ).map((loan) => loan.id);
  const pastHousePayments = await prisma.loanPayment.findMany({
    where: {
      status: 'SCHEDULED',
      due_date: { lt: parseCalendarDate(today) },
      loan_id: { in: houseLoanIds },
    },
    select: { id: true, due_date: true },
  });
  for (const payment of pastHousePayments) {
    await prisma.loanPayment.update({
      where: { id: payment.id },
      data: { status: 'PAID', paid_at: payment.due_date },
    });
  }

  const shiftMonth = (year: number, month: number, delta: number) => {
    const index = year * 12 + (month - 1) + delta;
    return { year: Math.floor(index / 12), month: (index % 12) + 1 };
  };

  const ensureHouseFortnight = async (year: number, month: number, period: FortnightPeriod) => {
    const found = await prisma.fortnight.findFirst({
      where: { year, month, period, house_id: casaDemo.id },
    });
    if (found) return found;
    const label = period === FortnightPeriod.FIRST ? 'Primera quincena' : 'Segunda quincena';
    return createFortnight(year, month, period, `${label} ${month}/${year}`, { house_id: casaDemo.id });
  };

  for (const delta of [-1, 0, 1]) {
    const { year, month } = shiftMonth(todayYear, todayMonth, delta);
    await ensureHouseFortnight(year, month, FortnightPeriod.FIRST);
    await ensureHouseFortnight(year, month, FortnightPeriod.SECOND);
  }

  const current = getCurrentCalendarFortnightRef();
  const otherPeriod =
    current.period === 'FIRST' ? FortnightPeriod.SECOND : FortnightPeriod.FIRST;
  const currentFortnight = await ensureHouseFortnight(
    current.year,
    current.month,
    current.period === 'FIRST' ? FortnightPeriod.FIRST : FortnightPeriod.SECOND,
  );
  const otherFortnight = await ensureHouseFortnight(current.year, current.month, otherPeriod);

  const ymdIn = (fortnight: { start_date: Date }, offset: number) =>
    parseCalendarDate(addCalendarDays(formatCalendarDate(fortnight.start_date), offset));

  const previousMonth = shiftMonth(todayYear, todayMonth, -1);
  const previousFirst = await ensureHouseFortnight(
    previousMonth.year,
    previousMonth.month,
    FortnightPeriod.FIRST,
  );
  const previousSecond = await ensureHouseFortnight(
    previousMonth.year,
    previousMonth.month,
    FortnightPeriod.SECOND,
  );
  const houseSalary = {
    house_id: casaDemo.id,
    amount: 18500,
    source: 'Salario',
    income_template_id: itAportacion.id,
    wallet_id: walletCasaDebito.id,
    category_id: catSalarioHouse.id,
  };
  await prisma.income.createMany({
    data: [
      {
        ...houseSalary,
        fortnight_id: previousFirst.id,
        received_at: ymdIn(previousFirst, 0),
      },
      {
        ...houseSalary,
        fortnight_id: previousSecond.id,
        received_at: ymdIn(previousSecond, 0),
      },
      {
        ...houseSalary,
        fortnight_id: currentFortnight.id,
        received_at: ymdIn(currentFortnight, 0),
      },
      {
        ...houseSalary,
        fortnight_id: otherFortnight.id,
        received_at: ymdIn(otherFortnight, 0),
      },
    ],
  });
  await prisma.expense.createMany({
    data: [
      {
        fortnight_id: previousFirst.id,
        house_id: casaDemo.id,
        description: 'Despensa',
        amount: 1180,
        is_paid: true,
        payment_date: ymdIn(previousFirst, 2),
        category_id: catComidaHouse.id,
        wallet_id: walletCasaDebito.id,
      },
      {
        fortnight_id: previousSecond.id,
        house_id: casaDemo.id,
        description: 'Luz',
        amount: 410,
        is_paid: true,
        payment_date: ymdIn(previousSecond, 3),
        category_id: catCasa.id,
        wallet_id: walletCasaDebito.id,
        expense_template_id: etLuz.id,
      },
    ],
  });

  await prisma.expense.createMany({
    data: [
      {
        fortnight_id: currentFortnight.id,
        house_id: casaDemo.id,
        description: 'Despensa',
        amount: 1240,
        is_paid: true,
        payment_date: ymdIn(currentFortnight, 1),
        category_id: catComidaHouse.id,
        wallet_id: walletCasaDebito.id,
      },
      {
        fortnight_id: currentFortnight.id,
        house_id: casaDemo.id,
        description: 'Luz',
        amount: 430,
        is_paid: true,
        payment_date: ymdIn(currentFortnight, 2),
        category_id: catCasa.id,
        wallet_id: walletCasaDebito.id,
        expense_template_id: etLuz.id,
      },
      {
        fortnight_id: currentFortnight.id,
        house_id: casaDemo.id,
        description: 'Transporte',
        amount: 210,
        is_paid: true,
        payment_date: ymdIn(currentFortnight, 3),
        category_id: catServiciosHouse.id,
        wallet_id: walletCasaEfectivo.id,
      },
      {
        fortnight_id: currentFortnight.id,
        house_id: casaDemo.id,
        description: 'Farmacia',
        amount: 320,
        is_paid: false,
        due_day: dueDay,
        category_id: catServiciosHouse.id,
        wallet_id: walletCasaDebito.id,
      },
      {
        fortnight_id: currentFortnight.id,
        house_id: casaDemo.id,
        description: 'Agua',
        amount: 190,
        is_paid: false,
        due_day: dueDay,
        category_id: catCasa.id,
        wallet_id: walletCasaDebito.id,
      },
      {
        fortnight_id: otherFortnight.id,
        house_id: casaDemo.id,
        description: 'Renta',
        amount: 6800,
        is_paid: false,
        due_day: 6,
        category_id: catCasa.id,
        wallet_id: walletCasaDebito.id,
        expense_template_id: etRentaCasa.id,
      },
      {
        fortnight_id: otherFortnight.id,
        house_id: casaDemo.id,
        description: 'Pago de tarjeta',
        amount: 2100,
        is_paid: false,
        due_day: dueDay,
        category_id: catServiciosHouse.id,
        wallet_id: walletCasaDebito.id,
      },
      {
        fortnight_id: otherFortnight.id,
        house_id: casaDemo.id,
        description: 'Internet',
        amount: 549,
        is_paid: false,
        due_day: 8,
        category_id: catServiciosHouse.id,
        wallet_id: walletCasaDebito.id,
      },
    ],
  });

  const budgetMes = await prisma.budget.create({
    data: {
      name: 'Gasto del mes',
      total_amount: 8500,
      frequency: 'BIWEEKLY',
      recurrent: true,
      active: true,
      start_date:
        currentFortnight.start_date < otherFortnight.start_date
          ? currentFortnight.start_date
          : otherFortnight.start_date,
      end_date:
        currentFortnight.end_date > otherFortnight.end_date
          ? currentFortnight.end_date
          : otherFortnight.end_date,
      house_id: casaDemo.id,
    },
  });
  await prisma.budgetAllocation.create({
    data: {
      budget_id: budgetMes.id,
      wallet_id: walletCasaDebito.id,
      category_id: catComidaHouse.id,
      amount: 8500,
    },
  });
  await prisma.budgetPeriod.createMany({
    data: [
      {
        budget_id: budgetMes.id,
        start_date: currentFortnight.start_date,
        end_date: currentFortnight.end_date,
      },
      {
        budget_id: budgetMes.id,
        start_date: otherFortnight.start_date,
        end_date: otherFortnight.end_date,
      },
    ],
  });

  await prisma.wallet.createMany({
    data: [
      {
        name: 'Reserva',
        type: PaymentMethodType.GOAL,
        amount: 6400,
        goal_amount: 20000,
        goal_due_date: parseCalendarDate(addCalendarDays(today, 270)),
        include_in_liquidity: false,
        house_id: casaDemo.id,
      },
      {
        name: 'Viaje',
        type: PaymentMethodType.GOAL,
        amount: 2800,
        goal_amount: 12000,
        goal_due_date: parseCalendarDate(addCalendarDays(today, 180)),
        include_in_liquidity: false,
        house_id: casaDemo.id,
      },
      {
        name: 'Colchón',
        type: PaymentMethodType.GOAL,
        amount: 4100,
        goal_amount: 15000,
        goal_due_date: parseCalendarDate(addCalendarDays(today, 400)),
        include_in_liquidity: false,
        house_id: casaDemo.id,
      },
    ],
  });

  console.log('✅ Database seeded with demo data');
}

main().finally(async () => {
  await prisma.$disconnect();
});

