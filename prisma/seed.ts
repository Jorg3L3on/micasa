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
import { parseCalendarDate } from '@/lib/calendar-dates';
import { getCanonicalFortnightBounds } from '@/lib/finance/budget-period-windows';
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
    data: { name: 'Casa Demo', owner_id: ana.id },
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

  const catLuisVivienda = await requireCategory({ user_id: luis.id }, 'Vivienda');
  const catCasa = await requireCategory({ house_id: casaDemo.id }, 'Vivienda');
  const catTarjetaCredito = await requireCategory(
    { house_id: casaDemo.id },
    'Tarjeta de crédito',
  );
  const catTarjetaDep = await requireCategory(
    { house_id: casaDemo.id },
    'Tarjeta departamental',
  );
  const catComidaHouse = await requireCategory({ house_id: casaDemo.id }, 'Comida');
  const catEntretenimiento = await requireCategory(
    { house_id: casaDemo.id },
    'Entretenimiento',
  );
  const catMedicamentos = await requireCategory(
    { house_id: casaDemo.id },
    'Farmacia',
  );
  const catTransporteHouse = await requireCategory(
    { house_id: casaDemo.id },
    'Transporte',
  );
  const catPrestamos = await requireCategory(
    { house_id: casaDemo.id },
    'Préstamos',
  );
  const catSpotify = await requireCategory({ house_id: casaDemo.id }, 'Spotify');
  const catSalarioLuis = await requireCategory({ user_id: luis.id }, 'Salario');
  const catSalarioAna = await requireCategory({ user_id: ana.id }, 'Salario');
  const catSalarioHouse = await requireCategory(
    { house_id: casaDemo.id },
    'Salario',
  );

  // ─────────────────────────────────────────────
  // WALLETS
  // ─────────────────────────────────────────────

  // Ana personal
  await prisma.wallet.create({ data: { name: 'Efectivo',         type: PaymentMethodType.CASH,       user_id: ana.id } });
  await prisma.wallet.create({ data: { name: 'Cuenta principal', type: PaymentMethodType.DEBIT_CARD, user_id: ana.id } });

  // Luis personal
  await prisma.wallet.create({ data: { name: 'Efectivo', type: PaymentMethodType.CASH,       user_id: luis.id } });
  const walletLuisBanamex = await prisma.wallet.create({
    data: { name: 'BANAMEX', type: PaymentMethodType.DEBIT_CARD, amount: -700, user_id: luis.id },
  });

  // Casa Demo house wallets
  const walletSantander = await prisma.wallet.create({
    data: { name: 'Santander', type: PaymentMethodType.DEBIT_CARD, amount: 4500, house_id: casaDemo.id },
  });
  const walletBanamex = await prisma.wallet.create({
    data: { name: 'Banamex', type: PaymentMethodType.DEBIT_CARD, amount: 3000, house_id: casaDemo.id },
  });
  const walletDidiCard = await prisma.wallet.create({
    data: {
      name: 'DIDI Card', type: PaymentMethodType.CREDIT_CARD,
      amount: 1100, cutoff_day: 3, due_day: 18, credit_limit: 1600,
      house_id: casaDemo.id,
    },
  });
  await prisma.wallet.create({
    data: {
      name: 'C&A Departamental', type: PaymentMethodType.DEPARTMENT_STORE_CARD,
      amount: 500, cutoff_day: 10, due_day: 3, credit_limit: 7000,
      house_id: casaDemo.id,
    },
  });
  const walletCnAEfectivo = await prisma.wallet.create({
    data: {
      name: 'C&A EFECTIVO', type: PaymentMethodType.CREDIT_CARD,
      amount: 2600, cutoff_day: 15, due_day: 8, credit_limit: 6000,
      house_id: casaDemo.id,
    },
  });
  await prisma.wallet.create({
    data: {
      name: 'Mercado Pago', type: PaymentMethodType.CREDIT_CARD,
      cutoff_day: 7, due_day: 17, credit_limit: 12000,
      house_id: casaDemo.id,
    },
  });
  await prisma.wallet.create({
    data: {
      name: 'Liverpool extra', type: PaymentMethodType.DEPARTMENT_STORE_CARD,
      cutoff_day: 12, due_day: 13, credit_limit: 12000,
      house_id: casaDemo.id,
    },
  });
  await prisma.wallet.create({
    data: {
      name: 'Liverpool', type: PaymentMethodType.DEPARTMENT_STORE_CARD,
      cutoff_day: 4, due_day: 5, credit_limit: 8000,
      house_id: casaDemo.id,
    },
  });
  await prisma.wallet.create({
    data: { name: 'BBVA', type: PaymentMethodType.CASH, amount: 400, house_id: casaDemo.id },
  });
  await prisma.wallet.create({
    data: {
      name: 'Mercado libre', type: PaymentMethodType.CREDIT_CARD,
      cutoff_day: 22, due_day: 4, credit_limit: 25000,
      house_id: casaDemo.id,
    },
  });
  await prisma.wallet.create({
    data: {
      name: 'Sears', type: PaymentMethodType.DEPARTMENT_STORE_CARD,
      cutoff_day: 10, due_day: 15, credit_limit: 12000,
      house_id: casaDemo.id,
    },
  });

  // ─────────────────────────────────────────────
  // INCOME TEMPLATES
  // ─────────────────────────────────────────────
  const itSueldoAna = await prisma.incomeTemplate.create({
    data: {
      name: 'Sueldo', suggested_amount: 7000,
      applies_first_fortnight: true, applies_second_fortnight: true, active: true,
      user_id: ana.id,
      category_id: catSalarioAna.id,
    },
  });
  const itSueldoLuis = await prisma.incomeTemplate.create({
    data: {
      name: 'Sueldo', suggested_amount: 18000, source: 'SALARIO',
      applies_first_fortnight: true, applies_second_fortnight: true, active: true,
      user_id: luis.id,
      category_id: catSalarioLuis.id,
    },
  });
  const itSalarioAna = await prisma.incomeTemplate.create({
    data: {
      name: 'Nómina A', suggested_amount: 6000, source: 'Salario',
      applies_first_fortnight: true, applies_second_fortnight: true, active: true,
      house_id: casaDemo.id,
      category_id: catSalarioHouse.id,
    },
  });
  const itSalarioLuis = await prisma.incomeTemplate.create({
    data: {
      name: 'Nómina B', suggested_amount: 18000, source: 'Salario',
      applies_first_fortnight: true, applies_second_fortnight: true, active: true,
      house_id: casaDemo.id,
      category_id: catSalarioHouse.id,
    },
  });

  // ─────────────────────────────────────────────
  // EXPENSE TEMPLATES
  // ─────────────────────────────────────────────

  // Ana personal
  const etAnaRenta    = await prisma.expenseTemplate.create({
    data: { name: 'Renta',    is_recurring: true, applies_first_fortnight: true, applies_second_fortnight: true, user_id: ana.id },
  });
  const etAnaInternet = await prisma.expenseTemplate.create({
    data: { name: 'Internet', is_recurring: true, applies_first_fortnight: true, applies_second_fortnight: true, user_id: ana.id },
  });

  // Luis personal
  const etLuisRenta    = await prisma.expenseTemplate.create({
    data: { name: 'Renta',    is_recurring: true, applies_first_fortnight: true, applies_second_fortnight: true, user_id: luis.id },
  });
  const etLuisInternet = await prisma.expenseTemplate.create({
    data: { name: 'Internet', is_recurring: true, applies_first_fortnight: true, applies_second_fortnight: true, user_id: luis.id },
  });

  // Casa Demo house expense templates
  const etRenta = await prisma.expenseTemplate.create({
    data: {
      name: 'Renta', suggested_amount: 9000, is_recurring: true,
      applies_first_fortnight: false, applies_second_fortnight: true,
      due_day: 15, cutoff_day: 1, due_day_second_fortnight: 15,
      category_id: catCasa.id, wallet_id: walletBanamex.id, house_id: casaDemo.id,
    },
  });
  const etTelmex = await prisma.expenseTemplate.create({
    data: {
      name: 'TELMEX', suggested_amount: 650, is_recurring: true,
      applies_first_fortnight: false, applies_second_fortnight: true,
      due_day: 23, cutoff_day: 1, due_day_second_fortnight: 23,
      category_id: catCasa.id, wallet_id: walletBanamex.id, house_id: casaDemo.id,
    },
  });
  const etAttAna = await prisma.expenseTemplate.create({
    data: {
      name: 'Celular', suggested_amount: 400, is_recurring: true,
      applies_first_fortnight: false, applies_second_fortnight: true,
      due_day: 23, cutoff_day: 1, due_day_second_fortnight: 23,
      category_id: catCasa.id, wallet_id: walletBanamex.id, house_id: casaDemo.id,
    },
  });
  const etAttLuisSecond = await prisma.expenseTemplate.create({
    data: {
      name: 'Celular extra', suggested_amount: 450, is_recurring: true,
      applies_first_fortnight: false, applies_second_fortnight: true,
      due_day: 19, cutoff_day: 1, due_day_second_fortnight: 19,
      category_id: catCasa.id, wallet_id: walletBanamex.id, house_id: casaDemo.id,
    },
  });
  const etMercadoPago = await prisma.expenseTemplate.create({
    data: {
      name: 'Mercado pago', suggested_amount: 850,
      applies_first_fortnight: false, applies_second_fortnight: true,
      due_day: 17, cutoff_day: 1, due_day_second_fortnight: 17,
      category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id, house_id: casaDemo.id,
    },
  });
  const etCfe = await prisma.expenseTemplate.create({
    data: {
      name: 'CFE', suggested_amount: 500, is_recurring: true,
      applies_first_fortnight: false, applies_second_fortnight: true,
      due_day: 17, cutoff_day: 1, due_day_second_fortnight: 17,
      category_id: catCasa.id, wallet_id: walletSantander.id, house_id: casaDemo.id,
    },
  });
  const etSuper = await prisma.expenseTemplate.create({
    data: {
      name: 'Super', suggested_amount: 2400, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: true,
      due_day: 15, cutoff_day: 1, due_day_first_fortnight: 15, due_day_second_fortnight: 15,
      category_id: catComidaHouse.id, wallet_id: walletSantander.id, house_id: casaDemo.id,
    },
  });
  const etNomina = await prisma.expenseTemplate.create({
    data: {
      name: 'Préstamo nómina', suggested_amount: 1250, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: true,
      due_day: 15, cutoff_day: 1, due_day_first_fortnight: 15, due_day_second_fortnight: 15,
      category_id: catPrestamos.id, wallet_id: walletSantander.id, house_id: casaDemo.id,
      active: false,
    },
  });
  const etNominaB = await prisma.expenseTemplate.create({
    data: {
      name: 'Préstamo nómina B', suggested_amount: 2800, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: true,
      due_day: 15, cutoff_day: 1, due_day_first_fortnight: 15, due_day_second_fortnight: 15,
      category_id: catPrestamos.id, wallet_id: walletBanamex.id, house_id: casaDemo.id,
      active: false,
    },
  });
  const etCarne = await prisma.expenseTemplate.create({
    data: {
      name: 'Carne', suggested_amount: 900, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: true,
      due_day: 15, cutoff_day: 1, due_day_first_fortnight: 15, due_day_second_fortnight: 15,
      category_id: catComidaHouse.id, wallet_id: walletSantander.id, house_id: casaDemo.id,
    },
  });
  const etAgua = await prisma.expenseTemplate.create({
    data: {
      name: 'Agua', suggested_amount: 250, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: true,
      due_day: 13, cutoff_day: 1, due_day_first_fortnight: 13, due_day_second_fortnight: 13,
      category_id: catComidaHouse.id, wallet_id: walletSantander.id, house_id: casaDemo.id,
    },
  });
  const etTransporteAna = await prisma.expenseTemplate.create({
    data: {
      name: 'Transporte', suggested_amount: 450, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: true,
      due_day: 1, cutoff_day: 1, due_day_first_fortnight: 1, due_day_second_fortnight: 1,
      category_id: catTransporteHouse.id, wallet_id: walletSantander.id, house_id: casaDemo.id,
    },
  });
  const etCreditoBanamex = await prisma.expenseTemplate.create({
    data: {
      name: 'Credito Banamex', suggested_amount: 2800, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: true,
      due_day: 15, cutoff_day: 1, due_day_first_fortnight: 15, due_day_second_fortnight: 15,
      category_id: catPrestamos.id, wallet_id: walletBanamex.id, house_id: casaDemo.id,
    },
  });
  const etLiverpoolAna = await prisma.expenseTemplate.create({
    data: {
      name: 'Liverpool', suggested_amount: 550, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 5, cutoff_day: 4, due_day_first_fortnight: 5,
      category_id: catTarjetaDep.id, wallet_id: walletSantander.id, house_id: casaDemo.id,
    },
  });
  const etLiverpoolLuis = await prisma.expenseTemplate.create({
    data: {
      name: 'Liverpool extra', suggested_amount: 200, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 12, cutoff_day: 1, due_day_first_fortnight: 12,
      category_id: catTarjetaDep.id, wallet_id: walletBanamex.id, house_id: casaDemo.id,
    },
  });
  const etAttLuisFirst = await prisma.expenseTemplate.create({
    data: {
      name: 'Celular plan', suggested_amount: 1200, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 7, cutoff_day: 1, due_day_first_fortnight: 7,
      category_id: catCasa.id, wallet_id: walletBanamex.id, house_id: casaDemo.id,
    },
  });
  const etSpotify = await prisma.expenseTemplate.create({
    data: {
      name: 'Spotify', suggested_amount: 200, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 30, cutoff_day: 1, due_day_first_fortnight: 30,
      category_id: catSpotify.id, wallet_id: walletSantander.id, house_id: casaDemo.id,
    },
  });
  const etSky = await prisma.expenseTemplate.create({
    data: {
      name: 'Sky', suggested_amount: 250, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 30, cutoff_day: 1, due_day_first_fortnight: 30,
      category_id: catEntretenimiento.id, wallet_id: walletSantander.id, house_id: casaDemo.id,
    },
  });
  const etCnAEfectivo = await prisma.expenseTemplate.create({
    data: {
      name: 'C&A efectivo', suggested_amount: 950, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 10, cutoff_day: 15, due_day_first_fortnight: 10,
      category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id, house_id: casaDemo.id,
    },
  });
  const etCnADepartamental = await prisma.expenseTemplate.create({
    data: {
      name: 'C&A departamental', suggested_amount: 300, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 3, cutoff_day: 10, due_day_first_fortnight: 3,
      category_id: catTarjetaDep.id, wallet_id: walletBanamex.id, house_id: casaDemo.id,
    },
  });
  const etFarmaciaExtra = await prisma.expenseTemplate.create({
    data: {
      name: 'Farmacia extra', suggested_amount: 350, is_recurring: true,
      applies_first_fortnight: false, applies_second_fortnight: true,
      due_day: 1, cutoff_day: 1, due_day_second_fortnight: 1,
      category_id: catMedicamentos.id, wallet_id: walletSantander.id, house_id: casaDemo.id,
    },
  });
  const etFarmaciaMensual = await prisma.expenseTemplate.create({
    data: {
      name: 'Farmacia mensual', suggested_amount: 2000, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 1, cutoff_day: 1, due_day_first_fortnight: 1,
      category_id: catMedicamentos.id, wallet_id: walletSantander.id, house_id: casaDemo.id,
    },
  });
  const etFarmacia = await prisma.expenseTemplate.create({
    data: {
      name: 'Farmacia', suggested_amount: 300, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 11, cutoff_day: 1, due_day_first_fortnight: 11,
      category_id: catMedicamentos.id, wallet_id: walletBanamex.id, house_id: casaDemo.id,
    },
  });
  const etFarmaciaApoyo = await prisma.expenseTemplate.create({
    data: {
      name: 'Farmacia de apoyo', suggested_amount: 150, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 1, cutoff_day: 1, due_day_first_fortnight: 1,
      category_id: catMedicamentos.id, wallet_id: walletBanamex.id, house_id: casaDemo.id,
    },
  });
  const etDidiCard = await prisma.expenseTemplate.create({
    data: {
      name: 'Didi card', suggested_amount: 1600, is_recurring: true,
      applies_first_fortnight: false, applies_second_fortnight: true,
      due_day: 18, cutoff_day: 3, due_day_second_fortnight: 18,
      category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id, house_id: casaDemo.id,
    },
  });

  // ─────────────────────────────────────────────
  // FORTNIGHTS
  // ─────────────────────────────────────────────

  const bounds = (year: number, month: number, period: FortnightPeriod) =>
    getCanonicalFortnightBounds(year, month, period);

  // Ana personal
  const anaMarFirst = bounds(2026, 3, FortnightPeriod.FIRST);
  const anaMarSecond = bounds(2026, 3, FortnightPeriod.SECOND);
  const anaAprFirst = bounds(2026, 4, FortnightPeriod.FIRST);
  const anaAprSecond = bounds(2026, 4, FortnightPeriod.SECOND);
  const f_ana_mar26_first  = await prisma.fortnight.create({ data: { year: 2026, month: 3, period: FortnightPeriod.FIRST,  start_date: anaMarFirst.start_date, end_date: anaMarFirst.end_date, label: 'Primera quincena - 3/2026',     user_id: ana.id } });
  const f_ana_mar26_second = await prisma.fortnight.create({ data: { year: 2026, month: 3, period: FortnightPeriod.SECOND, start_date: anaMarSecond.start_date, end_date: anaMarSecond.end_date, label: 'Segunda quincena - 3/2026',     user_id: ana.id } });
  const f_ana_apr26_first  = await prisma.fortnight.create({ data: { year: 2026, month: 4, period: FortnightPeriod.FIRST,  start_date: anaAprFirst.start_date, end_date: anaAprFirst.end_date, label: 'Primera quincena - 4/2026',     user_id: ana.id } });
  const f_ana_apr26_second = await prisma.fortnight.create({ data: { year: 2026, month: 4, period: FortnightPeriod.SECOND, start_date: anaAprSecond.start_date, end_date: anaAprSecond.end_date, label: 'Segunda quincena - 4/2026',     user_id: ana.id } });

  // Luis personal
  const f_luis_mar26_first  = await prisma.fortnight.create({ data: { year: 2026, month: 3, period: FortnightPeriod.FIRST,  start_date: anaMarFirst.start_date, end_date: anaMarFirst.end_date, label: 'Primera quincena - 3/2026',     user_id: luis.id } });
  const f_luis_mar26_second = await prisma.fortnight.create({ data: { year: 2026, month: 3, period: FortnightPeriod.SECOND, start_date: anaMarSecond.start_date, end_date: anaMarSecond.end_date, label: 'Segunda quincena - 3/2026',     user_id: luis.id } });
  const f_luis_apr26_first  = await prisma.fortnight.create({ data: { year: 2026, month: 4, period: FortnightPeriod.FIRST,  start_date: anaAprFirst.start_date, end_date: anaAprFirst.end_date, label: 'Primera quincena - 4/2026',     user_id: luis.id } });
  const f_luis_apr26_second = await prisma.fortnight.create({ data: { year: 2026, month: 4, period: FortnightPeriod.SECOND, start_date: anaAprSecond.start_date, end_date: anaAprSecond.end_date, label: 'Segunda quincena - 4/2026',     user_id: luis.id } });

  // Casa Demo house
  const oct25Second = bounds(2025, 10, FortnightPeriod.SECOND);
  const houseMarFirst = bounds(2026, 3, FortnightPeriod.FIRST);
  const houseMarSecond = bounds(2026, 3, FortnightPeriod.SECOND);
  const houseAprFirst = bounds(2026, 4, FortnightPeriod.FIRST);
  const houseAprSecond = bounds(2026, 4, FortnightPeriod.SECOND);
  const houseMayFirst = bounds(2026, 5, FortnightPeriod.FIRST);
  const houseMaySecond = bounds(2026, 5, FortnightPeriod.SECOND);
  const houseJunFirst = bounds(2026, 6, FortnightPeriod.FIRST);
  const houseJunSecond = bounds(2026, 6, FortnightPeriod.SECOND);
  const f_house_oct25_second  = await prisma.fortnight.create({ data: { year: 2025, month: 10, period: FortnightPeriod.SECOND, start_date: oct25Second.start_date, end_date: oct25Second.end_date, label: 'Segunda quincena - 10/2025',    house_id: casaDemo.id } });
  const f_house_mar26_first   = await prisma.fortnight.create({ data: { year: 2026, month: 3,  period: FortnightPeriod.FIRST,  start_date: houseMarFirst.start_date, end_date: houseMarFirst.end_date, label: 'Primera quincena - Marzo 2026', house_id: casaDemo.id } });
  const f_house_mar26_second  = await prisma.fortnight.create({ data: { year: 2026, month: 3,  period: FortnightPeriod.SECOND, start_date: houseMarSecond.start_date, end_date: houseMarSecond.end_date, label: 'Segunda quincena - Marzo 2026', house_id: casaDemo.id } });
  const f_house_apr26_first   = await prisma.fortnight.create({ data: { year: 2026, month: 4,  period: FortnightPeriod.FIRST,  start_date: houseAprFirst.start_date, end_date: houseAprFirst.end_date, label: 'Primera quincena - Abril 2026', house_id: casaDemo.id } });
  const f_house_apr26_second  = await prisma.fortnight.create({ data: { year: 2026, month: 4,  period: FortnightPeriod.SECOND, start_date: houseAprSecond.start_date, end_date: houseAprSecond.end_date, label: 'Segunda quincena - Abril 2026', house_id: casaDemo.id } });
  const f_house_may26_first   = await prisma.fortnight.create({ data: { year: 2026, month: 5,  period: FortnightPeriod.FIRST,  start_date: houseMayFirst.start_date, end_date: houseMayFirst.end_date, label: 'Primera quincena - Mayo 2026',  house_id: casaDemo.id } });
  const f_house_may26_second  = await prisma.fortnight.create({ data: { year: 2026, month: 5,  period: FortnightPeriod.SECOND, start_date: houseMaySecond.start_date, end_date: houseMaySecond.end_date, label: 'Segunda quincena - Mayo 2026',  house_id: casaDemo.id } });
  const f_house_jun26_first   = await prisma.fortnight.create({ data: { year: 2026, month: 6,  period: FortnightPeriod.FIRST,  start_date: houseJunFirst.start_date, end_date: houseJunFirst.end_date, label: 'Primera quincena - Junio 2026', house_id: casaDemo.id } });
  const f_house_jun26_second  = await prisma.fortnight.create({ data: { year: 2026, month: 6,  period: FortnightPeriod.SECOND, start_date: houseJunSecond.start_date, end_date: houseJunSecond.end_date, label: 'Segunda quincena - Junio 2026', house_id: casaDemo.id } });

  // ─────────────────────────────────────────────
  // BUDGETS (house demo)
  // ─────────────────────────────────────────────
  const budgetDespensa = await prisma.budget.create({
    data: {
      name: 'Despensa',
      total_amount: 4000,
      frequency: 'BIWEEKLY',
      recurrent: true,
      active: true,
      start_date: f_house_jun26_first.start_date,
      end_date: f_house_jun26_second.end_date,
      house_id: casaDemo.id,
    },
  });
  await prisma.budgetAllocation.createMany({
    data: [
      {
        budget_id: budgetDespensa.id,
        wallet_id: walletBanamex.id,
        category_id: catComidaHouse.id,
        amount: 2400,
      },
      {
        budget_id: budgetDespensa.id,
        wallet_id: walletSantander.id,
        category_id: catComidaHouse.id,
        amount: 1600,
      },
    ],
  });
  await prisma.budgetPeriod.createMany({
    data: [
      {
        budget_id: budgetDespensa.id,
        start_date: f_house_jun26_first.start_date,
        end_date: f_house_jun26_first.end_date,
      },
      {
        budget_id: budgetDespensa.id,
        start_date: f_house_jun26_second.start_date,
        end_date: f_house_jun26_second.end_date,
      },
    ],
  });

  // ─────────────────────────────────────────────
  // INCOMES
  // ─────────────────────────────────────────────

  await prisma.income.createMany({
    data: [
      // Ana personal
      { fortnight_id: f_ana_mar26_first.id,  user_id: ana.id, amount: 5000,  received_at: new Date('2026-03-01T06:00:00'), income_template_id: itSueldoAna.id },
      { fortnight_id: f_ana_mar26_second.id, user_id: ana.id, amount: 5000,  received_at: new Date('2026-03-15T06:00:00'), income_template_id: itSueldoAna.id },
      { fortnight_id: f_ana_apr26_first.id,  user_id: ana.id, amount: 5000,  received_at: new Date('2026-04-01T06:00:00'), income_template_id: itSueldoAna.id },
      { fortnight_id: f_ana_apr26_second.id, user_id: ana.id, amount: 5000,  received_at: new Date('2026-04-15T06:00:00'), income_template_id: itSueldoAna.id },

      // Luis personal
      { fortnight_id: f_luis_mar26_first.id,  user_id: luis.id, amount: 18000, source: 'SALARIO', received_at: new Date('2026-03-01T06:00:00'), income_template_id: itSueldoLuis.id },
      { fortnight_id: f_luis_mar26_second.id, user_id: luis.id, amount: 18000, source: 'SALARIO', received_at: new Date('2026-03-15T06:00:00'), income_template_id: itSueldoLuis.id },
      { fortnight_id: f_luis_apr26_first.id,  user_id: luis.id, amount: 18000, source: 'SALARIO', received_at: new Date('2026-04-01T06:00:00'), income_template_id: itSueldoLuis.id },
      { fortnight_id: f_luis_apr26_second.id, user_id: luis.id, amount: 18000, source: 'SALARIO', received_at: new Date('2026-04-15T06:00:00'), income_template_id: itSueldoLuis.id },

      // Casa Demo house
      { fortnight_id: f_house_mar26_first.id,  house_id: casaDemo.id, amount: 7000,  source: 'Salario', received_at: new Date('2026-03-01T06:00:00'), income_template_id: itSalarioAna.id },
      { fortnight_id: f_house_mar26_first.id,  house_id: casaDemo.id, amount: 18000, source: 'Salario', received_at: new Date('2026-03-01T06:00:00'), income_template_id: itSalarioLuis.id },
      { fortnight_id: f_house_mar26_second.id, house_id: casaDemo.id, amount: 6000,  source: 'Salario', received_at: new Date('2026-03-16T06:00:00'), income_template_id: itSalarioAna.id },
      { fortnight_id: f_house_mar26_second.id, house_id: casaDemo.id, amount: 18000, source: 'Salario', received_at: new Date('2026-03-16T06:00:00'), income_template_id: itSalarioLuis.id },
      { fortnight_id: f_house_apr26_first.id,  house_id: casaDemo.id, amount: 6500,  source: 'Salario', received_at: new Date('2026-04-01T06:00:00'), income_template_id: itSalarioAna.id },
      { fortnight_id: f_house_apr26_first.id,  house_id: casaDemo.id, amount: 18000, source: 'Salario', received_at: new Date('2026-04-01T06:00:00'), income_template_id: itSalarioLuis.id },
      { fortnight_id: f_house_apr26_second.id, house_id: casaDemo.id, amount: 7000,  source: 'Salario', received_at: new Date('2026-04-16T06:00:00'), income_template_id: itSalarioAna.id },
      { fortnight_id: f_house_apr26_second.id, house_id: casaDemo.id, amount: 18000, source: 'Salario', received_at: new Date('2026-04-16T06:00:00'), income_template_id: itSalarioLuis.id },
      { fortnight_id: f_house_may26_first.id,  house_id: casaDemo.id, amount: 7000,  source: 'Salario', received_at: new Date('2026-05-01T06:00:00'), income_template_id: itSalarioAna.id },
      { fortnight_id: f_house_may26_first.id,  house_id: casaDemo.id, amount: 18000, source: 'Salario', received_at: new Date('2026-05-01T06:00:00'), income_template_id: itSalarioLuis.id },
      { fortnight_id: f_house_may26_second.id, house_id: casaDemo.id, amount: 7000,  source: 'Salario', received_at: new Date('2026-05-16T06:00:00'), income_template_id: itSalarioAna.id },
      { fortnight_id: f_house_may26_second.id, house_id: casaDemo.id, amount: 18000, source: 'Salario', received_at: new Date('2026-05-16T06:00:00'), income_template_id: itSalarioLuis.id },
      { fortnight_id: f_house_jun26_first.id,  house_id: casaDemo.id, amount: 6000,  source: 'Salario', received_at: new Date('2026-06-01T06:00:00'), income_template_id: itSalarioAna.id },
      { fortnight_id: f_house_jun26_first.id,  house_id: casaDemo.id, amount: 18000, source: 'Salario', received_at: new Date('2026-06-01T06:00:00'), income_template_id: itSalarioLuis.id },
      { fortnight_id: f_house_jun26_second.id, house_id: casaDemo.id, amount: 6000,  source: 'Salario', received_at: new Date('2026-06-16T06:00:00'), income_template_id: itSalarioAna.id },
      { fortnight_id: f_house_jun26_second.id, house_id: casaDemo.id, amount: 18000, source: 'Salario', received_at: new Date('2026-06-16T06:00:00'), income_template_id: itSalarioLuis.id },
    ],
  });

  // ─────────────────────────────────────────────
  // EXPENSES
  // ─────────────────────────────────────────────

  await prisma.expense.createMany({
    data: [
      // ── Ana personal ──────────────────────
      { fortnight_id: f_ana_mar26_first.id,  user_id: ana.id, description: 'Renta',    amount: 0, is_paid: false, due_day: 14, expense_template_id: etAnaRenta.id },
      { fortnight_id: f_ana_mar26_first.id,  user_id: ana.id, description: 'Internet', amount: 0, is_paid: false, due_day: 14, expense_template_id: etAnaInternet.id },
      { fortnight_id: f_ana_mar26_second.id, user_id: ana.id, description: 'Renta',    amount: 0, is_paid: false, due_day: 31, expense_template_id: etAnaRenta.id },
      { fortnight_id: f_ana_mar26_second.id, user_id: ana.id, description: 'Internet', amount: 0, is_paid: false, due_day: 31, expense_template_id: etAnaInternet.id },
      { fortnight_id: f_ana_apr26_first.id,  user_id: ana.id, description: 'Renta',    amount: 0, is_paid: false, due_day: 14, expense_template_id: etAnaRenta.id },
      { fortnight_id: f_ana_apr26_first.id,  user_id: ana.id, description: 'Internet', amount: 0, is_paid: false, due_day: 14, expense_template_id: etAnaInternet.id },
      { fortnight_id: f_ana_apr26_second.id, user_id: ana.id, description: 'Renta',    amount: 0, is_paid: false, due_day: 30, expense_template_id: etAnaRenta.id },
      { fortnight_id: f_ana_apr26_second.id, user_id: ana.id, description: 'Internet', amount: 0, is_paid: false, due_day: 30, expense_template_id: etAnaInternet.id },

      // ── Luis personal ───────────────────────
      { fortnight_id: f_luis_mar26_first.id,  user_id: luis.id, description: 'Internet', amount: 700, is_paid: true,  category_id: catLuisVivienda.id, wallet_id: walletLuisBanamex.id, expense_template_id: etLuisInternet.id },
      { fortnight_id: f_luis_apr26_first.id,  user_id: luis.id, description: 'Renta',    amount: 0,   is_paid: false, due_day: 14, expense_template_id: etLuisRenta.id },
      { fortnight_id: f_luis_apr26_first.id,  user_id: luis.id, description: 'Internet', amount: 0,   is_paid: false, due_day: 14, expense_template_id: etLuisInternet.id },
      { fortnight_id: f_luis_apr26_second.id, user_id: luis.id, description: 'Renta',    amount: 0,   is_paid: false, due_day: 30, expense_template_id: etLuisRenta.id },
      { fortnight_id: f_luis_apr26_second.id, user_id: luis.id, description: 'Internet', amount: 0,   is_paid: false, due_day: 30, expense_template_id: etLuisInternet.id },

      // ── House: Oct 2025 second ───────────────
      { fortnight_id: f_house_oct25_second.id, house_id: casaDemo.id, description: 'Retiro de efectivo', amount: 900, is_paid: true, category_id: catCasa.id, wallet_id: walletCnAEfectivo.id },
      { fortnight_id: f_house_oct25_second.id, house_id: casaDemo.id, description: 'Compra a meses',   amount: 200, is_paid: true, category_id: catCasa.id, wallet_id: walletDidiCard.id },

      // ── House: Mar 2026 first ────────────────
      { fortnight_id: f_house_mar26_first.id, house_id: casaDemo.id, description: 'Super',           amount: 2400,    is_paid: false, due_day: 15, category_id: catComidaHouse.id,   wallet_id: walletSantander.id, expense_template_id: etSuper.id },
      { fortnight_id: f_house_mar26_first.id, house_id: casaDemo.id, description: 'Préstamo nómina',  amount: 1250, is_paid: false, due_day: 15, category_id: catPrestamos.id,     wallet_id: walletSantander.id, expense_template_id: etNomina.id },
      { fortnight_id: f_house_mar26_first.id, house_id: casaDemo.id, description: 'Préstamo nómina B',   amount: 2800, is_paid: false, due_day: 15, category_id: catPrestamos.id,     wallet_id: walletBanamex.id,   expense_template_id: etNominaB.id },
      { fortnight_id: f_house_mar26_first.id, house_id: casaDemo.id, description: 'Agua',            amount: 250,     is_paid: false, due_day: 13, category_id: catComidaHouse.id,   wallet_id: walletSantander.id, expense_template_id: etAgua.id },
      { fortnight_id: f_house_mar26_first.id, house_id: casaDemo.id, description: 'Transporte', amount: 450,   is_paid: false, due_day: 1,  category_id: catTransporteHouse.id, wallet_id: walletSantander.id, expense_template_id: etTransporteAna.id },
      { fortnight_id: f_house_mar26_first.id, house_id: casaDemo.id, description: 'Carne',           amount: 900,     is_paid: false, due_day: 15, category_id: catComidaHouse.id,   wallet_id: walletSantander.id, expense_template_id: etCarne.id },
      { fortnight_id: f_house_mar26_first.id, house_id: casaDemo.id, description: 'Credito Banamex', amount: 2800,    is_paid: false, due_day: 15, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,  expense_template_id: etCreditoBanamex.id },

      // ── House: Mar 2026 second ───────────────
      { fortnight_id: f_house_mar26_second.id, house_id: casaDemo.id, description: 'Renta',          amount: 9000,    is_paid: true,  due_day: 15, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etRenta.id },
      { fortnight_id: f_house_mar26_second.id, house_id: casaDemo.id, description: 'TELMEX',         amount: 650,     is_paid: true,  due_day: 23, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etTelmex.id },
      { fortnight_id: f_house_mar26_second.id, house_id: casaDemo.id, description: 'Celular',    amount: 400,  is_paid: true,  due_day: 23, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttAna.id },
      { fortnight_id: f_house_mar26_second.id, house_id: casaDemo.id, description: 'Celular extra',     amount: 450,  is_paid: true,  due_day: 19, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttLuisSecond.id },
      { fortnight_id: f_house_mar26_second.id, house_id: casaDemo.id, description: 'Mercado pago',   amount: 850,  is_paid: true,  due_day: 17, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etMercadoPago.id },
      { fortnight_id: f_house_mar26_second.id, house_id: casaDemo.id, description: 'CFE',            amount: 500,     is_paid: true,  due_day: 17, category_id: catCasa.id,           wallet_id: walletSantander.id, expense_template_id: etCfe.id },
      { fortnight_id: f_house_mar26_second.id, house_id: casaDemo.id, description: 'Super',          amount: 1100,    is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etSuper.id },
      { fortnight_id: f_house_mar26_second.id, house_id: casaDemo.id, description: 'Préstamo nómina', amount: 1250, is_paid: true,  due_day: 15, category_id: catPrestamos.id,      wallet_id: walletSantander.id, expense_template_id: etNomina.id },
      { fortnight_id: f_house_mar26_second.id, house_id: casaDemo.id, description: 'Préstamo nómina B',  amount: 2800, is_paid: true,  due_day: 15, category_id: catPrestamos.id,      wallet_id: walletBanamex.id,   expense_template_id: etNominaB.id },
      { fortnight_id: f_house_mar26_second.id, house_id: casaDemo.id, description: 'Agua',           amount: 250,     is_paid: false, due_day: 13, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etAgua.id },
      { fortnight_id: f_house_mar26_second.id, house_id: casaDemo.id, description: 'Carne',          amount: 900,     is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etCarne.id },
      { fortnight_id: f_house_mar26_second.id, house_id: casaDemo.id, description: 'Credito Banamex', amount: 2800,   is_paid: true,  due_day: 15, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etCreditoBanamex.id },
      { fortnight_id: f_house_mar26_second.id, house_id: casaDemo.id, description: 'Didi Card',      amount: 600,  is_paid: true,  category_id: catTarjetaCredito.id, wallet_id: walletSantander.id },

      // ── House: Apr 2026 first ────────────────
      { fortnight_id: f_house_apr26_first.id, house_id: casaDemo.id, description: 'Super',           amount: 2400,    is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etSuper.id },
      { fortnight_id: f_house_apr26_first.id, house_id: casaDemo.id, description: 'Préstamo nómina',  amount: 1250, is_paid: true,  due_day: 15, category_id: catPrestamos.id,      wallet_id: walletSantander.id, expense_template_id: etNomina.id },
      { fortnight_id: f_house_apr26_first.id, house_id: casaDemo.id, description: 'Préstamo nómina B',   amount: 2800, is_paid: true,  due_day: 15, category_id: catPrestamos.id,      wallet_id: walletBanamex.id,   expense_template_id: etNominaB.id },
      { fortnight_id: f_house_apr26_first.id, house_id: casaDemo.id, description: 'Agua',            amount: 250,     is_paid: false, due_day: 13, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etAgua.id },
      { fortnight_id: f_house_apr26_first.id, house_id: casaDemo.id, description: 'Transporte', amount: 450,   is_paid: false, due_day: 1,  category_id: catTransporteHouse.id, wallet_id: walletSantander.id, expense_template_id: etTransporteAna.id },
      { fortnight_id: f_house_apr26_first.id, house_id: casaDemo.id, description: 'Carne',           amount: 900,     is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etCarne.id },
      { fortnight_id: f_house_apr26_first.id, house_id: casaDemo.id, description: 'Celular plan',      amount: 1100, is_paid: true,  due_day: 7,  category_id: catCasa.id,           wallet_id: walletDidiCard.id,  expense_template_id: etAttLuisFirst.id },
      { fortnight_id: f_house_apr26_first.id, house_id: casaDemo.id, description: 'Sky',             amount: 250,     is_paid: true,  due_day: 30, category_id: catEntretenimiento.id, wallet_id: walletSantander.id, expense_template_id: etSky.id },
      { fortnight_id: f_house_apr26_first.id, house_id: casaDemo.id, description: 'Spotify',         amount: 200,     is_paid: true,  due_day: 30, category_id: catSpotify.id, wallet_id: walletSantander.id, expense_template_id: etSpotify.id },
      { fortnight_id: f_house_apr26_first.id, house_id: casaDemo.id, description: 'Farmacia mensual',        amount: 2000,    is_paid: false, due_day: 1,  category_id: catMedicamentos.id,   wallet_id: walletSantander.id, expense_template_id: etFarmaciaMensual.id },
      { fortnight_id: f_house_apr26_first.id, house_id: casaDemo.id, description: 'Farmacia de apoyo',    amount: 150,     is_paid: false, due_day: 1,  category_id: catMedicamentos.id,   wallet_id: walletBanamex.id,   expense_template_id: etFarmaciaApoyo.id },
      { fortnight_id: f_house_apr26_first.id, house_id: casaDemo.id, description: 'Credito Banamex', amount: 2800,    is_paid: true,  due_day: 15, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etCreditoBanamex.id },
      { fortnight_id: f_house_apr26_first.id, house_id: casaDemo.id, description: 'Renta',           amount: 1100,    is_paid: false, category_id: catCasa.id,           wallet_id: walletBanamex.id },
      { fortnight_id: f_house_apr26_first.id, house_id: casaDemo.id, description: 'Didi card',       amount: 600,     is_paid: true,  category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id },

      // ── House: Apr 2026 second ───────────────
      { fortnight_id: f_house_apr26_second.id, house_id: casaDemo.id, description: 'Renta',          amount: 8000,    is_paid: false, due_day: 15, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etRenta.id },
      { fortnight_id: f_house_apr26_second.id, house_id: casaDemo.id, description: 'TELMEX',         amount: 650,     is_paid: false, due_day: 23, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etTelmex.id },
      { fortnight_id: f_house_apr26_second.id, house_id: casaDemo.id, description: 'Celular',    amount: 400,  is_paid: false, due_day: 23, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttAna.id },
      { fortnight_id: f_house_apr26_second.id, house_id: casaDemo.id, description: 'Celular extra',     amount: 450,  is_paid: false, due_day: 19, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttLuisSecond.id },
      { fortnight_id: f_house_apr26_second.id, house_id: casaDemo.id, description: 'Mercado pago',   amount: 5000,    is_paid: false, due_day: 17, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etMercadoPago.id },
      { fortnight_id: f_house_apr26_second.id, house_id: casaDemo.id, description: 'Super',          amount: 2400,    is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etSuper.id },
      { fortnight_id: f_house_apr26_second.id, house_id: casaDemo.id, description: 'Préstamo nómina', amount: 1250, is_paid: true,  due_day: 15, category_id: catPrestamos.id,      wallet_id: walletSantander.id, expense_template_id: etNomina.id },
      { fortnight_id: f_house_apr26_second.id, house_id: casaDemo.id, description: 'Préstamo nómina B',  amount: 2800, is_paid: true,  due_day: 15, category_id: catPrestamos.id,      wallet_id: walletBanamex.id,   expense_template_id: etNominaB.id },
      { fortnight_id: f_house_apr26_second.id, house_id: casaDemo.id, description: 'Agua',           amount: 250,     is_paid: false, due_day: 13, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etAgua.id },
      { fortnight_id: f_house_apr26_second.id, house_id: casaDemo.id, description: 'Transporte', amount: 450, is_paid: false, due_day: 1,  category_id: catTransporteHouse.id, wallet_id: walletSantander.id, expense_template_id: etTransporteAna.id },
      { fortnight_id: f_house_apr26_second.id, house_id: casaDemo.id, description: 'Carne',          amount: 900,     is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etCarne.id },
      { fortnight_id: f_house_apr26_second.id, house_id: casaDemo.id, description: 'Farmacia extra',          amount: 350,     is_paid: false, due_day: 1,  category_id: catMedicamentos.id,   wallet_id: walletSantander.id, expense_template_id: etFarmaciaExtra.id },
      { fortnight_id: f_house_apr26_second.id, house_id: casaDemo.id, description: 'Credito Banamex', amount: 2800,   is_paid: true,  due_day: 15, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etCreditoBanamex.id },
      { fortnight_id: f_house_apr26_second.id, house_id: casaDemo.id, description: 'Didi card',      amount: 1600,    is_paid: false, due_day: 18, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etDidiCard.id },

      // ── House: May 2026 first ────────────────
      { fortnight_id: f_house_may26_first.id, house_id: casaDemo.id, description: 'Super',           amount: 2400,    is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etSuper.id },
      { fortnight_id: f_house_may26_first.id, house_id: casaDemo.id, description: 'Préstamo nómina',  amount: 1250, is_paid: false, due_day: 15, category_id: catPrestamos.id,      wallet_id: walletSantander.id, expense_template_id: etNomina.id },
      { fortnight_id: f_house_may26_first.id, house_id: casaDemo.id, description: 'Préstamo nómina B',   amount: 2800, is_paid: false, due_day: 15, category_id: catPrestamos.id,      wallet_id: walletBanamex.id,   expense_template_id: etNominaB.id },
      { fortnight_id: f_house_may26_first.id, house_id: casaDemo.id, description: 'Agua',            amount: 250,     is_paid: false, due_day: 13, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etAgua.id },
      { fortnight_id: f_house_may26_first.id, house_id: casaDemo.id, description: 'Transporte', amount: 450,   is_paid: false, due_day: 1,  category_id: catTransporteHouse.id, wallet_id: walletSantander.id, expense_template_id: etTransporteAna.id },
      { fortnight_id: f_house_may26_first.id, house_id: casaDemo.id, description: 'Carne',           amount: 900,     is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etCarne.id },
      { fortnight_id: f_house_may26_first.id, house_id: casaDemo.id, description: 'Liverpool', amount: 550, is_paid: false, due_day: 5,  category_id: catTarjetaDep.id,     wallet_id: walletSantander.id, expense_template_id: etLiverpoolAna.id },
      { fortnight_id: f_house_may26_first.id, house_id: casaDemo.id, description: 'Liverpool extra',  amount: 200,      is_paid: false, due_day: 12, category_id: catTarjetaDep.id,     wallet_id: walletBanamex.id,   expense_template_id: etLiverpoolLuis.id },
      { fortnight_id: f_house_may26_first.id, house_id: casaDemo.id, description: 'Celular plan',      amount: 1200,    is_paid: false, due_day: 7,  category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttLuisFirst.id },
      { fortnight_id: f_house_may26_first.id, house_id: casaDemo.id, description: 'Sky',             amount: 250,     is_paid: false, due_day: 30, category_id: catEntretenimiento.id, wallet_id: walletSantander.id, expense_template_id: etSky.id },
      { fortnight_id: f_house_may26_first.id, house_id: casaDemo.id, description: 'Spotify',         amount: 200,     is_paid: false, due_day: 30, category_id: catSpotify.id, wallet_id: walletSantander.id, expense_template_id: etSpotify.id },
      { fortnight_id: f_house_may26_first.id, house_id: casaDemo.id, description: 'C&A efectivo',    amount: 950,     is_paid: false, due_day: 10, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etCnAEfectivo.id },
      { fortnight_id: f_house_may26_first.id, house_id: casaDemo.id, description: 'C&A departamental', amount: 300,   is_paid: false, due_day: 3,  category_id: catTarjetaDep.id,     wallet_id: walletBanamex.id,   expense_template_id: etCnADepartamental.id },
      { fortnight_id: f_house_may26_first.id, house_id: casaDemo.id, description: 'Farmacia mensual',        amount: 2000,    is_paid: false, due_day: 1,  category_id: catMedicamentos.id,   wallet_id: walletSantander.id, expense_template_id: etFarmaciaMensual.id },
      { fortnight_id: f_house_may26_first.id, house_id: casaDemo.id, description: 'Farmacia',      amount: 300,     is_paid: false, due_day: 11, category_id: catMedicamentos.id,   wallet_id: walletBanamex.id,   expense_template_id: etFarmacia.id },
      { fortnight_id: f_house_may26_first.id, house_id: casaDemo.id, description: 'Farmacia de apoyo',    amount: 150,     is_paid: false, due_day: 1,  category_id: catMedicamentos.id,   wallet_id: walletBanamex.id,   expense_template_id: etFarmaciaApoyo.id },
      { fortnight_id: f_house_may26_first.id, house_id: casaDemo.id, description: 'Credito Banamex', amount: 2800,    is_paid: false, due_day: 15, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etCreditoBanamex.id },
      { fortnight_id: f_house_may26_first.id, house_id: casaDemo.id, description: 'Mercado Pago',    amount: 1600,    is_paid: false, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id },
      { fortnight_id: f_house_may26_first.id, house_id: casaDemo.id, description: 'Renta',           amount: 1600,    is_paid: false, category_id: catCasa.id,           wallet_id: walletBanamex.id },

      // ── House: May 2026 second ───────────────
      { fortnight_id: f_house_may26_second.id, house_id: casaDemo.id, description: 'Renta',          amount: 8000,    is_paid: false, due_day: 15, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etRenta.id },
      { fortnight_id: f_house_may26_second.id, house_id: casaDemo.id, description: 'TELMEX',         amount: 650,     is_paid: false, due_day: 23, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etTelmex.id },
      { fortnight_id: f_house_may26_second.id, house_id: casaDemo.id, description: 'Celular',    amount: 400,  is_paid: false, due_day: 23, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttAna.id },
      { fortnight_id: f_house_may26_second.id, house_id: casaDemo.id, description: 'Celular extra',     amount: 450,  is_paid: false, due_day: 19, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttLuisSecond.id },
      { fortnight_id: f_house_may26_second.id, house_id: casaDemo.id, description: 'Mercado pago',   amount: 1000, is_paid: false, due_day: 17, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etMercadoPago.id },
      { fortnight_id: f_house_may26_second.id, house_id: casaDemo.id, description: 'CFE',            amount: 500,     is_paid: false, due_day: 17, category_id: catCasa.id,           wallet_id: walletSantander.id, expense_template_id: etCfe.id },
      { fortnight_id: f_house_may26_second.id, house_id: casaDemo.id, description: 'Super',          amount: 2400,    is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etSuper.id },
      { fortnight_id: f_house_may26_second.id, house_id: casaDemo.id, description: 'Préstamo nómina', amount: 1250, is_paid: false, due_day: 15, category_id: catPrestamos.id,      wallet_id: walletSantander.id, expense_template_id: etNomina.id },
      { fortnight_id: f_house_may26_second.id, house_id: casaDemo.id, description: 'Préstamo nómina B',  amount: 2800, is_paid: false, due_day: 15, category_id: catPrestamos.id,      wallet_id: walletBanamex.id,   expense_template_id: etNominaB.id },
      { fortnight_id: f_house_may26_second.id, house_id: casaDemo.id, description: 'Agua',           amount: 250,     is_paid: false, due_day: 13, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etAgua.id },
      { fortnight_id: f_house_may26_second.id, house_id: casaDemo.id, description: 'Transporte', amount: 450, is_paid: false, due_day: 1,  category_id: catTransporteHouse.id, wallet_id: walletSantander.id, expense_template_id: etTransporteAna.id },
      { fortnight_id: f_house_may26_second.id, house_id: casaDemo.id, description: 'Carne',          amount: 900,     is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etCarne.id },
      { fortnight_id: f_house_may26_second.id, house_id: casaDemo.id, description: 'Farmacia extra',          amount: 350,     is_paid: false, due_day: 1,  category_id: catMedicamentos.id,   wallet_id: walletSantander.id, expense_template_id: etFarmaciaExtra.id },
      { fortnight_id: f_house_may26_second.id, house_id: casaDemo.id, description: 'Credito Banamex', amount: 2800,   is_paid: false, due_day: 15, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etCreditoBanamex.id },
      { fortnight_id: f_house_may26_second.id, house_id: casaDemo.id, description: 'Didi card',      amount: 800,     is_paid: false, due_day: 18, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etDidiCard.id },

      // ── House: Jun 2026 first ────────────────
      { fortnight_id: f_house_jun26_first.id, house_id: casaDemo.id, description: 'Super',           amount: 2400,    is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etSuper.id },
      { fortnight_id: f_house_jun26_first.id, house_id: casaDemo.id, description: 'Préstamo nómina',  amount: 1250, is_paid: false, due_day: 15, category_id: catPrestamos.id,      wallet_id: walletSantander.id, expense_template_id: etNomina.id },
      { fortnight_id: f_house_jun26_first.id, house_id: casaDemo.id, description: 'Préstamo nómina B',   amount: 2800, is_paid: false, due_day: 15, category_id: catPrestamos.id,      wallet_id: walletBanamex.id,   expense_template_id: etNominaB.id },
      { fortnight_id: f_house_jun26_first.id, house_id: casaDemo.id, description: 'Agua',            amount: 250,     is_paid: false, due_day: 13, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etAgua.id },
      { fortnight_id: f_house_jun26_first.id, house_id: casaDemo.id, description: 'Transporte', amount: 450,   is_paid: false, due_day: 1,  category_id: catTransporteHouse.id, wallet_id: walletSantander.id, expense_template_id: etTransporteAna.id },
      { fortnight_id: f_house_jun26_first.id, house_id: casaDemo.id, description: 'Carne',           amount: 900,     is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etCarne.id },
      { fortnight_id: f_house_jun26_first.id, house_id: casaDemo.id, description: 'Liverpool', amount: 550, is_paid: false, due_day: 5,  category_id: catTarjetaDep.id,     wallet_id: walletSantander.id, expense_template_id: etLiverpoolAna.id },
      { fortnight_id: f_house_jun26_first.id, house_id: casaDemo.id, description: 'Liverpool extra',  amount: 200,      is_paid: false, due_day: 12, category_id: catTarjetaDep.id,     wallet_id: walletBanamex.id,   expense_template_id: etLiverpoolLuis.id },
      { fortnight_id: f_house_jun26_first.id, house_id: casaDemo.id, description: 'Celular plan',      amount: 1200,    is_paid: false, due_day: 7,  category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttLuisFirst.id },
      { fortnight_id: f_house_jun26_first.id, house_id: casaDemo.id, description: 'Sky',             amount: 250,     is_paid: false, due_day: 30, category_id: catEntretenimiento.id, wallet_id: walletSantander.id, expense_template_id: etSky.id },
      { fortnight_id: f_house_jun26_first.id, house_id: casaDemo.id, description: 'Spotify',         amount: 200,     is_paid: false, due_day: 30, category_id: catSpotify.id, wallet_id: walletSantander.id, expense_template_id: etSpotify.id },
      { fortnight_id: f_house_jun26_first.id, house_id: casaDemo.id, description: 'C&A efectivo',    amount: 950,     is_paid: false, due_day: 10, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etCnAEfectivo.id },
      { fortnight_id: f_house_jun26_first.id, house_id: casaDemo.id, description: 'C&A departamental', amount: 300,   is_paid: false, due_day: 3,  category_id: catTarjetaDep.id,     wallet_id: walletBanamex.id,   expense_template_id: etCnADepartamental.id },
      { fortnight_id: f_house_jun26_first.id, house_id: casaDemo.id, description: 'Farmacia mensual',        amount: 2000,    is_paid: false, due_day: 1,  category_id: catMedicamentos.id,   wallet_id: walletSantander.id, expense_template_id: etFarmaciaMensual.id },
      { fortnight_id: f_house_jun26_first.id, house_id: casaDemo.id, description: 'Farmacia',      amount: 300,     is_paid: false, due_day: 11, category_id: catMedicamentos.id,   wallet_id: walletBanamex.id,   expense_template_id: etFarmacia.id },
      { fortnight_id: f_house_jun26_first.id, house_id: casaDemo.id, description: 'Farmacia de apoyo',    amount: 150,     is_paid: false, due_day: 1,  category_id: catMedicamentos.id,   wallet_id: walletBanamex.id,   expense_template_id: etFarmaciaApoyo.id },
      { fortnight_id: f_house_jun26_first.id, house_id: casaDemo.id, description: 'Credito Banamex', amount: 2800,    is_paid: false, due_day: 15, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etCreditoBanamex.id },

      // ── House: Jun 2026 second ───────────────
      { fortnight_id: f_house_jun26_second.id, house_id: casaDemo.id, description: 'Renta',          amount: 9000,    is_paid: false, due_day: 15, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etRenta.id },
      { fortnight_id: f_house_jun26_second.id, house_id: casaDemo.id, description: 'TELMEX',         amount: 650,     is_paid: false, due_day: 23, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etTelmex.id },
      { fortnight_id: f_house_jun26_second.id, house_id: casaDemo.id, description: 'Celular',    amount: 400,  is_paid: false, due_day: 23, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttAna.id },
      { fortnight_id: f_house_jun26_second.id, house_id: casaDemo.id, description: 'Celular extra',     amount: 450,  is_paid: false, due_day: 19, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttLuisSecond.id },
      { fortnight_id: f_house_jun26_second.id, house_id: casaDemo.id, description: 'Mercado pago',   amount: 850,  is_paid: false, due_day: 17, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etMercadoPago.id },
      { fortnight_id: f_house_jun26_second.id, house_id: casaDemo.id, description: 'CFE',            amount: 500,     is_paid: false, due_day: 17, category_id: catCasa.id,           wallet_id: walletSantander.id, expense_template_id: etCfe.id },
      { fortnight_id: f_house_jun26_second.id, house_id: casaDemo.id, description: 'Super',          amount: 2400,    is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etSuper.id },
      { fortnight_id: f_house_jun26_second.id, house_id: casaDemo.id, description: 'Préstamo nómina', amount: 1250, is_paid: false, due_day: 15, category_id: catPrestamos.id,      wallet_id: walletSantander.id, expense_template_id: etNomina.id },
      { fortnight_id: f_house_jun26_second.id, house_id: casaDemo.id, description: 'Préstamo nómina B',  amount: 2800, is_paid: false, due_day: 15, category_id: catPrestamos.id,      wallet_id: walletBanamex.id,   expense_template_id: etNominaB.id },
      { fortnight_id: f_house_jun26_second.id, house_id: casaDemo.id, description: 'Agua',           amount: 250,     is_paid: false, due_day: 13, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etAgua.id },
      { fortnight_id: f_house_jun26_second.id, house_id: casaDemo.id, description: 'Transporte', amount: 450, is_paid: false, due_day: 1,  category_id: catTransporteHouse.id, wallet_id: walletSantander.id, expense_template_id: etTransporteAna.id },
      { fortnight_id: f_house_jun26_second.id, house_id: casaDemo.id, description: 'Carne',          amount: 900,     is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etCarne.id },
      { fortnight_id: f_house_jun26_second.id, house_id: casaDemo.id, description: 'Farmacia extra',          amount: 350,     is_paid: false, due_day: 1,  category_id: catMedicamentos.id,   wallet_id: walletSantander.id, expense_template_id: etFarmaciaExtra.id },
      { fortnight_id: f_house_jun26_second.id, house_id: casaDemo.id, description: 'Credito Banamex', amount: 2800,   is_paid: false, due_day: 15, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etCreditoBanamex.id },
      { fortnight_id: f_house_jun26_second.id, house_id: casaDemo.id, description: 'Didi card',      amount: 1600,    is_paid: false, due_day: 18, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etDidiCard.id },
    ],
  });

  // ─────────────────────────────────────────────
  // LOANS (house demo for liquidity projection)
  // ─────────────────────────────────────────────
  const personalLoanSchedule = generateLoanPaymentSchedule({
    startDate: parseCalendarDate('2026-03-01'),
    paymentAmount: 4000,
    paymentCount: 10,
    frequency: 'MONTHLY',
  });

  const lenderBanamex = await prisma.lender.create({
    data: {
      name: 'Banamex',
      house_id: casaDemo.id,
    },
  });
  const lenderNomina = await prisma.lender.create({
    data: {
      name: 'Nómina',
      house_id: casaDemo.id,
    },
  });

  await prisma.loan.create({
    data: {
      name: 'Crédito personal Banamex',
      lender: 'Banamex',
      lender_id: lenderBanamex.id,
      type: 'PERSONAL',
      status: 'ACTIVE',
      principal_amount: 40000,
      payment_amount: 4000,
      payment_count: 10,
      frequency: 'MONTHLY',
      start_date: parseCalendarDate('2026-03-01'),
      payment_source: 'WALLET',
      house_id: casaDemo.id,
      source_wallet_id: walletBanamex.id,
      notes: 'Préstamo demo para proyección mes a mes',
      payments: {
        create: personalLoanSchedule.map((payment) => ({
          sequence: payment.sequence,
          due_date: payment.dueDate,
          amount: payment.amount.toString(),
          source_wallet_id: walletBanamex.id,
        })),
      },
    },
  });

  const personalLoanScheduleB = generateLoanPaymentSchedule({
    startDate: parseCalendarDate('2026-03-18'),
    paymentAmount: 2000,
    paymentCount: 8,
    frequency: 'MONTHLY',
  });

  await prisma.loan.create({
    data: {
      name: 'Crédito auto Banamex',
      lender: 'Banamex',
      lender_id: lenderBanamex.id,
      type: 'PERSONAL',
      status: 'ACTIVE',
      principal_amount: 16000,
      payment_amount: 2000,
      payment_count: 8,
      frequency: 'MONTHLY',
      start_date: parseCalendarDate('2026-03-18'),
      payment_source: 'WALLET',
      house_id: casaDemo.id,
      source_wallet_id: walletBanamex.id,
      notes: 'Segundo contrato del mismo prestamista para pago consolidado',
      payments: {
        create: personalLoanScheduleB.map((payment) => ({
          sequence: payment.sequence,
          due_date: payment.dueDate,
          amount: payment.amount.toString(),
          source_wallet_id: walletBanamex.id,
        })),
      },
    },
  });

  const nominaSchedule = generateLoanPaymentSchedule({
    startDate: parseCalendarDate('2026-03-01'),
    paymentAmount: 1250,
    paymentCount: 16,
    frequency: 'FORTNIGHTLY',
  });
  const nominaBSchedule = generateLoanPaymentSchedule({
    startDate: parseCalendarDate('2026-03-01'),
    paymentAmount: 2800,
    paymentCount: 18,
    frequency: 'FORTNIGHTLY',
  });

  await prisma.loan.create({
    data: {
      name: 'Préstamo nómina',
      lender: 'Nómina',
      lender_id: lenderNomina.id,
      type: 'PAYROLL',
      status: 'ACTIVE',
      principal_amount: 1250 * 16,
      payment_amount: 1250,
      payment_count: 16,
      frequency: 'FORTNIGHTLY',
      start_date: parseCalendarDate('2026-03-01'),
      payment_source: 'PAYROLL_DEDUCTION',
      house_id: casaDemo.id,
      notes: 'Descuento de nómina; el punto verde es el mes en que termina',
      payments: {
        create: nominaSchedule.map((payment) => ({
          sequence: payment.sequence,
          due_date: payment.dueDate,
          amount: payment.amount.toString(),
        })),
      },
    },
  });

  await prisma.loan.create({
    data: {
      name: 'Préstamo nómina B',
      lender: 'Nómina',
      lender_id: lenderNomina.id,
      type: 'PAYROLL',
      status: 'ACTIVE',
      principal_amount: 2800 * 18,
      payment_amount: 2800,
      payment_count: 18,
      frequency: 'FORTNIGHTLY',
      start_date: parseCalendarDate('2026-03-01'),
      payment_source: 'PAYROLL_DEDUCTION',
      house_id: casaDemo.id,
      notes: 'Descuento de nómina; el punto verde es el mes en que termina',
      payments: {
        create: nominaBSchedule.map((payment) => ({
          sequence: payment.sequence,
          due_date: payment.dueDate,
          amount: payment.amount.toString(),
        })),
      },
    },
  });

  // ─────────────────────────────────────────────
  // MSI PURCHASES (active installments on credit cards)
  // ─────────────────────────────────────────────
  await prisma.expense.createMany({
    data: [
      {
        fortnight_id: f_house_mar26_first.id,
        house_id: casaDemo.id,
        description: 'Laptop a 12 meses',
        amount: 900,
        is_paid: true,
        payment_date: parseCalendarDate('2026-02-10'),
        category_id: catCasa.id,
        wallet_id: walletDidiCard.id,
        credit_installment_current: 2,
        credit_installment_total: 12,
      },
      {
        fortnight_id: f_house_mar26_first.id,
        house_id: casaDemo.id,
        description: 'Televisor Liverpool 6 meses',
        amount: 1300,
        is_paid: true,
        payment_date: parseCalendarDate('2026-01-20'),
        category_id: catCasa.id,
        wallet_id: walletDidiCard.id,
        credit_installment_current: 3,
        credit_installment_total: 6,
      },
      {
        fortnight_id: f_house_mar26_second.id,
        house_id: casaDemo.id,
        description: 'Refrigerador C&A 18 meses',
        amount: 700,
        is_paid: true,
        payment_date: parseCalendarDate('2026-02-28'),
        category_id: catCasa.id,
        wallet_id: walletCnAEfectivo.id,
        credit_installment_current: 1,
        credit_installment_total: 18,
      },
    ],
  });

  console.log('✅ Database seeded with demo data');
}

main().finally(async () => {
  await prisma.$disconnect();
});
