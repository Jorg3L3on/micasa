import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  createIncomeTemplateSchema,
  updateIncomeTemplateSchema,
} from '@/schemas/income-template.schema';

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const templates = await prisma.incomeTemplate.findMany({
      where: ownerFilter,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    const formatted = templates.map((template) => ({
      id: template.id,
      name: template.name,
      suggestedAmount: template.suggested_amount
        ? Number(template.suggested_amount)
        : null,
      source: template.source,
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
    const { ownerType, ownerId } = context;

    const body = await request.json();
    const validatedData = createIncomeTemplateSchema.parse(body);

    const template = await prisma.incomeTemplate.create({
      data: {
        name: validatedData.name,
        suggested_amount: validatedData.suggestedAmount
          ? validatedData.suggestedAmount.toString()
          : null,
        source: validatedData.source ?? null,
        applies_first_fortnight: validatedData.appliesFirstFortnight,
        applies_second_fortnight: validatedData.appliesSecondFortnight,
        active: validatedData.active ?? true,
        user_id: ownerType === 'user' ? ownerId : null,
        house_id: ownerType === 'house' ? ownerId : null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        id: template.id,
        name: template.name,
        suggestedAmount: template.suggested_amount
          ? Number(template.suggested_amount)
          : null,
        source: template.source,
        appliesFirstFortnight: template.applies_first_fortnight,
        appliesSecondFortnight: template.applies_second_fortnight,
        active: template.active,
        userId: template.user_id,
        userName: template.user?.name ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
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
    const { ownerFilter } = context;

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

    const updateData: Record<string, unknown> = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.suggestedAmount !== undefined) {
      updateData.suggested_amount =
        validatedData.suggestedAmount === null
          ? null
          : validatedData.suggestedAmount.toString();
    }
    if (validatedData.source !== undefined)
      updateData.source = validatedData.source;
    if (validatedData.appliesFirstFortnight !== undefined)
      updateData.applies_first_fortnight = validatedData.appliesFirstFortnight;
    if (validatedData.appliesSecondFortnight !== undefined)
      updateData.applies_second_fortnight =
        validatedData.appliesSecondFortnight;
    if (validatedData.active !== undefined)
      updateData.active = validatedData.active;
    if (validatedData.userId !== undefined)
      updateData.user_id = validatedData.userId;

    const template = await prisma.incomeTemplate.update({
      where: { id: Number(id), ...ownerFilter },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        id: template.id,
        name: template.name,
        suggestedAmount: template.suggested_amount
          ? Number(template.suggested_amount)
          : null,
        source: template.source,
        appliesFirstFortnight: template.applies_first_fortnight,
        appliesSecondFortnight: template.applies_second_fortnight,
        active: template.active,
        userId: template.user_id,
        userName: template.user?.name ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
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

    const templateId = Number(id);
    const existing = await prisma.incomeTemplate.findFirst({
      where: { id: templateId, ...ownerFilter },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Plantilla de ingresos no encontrada' },
        { status: 404 },
      );
    }

    const relatedIncome = await prisma.income.findFirst({
      where: { income_template_id: templateId },
    });

    if (relatedIncome) {
      return NextResponse.json(
        {
          error: 'La plantilla de ingresos está en uso y no puede eliminarse',
        },
        { status: 409 },
      );
    }

    await prisma.incomeTemplate.delete({
      where: { id: templateId },
    });

    return NextResponse.json(
      { message: 'Plantilla de ingresos eliminada correctamente' },
      { status: 200 },
    );
  } catch (error) {
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
