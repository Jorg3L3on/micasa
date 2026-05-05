'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Check,
  Loader2,
  MoreHorizontal,
  Pencil,
  Repeat2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { AssigneeWithName } from '@/components/tasks/AssigneeAvatar';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import EmptyState from '@/components/EmptyState';
import MemberAssigneeSelect from '@/components/tasks/MemberAssigneeSelect';
import {
  countCompletionsInCurrentPeriod,
  habitWeekCompletionFlags,
} from '@/components/tasks/habit-ui-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useFinanceContext } from '@/context/finance-context';
import {
  completeHabit,
  createHabit,
  deleteHabit,
  listHabits,
  updateHabit,
} from '@/lib/api/tasks';
import type { HabitDto } from '@/types/habit';
import type { RecurrenceUnit } from '@/types/task-item';

const HABITS_VIEW_FILTER_KEY = 'micasa.tasks.habitsAssigneeFilter';

export default function HabitsPageView() {
  const { context } = useFinanceContext();
  const { data: session } = useSession();
  const sessionUserId = Number(session?.user?.id);

  const [loading, setLoading] = useState(true);
  const [habits, setHabits] = useState<HabitDto[]>([]);
  const [newHabitName, setNewHabitName] = useState('');
  const [newAssignee, setNewAssignee] = useState<number | ''>('');
  const [viewFilter, setViewFilter] = useState<'all' | 'mine'>(() => {
    if (typeof window === 'undefined') return 'all';
    return localStorage.getItem(HABITS_VIEW_FILTER_KEY) === 'mine' ? 'mine' : 'all';
  });

  const [completeDialog, setCompleteDialog] = useState<{
    habit: HabitDto;
  } | null>(null);
  const [completeNote, setCompleteNote] = useState('');
  const [completingHabit, setCompletingHabit] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<HabitDto | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    active: true,
    recurrence_unit: 'DAY' as RecurrenceUnit,
    recurrence_every: 1,
    target_per_period: 1,
    reminder_time: '' as string | null,
    assignee_user_id: '' as number | '',
  });

  const [creatingHabit, setCreatingHabit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingHabitId, setDeletingHabitId] = useState<number | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<HabitDto | null>(null);

  useEffect(() => {
    localStorage.setItem(HABITS_VIEW_FILTER_KEY, viewFilter);
  }, [viewFilter]);

  useEffect(() => {
    if (context.type === 'house' && Number.isFinite(sessionUserId) && sessionUserId > 0) {
      setNewAssignee((prev) => (prev === '' ? sessionUserId : prev));
    }
    if (context.type === 'user') {
      setNewAssignee('');
    }
  }, [context.type, sessionUserId]);

  const listOpts = useMemo(() => {
    if (context.type !== 'house') return undefined;
    if (viewFilter !== 'mine' || !Number.isFinite(sessionUserId) || sessionUserId <= 0) {
      return undefined;
    }
    return { assigneeUserId: sessionUserId };
  }, [context.type, viewFilter, sessionUserId]);

  const loadHabits = useCallback(async () => {
    try {
      setLoading(true);
      setHabits(await listHabits(context, listOpts));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudieron cargar los hábitos',
      );
    } finally {
      setLoading(false);
    }
  }, [context, listOpts]);

  useEffect(() => {
    void loadHabits();
  }, [loadHabits]);

  const handleCreateHabit = async () => {
    if (!newHabitName.trim()) return;
    if (context.type === 'house' && newAssignee === '') {
      toast.error('Selecciona un miembro de la casa');
      return;
    }
    try {
      setCreatingHabit(true);
      await createHabit(
        {
          name: newHabitName.trim(),
          recurrence_unit: 'DAY',
          recurrence_every: 1,
          ...(context.type === 'house' ? { assignee_user_id: newAssignee as number } : {}),
        },
        context,
      );
      setNewHabitName('');
      if (context.type === 'house' && Number.isFinite(sessionUserId)) {
        setNewAssignee(sessionUserId);
      }
      toast.success('Hábito creado');
      await loadHabits();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el hábito');
    } finally {
      setCreatingHabit(false);
    }
  };

  const handleOpenEdit = (habit: HabitDto) => {
    setEditing(habit);
    setEditForm({
      name: habit.name,
      description: habit.description ?? '',
      active: habit.active,
      recurrence_unit: habit.recurrence_unit,
      recurrence_every: habit.recurrence_every,
      target_per_period: habit.target_per_period,
      reminder_time: habit.reminder_time,
      assignee_user_id:
        context.type === 'house'
          ? habit.assignee_user_id ?? ''
          : '',
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (
      context.type === 'house' &&
      (editForm.assignee_user_id === '' || typeof editForm.assignee_user_id !== 'number')
    ) {
      toast.error('Selecciona un miembro de la casa');
      return;
    }
    try {
      setSavingEdit(true);
      await updateHabit(
        editing.id,
        {
          name: editForm.name.trim(),
          description: editForm.description.trim() || null,
          active: editForm.active,
          recurrence_unit: editForm.recurrence_unit,
          recurrence_every: editForm.recurrence_every,
          target_per_period: editForm.target_per_period,
          reminder_time:
            editForm.reminder_time && /^\d{2}:\d{2}$/.test(editForm.reminder_time)
              ? editForm.reminder_time
              : null,
          ...(context.type === 'house'
            ? { assignee_user_id: editForm.assignee_user_id as number }
            : {}),
        },
        context,
      );
      toast.success('Hábito actualizado');
      setEditOpen(false);
      setEditing(null);
      await loadHabits();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo actualizar el hábito',
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDeleteHabit = async () => {
    if (!habitToDelete) return;
    try {
      setDeletingHabitId(habitToDelete.id);
      await deleteHabit(habitToDelete.id, context);
      toast.success('Hábito eliminado');
      setHabitToDelete(null);
      await loadHabits();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar');
    } finally {
      setDeletingHabitId(null);
    }
  };

  const handleConfirmComplete = async () => {
    if (!completeDialog) return;
    try {
      setCompletingHabit(true);
      await completeHabit(
        completeDialog.habit.id,
        {
          note: completeNote.trim() || undefined,
        },
        context,
      );
      toast.success('Hábito completado');
      setCompleteDialog(null);
      setCompleteNote('');
      await loadHabits();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar');
    } finally {
      setCompletingHabit(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Card className="rounded-xl border-border/60">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
                <Repeat2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </span>
              Hábitos
            </CardTitle>
            <CardDescription>
              Gestiona y revisa constancia.
            </CardDescription>
          </div>
          {context.type === 'house' && (
            <div className="flex w-full flex-col gap-1 sm:w-auto sm:min-w-[200px]">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ver
              </Label>
              <Select
                value={viewFilter}
                onValueChange={(v) => setViewFilter(v as 'all' | 'mine')}
              >
                <SelectTrigger aria-label="Filtrar hábitos por miembro">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los miembros</SelectItem>
                  <SelectItem value="mine">Solo los míos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="new-habit-name" className="text-xs text-muted-foreground">
                  Nuevo hábito
                </Label>
                <Input
                  id="new-habit-name"
                  value={newHabitName}
                  placeholder="Nombre"
                  onChange={(event) => setNewHabitName(event.target.value)}
                  aria-label="Nombre de hábito"
                  disabled={creatingHabit}
                />
              </div>
              <MemberAssigneeSelect
                id="new-habit-assignee"
                value={newAssignee}
                onChange={setNewAssignee}
                disabled={creatingHabit}
              />
              <Button
                className="w-full shrink-0 sm:w-auto"
                onClick={() => void handleCreateHabit()}
                disabled={creatingHabit}
                aria-busy={creatingHabit}
              >
                {creatingHabit ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Creando…
                  </>
                ) : (
                  'Crear'
                )}
              </Button>
            </div>
          </div>

          {habits.length === 0 ? (
            <EmptyState message="Aún no tienes hábitos" />
          ) : (
            <div className="space-y-3">
              {habits.map((habit) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  contextHouse={context.type === 'house'}
                  deletePending={deletingHabitId === habit.id}
                  onCompleteClick={() => {
                    setCompleteNote('');
                    setCompleteDialog({ habit });
                  }}
                  onEdit={() => handleOpenEdit(habit)}
                  onDelete={() => setHabitToDelete(habit)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={completeDialog != null}
        onOpenChange={(o) => {
          if (!o && completingHabit) return;
          if (!o) setCompleteDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar hábito</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {completeDialog?.habit.name}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="complete-note" className="text-xs text-muted-foreground">
              Nota (opcional)
            </Label>
            <Textarea
              id="complete-note"
              value={completeNote}
              onChange={(e) => setCompleteNote(e.target.value)}
              placeholder="Cómo te fue hoy…"
              className="min-h-[88px] resize-none"
              disabled={completingHabit}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCompleteDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleConfirmComplete()}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet
        open={editOpen}
        onOpenChange={(open) => {
          if (!open && savingEdit) return;
          setEditOpen(open);
        }}
      >
        <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar hábito</SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nombre</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                disabled={savingEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-desc">Descripción</Label>
              <Textarea
                id="edit-desc"
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                className="min-h-[72px] resize-none"
                disabled={savingEdit}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={editForm.active}
                onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.checked }))}
                className="h-4 w-4 rounded border border-input"
                disabled={savingEdit}
              />
              <Label htmlFor="edit-active" className="font-normal">
                Activo
              </Label>
            </div>
            <div className="space-y-1.5">
              <Label>Recurrencia</Label>
              <Select
                value={editForm.recurrence_unit}
                onValueChange={(v) =>
                  setEditForm((f) => ({ ...f, recurrence_unit: v as RecurrenceUnit }))
                }
                disabled={savingEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAY">Cada día</SelectItem>
                  <SelectItem value="WEEK">Cada semana</SelectItem>
                  <SelectItem value="MONTH">Cada mes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-every">Cada (intervalo)</Label>
                <Input
                  id="edit-every"
                  type="number"
                  min={1}
                  max={365}
                  value={editForm.recurrence_every}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      recurrence_every: Number.parseInt(e.target.value, 10) || 1,
                    }))
                  }
                  disabled={savingEdit}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-target">Meta por periodo</Label>
                <Input
                  id="edit-target"
                  type="number"
                  min={1}
                  max={365}
                  value={editForm.target_per_period}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      target_per_period: Number.parseInt(e.target.value, 10) || 1,
                    }))
                  }
                  disabled={savingEdit}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-reminder">Recordatorio (HH:mm)</Label>
              <Input
                id="edit-reminder"
                placeholder="08:30"
                value={editForm.reminder_time ?? ''}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, reminder_time: e.target.value || null }))
                }
                disabled={savingEdit}
              />
            </div>
            {context.type === 'house' && (
              <MemberAssigneeSelect
                id="edit-assignee"
                value={editForm.assignee_user_id === '' ? '' : editForm.assignee_user_id}
                onChange={(id) =>
                  setEditForm((f) => ({ ...f, assignee_user_id: id === '' ? '' : id }))
                }
                disabled={savingEdit}
              />
            )}
          </div>
          <SheetFooter className="gap-2 border-t border-border/60 pt-4">
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={savingEdit}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleSaveEdit()}
              disabled={savingEdit}
              aria-busy={savingEdit}
            >
              {savingEdit ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Guardando…
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDeleteDialog
        open={habitToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setHabitToDelete(null);
        }}
        onConfirm={handleConfirmDeleteHabit}
        title="¿Eliminar hábito?"
        description="Se borrará el hábito y su historial de registros. Esta acción no se puede deshacer."
        itemName={habitToDelete?.name}
        loadingLabel="Eliminando…"
      />
    </TooltipProvider>
  );
}

const HabitCard = ({
  habit,
  contextHouse,
  deletePending,
  onCompleteClick,
  onEdit,
  onDelete,
}: {
  habit: HabitDto;
  contextHouse: boolean;
  deletePending?: boolean;
  onCompleteClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const weekFlags = habitWeekCompletionFlags(habit);
  const periodCount = countCompletionsInCurrentPeriod(habit);
  const target = Math.max(1, habit.target_per_period);
  const progressPct = Math.min(100, Math.round((periodCount / target) * 100));
  const goalMet = periodCount >= target;

  return (
    <div className="rounded-md border border-border/60 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{habit.name}</p>
            <Badge variant="secondary">Racha {habit.current_streak}</Badge>
            {contextHouse &&
              (habit.assignee ? (
                <AssigneeWithName
                  name={habit.assignee.name}
                  nameClassName="text-xs text-muted-foreground"
                />
              ) : (
                <Badge variant="destructive" className="font-normal">
                  Sin asignar
                </Badge>
              ))}
          </div>
          <div className="space-y-1">
            <div className="flex h-1.5 w-full max-w-md overflow-hidden rounded-full bg-muted/50">
              <div
                className="h-full rounded-l-full bg-emerald-500 dark:bg-emerald-400"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {periodCount}/{target} en este periodo · {progressPct}%
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Últimos 7 días">
            {weekFlags.map((done, i) => (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-medium ${
                      done
                        ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'border-border/60 bg-muted/30 text-muted-foreground'
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" /> : '·'}
                  </span>
                </TooltipTrigger>
                <TooltipContent>Día {i + 1} de la semana en vista</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Más acciones del hábito"
                disabled={deletePending}
                aria-busy={deletePending}
              >
                {deletePending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <MoreHorizontal className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit} disabled={deletePending}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={onDelete}
                disabled={deletePending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            variant={goalMet ? 'secondary' : 'outline'}
            className={
              goalMet ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300' : ''
            }
            onClick={() => onCompleteClick()}
          >
            {goalMet ? 'Añadir registro' : 'Marcar hoy'}
          </Button>
        </div>
      </div>
    </div>
  );
};
