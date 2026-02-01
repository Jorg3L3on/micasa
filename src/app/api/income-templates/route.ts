import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  createIncomeTemplateSchema,
  updateIncomeTemplateSchema,
} from '@/schemas/income-template.schema';

export async function GET() {
  try {
    const templates = await prisma.incomeTemplate.findMany({
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
      houseId: template.house_id,
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
        user_id: validatedData.userId ?? null,
        house_id: validatedData.houseId ?? null,
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
        houseId: template.house_id,
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
    if (validatedData.source !== undefined) updateData.source = validatedData.source;
    if (validatedData.appliesFirstFortnight !== undefined)
      updateData.applies_first_fortnight = validatedData.appliesFirstFortnight;
    if (validatedData.appliesSecondFortnight !== undefined)
      updateData.applies_second_fortnight =
        validatedData.appliesSecondFortnight;
    if (validatedData.active !== undefined) updateData.active = validatedData.active;
    if (validatedData.userId !== undefined) updateData.user_id = validatedData.userId;
    if (validatedData.houseId !== undefined) updateData.house_id = validatedData.houseId;

    const template = await prisma.incomeTemplate.update({
      where: { id: Number(id) },
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
        houseId: template.house_id,
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'El parámetro id es requerido' },
        { status: 400 },
      );
    }

    const relatedIncome = await prisma.fortnightIncome.findFirst({
      where: { income_template_id: Number(id) },
    });

    if (relatedIncome) {
      return NextResponse.json(
        {
          error:
            'La plantilla de ingresos está en uso y no puede eliminarse',
        },
        { status: 409 },
      );
    }

    await prisma.incomeTemplate.delete({
      where: { id: Number(id) },
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
