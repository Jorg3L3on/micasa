import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  PrismaClient,
  PaymentMethodType,
  CategoryGroup,
  FortnightPeriod,
} from '../src/generated/prisma/client'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  /**
   * CLEAN DATABASE (ORDER MATTERS)
   */
  await prisma.expense.deleteMany()
  await prisma.fortnightIncome.deleteMany()
  await prisma.expenseTemplate.deleteMany()
  await prisma.card.deleteMany()
  await prisma.paymentMethod.deleteMany()
  await prisma.category.deleteMany()
  await prisma.fortnight.deleteMany()
  await prisma.user.deleteMany()

  /**
   * USERS
   */
  const jorge = await prisma.user.create({ data: { name: 'Jorge' } })
  const carmen = await prisma.user.create({ data: { name: 'Carmen' } })

  /**
   * PAYMENT METHODS
   */
  const tarjeta = await prisma.paymentMethod.create({
    data: { name: 'Tarjeta', type: PaymentMethodType.CARD },
  })

  const efectivo = await prisma.paymentMethod.create({
    data: { name: 'Efectivo', type: PaymentMethodType.CASH },
  })

  /**
   * CARDS
   */
  const liverpoolJorge = await prisma.card.create({
    data: {
      name: 'Liverpool Jorge',
      payment_method_id: tarjeta.id,
    },
  })

  const liverpoolCarmen = await prisma.card.create({
    data: {
      name: 'Liverpool Carmen',
      payment_method_id: tarjeta.id,
    },
  })

  const telmexCard = await prisma.card.create({
    data: {
      name: 'TELMEX',
      payment_method_id: tarjeta.id,
    },
  })

  const skyCard = await prisma.card.create({
    data: {
      name: 'SKY',
      payment_method_id: tarjeta.id,
    },
  })

  /**
   * CATEGORIES
   */
  const fixed = await prisma.category.create({
    data: { name: 'Fijo', group: CategoryGroup.FIXED },
  })

  const variable = await prisma.category.create({
    data: { name: 'Variable', group: CategoryGroup.VARIABLE },
  })

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
  })

  const secondFortnight = await prisma.fortnight.create({
    data: {
      year: 2026,
      month: 1,
      period: FortnightPeriod.SECOND,
      start_date: new Date('2026-01-16'),
      end_date: new Date('2026-01-31'),
      label: '16–31 Enero 2026',
    },
  })

  /**
   * EXPENSE TEMPLATES
   */
  const templates = await prisma.expenseTemplate.createMany({
    data: [
      { name: 'Renta', category_id: fixed.id, is_recurring: true, applies_first_fortnight: true, applies_second_fortnight: true },
      { name: 'TELMEX', category_id: fixed.id, default_card_id: telmexCard.id, is_recurring: true, applies_second_fortnight: true },
      { name: 'AT&T Jorge', category_id: fixed.id, is_recurring: true, applies_second_fortnight: true },
      { name: 'AT&T Carmen', category_id: fixed.id, is_recurring: true, applies_second_fortnight: true },
      { name: 'Mercado Pago', category_id: variable.id, applies_second_fortnight: true },
      { name: 'Súper', category_id: variable.id, applies_first_fortnight: true, applies_second_fortnight: true },
      { name: 'Sears', category_id: variable.id, applies_second_fortnight: true },
      { name: 'Sartén', category_id: variable.id, applies_first_fortnight: true, applies_second_fortnight: true },
      { name: 'Liverpool Carmen', category_id: variable.id, applies_first_fortnight: true },
      { name: 'Liverpool Jorge', category_id: variable.id, applies_first_fortnight: true },
      { name: 'C&A Efectivo', category_id: variable.id, applies_first_fortnight: true },
      { name: 'C&A Departamental', category_id: variable.id, applies_first_fortnight: true },
      { name: 'Mercado Libre', category_id: variable.id, applies_first_fortnight: true },
      { name: 'SKY', category_id: fixed.id, default_card_id: skyCard.id, applies_first_fortnight: true },
    ],
  })

  const templateMap = Object.fromEntries(
    (await prisma.expenseTemplate.findMany()).map(t => [t.name, t])
  )

  /**
   * INCOME
   */
  await prisma.fortnightIncome.createMany({
    data: [
      { fortnight_id: firstFortnight.id, user_id: jorge.id, amount: 12207.27, source: 'SALARY' },
      { fortnight_id: firstFortnight.id, user_id: carmen.id, amount: 4256.32, source: 'SALARY' },
      { fortnight_id: secondFortnight.id, user_id: jorge.id, amount: 12207.27, source: 'SALARY' },
      { fortnight_id: secondFortnight.id, user_id: carmen.id, amount: 4256.32, source: 'SALARY' },
    ],
  })

  /**
   * EXPENSES (FULLY INCLUDED)
   */
  await prisma.expense.createMany({
    data: [
      // FIRST FORTNIGHT
      { fortnight_id: firstFortnight.id, category_id: variable.id, description: 'Liverpool Jorge', amount: 1888.87, expense_template_id: templateMap['Liverpool Jorge'].id, card_id: liverpoolJorge.id },
      { fortnight_id: firstFortnight.id, category_id: variable.id, description: 'Mercado Libre', amount: 1520, expense_template_id: templateMap['Mercado Libre'].id },
      { fortnight_id: firstFortnight.id, category_id: fixed.id, description: 'AT&T Jorge', amount: 1100, expense_template_id: templateMap['AT&T Jorge'].id },
      { fortnight_id: firstFortnight.id, category_id: variable.id, description: 'C&A Efectivo', amount: 1000, expense_template_id: templateMap['C&A Efectivo'].id },
      { fortnight_id: firstFortnight.id, category_id: variable.id, description: 'Liverpool Carmen', amount: 1500, expense_template_id: templateMap['Liverpool Carmen'].id, card_id: liverpoolCarmen.id },
      { fortnight_id: firstFortnight.id, category_id: variable.id, description: 'Sartén', amount: 520, expense_template_id: templateMap['Sartén'].id },
      { fortnight_id: firstFortnight.id, category_id: fixed.id, description: 'Renta', amount: 1000, expense_template_id: templateMap['Renta'].id },
      { fortnight_id: firstFortnight.id, category_id: fixed.id, description: 'SKY', amount: 269, expense_template_id: templateMap['SKY'].id },
      { fortnight_id: firstFortnight.id, category_id: variable.id, description: 'C&A Departamental', amount: 385, expense_template_id: templateMap['C&A Departamental'].id, card_id: liverpoolJorge.id },
      { fortnight_id: firstFortnight.id, category_id: variable.id, description: 'Súper', amount: 2000, expense_template_id: templateMap['Súper'].id },

      // SECOND FORTNIGHT
      { fortnight_id: secondFortnight.id, category_id: fixed.id, description: 'Renta', amount: 8000, expense_template_id: templateMap['Renta'].id },
      { fortnight_id: secondFortnight.id, category_id: fixed.id, description: 'AT&T Jorge', amount: 300, expense_template_id: templateMap['AT&T Jorge'].id },
      { fortnight_id: secondFortnight.id, category_id: fixed.id, description: 'AT&T Carmen', amount: 300, expense_template_id: templateMap['AT&T Carmen'].id },
      { fortnight_id: secondFortnight.id, category_id: variable.id, description: 'Mercado Pago', amount: 1500, expense_template_id: templateMap['Mercado Pago'].id },
      { fortnight_id: secondFortnight.id, category_id: variable.id, description: 'Súper', amount: 2000, expense_template_id: templateMap['Súper'].id },
      { fortnight_id: secondFortnight.id, category_id: variable.id, description: 'Sartén', amount: 520, expense_template_id: templateMap['Sartén'].id },
      { fortnight_id: secondFortnight.id, category_id: variable.id, description: 'Sears', amount: 403.83, expense_template_id: templateMap['Sears'].id, card_id: liverpoolJorge.id },
      { fortnight_id: secondFortnight.id, category_id: fixed.id, description: 'TELMEX', amount: 658, expense_template_id: templateMap['TELMEX'].id, card_id: telmexCard.id },
    ],
  })

  console.log('✅ Database fully seeded')
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
