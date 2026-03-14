'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatCurrencySigned } from '@/lib/utils';
import type { TransactionRow } from '@/types/catalog';

type TransactionsDataTableProps = {
  transactions: TransactionRow[];
};

export default function TransactionsDataTable({
  transactions,
}: TransactionsDataTableProps) {
  const columns = useMemo<ColumnDef<TransactionRow>[]>(
    () => [
      {
        accessorKey: 'date',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Fecha" />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {formatDate(row.original.date)}
          </span>
        ),
      },
      {
        accessorKey: 'description',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Descripción" />
        ),
        cell: ({ row }) => row.original.description,
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Monto"
            className="text-right"
          />
        ),
        cell: ({ row }) => {
          const t = row.original;
          return (
            <span
              className={`font-medium ${
                t.type === 'expense' ? 'text-destructive' : 'text-chart-4'
              }`}
            >
              {formatCurrencySigned(
                t.amount,
                t.type ?? 'expense',
              )}
            </span>
          );
        },
      },
      {
        accessorKey: 'category',
        header: 'Categoría',
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap">
            {row.original.category}
          </span>
        ),
      },
      {
        accessorKey: 'paymentMethod',
        header: 'Método de pago',
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap">
            {row.original.paymentMethod}
          </span>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Tipo',
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.type === 'expense' ? 'destructive' : 'default'
            }
          >
            {row.original.type === 'expense' ? 'Gasto' : 'Ingreso'}
          </Badge>
        ),
      },
    ],
    []
  );

  return (
    <DataTable
      data={transactions}
      columns={columns}
      filterColumn="description"
      filterPlaceholder="Filtrar por descripción..."
      emptyMessage="No se encontraron transacciones."
    />
  );
}
