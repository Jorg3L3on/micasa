import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  PaymentMethodType,
  FortnightPeriod,
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
  await prisma.fortnightIncome.deleteMany();
  await prisma.expenseTemplate.deleteMany();
  await prisma.card.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.category.deleteMany();
  await prisma.fortnight.deleteMany();
  await prisma.user.deleteMany();
  await prisma.incomeTemplate.deleteMany();

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
   * HOUSES
   */

  const mainHouse = await prisma.house.create({
    data: {
      name: `Casa de ${john.name}`,
      owner_id: john.id,
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
   * PAYMENT METHODS
   */
  const tarjeta = await prisma.paymentMethod.create({
    data: { name: 'Tarjeta', type: PaymentMethodType.CASH },
  });

  const efectivo = await prisma.paymentMethod.create({
    data: { name: 'Efectivo', type: PaymentMethodType.CASH },
  });

  /**
   * CARDS
   */
  const liverpoolJohn = await prisma.card.create({
    data: {
      name: 'Liverpool John',
      payment_method_id: tarjeta.id,
    },
  });

  const liverpoolJane = await prisma.card.create({
    data: {
      name: 'Liverpool Jane',
      payment_method_id: tarjeta.id,
    },
  });

  const telmexCard = await prisma.card.create({
    data: {
      name: 'TELMEX',
      payment_method_id: tarjeta.id,
    },
  });

  const skyCard = await prisma.card.create({
    data: {
      name: 'SKY',
      payment_method_id: tarjeta.id,
    },
  });

  /**
   * CATEGORIES
   */
  const fixed = await prisma.category.create({
    data: { name: 'Fijo' },
  });

  const variable = await prisma.category.create({
    data: { name: 'Variable' },
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
    },
  });

  /**
   * EXPENSE TEMPLATES
   */
  const templates = await prisma.expenseTemplate.createMany({
    data: [
      {
        name: 'Renta',
        category_id: fixed.id,
        is_recurring: true,
        applies_first_fortnight: true,
        applies_second_fortnight: true,
      },
      {
        name: 'TELMEX',
        category_id: fixed.id,
        default_card_id: telmexCard.id,
        is_recurring: true,
        applies_second_fortnight: true,
      },
      {
        name: 'AT&T John',
        category_id: fixed.id,
        is_recurring: true,
        applies_second_fortnight: true,
      },
      {
        name: 'AT&T Jane',
        category_id: fixed.id,
        is_recurring: true,
        applies_second_fortnight: true,
      },
      {
        name: 'Mercado Pago',
        category_id: variable.id,
        applies_second_fortnight: true,
      },
      {
        name: 'Súper',
        category_id: variable.id,
        applies_first_fortnight: true,
        applies_second_fortnight: true,
      },
      {
        name: 'Sears',
        category_id: variable.id,
        applies_second_fortnight: true,
      },
      {
        name: 'Sartén',
        category_id: variable.id,
        applies_first_fortnight: true,
        applies_second_fortnight: true,
      },
      {
        name: 'Liverpool Jane',
        category_id: variable.id,
        applies_first_fortnight: true,
      },
      {
        name: 'Liverpool John',
        category_id: variable.id,
        applies_first_fortnight: true,
      },
      {
        name: 'C&A Efectivo',
        category_id: variable.id,
        applies_first_fortnight: true,
      },
      {
        name: 'C&A Departamental',
        category_id: variable.id,
        applies_first_fortnight: true,
      },
      {
        name: 'Mercado Libre',
        category_id: variable.id,
        applies_first_fortnight: true,
      },
      {
        name: 'SKY',
        category_id: fixed.id,
        default_card_id: skyCard.id,
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
  await prisma.fortnightIncome.createMany({
    data: [
      {
        fortnight_id: firstFortnight.id,
        user_id: john.id,
        amount: 12207.27,
        source: 'SALARY',
        house_id: mainHouse.id,
        income_template_id: salaryTemplate.id,
      },
      {
        fortnight_id: secondFortnight.id,
        user_id: john.id,
        amount: 12207.27,
        source: 'SALARY',
        house_id: mainHouse.id,
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
        category_id: variable.id,
        description: 'Liverpool John',
        amount: 1888.87,
        expense_template_id: templateMap['Liverpool John'].id,
        card_id: liverpoolJohn.id,
      },
      {
        fortnight_id: firstFortnight.id,
        category_id: variable.id,
        description: 'Mercado Libre',
        amount: 1520,
        expense_template_id: templateMap['Mercado Libre'].id,
      },
      {
        fortnight_id: firstFortnight.id,
        category_id: fixed.id,
        description: 'AT&T John',
        amount: 1100,
        expense_template_id: templateMap['AT&T John'].id,
      },
      {
        fortnight_id: firstFortnight.id,
        category_id: variable.id,
        description: 'C&A Efectivo',
        amount: 1000,
        expense_template_id: templateMap['C&A Efectivo'].id,
      },
      {
        fortnight_id: firstFortnight.id,
        category_id: variable.id,
        description: 'Liverpool Jane',
        amount: 1500,
        expense_template_id: templateMap['Liverpool Jane'].id,
        card_id: liverpoolJane.id,
      },
      {
        fortnight_id: firstFortnight.id,
        category_id: variable.id,
        description: 'Sartén',
        amount: 520,
        expense_template_id: templateMap['Sartén'].id,
      },
      {
        fortnight_id: firstFortnight.id,
        category_id: fixed.id,
        description: 'Renta',
        amount: 1000,
        expense_template_id: templateMap['Renta'].id,
      },
      {
        fortnight_id: firstFortnight.id,
        category_id: fixed.id,
        description: 'SKY',
        amount: 269,
        expense_template_id: templateMap['SKY'].id,
      },
      {
        fortnight_id: firstFortnight.id,
        category_id: variable.id,
        description: 'C&A Departamental',
        amount: 385,
        expense_template_id: templateMap['C&A Departamental'].id,
        card_id: liverpoolJohn.id,
      },
      {
        fortnight_id: firstFortnight.id,
        category_id: variable.id,
        description: 'Súper',
        amount: 2000,
        expense_template_id: templateMap['Súper'].id,
      },

      // SECOND FORTNIGHT
      {
        fortnight_id: secondFortnight.id,
        category_id: fixed.id,
        description: 'Renta',
        amount: 8000,
        expense_template_id: templateMap['Renta'].id,
      },
      {
        fortnight_id: secondFortnight.id,
        category_id: fixed.id,
        description: 'AT&T John',
        amount: 300,
        expense_template_id: templateMap['AT&T John'].id,
      },
      {
        fortnight_id: secondFortnight.id,
        category_id: fixed.id,
        description: 'AT&T Jane',
        amount: 300,
        expense_template_id: templateMap['AT&T Jane'].id,
      },
      {
        fortnight_id: secondFortnight.id,
        category_id: variable.id,
        description: 'Mercado Pago',
        amount: 1500,
        expense_template_id: templateMap['Mercado Pago'].id,
      },
      {
        fortnight_id: secondFortnight.id,
        category_id: variable.id,
        description: 'Súper',
        amount: 2000,
        expense_template_id: templateMap['Súper'].id,
      },
      {
        fortnight_id: secondFortnight.id,
        category_id: variable.id,
        description: 'Sartén',
        amount: 520,
        expense_template_id: templateMap['Sartén'].id,
      },
      {
        fortnight_id: secondFortnight.id,
        category_id: variable.id,
        description: 'Sears',
        amount: 403.83,
        expense_template_id: templateMap['Sears'].id,
        card_id: liverpoolJohn.id,
      },
      {
        fortnight_id: secondFortnight.id,
        category_id: fixed.id,
        description: 'TELMEX',
        amount: 658,
        expense_template_id: templateMap['TELMEX'].id,
        card_id: telmexCard.id,
      },
    ],
  });

  console.log('✅ Database fully seeded');
}

main().finally(async () => {
  await prisma.$disconnect();
});
