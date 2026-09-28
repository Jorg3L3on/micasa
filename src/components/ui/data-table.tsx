'use client';

import * as React from 'react';
import { useSyncExternalStore } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ExpandedState,
  type Row,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Column } from '@tanstack/react-table';

import EmptyState from '@/components/EmptyState';
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

const MAX_MD_QUERY = '(max-width: 767px)';

const subscribeMaxMd = (onStoreChange: () => void) => {
  const media = window.matchMedia(MAX_MD_QUERY);
  media.addEventListener('change', onStoreChange);
  return () => media.removeEventListener('change', onStoreChange);
};

const getMaxMdSnapshot = () => window.matchMedia(MAX_MD_QUERY).matches;

/** SSR and the first client render use the mobile list so a wide table is not in the document. */
const getMaxMdServerSnapshot = () => true;

const useIsMaxMd = () =>
  useSyncExternalStore(subscribeMaxMd, getMaxMdSnapshot, getMaxMdServerSnapshot);

export type DataTableProps<TData> = {
  data: TData[];
  columns: ColumnDef<TData>[];
  filterColumn?: string;
  filterPlaceholder?: string;
  pagination?: boolean;
  columnVisibility?: boolean;
  emptyMessage?: React.ReactNode;
  /** Renders in the toolbar row (e.g. "Add" button). Shown after filter and column visibility. */
  toolbarExtra?: React.ReactNode;
  /** Renders extra filter controls in the toolbar (e.g. category, type). Shown after the search input, before Columnas. */
  filterSlot?: React.ReactNode;
  /** Called when a data row is clicked (e.g. select for detail pane). */
  onRowClick?: (row: TData) => void;
  /** When set with onRowClick, highlights the row whose id matches (row must have numeric `id`). */
  selectedRowId?: number | null;
  /** Renders an inline detail panel below an expanded row. Enables opt-in row expansion. */
  renderExpandedRow?: (row: TData) => React.ReactNode;
  /** Whether a given row can expand. Defaults to true for every row when renderExpandedRow is set. */
  getRowCanExpand?: (row: Row<TData>) => boolean;
  /** Allow more than one row expanded at a time. Defaults to false (accordion). */
  enableMultiRowExpansion?: boolean;
  /** Below `md`, replaces the table with a list of these rows (filters and pagination still apply). */
  renderMobileRow?: (row: TData) => React.ReactNode;
  /** Inside a Card: the card owns the border, so the table does not draw a second one. */
  embedded?: boolean;
};

export function DataTable<TData>({
  data,
  columns,
  filterColumn,
  filterPlaceholder = 'Filtrar…',
  pagination = true,
  columnVisibility = false,
  emptyMessage = 'Sin resultados.',
  toolbarExtra,
  filterSlot,
  onRowClick,
  selectedRowId,
  renderExpandedRow,
  getRowCanExpand,
  enableMultiRowExpansion = false,
  renderMobileRow,
  embedded = false,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [visibility, setVisibility] = React.useState<VisibilityState>({});
  const [expanded, setExpanded] = React.useState<ExpandedState>({});

  const expansionEnabled = renderExpandedRow != null;
  const resolvedEmpty =
    typeof emptyMessage === 'string' ? (
      <EmptyState message={emptyMessage} className="py-8" />
    ) : (
      emptyMessage
    );


  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table owns its internal mutable table API.
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
      ...(expansionEnabled && { expanded }),
    },
    ...(expansionEnabled && {
      onExpandedChange: setExpanded,
      getExpandedRowModel: getExpandedRowModel(),
      getRowCanExpand: getRowCanExpand ?? (() => true),
      enableMultiRowExpansion,
    }),
    ...(pagination && {
      getPaginationRowModel: getPaginationRowModel(),
      initialState: { pagination: { pageSize: 10 } },
    }),
  });

  const filterValue =
    (filterColumn && (table.getColumn(filterColumn)?.getFilterValue() as string)) ?? '';

  const isMaxMd = useIsMaxMd();
  const showMobileList = Boolean(renderMobileRow) && isMaxMd;
  const columnToggleIsDesktopOnly = Boolean(renderMobileRow && columnVisibility);
  const toolbarOnlyColumnToggle =
    columnToggleIsDesktopOnly && !filterColumn && !filterSlot && !toolbarExtra;

  return (
    <div className="w-full min-w-0 space-y-4">
      {(filterColumn || filterSlot || columnVisibility || toolbarExtra) && (
        <div
          className={cn(
            'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
            toolbarOnlyColumnToggle && 'hidden md:flex',
          )}
        >
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
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(columnToggleIsDesktopOnly && 'hidden md:inline-flex')}
                  >
                    Columnas <ChevronDown className="ml-2 h-4 w-4" data-icon="inline-end" />
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
      {showMobileList && renderMobileRow ? (
        <ul
          className={cn(
            'w-full min-w-0 max-w-full divide-y divide-border/60 overflow-hidden',
            !embedded && 'rounded-lg border bg-card',
          )}
          role="list"
        >
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <li key={row.id} className="min-w-0 max-w-full">
                {renderMobileRow(row.original)}
              </li>
            ))
          ) : (
            <li className="p-2 text-center">{resolvedEmpty}</li>
          )}
        </ul>
      ) : null}
      {showMobileList ? null : (
      <div
        className={cn(
          'overflow-x-auto',
          !embedded && 'rounded-lg border bg-card',
        )}
      >
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
                const isExpanded = expansionEnabled && row.getIsExpanded();
                return (
                <React.Fragment key={row.id}>
                <TableRow
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
                {isExpanded && renderExpandedRow ? (
                  <TableRow
                    data-expanded-detail="true"
                    className="hover:bg-transparent"
                  >
                    <TableCell
                      colSpan={row.getVisibleCells().length}
                      className="bg-muted/20 p-0"
                    >
                      {renderExpandedRow(row.original)}
                    </TableCell>
                  </TableRow>
                ) : null}
                </React.Fragment>
              );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-2 text-center">
                  {resolvedEmpty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      )}
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
              <ChevronLeft className="h-4 w-4" data-icon="inline-start" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" data-icon="inline-end" />
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
      <ArrowUpDown className="ml-2 h-4 w-4" data-icon="inline-start" />
    </Button>
  );
}
