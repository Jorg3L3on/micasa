import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  createFortnightSchema,
  updateFortnightSchema,
} from '@/schemas/fortnight.schema';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const period = searchParams.get('period');

    // If specific params provided, return that fortnight (or null if not found)
    if (year && month && period) {
      const fortnight = await prisma.fortnight.findFirst({
        where: {
          year: parseInt(year, 10),
          month: parseInt(month, 10),
          period: period.toUpperCase() as 'FIRST' | 'SECOND',
        },
        select: {
          id: true,
          label: true,
          year: true,
          month: true,
          period: true,
        },
      });

      if (!fortnight) {
        return NextResponse.json(null, { status: 200 });
      }

      return NextResponse.json(
        {
          id: fortnight.id,
          label: fortnight.label,
          year: fortnight.year,
          month: fortnight.month,
          period: fortnight.period,
        },
        { status: 200 },
      );
    }

    // Otherwise return all fortnights for catalog
    const fortnights = await prisma.fortnight.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { period: 'desc' }],
      select: {
        id: true,
        label: true,
        start_date: true,
        end_date: true,
        closed: true,
        year: true,
        month: true,
        period: true,
      },
    });

    const formatted = fortnights.map((f) => ({
      id: f.id,
      name: f.label,
      startDay: new Date(f.start_date).getDate(),
      endDay: new Date(f.end_date).getDate(),
      active: !f.closed,
      year: f.year,
      month: f.month,
      period: f.period,
    }));

    return NextResponse.json(formatted, { status: 200 });
  } catch (error) {
    console.error('Error al obtener las quincenas:', error);
    return NextResponse.json(
      { error: 'Error al obtener las quincenas' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createFortnightSchema.parse(body);

    // For now, we'll create a simple fortnight entry
    // In a real system, you'd need to calculate start_date/end_date from startDay/endDay
    // This is a simplified version for the catalog
    const year = validatedData.year;
    const month = validatedData.month;
    const period = validatedData.period;

    const startDate = new Date(year, month - 1, validatedData.startDay);
    const endDate = new Date(year, month - 1, validatedData.endDay);

    const fortnight = await prisma.fortnight.create({
      data: {
        label: validatedData.name,
        start_date: startDate,
        end_date: endDate,
        month,
        year,
        period: period as 'FIRST' | 'SECOND',
        closed: !validatedData.active,
      },
    });

    return NextResponse.json(
      {
        id: fortnight.id,
        name: fortnight.label,
        startDay: new Date(fortnight.start_date).getDate(),
        endDay: new Date(fortnight.end_date).getDate(),
        active: !fortnight.closed,
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
        { error: 'Quincena con esta configuración ya existe' },
        { status: 409 },
      );
    }

    console.error('Error al crear la quincena:', error);
    return NextResponse.json(
      { error: 'Error al crear la quincena' },
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
    const validatedData = updateFortnightSchema.parse(body);

    const updateData: any = {};
    if (validatedData.name !== undefined) {
      updateData.label = validatedData.name;
    }
    if (validatedData.active !== undefined) {
      updateData.closed = !validatedData.active;
    }
    if (
      validatedData.startDay !== undefined ||
      validatedData.endDay !== undefined
    ) {
      const existing = await prisma.fortnight.findUnique({
        where: { id: Number(id) },
      });
      if (existing) {
        const startDay =
          validatedData.startDay ?? new Date(existing.start_date).getDate();
        const endDay =
          validatedData.endDay ?? new Date(existing.end_date).getDate();
        updateData.start_date = new Date(
          existing.year,
          existing.month - 1,
          startDay,
        );
        updateData.end_date = new Date(
          existing.year,
          existing.month - 1,
          endDay,
        );
      }
    }

    const fortnight = await prisma.fortnight.update({
      where: { id: Number(id) },
      data: updateData,
    });

    return NextResponse.json(
      {
        id: fortnight.id,
        name: fortnight.label,
        startDay: new Date(fortnight.start_date).getDate(),
        endDay: new Date(fortnight.end_date).getDate(),
        active: !fortnight.closed,
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
        { error: 'Quincena no encontrada' },
        { status: 404 },
      );
    }

    console.error('Error al actualizar la quincena:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la quincena' },
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

    // Check for related expenses
    const relatedExpenses = await prisma.expense.findFirst({
      where: { fortnight_id: Number(id) },
    });

    if (relatedExpenses) {
      return NextResponse.json(
        { error: 'La quincena está en uso y no puede ser eliminada' },
        { status: 409 },
      );
    }

    await prisma.fortnight.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json(
      { message: 'Quincena eliminada correctamente' },
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
        { error: 'Quincena no encontrada' },
        { status: 404 },
      );
    }

    console.error('Error al eliminar la quincena:', error);
    return NextResponse.json(
      { error: 'Error al eliminar la quincena' },
      { status: 500 },
    );
  }
}
