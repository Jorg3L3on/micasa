import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  PaymentMethodType,
  FortnightPeriod,
  HouseRole,
  TransferType,
} from '@/generated/prisma/client';
import { hash } from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  /**
   * CLEAN DATABASE (ORDER MATTERS)
   */
  await prisma.expense.deleteMany();
  await prisma.income.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.expenseTemplate.deleteMany();
  await prisma.incomeTemplate.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.category.deleteMany();
  await prisma.fortnight.deleteMany();
  await prisma.houseMember.deleteMany();
  await prisma.house.deleteMany();
  await prisma.user.deleteMany();

  /**
   * USERS
   */

  const hashedPassword = await hash('temp1234', 10);

  const john = await prisma.user.create({
    data: {
      name: 'john doe',
      email: 'john@gmail.com',
      password: hashedPassword,
    },
  });

  /**
   * HOUSE (shared / optional)
   */
  const casaJohn = await prisma.house.create({
    data: {
      name: 'Casa John',
      owner_id: john.id,
    },
  });

  await prisma.houseMember.create({
    data: {
      house_id: casaJohn.id,
      user_id: john.id,
      role: HouseRole.OWNER,
    },
  });

  await prisma.transfer.create({
    data: {
      amount: 5000,
      type: TransferType.USER_TO_HOUSE,
      user_id: john.id,
      house_id: casaJohn.id,
      note: 'Initial transfer to house',
    },
  });

  /**
   * INCOME TEMPLATES
   */
  const salaryTemplate = await prisma.incomeTemplate.create({
    data: {
      name: 'Salario',
      suggested_amount: 12207.27,
      source: 'SALARY',
      applies_first_fortnight: true,
      applies_second_fortnight: true,
      active: true,
      user_id: john.id,
    },
  });

  /**
   * =========================
   * WALLETS (REPLACING CARDS / PAYMENT METHODS)
   * =========================
   */
  const efectivo = await prisma.wallet.create({
    data: {
      name: 'Efectivo',
      type: PaymentMethodType.CASH,
      user_id: john.id,
    },
  });

  const liverpoolJohn = await prisma.wallet.create({
    data: {
      name: 'Liverpool John',
      type: PaymentMethodType.DEPARTMENT_STORE_CARD,
      user_id: john.id,
    },
  });

  const liverpoolJane = await prisma.wallet.create({
    data: {
      name: 'Liverpool Jane',
      type: PaymentMethodType.DEPARTMENT_STORE_CARD,
      user_id: john.id,
    },
  });

  const telmexWallet = await prisma.wallet.create({
    data: {
      name: 'TELMEX',
      type: PaymentMethodType.CREDIT_CARD,
      user_id: john.id,
    },
  });

  const skyWallet = await prisma.wallet.create({
    data: {
      name: 'SKY',
      type: PaymentMethodType.CREDIT_CARD,
      user_id: john.id,
    },
  });

  /**
   * CATEGORIES
   */
  const phoneCategory = await prisma.category.create({
    data: { name: 'Telefonía' },
  });

  const internetCategory = await prisma.category.create({
    data: { name: 'Internet' },
  });

  const creditCardCategory = await prisma.category.create({
    data: { name: 'Tarjeta de crédito' },
  });

  const supermarketCategory = await prisma.category.create({
    data: { name: 'Supermercado' },
  });

  const departmentStoreCategory = await prisma.category.create({
    data: { name: 'Departamental' },
  });

  const homeCategory = await prisma.category.create({
    data: { name: 'Hogar' },
  });

  const rentCategory = await prisma.category.create({
    data: { name: 'Renta' },
  });

  /**
   * FORTNIGHTS
   */
  const firstFortnight = await prisma.fortnight.create({
    data: {
      year: 2026,
      month: 1,
      period: FortnightPeriod.FIRST,
      start_date: new Date('2026-01-01'),
      end_date: new Date('2026-01-15'),
      label: '1–15 Enero 2026',
      user_id: john.id,
    },
  });

  const secondFortnight = await prisma.fortnight.create({
    data: {
      year: 2026,
      month: 1,
      period: FortnightPeriod.SECOND,
      start_date: new Date('2026-01-16'),
      end_date: new Date('2026-01-31'),
      label: '16–31 Enero 2026',
      user_id: john.id,
    },
  });

  /**
   * EXPENSE TEMPLATES
   */
  const templates = await prisma.expenseTemplate.createMany({
    data: [
      {
        name: 'Renta',
        category_id: rentCategory.id,
        user_id: john.id,
        is_recurring: true,
        applies_first_fortnight: true,
        applies_second_fortnight: true,
      },
      {
        name: 'TELMEX',
        category_id: phoneCategory.id,
        user_id: john.id,
        wallet_id: telmexWallet.id,
        is_recurring: true,
        applies_second_fortnight: true,
      },
      {
        name: 'AT&T John',
        category_id: phoneCategory.id,
        user_id: john.id,
        is_recurring: true,
        applies_second_fortnight: true,
      },
      {
        name: 'AT&T Jane',
        category_id: phoneCategory.id,
        user_id: john.id,
        is_recurring: true,
        applies_second_fortnight: true,
      },
      {
        name: 'Mercado Pago',
        category_id: creditCardCategory.id,
        user_id: john.id,
        applies_second_fortnight: true,
      },
      {
        name: 'Súper',
        category_id: supermarketCategory.id,
        user_id: john.id,
        applies_first_fortnight: true,
        applies_second_fortnight: true,
      },
      {
        name: 'Sears',
        category_id: departmentStoreCategory.id,
        user_id: john.id,
        applies_second_fortnight: true,
      },
      {
        name: 'Sartén',
        category_id: homeCategory.id,
        user_id: john.id,
        applies_first_fortnight: true,
        applies_second_fortnight: true,
      },
      {
        name: 'Liverpool Jane',
        category_id: departmentStoreCategory.id,
        user_id: john.id,
        wallet_id: liverpoolJane.id,
        applies_first_fortnight: true,
      },
      {
        name: 'Liverpool John',
        category_id: departmentStoreCategory.id,
        user_id: john.id,
        wallet_id: liverpoolJohn.id,
        applies_first_fortnight: true,
      },
      {
        name: 'C&A Efectivo',
        category_id: departmentStoreCategory.id,
        user_id: john.id,
        applies_first_fortnight: true,
      },
      {
        name: 'C&A Departamental',
        category_id: departmentStoreCategory.id,
        user_id: john.id,
        applies_first_fortnight: true,
      },
      {
        name: 'Mercado Libre',
        category_id: departmentStoreCategory.id,
        user_id: john.id,
        applies_first_fortnight: true,
      },
      {
        name: 'SKY',
        category_id: internetCategory.id,
        user_id: john.id,
        wallet_id: skyWallet.id,
        applies_first_fortnight: true,
      },
    ],
  });

  const templateMap = Object.fromEntries(
    (await prisma.expenseTemplate.findMany()).map((t) => [t.name, t]),
  );

  /**
   * INCOME
   */
  await prisma.income.createMany({
    data: [
      {
        fortnight_id: firstFortnight.id,
        user_id: john.id,
        amount: 12207.27,
        source: 'SALARY',
        received_at: new Date('2026-01-01'),
        income_template_id: salaryTemplate.id,
      },
      {
        fortnight_id: secondFortnight.id,
        user_id: john.id,
        amount: 12207.27,
        source: 'SALARY',
        received_at: new Date('2026-01-16'),
        income_template_id: salaryTemplate.id,
      },
    ],
  });

  /**
   * EXPENSES (FULLY INCLUDED)
   */
  await prisma.expense.createMany({
    data: [
      // FIRST FORTNIGHT
      {
        fortnight_id: firstFortnight.id,
        user_id: john.id,
        category_id: departmentStoreCategory.id,
        description: 'Liverpool John',
        amount: 1888.87,
        expense_template_id: templateMap['Liverpool John'].id,
        wallet_id: liverpoolJohn.id,
      },
      {
        fortnight_id: firstFortnight.id,
        user_id: john.id,
        category_id: departmentStoreCategory.id,
        description: 'Mercado Libre',
        amount: 1520,
        expense_template_id: templateMap['Mercado Libre'].id,
      },
      {
        fortnight_id: firstFortnight.id,
        user_id: john.id,
        category_id: phoneCategory.id,
        description: 'AT&T John',
        amount: 1100,
        expense_template_id: templateMap['AT&T John'].id,
      },
      {
        fortnight_id: firstFortnight.id,
        user_id: john.id,
        category_id: departmentStoreCategory.id,
        description: 'C&A Efectivo',
        amount: 1000,
        expense_template_id: templateMap['C&A Efectivo'].id,
        wallet_id: efectivo.id,
      },
      {
        fortnight_id: firstFortnight.id,
        user_id: john.id,
        category_id: departmentStoreCategory.id,
        description: 'Liverpool Jane',
        amount: 1500,
        expense_template_id: templateMap['Liverpool Jane'].id,
        wallet_id: liverpoolJane.id,
      },
      {
        fortnight_id: firstFortnight.id,
        user_id: john.id,
        category_id: homeCategory.id,
        description: 'Sartén',
        amount: 520,
        expense_template_id: templateMap['Sartén'].id,
        wallet_id: efectivo.id,
      },
      {
        fortnight_id: firstFortnight.id,
        user_id: john.id,
        category_id: rentCategory.id,
        description: 'Renta',
        amount: 1000,
        expense_template_id: templateMap['Renta'].id,
        wallet_id: efectivo.id,
      },
      {
        fortnight_id: firstFortnight.id,
        user_id: john.id,
        category_id: internetCategory.id,
        description: 'SKY',
        amount: 269,
        expense_template_id: templateMap['SKY'].id,
        wallet_id: skyWallet.id,
      },
      {
        fortnight_id: firstFortnight.id,
        user_id: john.id,
        category_id: departmentStoreCategory.id,
        description: 'C&A Departamental',
        amount: 385,
        expense_template_id: templateMap['C&A Departamental'].id,
      },
      {
        fortnight_id: firstFortnight.id,
        user_id: john.id,
        category_id: supermarketCategory.id,
        description: 'Súper',
        amount: 2000,
        expense_template_id: templateMap['Súper'].id,
        wallet_id: efectivo.id,
      },

      // SECOND FORTNIGHT
      {
        fortnight_id: secondFortnight.id,
        user_id: john.id,
        category_id: rentCategory.id,
        description: 'Renta',
        amount: 8000,
        expense_template_id: templateMap['Renta'].id,
        wallet_id: efectivo.id,
      },
      {
        fortnight_id: secondFortnight.id,
        user_id: john.id,
        category_id: phoneCategory.id,
        description: 'AT&T John',
        amount: 300,
        expense_template_id: templateMap['AT&T John'].id,
      },
      {
        fortnight_id: secondFortnight.id,
        user_id: john.id,
        category_id: phoneCategory.id,
        description: 'AT&T Jane',
        amount: 300,
        expense_template_id: templateMap['AT&T Jane'].id,
      },
      {
        fortnight_id: secondFortnight.id,
        user_id: john.id,
        category_id: creditCardCategory.id,
        description: 'Mercado Pago',
        amount: 1500,
        expense_template_id: templateMap['Mercado Pago'].id,
      },
      {
        fortnight_id: secondFortnight.id,
        user_id: john.id,
        category_id: supermarketCategory.id,
        description: 'Súper',
        amount: 2000,
        expense_template_id: templateMap['Súper'].id,
        wallet_id: efectivo.id,
      },
      {
        fortnight_id: secondFortnight.id,
        user_id: john.id,
        category_id: homeCategory.id,
        description: 'Sartén',
        amount: 520,
        expense_template_id: templateMap['Sartén'].id,
        wallet_id: efectivo.id,
      },
      {
        fortnight_id: secondFortnight.id,
        user_id: john.id,
        category_id: departmentStoreCategory.id,
        description: 'Sears',
        amount: 403.83,
        expense_template_id: templateMap['Sears'].id,
      },
      {
        fortnight_id: secondFortnight.id,
        user_id: john.id,
        category_id: phoneCategory.id,
        description: 'TELMEX',
        amount: 658,
        expense_template_id: templateMap['TELMEX'].id,
        wallet_id: telmexWallet.id,
      },
    ],
  });

  console.log('✅ Database fully seeded');
}

main().finally(async () => {
  await prisma.$disconnect();
});
