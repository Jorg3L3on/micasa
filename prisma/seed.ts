import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, FortnightPeriod, CategoryGroup } from '../src/generated/prisma/client'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  /**
   * USERS
   */
  const jorge = await prisma.user.upsert({
    where: { name: 'Jorge' },
    update: {},
    create: { name: 'Jorge' },
  })

  const carmen = await prisma.user.upsert({
    where: { name: 'Carmen' },
    update: {},
    create: { name: 'Carmen' },
  })

  /**
   * CATEGORIES - Create unique categories for each expense type
   */
  const categories: Array<{ name: string; group: CategoryGroup }> = [
    { name: 'Renta', group: CategoryGroup.FIXED },
    { name: 'TELMEX', group: CategoryGroup.FIXED },
    { name: 'AT&T Jorge', group: CategoryGroup.FIXED },
    { name: 'AT&T Carmen', group: CategoryGroup.FIXED },
    { name: 'SKY', group: CategoryGroup.FIXED },
    { name: 'Mercado Pago', group: CategoryGroup.VARIABLE },
    { name: 'Súper', group: CategoryGroup.VARIABLE },
    { name: 'Sears', group: CategoryGroup.VARIABLE },
    { name: 'Sartén', group: CategoryGroup.VARIABLE },
    { name: 'Liverpool Carmen', group: CategoryGroup.VARIABLE },
    { name: 'Liverpool Jorge', group: CategoryGroup.VARIABLE },
    { name: 'C&A Efectivo', group: CategoryGroup.VARIABLE },
    { name: 'C&A Departamental', group: CategoryGroup.VARIABLE },
    { name: 'Mercado Libre', group: CategoryGroup.VARIABLE },
  ]

  const categoryMap: Record<string, { id: number }> = {}
  for (const cat of categories) {
    const category = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: { name: cat.name, group: cat.group },
    })
    categoryMap[cat.name] = category
  }

  /**
   * EXPENSE TEMPLATES
   */
  const templates = await prisma.expenseTemplate.createMany({
    data: [
      { name: 'Renta', category_id: categoryMap['Renta'].id, is_recurring: true, applies_first_fortnight: true, applies_second_fortnight: true },
      { name: 'TELMEX', category_id: categoryMap['TELMEX'].id, is_recurring: true, applies_second_fortnight: true },
      { name: 'AT&T Jorge', category_id: categoryMap['AT&T Jorge'].id, is_recurring: true, applies_second_fortnight: true },
      { name: 'AT&T Carmen', category_id: categoryMap['AT&T Carmen'].id, is_recurring: true, applies_second_fortnight: true },
      { name: 'Mercado Pago', category_id: categoryMap['Mercado Pago'].id, applies_second_fortnight: true },
      { name: 'Súper', category_id: categoryMap['Súper'].id, applies_first_fortnight: true, applies_second_fortnight: true },
      { name: 'Sears', category_id: categoryMap['Sears'].id, applies_second_fortnight: true },
      { name: 'Sartén', category_id: categoryMap['Sartén'].id, applies_first_fortnight: true, applies_second_fortnight: true },
      { name: 'Liverpool Carmen', category_id: categoryMap['Liverpool Carmen'].id, applies_first_fortnight: true },
      { name: 'Liverpool Jorge', category_id: categoryMap['Liverpool Jorge'].id, applies_first_fortnight: true },
      { name: 'C&A Efectivo', category_id: categoryMap['C&A Efectivo'].id, applies_first_fortnight: true },
      { name: 'C&A Departamental', category_id: categoryMap['C&A Departamental'].id, applies_first_fortnight: true },
      { name: 'SKY', category_id: categoryMap['SKY'].id, applies_first_fortnight: true },
      { name: 'Mercado Libre', category_id: categoryMap['Mercado Libre'].id, applies_first_fortnight: true },
    ],
    skipDuplicates: true,
  })

  /**
   * FORTNIGHTS
   */
  const firstFortnight = await prisma.fortnight.upsert({
    where: {
      year_month_period: {
        year: 2026,
        month: 1,
        period: FortnightPeriod.FIRST,
      },
    },
    update: {},
    create: {
      year: 2026,
      month: 1,
      period: FortnightPeriod.FIRST,
      start_date: new Date('2026-01-01'),
      end_date: new Date('2026-01-15'),
      label: '1–15 Enero 2026',
    },
  })

  const secondFortnight = await prisma.fortnight.upsert({
    where: {
      year_month_period: {
        year: 2026,
        month: 1,
        period: FortnightPeriod.SECOND,
      },
    },
    update: {},
    create: {
      year: 2026,
      month: 1,
      period: FortnightPeriod.SECOND,
      start_date: new Date('2026-01-16'),
      end_date: new Date('2026-01-31'),
      label: '16–31 Enero 2026',
    },
  })

  /**
   * PAYMENT METHODS
   */
  const card = await prisma.paymentMethod.upsert({
    where: { name: 'Tarjeta' },
    update: {},
    create: { name: 'Tarjeta', type: 'CARD' },
  })

  const cash = await prisma.paymentMethod.upsert({
    where: { name: 'Efectivo' },
    update: {},
    create: { name: 'Efectivo', type: 'CASH' },
  })

  /**
   * CARDS
   */
  const jorgeCard = await prisma.card.upsert({
    where: { name: 'Liverpool Jorge' },
    update: {},
    create: {
      name: 'Liverpool Jorge',
      payment_method_id: card.id,
    },
  })

  const carmenCard = await prisma.card.upsert({
    where: { name: 'Liverpool Carmen' },
    update: {},
    create: {
      name: 'Liverpool Carmen',
      payment_method_id: card.id,
    },
  })

  /**
   * INCOME
   */
  // Delete existing income for these fortnights
  await prisma.fortnightIncome.deleteMany({
    where: {
      fortnight_id: {
        in: [firstFortnight.id, secondFortnight.id],
      },
    },
  })

  await prisma.fortnightIncome.create({
    data: {
      fortnight_id: firstFortnight.id,
      amount: 27000, // Combined income for the fortnight
      source: 'Salary',
    },
  })

  await prisma.fortnightIncome.create({
    data: {
      fortnight_id: secondFortnight.id,
      amount: 27000, // Combined income for the fortnight
      source: 'Salary',
    },
  })

  /**
   * EXPENSES PER FORTNIGHT
   */
  const expenseTemplates = await prisma.expenseTemplate.findMany()

  // Sample expense amounts
  const expenseAmounts: Record<string, number> = {
    Renta: 8000,
    TELMEX: 500,
    'AT&T Jorge': 300,
    'AT&T Carmen': 300,
    'Mercado Pago': 1500,
    Súper: 2000,
    Sears: 800,
    Sartén: 1200,
    'Liverpool Carmen': 1500,
    'Liverpool Jorge': 2000,
    'C&A Efectivo': 600,
    'C&A Departamental': 800,
    SKY: 400,
    'Mercado Libre': 1000,
  }

  // Card mapping for expenses
  const expenseCards: Record<string, number> = {
    'Liverpool Jorge': jorgeCard.id,
    'Liverpool Carmen': carmenCard.id,
    'C&A Departamental': jorgeCard.id,
    Sears: jorgeCard.id,
  }

  // Delete existing expenses for these fortnights to avoid duplicates
  await prisma.expense.deleteMany({
    where: {
      fortnight_id: {
        in: [firstFortnight.id, secondFortnight.id],
      },
    },
  })

  for (const template of expenseTemplates) {
    const amount = expenseAmounts[template.name] || 0
    const cardId = expenseCards[template.name] || null

    if (template.applies_first_fortnight) {
      await prisma.expense.create({
        data: {
          description: template.name,
          amount: amount,
          fortnight_id: firstFortnight.id,
          category_id: template.category_id,
          expense_template_id: template.id,
          card_id: cardId,
          is_paid: Math.random() > 0.3, // 70% paid
        },
      })
    }

    if (template.applies_second_fortnight) {
      await prisma.expense.create({
        data: {
          description: template.name,
          amount: amount,
          fortnight_id: secondFortnight.id,
          category_id: template.category_id,
          expense_template_id: template.id,
          card_id: cardId,
          is_paid: Math.random() > 0.3, // 70% paid
        },
      })
    }
  }

  console.log('✅ Seed data created successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
