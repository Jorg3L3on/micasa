'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  Loader2,
  Repeat2,
} from 'lucide-react';
import { toast } from 'sonner';
import { AssigneeWithName } from '@/components/tasks/AssigneeAvatar';
import EmptyState from '@/components/EmptyState';
import MemberAssigneeSelect from '@/components/tasks/MemberAssigneeSelect';
import TasksDayDialog from '@/components/tasks/TasksDayDialog';
import TodayHabitRow from '@/components/tasks/TodayHabitRow';
import { habitDoneToday } from '@/components/tasks/habit-ui-utils';
import {
  compareTasksByUrgency,
  getStartOfDay,
  getTaskTemporalBucket,
  getTaskUrgencyLabel,
} from '@/components/tasks/task-time-groups';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFinanceContext } from '@/context/finance-context';
import { useTasksModuleScope } from '@/components/tasks/tasks-module-context';
import { buildOwnerQuery } from '@/lib/api/client-fetch';
import {
  completeRoutine,
  completeTaskItem,
  createTaskItem,
  listHabits,
  listRoutines,
  listTaskItems,
  listTaskLists,
} from '@/lib/api/tasks';
import { cn } from '@/lib/utils';
import type { HabitDto } from '@/types/habit';
import type { RoutineDto } from '@/types/routine';
import type { TaskItemDto } from '@/types/task-item';
import type { TaskListDto } from '@/types/task-list';

export default function TasksTodayView() {
  const { context } = useFinanceContext();
  const { todayScopeUserId } = useTasksModuleScope();
  const { data: session } = useSession();
  const sessionUserId = Number(session?.user?.id);

  const [loading, setLoading] = useState(true);
  const [lists, setLists] = useState<TaskListDto[]>([]);
  const [tasks, setTasks] = useState<TaskItemDto[]>([]);
  const [habits, setHabits] = useState<HabitDto[]>([]);
  const [routines, setRoutines] = useState<RoutineDto[]>([]);
  const [calendarSheetSeed, setCalendarSheetSeed] = useState(() => new Date());
  const [daySheetOpen, setDaySheetOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickAssignee, setQuickAssignee] = useState<number | ''>('');
  const [quickCreating, setQuickCreating] = useState(false);
  const [urgentCompletingId, setUrgentCompletingId] = useState<number | null>(null);
  const [routineRunningId, setRoutineRunningId] = useState<number | null>(null);

  const assigneeFilterOpts = useMemo(() => {
    if (context.type !== 'house') return undefined;
    if (todayScopeUserId == null) return undefined;
    return { assigneeUserId: todayScopeUserId };
  }, [context.type, todayScopeUserId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [listsResult, tasksResult, habitsResult, routinesResult] = await Promise.all([
        listTaskLists(context),
        listTaskItems(context, undefined, assigneeFilterOpts),
        listHabits(context, assigneeFilterOpts),
        listRoutines(context, assigneeFilterOpts),
      ]);
      setLists(listsResult);
      setTasks(tasksResult);
      setHabits(habitsResult);
      setRoutines(routinesResult);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar la vista Hoy');
    } finally {
      setLoading(false);
    }
  }, [context, assigneeFilterOpts]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const firstList = lists[0] ?? null;

  useEffect(() => {
    if (context.type !== 'house') {
      setQuickAssignee('');
      return;
    }
    const fromList = firstList?.assignee_user_id;
    if (fromList) {
      setQuickAssignee(fromList);
      return;
    }
    if (Number.isFinite(sessionUserId) && sessionUserId > 0) {
      setQuickAssignee(sessionUserId);
    }
  }, [context.type, firstList?.assignee_user_id, sessionUserId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#quick-task') return;
    const el = document.getElementById('quick-task');
    if (el) {
      window.requestAnimationFrame(() =>
        el.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      );
    }
  }, [loading]);

  const ownerQs = buildOwnerQuery(context).toString();
  const scheduledHref = `/tasks/scheduled${ownerQs ? `?${ownerQs}` : ''}`;

  const now = new Date();
  const dayLabel = now.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const activeHabits = useMemo(() => habits.filter((h) => h.active), [habits]);
  const habitsDoneToday = useMemo(
    () => activeHabits.filter((h) => habitDoneToday(h)).length,
    [activeHabits],
  );
  const habitProgress =
    activeHabits.length === 0
      ? 0
      : Math.round((habitsDoneToday / activeHabits.length) * 100);

  const pendingTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'DONE').sort(compareTasksByUrgency),
    [tasks],
  );

  const urgentTasks = useMemo(
    () =>
      pendingTasks
        .filter((task) => {
          const bucket = getTaskTemporalBucket(task);
          return bucket === 'hoy' || bucket === 'atrasada';
        })
        .slice(0, 5),
    [pendingTasks],
  );

  const dayNumber = now.getDay();
  const routinesToday = useMemo(
    () =>
      routines.filter(
        (routine) =>
          routine.active &&
          (routine.active_days.length === 0 || routine.active_days.includes(dayNumber)),
      ),
    [routines, dayNumber],
  );

  const handleCreateTaskForDay = async ({
    title,
    dueAt,
    assignee_user_id,
  }: {
    title: string;
    dueAt: Date;
    assignee_user_id?: number;
  }) => {
    if (!firstList) {
      toast.error('Primero crea una lista de tareas');
      return;
    }
    if (context.type === 'house' && assignee_user_id == null) {
      toast.error('Selecciona un miembro de la casa');
      return;
    }
    await createTaskItem(
      {
        list_id: firstList.id,
        title,
        due_at: dueAt.toISOString(),
        ...(context.type === 'house' && assignee_user_id != null
          ? { assignee_user_id }
          : {}),
      },
      context,
    );
    toast.success('Tarea creada para el día seleccionado');
    await loadData();
  };

  const handleCompleteTaskForDay = async (taskId: number) => {
    await completeTaskItem(taskId, context);
    await loadData();
  };

  const handleCompleteUrgentTask = async (taskId: number) => {
    try {
      setUrgentCompletingId(taskId);
      await completeTaskItem(taskId, context);
      await loadData();
    } finally {
      setUrgentCompletingId(null);
    }
  };

  const handleQuickTask = async () => {
    const title = quickTitle.trim();
    if (!title) {
      toast.error('Escribe un nombre para la tarea');
      return;
    }
    if (!firstList) {
      toast.error('Primero crea una lista de tareas');
      return;
    }
    if (context.type === 'house' && quickAssignee === '') {
      toast.error('Selecciona un miembro de la casa');
      return;
    }
    try {
      setQuickCreating(true);
      await createTaskItem(
        {
          list_id: firstList.id,
          title,
          due_at: getStartOfDay(new Date()).toISOString(),
          ...(context.type === 'house' ? { assignee_user_id: quickAssignee as number } : {}),
        },
        context,
      );
      setQuickTitle('');
      toast.success('Tarea rápida creada');
      await loadData();
    } finally {
      setQuickCreating(false);
    }
  };

  const handleRunRoutine = async (routineId: number) => {
    try {
      setRoutineRunningId(routineId);
      await completeRoutine(routineId, {}, context);
      toast.success('Rutina ejecutada');
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo ejecutar');
    } finally {
      setRoutineRunningId(null);
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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xl font-semibold capitalize leading-tight">{dayLabel}</p>
          <p className="text-xs text-muted-foreground">Tu checklist del día</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 rounded-xl"
          aria-label="Abrir calendario de tareas"
          onClick={() => {
            setCalendarSheetSeed(new Date());
            setDaySheetOpen(true);
          }}
        >
          <CalendarDays className="h-4 w-4" />
        </Button>
      </div>

      <Card className="rounded-xl border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Progreso de hoy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Hábitos completados
            </p>
            <p className="text-sm font-semibold tabular-nums">
              {habitsDoneToday} de {activeHabits.length}
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full bg-emerald-600 transition-[width] dark:bg-emerald-500',
              )}
              style={{ width: `${habitProgress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <section className="space-y-2" aria-labelledby="today-habits-heading">
        <div className="flex items-center justify-between gap-2">
          <h3 id="today-habits-heading" className="text-sm font-semibold">
            Hábitos
          </h3>
          <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
            <Link href={`/tasks/habits${ownerQs ? `?${ownerQs}` : ''}`}>Ver biblioteca</Link>
          </Button>
        </div>
        {activeHabits.length === 0 ? (
          <EmptyState message="No hay hábitos activos. Añade uno desde el menú Añadir." />
        ) : (
          <div className="space-y-2">
            {activeHabits.map((habit) => (
              <TodayHabitRow key={habit.id} habit={habit} onUpdated={loadData} />
            ))}
          </div>
        )}
      </section>

      <Card id="quick-task" className="rounded-xl border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tarea rápida</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="quick-task-title" className="text-xs text-muted-foreground">
              Nombre de la tarea
            </Label>
            <Input
              id="quick-task-title"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Ej. Comprar leche"
              aria-label="Nombre de la tarea rápida"
              disabled={quickCreating}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleQuickTask();
                }
              }}
            />
          </div>
          {context.type === 'house' && (
            <MemberAssigneeSelect
              id="today-quick-assignee"
              value={quickAssignee}
              onChange={setQuickAssignee}
              label="Asignar a"
              disabled={quickCreating}
            />
          )}
          <Button
            className="w-full sm:w-auto"
            onClick={() => void handleQuickTask()}
            disabled={!quickTitle.trim() || quickCreating}
            aria-busy={quickCreating}
          >
            {quickCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Creando…
              </>
            ) : (
              'Crear tarea rápida'
            )}
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-2" aria-labelledby="today-tasks-heading">
        <div className="flex items-center justify-between gap-2">
          <h3 id="today-tasks-heading" className="text-sm font-semibold">
            Tareas urgentes
          </h3>
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" asChild>
            <Link href={scheduledHref}>
              Ver agenda
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        {urgentTasks.length === 0 ? (
          <p className="rounded-lg border border-border/60 bg-card px-3 py-4 text-sm text-muted-foreground">
            No hay tareas críticas para hoy.
          </p>
        ) : (
          <div className="space-y-2">
            {urgentTasks.map((task) => {
              const bucket = getTaskTemporalBucket(task);
              return (
                <div
                  key={task.id}
                  className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {getTaskUrgencyLabel(bucket, task.due_at)}
                      </p>
                      {context.type === 'house' &&
                        (task.assignee ? (
                          <AssigneeWithName
                            name={task.assignee.name}
                            nameClassName="text-xs text-muted-foreground"
                          />
                        ) : (
                          <Badge variant="secondary" className="font-normal">
                            Sin asignar
                          </Badge>
                        ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full shrink-0 sm:w-auto"
                    disabled={urgentCompletingId !== null}
                    aria-busy={urgentCompletingId === task.id}
                    onClick={() => void handleCompleteUrgentTask(task.id)}
                  >
                    {urgentCompletingId === task.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Completando…
                      </>
                    ) : (
                      'Completar'
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-2" aria-labelledby="today-routines-heading">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
            <Repeat2 className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <h3 id="today-routines-heading" className="text-sm font-semibold">
            Rutinas para hoy
          </h3>
        </div>
        {routinesToday.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay rutinas programadas para este día.</p>
        ) : (
          <div className="space-y-2">
            {routinesToday.map((routine) => (
              <div
                key={routine.id}
                className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{routine.name}</p>
                  <p className="text-xs text-muted-foreground">{routine.steps.length} pasos</p>
                </div>
                <Button
                  size="sm"
                  className="w-full shrink-0 sm:w-auto"
                  disabled={routineRunningId !== null}
                  aria-busy={routineRunningId === routine.id}
                  onClick={() => void handleRunRoutine(routine.id)}
                >
                  {routineRunningId === routine.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Ejecutando…
                    </>
                  ) : (
                    'Ejecutar'
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <TasksDayDialog
        open={daySheetOpen}
        onOpenChange={setDaySheetOpen}
        selectedDate={calendarSheetSeed}
        tasks={tasks}
        routines={routines}
        onCreateTask={handleCreateTaskForDay}
        onCompleteTask={handleCompleteTaskForDay}
        presentation="sheet"
      />
    </div>
  );
}
