'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Column } from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type DataTableProps<TData> = {
  data: TData[];
  columns: ColumnDef<TData>[];
  filterColumn?: string;
  filterPlaceholder?: string;
  pagination?: boolean;
  columnVisibility?: boolean;
  emptyMessage?: string;
  /** Renders in the toolbar row (e.g. "Add" button). Shown after filter and column visibility. */
  toolbarExtra?: React.ReactNode;
  /** Renders extra filter controls in the toolbar (e.g. category, type). Shown after the search input, before Columnas. */
  filterSlot?: React.ReactNode;
  /** Called when a data row is clicked (e.g. select for detail pane). */
  onRowClick?: (row: TData) => void;
  /** When set with onRowClick, highlights the row whose id matches (row must have numeric `id`). */
  selectedRowId?: number | null;
};

export function DataTable<TData>({
  data,
  columns,
  filterColumn,
  filterPlaceholder = 'Filtrar...',
  pagination = true,
  columnVisibility = false,
  emptyMessage = 'Sin resultados.',
  toolbarExtra,
  filterSlot,
  onRowClick,
  selectedRowId,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [visibility, setVisibility] = React.useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility: visibility,
    },
    ...(pagination && {
      getPaginationRowModel: getPaginationRowModel(),
      initialState: { pagination: { pageSize: 10 } },
    }),
  });

  const filterValue =
    (filterColumn && (table.getColumn(filterColumn)?.getFilterValue() as string)) ?? '';

  return (
    <div className="w-full min-w-0 space-y-4">
      {(filterColumn || filterSlot || columnVisibility || toolbarExtra) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex flex-1 flex-wrap items-center gap-3 sm:gap-4">
            {filterColumn && (
              <Input
                placeholder={filterPlaceholder}
                value={filterValue}
                onChange={(e) =>
                  table.getColumn(filterColumn)?.setFilterValue(e.target.value)
                }
                className="max-w-xs"
                aria-label={filterPlaceholder}
              />
            )}
            {filterSlot}
            {columnVisibility && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Columnas <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuGroup>
                    {table
                      .getAllColumns()
                      .filter((col) => col.getCanHide())
                      .map((col) => (
                        <DropdownMenuCheckboxItem
                          key={col.id}
                          className="capitalize"
                          checked={col.getIsVisible()}
                          onCheckedChange={(value) => col.toggleVisibility(!!value)}
                        >
                          {typeof col.columnDef.header === 'string'
                            ? col.columnDef.header
                            : col.id}
                        </DropdownMenuCheckboxItem>
                      ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {toolbarExtra && (
            <div className="shrink-0">{toolbarExtra}</div>
          )}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                const minWidth = header.column.columnDef.minSize;
                return (
                  <TableHead
                    key={header.id}
                    style={minWidth != null ? { minWidth } : undefined}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                );
              })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const original = row.original as { id?: number };
                const isSelected =
                  selectedRowId != null && original?.id === selectedRowId;
                return (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  data-selected={isSelected ? 'true' : undefined}
                  className={cn(
                    onRowClick && 'cursor-pointer hover:bg-muted/40',
                    isSelected &&
                      'bg-muted/30 border-l-[3px] border-l-violet-500/50',
                  )}
                  onClick={() => onRowClick?.(row.original)}
                  onKeyDown={(e) => {
                    if (!onRowClick) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRowClick(row.original);
                    }
                  }}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={
                    onRowClick ? 'Seleccionar fila para ver detalle' : undefined
                  }
                  aria-selected={isSelected}
                >
                  {row.getVisibleCells().map((cell) => {
                  const minWidth = cell.column.columnDef.minSize;
                  return (
                    <TableCell
                      key={cell.id}
                      style={minWidth != null ? { minWidth } : undefined}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  );
                })}
                </TableRow>
              );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {pagination && table.getPageCount() > 1 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Página {table.getState().pagination.pageIndex + 1} de{' '}
            {table.getPageCount()} ({table.getFilteredRowModel().rows.length}{' '}
            filas)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DataTableColumnHeader<TData>({
  column,
  title,
  className,
}: {
  column: Column<TData>;
  title: string;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      className={className}
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      aria-label={`Ordenar por ${title}`}
    >
      {title}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}
