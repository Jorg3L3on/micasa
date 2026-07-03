'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LayoutList, Pencil, Repeat2, RotateCcw, Trash2 } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import type { BudgetListItem } from '@/types/catalog';
import { BUDGET_FREQUENCY_LABELS, type BudgetFrequency } from '@/schemas/budget.schema';

type BudgetTemplateMobileCardProps = {
  template: BudgetListItem;
  onEdit: (template: BudgetListItem) => void;
  onAllocations: (template: BudgetListItem) => void;
  onDeactivate: (template: BudgetListItem) => void;
  onReactivate: (template: BudgetListItem) => void;
};

export function BudgetTemplateMobileCard({
  template,
  onEdit,
  onAllocations,
  onDeactivate,
  onReactivate,
}: BudgetTemplateMobileCardProps) {
  const frequencyLabel =
    BUDGET_FREQUENCY_LABELS[template.frequency as BudgetFrequency] ?? template.frequency;

  return (
    <article
      className="rounded-xl border border-border/60 bg-card p-4 shadow-sm"
      aria-label={`Plantilla ${template.name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={cn(
                'text-sm font-semibold leading-tight',
                !template.active && 'text-muted-foreground',
              )}
            >
              {template.name}
            </h3>
            <Badge variant={template.active ? 'default' : 'secondary'}>
              {template.active ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{frequencyLabel}</p>
        </div>
        <span className="shrink-0 text-sm font-bold font-mono tabular-nums">
          {formatCurrency(template.allocated_amount)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {template.recurrent ? (
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Repeat2 className="h-3 w-3" aria-hidden />
            Recurrente
          </Badge>
        ) : null}
        <Badge variant="outline" className="text-[10px]">
          {template.allocations.length}{' '}
          {template.allocations.length === 1 ? 'asignación' : 'asignaciones'}
        </Badge>
      </div>

      <div className="mt-3 flex justify-end gap-1">
        {!template.active ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            onClick={() => onReactivate(template)}
            aria-label={`Reactivar ${template.name}`}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={() => onEdit(template)}
              aria-label={`Editar ${template.name}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={() => onAllocations(template)}
              aria-label={`Ver asignaciones de ${template.name}`}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={() => onDeactivate(template)}
              aria-label={`Desactivar ${template.name}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
