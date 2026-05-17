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

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  /**
   * CLEAN DATABASE (order respects FK constraints)
   * Default password for all users: temp1234
   */
  await prisma.pantryReceiptLine.deleteMany();
  await prisma.pantryReceipt.deleteMany();
  await prisma.pantryProduct.deleteMany();
  await prisma.creditCardStatementImport.deleteMany();
  await prisma.creditCardPayment.deleteMany();
  await prisma.budgetAllocation.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.income.deleteMany();
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
  const password = await hash('temp1234', 10);

  const carmen = await prisma.user.create({
    data: { name: 'Carmen Solorzano', email: 'Consepcionsolorzano39@gmail.com', password, onboarding_completed: true },
  });
  const jorge = await prisma.user.create({
    data: { name: 'Jorge', email: 'jorgeleon983@gmail.com', password, onboarding_completed: true },
  });

  // ─────────────────────────────────────────────
  // HOUSES
  // ─────────────────────────────────────────────
  const leonSolorzano = await prisma.house.create({
    data: { name: 'Leon Solorzano', owner_id: carmen.id },
  });
  const casaJorge = await prisma.house.create({
    data: { name: 'Casa de Jorge', owner_id: jorge.id },
  });

  await prisma.houseMember.createMany({
    data: [
      { house_id: leonSolorzano.id, user_id: carmen.id, role: HouseRole.OWNER },
      { house_id: casaJorge.id,     user_id: jorge.id,  role: HouseRole.OWNER },
      { house_id: leonSolorzano.id, user_id: jorge.id,  role: HouseRole.MEMBER },
    ],
  });

  // ─────────────────────────────────────────────
  // CATEGORIES
  // ─────────────────────────────────────────────

  // Carmen personal
  const catCarmenComida      = await prisma.category.create({ data: { name: 'Comida',     icon: '🍽️', user_id: carmen.id } });
  const catCarmenTransporte  = await prisma.category.create({ data: { name: 'Transporte', icon: '🚗', user_id: carmen.id } });
  const catCarmenVivienda    = await prisma.category.create({ data: { name: 'Vivienda',   icon: '🏠', user_id: carmen.id } });

  // Jorge personal
  const catJorgeComida       = await prisma.category.create({ data: { name: 'Comida',     icon: '🍽️', user_id: jorge.id } });
  const catJorgeTransporte   = await prisma.category.create({ data: { name: 'Transporte', icon: '🚗', user_id: jorge.id } });
  const catJorgeVivienda     = await prisma.category.create({ data: { name: 'Vivienda',   icon: '🏠', user_id: jorge.id } });

  // Leon Solorzano house
  const catCasa              = await prisma.category.create({ data: { name: 'Casa',                  icon: '🏠', house_id: leonSolorzano.id } });
  const catSuscripciones     = await prisma.category.create({ data: { name: 'Suscripciones',         icon: '🔁', house_id: leonSolorzano.id } });
  const catTarjetaCredito    = await prisma.category.create({ data: { name: 'Tarjeta de credito',    icon: '💳', house_id: leonSolorzano.id } });
  const catTarjetaDep        = await prisma.category.create({ data: { name: 'Tarjeta departamental', icon: '💳', house_id: leonSolorzano.id } });
  const catComidaHouse       = await prisma.category.create({ data: { name: 'Comida',                icon: '🍽️', house_id: leonSolorzano.id } });
  const catSalidas           = await prisma.category.create({ data: { name: 'Salidas',               icon: '🎬', house_id: leonSolorzano.id } });
  const catEntretenimiento   = await prisma.category.create({ data: { name: 'Entretenimiento',       icon: '🎬', house_id: leonSolorzano.id } });
  const catMedicamentos      = await prisma.category.create({ data: { name: 'Medicamentos',          icon: '💊', house_id: leonSolorzano.id } });
  const catTransporteHouse   = await prisma.category.create({ data: { name: 'Trnasporte',            icon: '🚗', house_id: leonSolorzano.id } });
  const catInversiones       = await prisma.category.create({ data: { name: 'Inversiones',           icon: '📈', house_id: leonSolorzano.id } });
  const catApoyosFamiliares  = await prisma.category.create({ data: { name: 'Apoyos familiares',     icon: '🤝', house_id: leonSolorzano.id } });
  const catPrestamos         = await prisma.category.create({ data: { name: 'Prestamos',             icon: '🏦', house_id: leonSolorzano.id } });

  // ─────────────────────────────────────────────
  // WALLETS
  // ─────────────────────────────────────────────

  // Carmen personal
  await prisma.wallet.create({ data: { name: 'Efectivo',         type: PaymentMethodType.CASH,       user_id: carmen.id } });
  await prisma.wallet.create({ data: { name: 'Cuenta principal', type: PaymentMethodType.DEBIT_CARD, user_id: carmen.id } });

  // Jorge personal
  await prisma.wallet.create({ data: { name: 'Efectivo', type: PaymentMethodType.CASH,       user_id: jorge.id } });
  const walletJorgeBanamex = await prisma.wallet.create({
    data: { name: 'BANAMEX', type: PaymentMethodType.DEBIT_CARD, amount: -678, user_id: jorge.id },
  });

  // Leon Solorzano house wallets
  const walletSantander = await prisma.wallet.create({
    data: { name: 'Santander', type: PaymentMethodType.DEBIT_CARD, amount: 5000, house_id: leonSolorzano.id },
  });
  const walletBanamex = await prisma.wallet.create({
    data: { name: 'Banamex', type: PaymentMethodType.DEBIT_CARD, amount: 2920.42, house_id: leonSolorzano.id },
  });
  const walletDidiCard = await prisma.wallet.create({
    data: {
      name: 'DIDI Card', type: PaymentMethodType.CREDIT_CARD,
      amount: 1179.43, cutoff_day: 3, due_day: 18, credit_limit: 1500,
      house_id: leonSolorzano.id,
    },
  });
  await prisma.wallet.create({
    data: {
      name: 'C&A Departamental', type: PaymentMethodType.DEPARTMENT_STORE_CARD,
      amount: 437.25, cutoff_day: 10, due_day: 3, credit_limit: 5640,
      house_id: leonSolorzano.id,
    },
  });
  const walletCnAEfectivo = await prisma.wallet.create({
    data: {
      name: 'C&A EFECTIVO', type: PaymentMethodType.CREDIT_CARD,
      amount: 2532.57, cutoff_day: 15, due_day: 8, credit_limit: 5100,
      house_id: leonSolorzano.id,
    },
  });
  await prisma.wallet.create({
    data: {
      name: 'Mercado Pago', type: PaymentMethodType.CREDIT_CARD,
      cutoff_day: 7, due_day: 17, credit_limit: 9400,
      house_id: leonSolorzano.id,
    },
  });
  await prisma.wallet.create({
    data: {
      name: 'Liverpool Jorge', type: PaymentMethodType.DEPARTMENT_STORE_CARD,
      cutoff_day: 12, due_day: 13, credit_limit: 10000,
      house_id: leonSolorzano.id,
    },
  });
  await prisma.wallet.create({
    data: {
      name: 'Liverpool Carmen', type: PaymentMethodType.DEPARTMENT_STORE_CARD,
      cutoff_day: 4, due_day: 5, credit_limit: 7000,
      house_id: leonSolorzano.id,
    },
  });
  await prisma.wallet.create({
    data: { name: 'BBVA Jorge', type: PaymentMethodType.CASH, amount: 306.20, house_id: leonSolorzano.id },
  });
  await prisma.wallet.create({
    data: {
      name: 'Mercado libre', type: PaymentMethodType.CREDIT_CARD,
      cutoff_day: 22, due_day: 4, credit_limit: 31000,
      house_id: leonSolorzano.id,
    },
  });
  await prisma.wallet.create({
    data: {
      name: 'Sears', type: PaymentMethodType.DEPARTMENT_STORE_CARD,
      cutoff_day: 10, due_day: 15, credit_limit: 10000,
      house_id: leonSolorzano.id,
    },
  });

  // ─────────────────────────────────────────────
  // INCOME TEMPLATES
  // ─────────────────────────────────────────────
  const itSueldoCarmen = await prisma.incomeTemplate.create({
    data: {
      name: 'Sueldo', suggested_amount: 6000,
      applies_first_fortnight: true, applies_second_fortnight: true, active: true,
      user_id: carmen.id,
    },
  });
  const itSueldoJorge = await prisma.incomeTemplate.create({
    data: {
      name: 'Sueldo', suggested_amount: 15000, source: 'SALARIO',
      applies_first_fortnight: true, applies_second_fortnight: true, active: true,
      user_id: jorge.id,
    },
  });
  const itSalarioCarmen = await prisma.incomeTemplate.create({
    data: {
      name: 'Salario Carmen', suggested_amount: 5500, source: 'Salario',
      applies_first_fortnight: true, applies_second_fortnight: true, active: true,
      house_id: leonSolorzano.id,
    },
  });
  const itSalarioJorge = await prisma.incomeTemplate.create({
    data: {
      name: 'Salario Jorge', suggested_amount: 15000, source: 'Salario',
      applies_first_fortnight: true, applies_second_fortnight: true, active: true,
      house_id: leonSolorzano.id,
    },
  });

  // ─────────────────────────────────────────────
  // EXPENSE TEMPLATES
  // ─────────────────────────────────────────────

  // Carmen personal
  const etCarmenRenta    = await prisma.expenseTemplate.create({
    data: { name: 'Renta',    is_recurring: true, applies_first_fortnight: true, applies_second_fortnight: true, user_id: carmen.id },
  });
  const etCarmenInternet = await prisma.expenseTemplate.create({
    data: { name: 'Internet', is_recurring: true, applies_first_fortnight: true, applies_second_fortnight: true, user_id: carmen.id },
  });

  // Jorge personal
  const etJorgeRenta    = await prisma.expenseTemplate.create({
    data: { name: 'Renta',    is_recurring: true, applies_first_fortnight: true, applies_second_fortnight: true, user_id: jorge.id },
  });
  const etJorgeInternet = await prisma.expenseTemplate.create({
    data: { name: 'Internet', is_recurring: true, applies_first_fortnight: true, applies_second_fortnight: true, user_id: jorge.id },
  });

  // Leon Solorzano house expense templates
  const etRenta = await prisma.expenseTemplate.create({
    data: {
      name: 'Renta', suggested_amount: 8500, is_recurring: true,
      applies_first_fortnight: false, applies_second_fortnight: true,
      due_day: 15, cutoff_day: 1, due_day_second_fortnight: 15,
      category_id: catCasa.id, wallet_id: walletBanamex.id, house_id: leonSolorzano.id,
    },
  });
  const etTelmex = await prisma.expenseTemplate.create({
    data: {
      name: 'TELMEX', suggested_amount: 658, is_recurring: true,
      applies_first_fortnight: false, applies_second_fortnight: true,
      due_day: 23, cutoff_day: 1, due_day_second_fortnight: 23,
      category_id: catCasa.id, wallet_id: walletBanamex.id, house_id: leonSolorzano.id,
    },
  });
  const etAttCarmen = await prisma.expenseTemplate.create({
    data: {
      name: 'AT&T Carmen', suggested_amount: 400.99, is_recurring: true,
      applies_first_fortnight: false, applies_second_fortnight: true,
      due_day: 23, cutoff_day: 1, due_day_second_fortnight: 23,
      category_id: catCasa.id, wallet_id: walletBanamex.id, house_id: leonSolorzano.id,
    },
  });
  const etAttJorgeSecond = await prisma.expenseTemplate.create({
    data: {
      name: 'AT&T Jorge', suggested_amount: 453.06, is_recurring: true,
      applies_first_fortnight: false, applies_second_fortnight: true,
      due_day: 19, cutoff_day: 1, due_day_second_fortnight: 19,
      category_id: catCasa.id, wallet_id: walletBanamex.id, house_id: leonSolorzano.id,
    },
  });
  const etMercadoPago = await prisma.expenseTemplate.create({
    data: {
      name: 'Mercado pago', suggested_amount: 823.16,
      applies_first_fortnight: false, applies_second_fortnight: true,
      due_day: 17, cutoff_day: 1, due_day_second_fortnight: 17,
      category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id, house_id: leonSolorzano.id,
    },
  });
  const etCfe = await prisma.expenseTemplate.create({
    data: {
      name: 'CFE', suggested_amount: 450, is_recurring: true,
      applies_first_fortnight: false, applies_second_fortnight: true,
      due_day: 17, cutoff_day: 1, due_day_second_fortnight: 17,
      category_id: catCasa.id, wallet_id: walletSantander.id, house_id: leonSolorzano.id,
    },
  });
  const etSuper = await prisma.expenseTemplate.create({
    data: {
      name: 'Super', suggested_amount: 2000, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: true,
      due_day: 15, cutoff_day: 1, due_day_first_fortnight: 15, due_day_second_fortnight: 15,
      category_id: catComidaHouse.id, wallet_id: walletSantander.id, house_id: leonSolorzano.id,
    },
  });
  const etFonacotCarmen = await prisma.expenseTemplate.create({
    data: {
      name: 'Fonacot Carmen', suggested_amount: 1243.68, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: true,
      due_day: 15, cutoff_day: 1, due_day_first_fortnight: 15, due_day_second_fortnight: 15,
      category_id: catPrestamos.id, wallet_id: walletSantander.id, house_id: leonSolorzano.id,
    },
  });
  const etFonacotJorge = await prisma.expenseTemplate.create({
    data: {
      name: 'Fonacot Jorge', suggested_amount: 2792.73, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: true,
      due_day: 15, cutoff_day: 1, due_day_first_fortnight: 15, due_day_second_fortnight: 15,
      category_id: catPrestamos.id, wallet_id: walletBanamex.id, house_id: leonSolorzano.id,
    },
  });
  const etCarne = await prisma.expenseTemplate.create({
    data: {
      name: 'Carne', suggested_amount: 800, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: true,
      due_day: 15, cutoff_day: 1, due_day_first_fortnight: 15, due_day_second_fortnight: 15,
      category_id: catComidaHouse.id, wallet_id: walletSantander.id, house_id: leonSolorzano.id,
    },
  });
  const etAgua = await prisma.expenseTemplate.create({
    data: {
      name: 'Agua', suggested_amount: 200, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: true,
      due_day: 13, cutoff_day: 1, due_day_first_fortnight: 13, due_day_second_fortnight: 13,
      category_id: catComidaHouse.id, wallet_id: walletSantander.id, house_id: leonSolorzano.id,
    },
  });
  const etTransporteCarmen = await prisma.expenseTemplate.create({
    data: {
      name: 'Transporte Carmen', suggested_amount: 400, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: true,
      due_day: 1, cutoff_day: 1, due_day_first_fortnight: 1, due_day_second_fortnight: 1,
      category_id: catTransporteHouse.id, wallet_id: walletSantander.id, house_id: leonSolorzano.id,
    },
  });
  const etCreditoBanamex = await prisma.expenseTemplate.create({
    data: {
      name: 'Credito Banamex', suggested_amount: 2500, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: true,
      due_day: 15, cutoff_day: 1, due_day_first_fortnight: 15, due_day_second_fortnight: 15,
      category_id: catPrestamos.id, wallet_id: walletBanamex.id, house_id: leonSolorzano.id,
    },
  });
  const etLiverpoolCarmen = await prisma.expenseTemplate.create({
    data: {
      name: 'Liverpool Carmen', suggested_amount: 531.67, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 5, cutoff_day: 4, due_day_first_fortnight: 5,
      category_id: catTarjetaDep.id, wallet_id: walletSantander.id, house_id: leonSolorzano.id,
    },
  });
  const etLiverpoolJorge = await prisma.expenseTemplate.create({
    data: {
      name: 'Liverpool Jorge', suggested_amount: 1, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 12, cutoff_day: 1, due_day_first_fortnight: 12,
      category_id: catTarjetaDep.id, wallet_id: walletBanamex.id, house_id: leonSolorzano.id,
    },
  });
  const etAttJorgeFirst = await prisma.expenseTemplate.create({
    data: {
      name: 'AT&T Jorge', suggested_amount: 1160, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 7, cutoff_day: 1, due_day_first_fortnight: 7,
      category_id: catCasa.id, wallet_id: walletBanamex.id, house_id: leonSolorzano.id,
    },
  });
  const etSpotify = await prisma.expenseTemplate.create({
    data: {
      name: 'Spotify', suggested_amount: 189, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 30, cutoff_day: 1, due_day_first_fortnight: 30,
      category_id: catEntretenimiento.id, wallet_id: walletSantander.id, house_id: leonSolorzano.id,
    },
  });
  const etSky = await prisma.expenseTemplate.create({
    data: {
      name: 'Sky', suggested_amount: 269, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 30, cutoff_day: 1, due_day_first_fortnight: 30,
      category_id: catEntretenimiento.id, wallet_id: walletSantander.id, house_id: leonSolorzano.id,
    },
  });
  const etCnAEfectivo = await prisma.expenseTemplate.create({
    data: {
      name: 'C&A efectivo', suggested_amount: 928, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 10, cutoff_day: 15, due_day_first_fortnight: 10,
      category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id, house_id: leonSolorzano.id,
    },
  });
  const etCnADepartamental = await prisma.expenseTemplate.create({
    data: {
      name: 'C&A departamental', suggested_amount: 250, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 3, cutoff_day: 10, due_day_first_fortnight: 3,
      category_id: catTarjetaDep.id, wallet_id: walletBanamex.id, house_id: leonSolorzano.id,
    },
  });
  const etPaula = await prisma.expenseTemplate.create({
    data: {
      name: 'Paula', suggested_amount: 300, is_recurring: true,
      applies_first_fortnight: false, applies_second_fortnight: true,
      due_day: 1, cutoff_day: 1, due_day_second_fortnight: 1,
      category_id: catMedicamentos.id, wallet_id: walletSantander.id, house_id: leonSolorzano.id,
    },
  });
  const etConcerta = await prisma.expenseTemplate.create({
    data: {
      name: 'Concerta', suggested_amount: 2400, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 1, cutoff_day: 1, due_day_first_fortnight: 1,
      category_id: catMedicamentos.id, wallet_id: walletSantander.id, house_id: leonSolorzano.id,
    },
  });
  const etQuetiapina = await prisma.expenseTemplate.create({
    data: {
      name: 'Quetiapina', suggested_amount: 250, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 11, cutoff_day: 1, due_day_first_fortnight: 11,
      category_id: catMedicamentos.id, wallet_id: walletBanamex.id, house_id: leonSolorzano.id,
    },
  });
  const etLamotriglina = await prisma.expenseTemplate.create({
    data: {
      name: 'Lamotriglina', suggested_amount: 160, is_recurring: true,
      applies_first_fortnight: true, applies_second_fortnight: false,
      due_day: 1, cutoff_day: 1, due_day_first_fortnight: 1,
      category_id: catMedicamentos.id, wallet_id: walletBanamex.id, house_id: leonSolorzano.id,
    },
  });
  const etDidiCard = await prisma.expenseTemplate.create({
    data: {
      name: 'Didi card', suggested_amount: 1500, is_recurring: true,
      applies_first_fortnight: false, applies_second_fortnight: true,
      due_day: 18, cutoff_day: 3, due_day_second_fortnight: 18,
      category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id, house_id: leonSolorzano.id,
    },
  });

  // ─────────────────────────────────────────────
  // FORTNIGHTS
  // ─────────────────────────────────────────────

  // Carmen personal
  const f_carmen_mar26_first  = await prisma.fortnight.create({ data: { year: 2026, month: 3, period: FortnightPeriod.FIRST,  start_date: new Date('2026-03-01T06:00:00'), end_date: new Date('2026-03-14T06:00:00'), label: 'Primera quincena - 3/2026',     user_id: carmen.id } });
  const f_carmen_mar26_second = await prisma.fortnight.create({ data: { year: 2026, month: 3, period: FortnightPeriod.SECOND, start_date: new Date('2026-03-15T06:00:00'), end_date: new Date('2026-03-31T06:00:00'), label: 'Segunda quincena - 3/2026',     user_id: carmen.id } });
  const f_carmen_apr26_first  = await prisma.fortnight.create({ data: { year: 2026, month: 4, period: FortnightPeriod.FIRST,  start_date: new Date('2026-04-01T06:00:00'), end_date: new Date('2026-04-14T06:00:00'), label: 'Primera quincena - 4/2026',     user_id: carmen.id } });
  const f_carmen_apr26_second = await prisma.fortnight.create({ data: { year: 2026, month: 4, period: FortnightPeriod.SECOND, start_date: new Date('2026-04-15T06:00:00'), end_date: new Date('2026-04-30T06:00:00'), label: 'Segunda quincena - 4/2026',     user_id: carmen.id } });

  // Jorge personal
  const f_jorge_mar26_first  = await prisma.fortnight.create({ data: { year: 2026, month: 3, period: FortnightPeriod.FIRST,  start_date: new Date('2026-03-01T06:00:00'), end_date: new Date('2026-03-14T06:00:00'), label: 'Primera quincena - 3/2026',     user_id: jorge.id } });
  const f_jorge_mar26_second = await prisma.fortnight.create({ data: { year: 2026, month: 3, period: FortnightPeriod.SECOND, start_date: new Date('2026-03-15T06:00:00'), end_date: new Date('2026-03-31T06:00:00'), label: 'Segunda quincena - 3/2026',     user_id: jorge.id } });
  const f_jorge_apr26_first  = await prisma.fortnight.create({ data: { year: 2026, month: 4, period: FortnightPeriod.FIRST,  start_date: new Date('2026-04-01T06:00:00'), end_date: new Date('2026-04-14T06:00:00'), label: 'Primera quincena - 4/2026',     user_id: jorge.id } });
  const f_jorge_apr26_second = await prisma.fortnight.create({ data: { year: 2026, month: 4, period: FortnightPeriod.SECOND, start_date: new Date('2026-04-15T06:00:00'), end_date: new Date('2026-04-30T06:00:00'), label: 'Segunda quincena - 4/2026',     user_id: jorge.id } });

  // Leon Solorzano house
  const f_house_oct25_second  = await prisma.fortnight.create({ data: { year: 2025, month: 10, period: FortnightPeriod.SECOND, start_date: new Date('2025-10-16T06:00:00'), end_date: new Date('2025-10-31T06:00:00'), label: 'Segunda quincena - 10/2025',    house_id: leonSolorzano.id } });
  const f_house_mar26_first   = await prisma.fortnight.create({ data: { year: 2026, month: 3,  period: FortnightPeriod.FIRST,  start_date: new Date('2026-03-01T06:00:00'), end_date: new Date('2026-03-15T06:00:00'), label: 'Primera quincena - Marzo 2026', house_id: leonSolorzano.id } });
  const f_house_mar26_second  = await prisma.fortnight.create({ data: { year: 2026, month: 3,  period: FortnightPeriod.SECOND, start_date: new Date('2026-03-16T06:00:00'), end_date: new Date('2026-03-31T06:00:00'), label: 'Segunda quincena - Marzo 2026', house_id: leonSolorzano.id } });
  const f_house_apr26_first   = await prisma.fortnight.create({ data: { year: 2026, month: 4,  period: FortnightPeriod.FIRST,  start_date: new Date('2026-04-01T06:00:00'), end_date: new Date('2026-04-15T06:00:00'), label: 'Primera quincena - Abril 2026', house_id: leonSolorzano.id } });
  const f_house_apr26_second  = await prisma.fortnight.create({ data: { year: 2026, month: 4,  period: FortnightPeriod.SECOND, start_date: new Date('2026-04-16T06:00:00'), end_date: new Date('2026-04-30T06:00:00'), label: 'Segunda quincena - Abril 2026', house_id: leonSolorzano.id } });
  const f_house_may26_first   = await prisma.fortnight.create({ data: { year: 2026, month: 5,  period: FortnightPeriod.FIRST,  start_date: new Date('2026-05-01T06:00:00'), end_date: new Date('2026-05-15T06:00:00'), label: 'Primera quincena - Mayo 2026',  house_id: leonSolorzano.id } });
  const f_house_may26_second  = await prisma.fortnight.create({ data: { year: 2026, month: 5,  period: FortnightPeriod.SECOND, start_date: new Date('2026-05-16T06:00:00'), end_date: new Date('2026-05-31T06:00:00'), label: 'Segunda quincena - Mayo 2026',  house_id: leonSolorzano.id } });
  const f_house_jun26_first   = await prisma.fortnight.create({ data: { year: 2026, month: 6,  period: FortnightPeriod.FIRST,  start_date: new Date('2026-06-01T06:00:00'), end_date: new Date('2026-06-15T06:00:00'), label: 'Primera quincena - Junio 2026', house_id: leonSolorzano.id } });
  const f_house_jun26_second  = await prisma.fortnight.create({ data: { year: 2026, month: 6,  period: FortnightPeriod.SECOND, start_date: new Date('2026-06-16T06:00:00'), end_date: new Date('2026-06-30T06:00:00'), label: 'Segunda quincena - Junio 2026', house_id: leonSolorzano.id } });

  // ─────────────────────────────────────────────
  // INCOMES
  // ─────────────────────────────────────────────

  await prisma.income.createMany({
    data: [
      // Carmen personal
      { fortnight_id: f_carmen_mar26_first.id,  user_id: carmen.id, amount: 4800,  received_at: new Date('2026-03-01T06:00:00'), income_template_id: itSueldoCarmen.id },
      { fortnight_id: f_carmen_mar26_second.id, user_id: carmen.id, amount: 4800,  received_at: new Date('2026-03-15T06:00:00'), income_template_id: itSueldoCarmen.id },
      { fortnight_id: f_carmen_apr26_first.id,  user_id: carmen.id, amount: 4800,  received_at: new Date('2026-04-01T06:00:00'), income_template_id: itSueldoCarmen.id },
      { fortnight_id: f_carmen_apr26_second.id, user_id: carmen.id, amount: 4800,  received_at: new Date('2026-04-15T06:00:00'), income_template_id: itSueldoCarmen.id },

      // Jorge personal
      { fortnight_id: f_jorge_mar26_first.id,  user_id: jorge.id, amount: 15000, source: 'SALARIO', received_at: new Date('2026-03-01T06:00:00'), income_template_id: itSueldoJorge.id },
      { fortnight_id: f_jorge_mar26_second.id, user_id: jorge.id, amount: 15000, source: 'SALARIO', received_at: new Date('2026-03-15T06:00:00'), income_template_id: itSueldoJorge.id },
      { fortnight_id: f_jorge_apr26_first.id,  user_id: jorge.id, amount: 15000, source: 'SALARIO', received_at: new Date('2026-04-01T06:00:00'), income_template_id: itSueldoJorge.id },
      { fortnight_id: f_jorge_apr26_second.id, user_id: jorge.id, amount: 15000, source: 'SALARIO', received_at: new Date('2026-04-15T06:00:00'), income_template_id: itSueldoJorge.id },

      // Leon Solorzano house
      { fortnight_id: f_house_mar26_first.id,  house_id: leonSolorzano.id, amount: 6000,  source: 'Salario', received_at: new Date('2026-03-01T06:00:00'), income_template_id: itSalarioCarmen.id },
      { fortnight_id: f_house_mar26_first.id,  house_id: leonSolorzano.id, amount: 15000, source: 'Salario', received_at: new Date('2026-03-01T06:00:00'), income_template_id: itSalarioJorge.id },
      { fortnight_id: f_house_mar26_second.id, house_id: leonSolorzano.id, amount: 5500,  source: 'Salario', received_at: new Date('2026-03-16T06:00:00'), income_template_id: itSalarioCarmen.id },
      { fortnight_id: f_house_mar26_second.id, house_id: leonSolorzano.id, amount: 15000, source: 'Salario', received_at: new Date('2026-03-16T06:00:00'), income_template_id: itSalarioJorge.id },
      { fortnight_id: f_house_apr26_first.id,  house_id: leonSolorzano.id, amount: 5900,  source: 'Salario', received_at: new Date('2026-04-01T06:00:00'), income_template_id: itSalarioCarmen.id },
      { fortnight_id: f_house_apr26_first.id,  house_id: leonSolorzano.id, amount: 15000, source: 'Salario', received_at: new Date('2026-04-01T06:00:00'), income_template_id: itSalarioJorge.id },
      { fortnight_id: f_house_apr26_second.id, house_id: leonSolorzano.id, amount: 6000,  source: 'Salario', received_at: new Date('2026-04-16T06:00:00'), income_template_id: itSalarioCarmen.id },
      { fortnight_id: f_house_apr26_second.id, house_id: leonSolorzano.id, amount: 15000, source: 'Salario', received_at: new Date('2026-04-16T06:00:00'), income_template_id: itSalarioJorge.id },
      { fortnight_id: f_house_may26_first.id,  house_id: leonSolorzano.id, amount: 6000,  source: 'Salario', received_at: new Date('2026-05-01T06:00:00'), income_template_id: itSalarioCarmen.id },
      { fortnight_id: f_house_may26_first.id,  house_id: leonSolorzano.id, amount: 15000, source: 'Salario', received_at: new Date('2026-05-01T06:00:00'), income_template_id: itSalarioJorge.id },
      { fortnight_id: f_house_may26_second.id, house_id: leonSolorzano.id, amount: 6000,  source: 'Salario', received_at: new Date('2026-05-16T06:00:00'), income_template_id: itSalarioCarmen.id },
      { fortnight_id: f_house_may26_second.id, house_id: leonSolorzano.id, amount: 15000, source: 'Salario', received_at: new Date('2026-05-16T06:00:00'), income_template_id: itSalarioJorge.id },
      { fortnight_id: f_house_jun26_first.id,  house_id: leonSolorzano.id, amount: 5500,  source: 'Salario', received_at: new Date('2026-06-01T06:00:00'), income_template_id: itSalarioCarmen.id },
      { fortnight_id: f_house_jun26_first.id,  house_id: leonSolorzano.id, amount: 15000, source: 'Salario', received_at: new Date('2026-06-01T06:00:00'), income_template_id: itSalarioJorge.id },
      { fortnight_id: f_house_jun26_second.id, house_id: leonSolorzano.id, amount: 5500,  source: 'Salario', received_at: new Date('2026-06-16T06:00:00'), income_template_id: itSalarioCarmen.id },
      { fortnight_id: f_house_jun26_second.id, house_id: leonSolorzano.id, amount: 15000, source: 'Salario', received_at: new Date('2026-06-16T06:00:00'), income_template_id: itSalarioJorge.id },
    ],
  });

  // ─────────────────────────────────────────────
  // EXPENSES
  // ─────────────────────────────────────────────

  await prisma.expense.createMany({
    data: [
      // ── Carmen personal ──────────────────────
      { fortnight_id: f_carmen_mar26_first.id,  user_id: carmen.id, description: 'Renta',    amount: 0, is_paid: false, due_day: 14, expense_template_id: etCarmenRenta.id },
      { fortnight_id: f_carmen_mar26_first.id,  user_id: carmen.id, description: 'Internet', amount: 0, is_paid: false, due_day: 14, expense_template_id: etCarmenInternet.id },
      { fortnight_id: f_carmen_mar26_second.id, user_id: carmen.id, description: 'Renta',    amount: 0, is_paid: false, due_day: 31, expense_template_id: etCarmenRenta.id },
      { fortnight_id: f_carmen_mar26_second.id, user_id: carmen.id, description: 'Internet', amount: 0, is_paid: false, due_day: 31, expense_template_id: etCarmenInternet.id },
      { fortnight_id: f_carmen_apr26_first.id,  user_id: carmen.id, description: 'Renta',    amount: 0, is_paid: false, due_day: 14, expense_template_id: etCarmenRenta.id },
      { fortnight_id: f_carmen_apr26_first.id,  user_id: carmen.id, description: 'Internet', amount: 0, is_paid: false, due_day: 14, expense_template_id: etCarmenInternet.id },
      { fortnight_id: f_carmen_apr26_second.id, user_id: carmen.id, description: 'Renta',    amount: 0, is_paid: false, due_day: 30, expense_template_id: etCarmenRenta.id },
      { fortnight_id: f_carmen_apr26_second.id, user_id: carmen.id, description: 'Internet', amount: 0, is_paid: false, due_day: 30, expense_template_id: etCarmenInternet.id },

      // ── Jorge personal ───────────────────────
      { fortnight_id: f_jorge_mar26_first.id,  user_id: jorge.id, description: 'Internet', amount: 678, is_paid: true,  category_id: catJorgeVivienda.id, wallet_id: walletJorgeBanamex.id, expense_template_id: etJorgeInternet.id },
      { fortnight_id: f_jorge_apr26_first.id,  user_id: jorge.id, description: 'Renta',    amount: 0,   is_paid: false, due_day: 14, expense_template_id: etJorgeRenta.id },
      { fortnight_id: f_jorge_apr26_first.id,  user_id: jorge.id, description: 'Internet', amount: 0,   is_paid: false, due_day: 14, expense_template_id: etJorgeInternet.id },
      { fortnight_id: f_jorge_apr26_second.id, user_id: jorge.id, description: 'Renta',    amount: 0,   is_paid: false, due_day: 30, expense_template_id: etJorgeRenta.id },
      { fortnight_id: f_jorge_apr26_second.id, user_id: jorge.id, description: 'Internet', amount: 0,   is_paid: false, due_day: 30, expense_template_id: etJorgeInternet.id },

      // ── House: Oct 2025 second ───────────────
      { fortnight_id: f_house_oct25_second.id, house_id: leonSolorzano.id, description: 'DISPOSICION EFTVO PARCIALID ADES C&', amount: 931.55, is_paid: true, category_id: catCasa.id, wallet_id: walletCnAEfectivo.id },
      { fortnight_id: f_house_oct25_second.id, house_id: leonSolorzano.id, description: 'COMPRA PROMOCION SIN INTERE S C&A',   amount: 217.00, is_paid: true, category_id: catCasa.id, wallet_id: walletDidiCard.id },

      // ── House: Mar 2026 first ────────────────
      { fortnight_id: f_house_mar26_first.id, house_id: leonSolorzano.id, description: 'Super',           amount: 2000,    is_paid: false, due_day: 15, category_id: catComidaHouse.id,   wallet_id: walletSantander.id, expense_template_id: etSuper.id },
      { fortnight_id: f_house_mar26_first.id, house_id: leonSolorzano.id, description: 'Fonacot Carmen',  amount: 1243.68, is_paid: false, due_day: 15, category_id: catPrestamos.id,     wallet_id: walletSantander.id, expense_template_id: etFonacotCarmen.id },
      { fortnight_id: f_house_mar26_first.id, house_id: leonSolorzano.id, description: 'Fonacot Jorge',   amount: 2792.73, is_paid: false, due_day: 15, category_id: catPrestamos.id,     wallet_id: walletBanamex.id,   expense_template_id: etFonacotJorge.id },
      { fortnight_id: f_house_mar26_first.id, house_id: leonSolorzano.id, description: 'Agua',            amount: 200,     is_paid: false, due_day: 13, category_id: catComidaHouse.id,   wallet_id: walletSantander.id, expense_template_id: etAgua.id },
      { fortnight_id: f_house_mar26_first.id, house_id: leonSolorzano.id, description: 'Transporte Carmen', amount: 400,   is_paid: false, due_day: 1,  category_id: catTransporteHouse.id, wallet_id: walletSantander.id, expense_template_id: etTransporteCarmen.id },
      { fortnight_id: f_house_mar26_first.id, house_id: leonSolorzano.id, description: 'Carne',           amount: 800,     is_paid: false, due_day: 15, category_id: catComidaHouse.id,   wallet_id: walletSantander.id, expense_template_id: etCarne.id },
      { fortnight_id: f_house_mar26_first.id, house_id: leonSolorzano.id, description: 'Credito Banamex', amount: 2500,    is_paid: false, due_day: 15, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,  expense_template_id: etCreditoBanamex.id },

      // ── House: Mar 2026 second ───────────────
      { fortnight_id: f_house_mar26_second.id, house_id: leonSolorzano.id, description: 'Renta',          amount: 8500,    is_paid: true,  due_day: 15, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etRenta.id },
      { fortnight_id: f_house_mar26_second.id, house_id: leonSolorzano.id, description: 'TELMEX',         amount: 658,     is_paid: true,  due_day: 23, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etTelmex.id },
      { fortnight_id: f_house_mar26_second.id, house_id: leonSolorzano.id, description: 'AT&T Carmen',    amount: 400.99,  is_paid: true,  due_day: 23, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttCarmen.id },
      { fortnight_id: f_house_mar26_second.id, house_id: leonSolorzano.id, description: 'AT&T Jorge',     amount: 453.06,  is_paid: true,  due_day: 19, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttJorgeSecond.id },
      { fortnight_id: f_house_mar26_second.id, house_id: leonSolorzano.id, description: 'Mercado pago',   amount: 823.16,  is_paid: true,  due_day: 17, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etMercadoPago.id },
      { fortnight_id: f_house_mar26_second.id, house_id: leonSolorzano.id, description: 'CFE',            amount: 450,     is_paid: true,  due_day: 17, category_id: catCasa.id,           wallet_id: walletSantander.id, expense_template_id: etCfe.id },
      { fortnight_id: f_house_mar26_second.id, house_id: leonSolorzano.id, description: 'Super',          amount: 1000,    is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etSuper.id },
      { fortnight_id: f_house_mar26_second.id, house_id: leonSolorzano.id, description: 'Fonacot Carmen', amount: 1243.68, is_paid: true,  due_day: 15, category_id: catPrestamos.id,      wallet_id: walletSantander.id, expense_template_id: etFonacotCarmen.id },
      { fortnight_id: f_house_mar26_second.id, house_id: leonSolorzano.id, description: 'Fonacot Jorge',  amount: 2792.73, is_paid: true,  due_day: 15, category_id: catPrestamos.id,      wallet_id: walletBanamex.id,   expense_template_id: etFonacotJorge.id },
      { fortnight_id: f_house_mar26_second.id, house_id: leonSolorzano.id, description: 'Agua',           amount: 200,     is_paid: false, due_day: 13, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etAgua.id },
      { fortnight_id: f_house_mar26_second.id, house_id: leonSolorzano.id, description: 'Carne',          amount: 800,     is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etCarne.id },
      { fortnight_id: f_house_mar26_second.id, house_id: leonSolorzano.id, description: 'Credito Banamex', amount: 2500,   is_paid: true,  due_day: 15, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etCreditoBanamex.id },
      { fortnight_id: f_house_mar26_second.id, house_id: leonSolorzano.id, description: 'Didi Card',      amount: 580.04,  is_paid: true,  category_id: catTarjetaCredito.id, wallet_id: walletSantander.id },

      // ── House: Apr 2026 first ────────────────
      { fortnight_id: f_house_apr26_first.id, house_id: leonSolorzano.id, description: 'Super',           amount: 2000,    is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etSuper.id },
      { fortnight_id: f_house_apr26_first.id, house_id: leonSolorzano.id, description: 'Fonacot Carmen',  amount: 1243.68, is_paid: true,  due_day: 15, category_id: catPrestamos.id,      wallet_id: walletSantander.id, expense_template_id: etFonacotCarmen.id },
      { fortnight_id: f_house_apr26_first.id, house_id: leonSolorzano.id, description: 'Fonacot Jorge',   amount: 2792.73, is_paid: true,  due_day: 15, category_id: catPrestamos.id,      wallet_id: walletBanamex.id,   expense_template_id: etFonacotJorge.id },
      { fortnight_id: f_house_apr26_first.id, house_id: leonSolorzano.id, description: 'Agua',            amount: 200,     is_paid: false, due_day: 13, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etAgua.id },
      { fortnight_id: f_house_apr26_first.id, house_id: leonSolorzano.id, description: 'Transporte Carmen', amount: 400,   is_paid: false, due_day: 1,  category_id: catTransporteHouse.id, wallet_id: walletSantander.id, expense_template_id: etTransporteCarmen.id },
      { fortnight_id: f_house_apr26_first.id, house_id: leonSolorzano.id, description: 'Carne',           amount: 800,     is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etCarne.id },
      { fortnight_id: f_house_apr26_first.id, house_id: leonSolorzano.id, description: 'AT&T Jorge',      amount: 1179.43, is_paid: true,  due_day: 7,  category_id: catCasa.id,           wallet_id: walletDidiCard.id,  expense_template_id: etAttJorgeFirst.id },
      { fortnight_id: f_house_apr26_first.id, house_id: leonSolorzano.id, description: 'Sky',             amount: 269,     is_paid: true,  due_day: 30, category_id: catEntretenimiento.id, wallet_id: walletSantander.id, expense_template_id: etSky.id },
      { fortnight_id: f_house_apr26_first.id, house_id: leonSolorzano.id, description: 'Spotify',         amount: 189,     is_paid: true,  due_day: 30, category_id: catEntretenimiento.id, wallet_id: walletSantander.id, expense_template_id: etSpotify.id },
      { fortnight_id: f_house_apr26_first.id, house_id: leonSolorzano.id, description: 'Concerta',        amount: 2400,    is_paid: false, due_day: 1,  category_id: catMedicamentos.id,   wallet_id: walletSantander.id, expense_template_id: etConcerta.id },
      { fortnight_id: f_house_apr26_first.id, house_id: leonSolorzano.id, description: 'Lamotriglina',    amount: 160,     is_paid: false, due_day: 1,  category_id: catMedicamentos.id,   wallet_id: walletBanamex.id,   expense_template_id: etLamotriglina.id },
      { fortnight_id: f_house_apr26_first.id, house_id: leonSolorzano.id, description: 'Credito Banamex', amount: 2500,    is_paid: true,  due_day: 15, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etCreditoBanamex.id },
      { fortnight_id: f_house_apr26_first.id, house_id: leonSolorzano.id, description: 'Renta',           amount: 1000,    is_paid: false, category_id: catCasa.id,           wallet_id: walletBanamex.id },
      { fortnight_id: f_house_apr26_first.id, house_id: leonSolorzano.id, description: 'Didi card',       amount: 520,     is_paid: true,  category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id },

      // ── House: Apr 2026 second ───────────────
      { fortnight_id: f_house_apr26_second.id, house_id: leonSolorzano.id, description: 'Renta',          amount: 7500,    is_paid: false, due_day: 15, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etRenta.id },
      { fortnight_id: f_house_apr26_second.id, house_id: leonSolorzano.id, description: 'TELMEX',         amount: 658,     is_paid: false, due_day: 23, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etTelmex.id },
      { fortnight_id: f_house_apr26_second.id, house_id: leonSolorzano.id, description: 'AT&T Carmen',    amount: 400.99,  is_paid: false, due_day: 23, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttCarmen.id },
      { fortnight_id: f_house_apr26_second.id, house_id: leonSolorzano.id, description: 'AT&T Jorge',     amount: 453.06,  is_paid: false, due_day: 19, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttJorgeSecond.id },
      { fortnight_id: f_house_apr26_second.id, house_id: leonSolorzano.id, description: 'Mercado pago',   amount: 4800,    is_paid: false, due_day: 17, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etMercadoPago.id },
      { fortnight_id: f_house_apr26_second.id, house_id: leonSolorzano.id, description: 'Super',          amount: 2000,    is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etSuper.id },
      { fortnight_id: f_house_apr26_second.id, house_id: leonSolorzano.id, description: 'Fonacot Carmen', amount: 1243.68, is_paid: true,  due_day: 15, category_id: catPrestamos.id,      wallet_id: walletSantander.id, expense_template_id: etFonacotCarmen.id },
      { fortnight_id: f_house_apr26_second.id, house_id: leonSolorzano.id, description: 'Fonacot Jorge',  amount: 2792.73, is_paid: true,  due_day: 15, category_id: catPrestamos.id,      wallet_id: walletBanamex.id,   expense_template_id: etFonacotJorge.id },
      { fortnight_id: f_house_apr26_second.id, house_id: leonSolorzano.id, description: 'Agua',           amount: 200,     is_paid: false, due_day: 13, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etAgua.id },
      { fortnight_id: f_house_apr26_second.id, house_id: leonSolorzano.id, description: 'Transporte Carmen', amount: 400, is_paid: false, due_day: 1,  category_id: catTransporteHouse.id, wallet_id: walletSantander.id, expense_template_id: etTransporteCarmen.id },
      { fortnight_id: f_house_apr26_second.id, house_id: leonSolorzano.id, description: 'Carne',          amount: 800,     is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etCarne.id },
      { fortnight_id: f_house_apr26_second.id, house_id: leonSolorzano.id, description: 'Paula',          amount: 300,     is_paid: false, due_day: 1,  category_id: catMedicamentos.id,   wallet_id: walletSantander.id, expense_template_id: etPaula.id },
      { fortnight_id: f_house_apr26_second.id, house_id: leonSolorzano.id, description: 'Credito Banamex', amount: 2500,   is_paid: true,  due_day: 15, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etCreditoBanamex.id },
      { fortnight_id: f_house_apr26_second.id, house_id: leonSolorzano.id, description: 'Didi card',      amount: 1500,    is_paid: false, due_day: 18, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etDidiCard.id },

      // ── House: May 2026 first ────────────────
      { fortnight_id: f_house_may26_first.id, house_id: leonSolorzano.id, description: 'Super',           amount: 2000,    is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etSuper.id },
      { fortnight_id: f_house_may26_first.id, house_id: leonSolorzano.id, description: 'Fonacot Carmen',  amount: 1243.68, is_paid: false, due_day: 15, category_id: catPrestamos.id,      wallet_id: walletSantander.id, expense_template_id: etFonacotCarmen.id },
      { fortnight_id: f_house_may26_first.id, house_id: leonSolorzano.id, description: 'Fonacot Jorge',   amount: 2792.73, is_paid: false, due_day: 15, category_id: catPrestamos.id,      wallet_id: walletBanamex.id,   expense_template_id: etFonacotJorge.id },
      { fortnight_id: f_house_may26_first.id, house_id: leonSolorzano.id, description: 'Agua',            amount: 200,     is_paid: false, due_day: 13, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etAgua.id },
      { fortnight_id: f_house_may26_first.id, house_id: leonSolorzano.id, description: 'Transporte Carmen', amount: 400,   is_paid: false, due_day: 1,  category_id: catTransporteHouse.id, wallet_id: walletSantander.id, expense_template_id: etTransporteCarmen.id },
      { fortnight_id: f_house_may26_first.id, house_id: leonSolorzano.id, description: 'Carne',           amount: 800,     is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etCarne.id },
      { fortnight_id: f_house_may26_first.id, house_id: leonSolorzano.id, description: 'Liverpool Carmen', amount: 531.67, is_paid: false, due_day: 5,  category_id: catTarjetaDep.id,     wallet_id: walletSantander.id, expense_template_id: etLiverpoolCarmen.id },
      { fortnight_id: f_house_may26_first.id, house_id: leonSolorzano.id, description: 'Liverpool Jorge',  amount: 1,      is_paid: false, due_day: 12, category_id: catTarjetaDep.id,     wallet_id: walletBanamex.id,   expense_template_id: etLiverpoolJorge.id },
      { fortnight_id: f_house_may26_first.id, house_id: leonSolorzano.id, description: 'AT&T Jorge',      amount: 1160,    is_paid: false, due_day: 7,  category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttJorgeFirst.id },
      { fortnight_id: f_house_may26_first.id, house_id: leonSolorzano.id, description: 'Sky',             amount: 269,     is_paid: false, due_day: 30, category_id: catEntretenimiento.id, wallet_id: walletSantander.id, expense_template_id: etSky.id },
      { fortnight_id: f_house_may26_first.id, house_id: leonSolorzano.id, description: 'Spotify',         amount: 189,     is_paid: false, due_day: 30, category_id: catEntretenimiento.id, wallet_id: walletSantander.id, expense_template_id: etSpotify.id },
      { fortnight_id: f_house_may26_first.id, house_id: leonSolorzano.id, description: 'C&A efectivo',    amount: 928,     is_paid: false, due_day: 10, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etCnAEfectivo.id },
      { fortnight_id: f_house_may26_first.id, house_id: leonSolorzano.id, description: 'C&A departamental', amount: 250,   is_paid: false, due_day: 3,  category_id: catTarjetaDep.id,     wallet_id: walletBanamex.id,   expense_template_id: etCnADepartamental.id },
      { fortnight_id: f_house_may26_first.id, house_id: leonSolorzano.id, description: 'Concerta',        amount: 2400,    is_paid: false, due_day: 1,  category_id: catMedicamentos.id,   wallet_id: walletSantander.id, expense_template_id: etConcerta.id },
      { fortnight_id: f_house_may26_first.id, house_id: leonSolorzano.id, description: 'Quetiapina',      amount: 250,     is_paid: false, due_day: 11, category_id: catMedicamentos.id,   wallet_id: walletBanamex.id,   expense_template_id: etQuetiapina.id },
      { fortnight_id: f_house_may26_first.id, house_id: leonSolorzano.id, description: 'Lamotriglina',    amount: 160,     is_paid: false, due_day: 1,  category_id: catMedicamentos.id,   wallet_id: walletBanamex.id,   expense_template_id: etLamotriglina.id },
      { fortnight_id: f_house_may26_first.id, house_id: leonSolorzano.id, description: 'Credito Banamex', amount: 2500,    is_paid: false, due_day: 15, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etCreditoBanamex.id },
      { fortnight_id: f_house_may26_first.id, house_id: leonSolorzano.id, description: 'Mercado Pago',    amount: 1500,    is_paid: false, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id },
      { fortnight_id: f_house_may26_first.id, house_id: leonSolorzano.id, description: 'Renta',           amount: 1500,    is_paid: false, category_id: catCasa.id,           wallet_id: walletBanamex.id },

      // ── House: May 2026 second ───────────────
      { fortnight_id: f_house_may26_second.id, house_id: leonSolorzano.id, description: 'Renta',          amount: 7000,    is_paid: false, due_day: 15, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etRenta.id },
      { fortnight_id: f_house_may26_second.id, house_id: leonSolorzano.id, description: 'TELMEX',         amount: 658,     is_paid: false, due_day: 23, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etTelmex.id },
      { fortnight_id: f_house_may26_second.id, house_id: leonSolorzano.id, description: 'AT&T Carmen',    amount: 400.99,  is_paid: false, due_day: 23, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttCarmen.id },
      { fortnight_id: f_house_may26_second.id, house_id: leonSolorzano.id, description: 'AT&T Jorge',     amount: 453.06,  is_paid: false, due_day: 19, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttJorgeSecond.id },
      { fortnight_id: f_house_may26_second.id, house_id: leonSolorzano.id, description: 'Mercado pago',   amount: 1036.94, is_paid: false, due_day: 17, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etMercadoPago.id },
      { fortnight_id: f_house_may26_second.id, house_id: leonSolorzano.id, description: 'CFE',            amount: 450,     is_paid: false, due_day: 17, category_id: catCasa.id,           wallet_id: walletSantander.id, expense_template_id: etCfe.id },
      { fortnight_id: f_house_may26_second.id, house_id: leonSolorzano.id, description: 'Super',          amount: 2000,    is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etSuper.id },
      { fortnight_id: f_house_may26_second.id, house_id: leonSolorzano.id, description: 'Fonacot Carmen', amount: 1243.68, is_paid: false, due_day: 15, category_id: catPrestamos.id,      wallet_id: walletSantander.id, expense_template_id: etFonacotCarmen.id },
      { fortnight_id: f_house_may26_second.id, house_id: leonSolorzano.id, description: 'Fonacot Jorge',  amount: 2792.73, is_paid: false, due_day: 15, category_id: catPrestamos.id,      wallet_id: walletBanamex.id,   expense_template_id: etFonacotJorge.id },
      { fortnight_id: f_house_may26_second.id, house_id: leonSolorzano.id, description: 'Agua',           amount: 200,     is_paid: false, due_day: 13, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etAgua.id },
      { fortnight_id: f_house_may26_second.id, house_id: leonSolorzano.id, description: 'Transporte Carmen', amount: 400, is_paid: false, due_day: 1,  category_id: catTransporteHouse.id, wallet_id: walletSantander.id, expense_template_id: etTransporteCarmen.id },
      { fortnight_id: f_house_may26_second.id, house_id: leonSolorzano.id, description: 'Carne',          amount: 800,     is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etCarne.id },
      { fortnight_id: f_house_may26_second.id, house_id: leonSolorzano.id, description: 'Paula',          amount: 300,     is_paid: false, due_day: 1,  category_id: catMedicamentos.id,   wallet_id: walletSantander.id, expense_template_id: etPaula.id },
      { fortnight_id: f_house_may26_second.id, house_id: leonSolorzano.id, description: 'Credito Banamex', amount: 2500,   is_paid: false, due_day: 15, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etCreditoBanamex.id },
      { fortnight_id: f_house_may26_second.id, house_id: leonSolorzano.id, description: 'Didi card',      amount: 700,     is_paid: false, due_day: 18, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etDidiCard.id },

      // ── House: Jun 2026 first ────────────────
      { fortnight_id: f_house_jun26_first.id, house_id: leonSolorzano.id, description: 'Super',           amount: 2000,    is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etSuper.id },
      { fortnight_id: f_house_jun26_first.id, house_id: leonSolorzano.id, description: 'Fonacot Carmen',  amount: 1243.68, is_paid: false, due_day: 15, category_id: catPrestamos.id,      wallet_id: walletSantander.id, expense_template_id: etFonacotCarmen.id },
      { fortnight_id: f_house_jun26_first.id, house_id: leonSolorzano.id, description: 'Fonacot Jorge',   amount: 2792.73, is_paid: false, due_day: 15, category_id: catPrestamos.id,      wallet_id: walletBanamex.id,   expense_template_id: etFonacotJorge.id },
      { fortnight_id: f_house_jun26_first.id, house_id: leonSolorzano.id, description: 'Agua',            amount: 200,     is_paid: false, due_day: 13, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etAgua.id },
      { fortnight_id: f_house_jun26_first.id, house_id: leonSolorzano.id, description: 'Transporte Carmen', amount: 400,   is_paid: false, due_day: 1,  category_id: catTransporteHouse.id, wallet_id: walletSantander.id, expense_template_id: etTransporteCarmen.id },
      { fortnight_id: f_house_jun26_first.id, house_id: leonSolorzano.id, description: 'Carne',           amount: 800,     is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etCarne.id },
      { fortnight_id: f_house_jun26_first.id, house_id: leonSolorzano.id, description: 'Liverpool Carmen', amount: 531.67, is_paid: false, due_day: 5,  category_id: catTarjetaDep.id,     wallet_id: walletSantander.id, expense_template_id: etLiverpoolCarmen.id },
      { fortnight_id: f_house_jun26_first.id, house_id: leonSolorzano.id, description: 'Liverpool Jorge',  amount: 1,      is_paid: false, due_day: 12, category_id: catTarjetaDep.id,     wallet_id: walletBanamex.id,   expense_template_id: etLiverpoolJorge.id },
      { fortnight_id: f_house_jun26_first.id, house_id: leonSolorzano.id, description: 'AT&T Jorge',      amount: 1160,    is_paid: false, due_day: 7,  category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttJorgeFirst.id },
      { fortnight_id: f_house_jun26_first.id, house_id: leonSolorzano.id, description: 'Sky',             amount: 269,     is_paid: false, due_day: 30, category_id: catEntretenimiento.id, wallet_id: walletSantander.id, expense_template_id: etSky.id },
      { fortnight_id: f_house_jun26_first.id, house_id: leonSolorzano.id, description: 'Spotify',         amount: 189,     is_paid: false, due_day: 30, category_id: catEntretenimiento.id, wallet_id: walletSantander.id, expense_template_id: etSpotify.id },
      { fortnight_id: f_house_jun26_first.id, house_id: leonSolorzano.id, description: 'C&A efectivo',    amount: 928,     is_paid: false, due_day: 10, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etCnAEfectivo.id },
      { fortnight_id: f_house_jun26_first.id, house_id: leonSolorzano.id, description: 'C&A departamental', amount: 250,   is_paid: false, due_day: 3,  category_id: catTarjetaDep.id,     wallet_id: walletBanamex.id,   expense_template_id: etCnADepartamental.id },
      { fortnight_id: f_house_jun26_first.id, house_id: leonSolorzano.id, description: 'Concerta',        amount: 2400,    is_paid: false, due_day: 1,  category_id: catMedicamentos.id,   wallet_id: walletSantander.id, expense_template_id: etConcerta.id },
      { fortnight_id: f_house_jun26_first.id, house_id: leonSolorzano.id, description: 'Quetiapina',      amount: 250,     is_paid: false, due_day: 11, category_id: catMedicamentos.id,   wallet_id: walletBanamex.id,   expense_template_id: etQuetiapina.id },
      { fortnight_id: f_house_jun26_first.id, house_id: leonSolorzano.id, description: 'Lamotriglina',    amount: 160,     is_paid: false, due_day: 1,  category_id: catMedicamentos.id,   wallet_id: walletBanamex.id,   expense_template_id: etLamotriglina.id },
      { fortnight_id: f_house_jun26_first.id, house_id: leonSolorzano.id, description: 'Credito Banamex', amount: 2500,    is_paid: false, due_day: 15, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etCreditoBanamex.id },

      // ── House: Jun 2026 second ───────────────
      { fortnight_id: f_house_jun26_second.id, house_id: leonSolorzano.id, description: 'Renta',          amount: 8500,    is_paid: false, due_day: 15, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etRenta.id },
      { fortnight_id: f_house_jun26_second.id, house_id: leonSolorzano.id, description: 'TELMEX',         amount: 658,     is_paid: false, due_day: 23, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etTelmex.id },
      { fortnight_id: f_house_jun26_second.id, house_id: leonSolorzano.id, description: 'AT&T Carmen',    amount: 400.99,  is_paid: false, due_day: 23, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttCarmen.id },
      { fortnight_id: f_house_jun26_second.id, house_id: leonSolorzano.id, description: 'AT&T Jorge',     amount: 453.06,  is_paid: false, due_day: 19, category_id: catCasa.id,           wallet_id: walletBanamex.id,   expense_template_id: etAttJorgeSecond.id },
      { fortnight_id: f_house_jun26_second.id, house_id: leonSolorzano.id, description: 'Mercado pago',   amount: 823.16,  is_paid: false, due_day: 17, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etMercadoPago.id },
      { fortnight_id: f_house_jun26_second.id, house_id: leonSolorzano.id, description: 'CFE',            amount: 450,     is_paid: false, due_day: 17, category_id: catCasa.id,           wallet_id: walletSantander.id, expense_template_id: etCfe.id },
      { fortnight_id: f_house_jun26_second.id, house_id: leonSolorzano.id, description: 'Super',          amount: 2000,    is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etSuper.id },
      { fortnight_id: f_house_jun26_second.id, house_id: leonSolorzano.id, description: 'Fonacot Carmen', amount: 1243.68, is_paid: false, due_day: 15, category_id: catPrestamos.id,      wallet_id: walletSantander.id, expense_template_id: etFonacotCarmen.id },
      { fortnight_id: f_house_jun26_second.id, house_id: leonSolorzano.id, description: 'Fonacot Jorge',  amount: 2792.73, is_paid: false, due_day: 15, category_id: catPrestamos.id,      wallet_id: walletBanamex.id,   expense_template_id: etFonacotJorge.id },
      { fortnight_id: f_house_jun26_second.id, house_id: leonSolorzano.id, description: 'Agua',           amount: 200,     is_paid: false, due_day: 13, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etAgua.id },
      { fortnight_id: f_house_jun26_second.id, house_id: leonSolorzano.id, description: 'Transporte Carmen', amount: 400, is_paid: false, due_day: 1,  category_id: catTransporteHouse.id, wallet_id: walletSantander.id, expense_template_id: etTransporteCarmen.id },
      { fortnight_id: f_house_jun26_second.id, house_id: leonSolorzano.id, description: 'Carne',          amount: 800,     is_paid: false, due_day: 15, category_id: catComidaHouse.id,    wallet_id: walletSantander.id, expense_template_id: etCarne.id },
      { fortnight_id: f_house_jun26_second.id, house_id: leonSolorzano.id, description: 'Paula',          amount: 300,     is_paid: false, due_day: 1,  category_id: catMedicamentos.id,   wallet_id: walletSantander.id, expense_template_id: etPaula.id },
      { fortnight_id: f_house_jun26_second.id, house_id: leonSolorzano.id, description: 'Credito Banamex', amount: 2500,   is_paid: false, due_day: 15, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etCreditoBanamex.id },
      { fortnight_id: f_house_jun26_second.id, house_id: leonSolorzano.id, description: 'Didi card',      amount: 1500,    is_paid: false, due_day: 18, category_id: catTarjetaCredito.id, wallet_id: walletBanamex.id,   expense_template_id: etDidiCard.id },
    ],
  });

  // suppress unused variable warnings for categories not yet used in expenses
  void catCarmenComida; void catCarmenTransporte; void catCarmenVivienda;
  void catJorgeComida; void catJorgeTransporte;
  void catSuscripciones; void catSalidas; void catInversiones; void catApoyosFamiliares;

  console.log('✅ Database seeded with real data');
}

main().finally(async () => {
  await prisma.$disconnect();
});
