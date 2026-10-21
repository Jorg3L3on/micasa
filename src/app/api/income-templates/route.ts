import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  createIncomeTemplateSchema,
  updateIncomeTemplateSchema,
} from '@/schemas/income-template.schema';
import { CategoryServiceError } from '@/lib/finance/category.service';
import { IncomeServiceError } from '@/lib/finance/income.service';
import { DomainError } from '@/lib/finance/domain-error';
import {
  createIncomeTemplateForOwner,
  deleteIncomeTemplateForOwner,
  listIncomeTemplatesForOwner,
  updateIncomeTemplateForOwner,
} from '@/lib/finance/income-template.service';

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const templates = await listIncomeTemplatesForOwner(ownerFilter);

    const formatted = templates.map((template) => ({
      id: template.id,
      name: template.name,
      suggestedAmount: template.suggested_amount
        ? Number(template.suggested_amount)
        : null,
      source: template.source,
      categoryId: template.category_id,
      walletId: template.wallet_id,
      categoryName: template.category?.name ?? null,
      categoryIcon: template.category?.icon ?? null,
      appliesFirstFortnight: template.applies_first_fortnight,
      appliesSecondFortnight: template.applies_second_fortnight,
      active: template.active,
      userId: template.user_id,
      userName: template.user?.name ?? null,
    }));

    return NextResponse.json(formatted, { status: 200 });
  } catch (error) {
    console.error('Error fetching income templates:', error);
    return NextResponse.json(
      { error: 'Error al obtener las plantillas de ingresos' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const body = await request.json();
    const validatedData = createIncomeTemplateSchema.parse(body);

    const template = await createIncomeTemplateForOwner(context, validatedData);

    return NextResponse.json(
      {
        id: template.id,
        name: template.name,
        suggestedAmount: template.suggested_amount
          ? Number(template.suggested_amount)
          : null,
        source: template.source,
        categoryId: template.category_id,
        walletId: template.wallet_id,
        categoryName: template.category?.name ?? null,
        categoryIcon: template.category?.icon ?? null,
        appliesFirstFortnight: template.applies_first_fortnight,
        appliesSecondFortnight: template.applies_second_fortnight,
        active: template.active,
        userId: template.user_id,
        userName: template.user?.name ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof CategoryServiceError ||
      error instanceof IncomeServiceError ||
      (error instanceof DomainError && error.code !== 'P2025')
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Ya existe una plantilla de ingresos con este nombre' },
        { status: 409 },
      );
    }

    console.error('Error creating income template:', error);
    return NextResponse.json(
      { error: 'Error al crear la plantilla de ingresos' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'El parámetro id es requerido' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validatedData = updateIncomeTemplateSchema.parse(body);

    const template = await updateIncomeTemplateForOwner(Number(id), context, validatedData);

    return NextResponse.json(
      {
        id: template.id,
        name: template.name,
        suggestedAmount: template.suggested_amount
          ? Number(template.suggested_amount)
          : null,
        source: template.source,
        categoryId: template.category_id,
        walletId: template.wallet_id,
        categoryName: template.category?.name ?? null,
        categoryIcon: template.category?.icon ?? null,
        appliesFirstFortnight: template.applies_first_fortnight,
        appliesSecondFortnight: template.applies_second_fortnight,
        active: template.active,
        userId: template.user_id,
        userName: template.user?.name ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    if (
      error instanceof CategoryServiceError ||
      error instanceof IncomeServiceError ||
      (error instanceof DomainError && error.code !== 'P2025')
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2025'
    ) {
      return NextResponse.json(
        { error: 'Plantilla de ingresos no encontrada' },
        { status: 404 },
      );
    }

    console.error('Error updating income template:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la plantilla de ingresos' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'El parámetro id es requerido' },
        { status: 400 },
      );
    }

    await deleteIncomeTemplateForOwner(Number(id), ownerFilter);

    return NextResponse.json(
      { message: 'Plantilla de ingresos eliminada correctamente' },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof DomainError && error.code !== 'P2025') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2025'
    ) {
      return NextResponse.json(
        { error: 'Plantilla de ingresos no encontrada' },
        { status: 404 },
      );
    }

    console.error('Error deleting income template:', error);
    return NextResponse.json(
      { error: 'Error al eliminar la plantilla de ingresos' },
      { status: 500 },
    );
  }
}
