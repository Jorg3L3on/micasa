import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  createFortnightSchema,
  updateFortnightSchema,
} from '@/schemas/fortnight.schema';
import {
  listFortnightsForCatalog,
  createOwnedFortnight,
  updateFortnightCatalogEntry,
  deleteFortnightIfUnused,
} from '@/lib/finance/fortnight.service';

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

    const formatted = await listFortnightsForCatalog();
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

    try {
      const result = await createOwnedFortnight(validatedData);
      return NextResponse.json(result, { status: 201 });
    } catch (error: any) {
      if (error.code === 'NO_DEFAULT_USER') {
        return NextResponse.json(
          { error: 'No active user found to own fortnight' },
          { status: 400 },
        );
      }
      throw error;
    }
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

    const result = await updateFortnightCatalogEntry(Number(id), validatedData);

    return NextResponse.json(result, { status: 200 });
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

    try {
      await deleteFortnightIfUnused(Number(id));
    } catch (error: any) {
      if (error.code === 'FORTNIGHT_IN_USE') {
        return NextResponse.json(
          { error: 'La quincena está en uso y no puede ser eliminada' },
          { status: 409 },
        );
      }
      throw error;
    }

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
