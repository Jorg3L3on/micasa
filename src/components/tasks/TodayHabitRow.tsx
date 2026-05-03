'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Flame, Loader2, MoreHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { AssigneeWithName } from '@/components/tasks/AssigneeAvatar';
import { habitDoneToday } from '@/components/tasks/habit-ui-utils';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery } from '@/lib/api/client-fetch';
import { completeHabit, deleteHabit } from '@/lib/api/tasks';
import { cn } from '@/lib/utils';
import type { HabitDto } from '@/types/habit';

type TodayHabitRowProps = {
  habit: HabitDto;
  onUpdated: () => void | Promise<void>;
};

export default function TodayHabitRow({ habit, onUpdated }: TodayHabitRowProps) {
  const { context } = useFinanceContext();
  const done = habitDoneToday(habit);
  const [marking, setMarking] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const ownerQs = buildOwnerQuery(context).toString();
  const habitsHref = `/tasks/habits${ownerQs ? `?${ownerQs}` : ''}`;

  const handleMark = async () => {
    if (done || marking) return;
    setMarking(true);
    try {
      await completeHabit(habit.id, {}, context);
      toast.success('Hábito marcado');
      await onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar');
    } finally {
      setMarking(false);
    }
  };

  const handleConfirmDelete = useCallback(async () => {
    try {
      await deleteHabit(habit.id, context);
      toast.success('Hábito eliminado');
      setDeleteDialogOpen(false);
      await onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar');
    }
  }, [context, habit.id, onUpdated]);

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2.5',
        done && 'border-emerald-500/30 bg-muted/20',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{habit.name}</p>
          {habit.current_streak > 0 && (
            <Badge variant="outline" className="shrink-0 gap-0.5 border-amber-500/40 px-1.5 py-0 text-[10px] font-normal">
              <Flame className="h-3 w-3 text-amber-600 dark:text-amber-400" aria-hidden />
              {habit.current_streak}
            </Badge>
          )}
          {context.type === 'house' && habit.assignee && (
            <AssigneeWithName
              name={habit.assignee.name}
              size="sm"
              nameClassName="text-[10px] text-muted-foreground"
            />
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="sm"
          variant={done ? 'secondary' : 'default'}
          className="min-w-[88px]"
          onClick={() => void handleMark()}
          disabled={done || marking}
          aria-busy={marking}
          aria-label={
            done
              ? 'Ya completado hoy'
              : marking
                ? 'Guardando…'
                : 'Marcar hábito como hecho hoy'
          }
        >
          {marking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              <span className="sr-only">Guardando…</span>
            </>
          ) : done ? (
            'Hecho'
          ) : (
            'Marcar'
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Más opciones del hábito">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={habitsHref}>Ver en Hábitos</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar hábito?"
        description="Se borrará el hábito y su historial de registros. Esta acción no se puede deshacer."
        itemName={habit.name}
        loadingLabel="Eliminando…"
      />
    </div>
  );
}
