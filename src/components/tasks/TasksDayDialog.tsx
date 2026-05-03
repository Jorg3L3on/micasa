'use client';

import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import AssigneeAvatar from '@/components/tasks/AssigneeAvatar';
import MemberAssigneeSelect from '@/components/tasks/MemberAssigneeSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { useFinanceContext } from '@/context/finance-context';
import type { RoutineDto } from '@/types/routine';
import type { TaskItemDto } from '@/types/task-item';
import {
  filterTasksBySelectedDay,
  getStartOfDay,
  isSameDay,
} from '@/components/tasks/task-time-groups';

type TasksDayDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  tasks: TaskItemDto[];
  routines: RoutineDto[];
  onCreateTask: (payload: {
    title: string;
    dueAt: Date;
    assignee_user_id?: number;
  }) => Promise<void>;
  onCompleteTask: (taskId: number) => Promise<void>;
  /** Use Sheet (e.g. vista Hoy) instead of modal Dialog */
  presentation?: 'dialog' | 'sheet';
};

const formatDay = (value: Date): string =>
  value.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

export default function TasksDayDialog({
  open,
  onOpenChange,
  selectedDate,
  tasks,
  routines,
  onCreateTask,
  onCompleteTask,
  presentation = 'dialog',
}: TasksDayDialogProps) {
  const { context } = useFinanceContext();
  const { data: session } = useSession();
  const sessionUserId = Number(session?.user?.id);
  const [newTitle, setNewTitle] = useState('');
  const [assigneeUserId, setAssigneeUserId] = useState<number | ''>('');
  const [viewDate, setViewDate] = useState(selectedDate);
  const [creatingTask, setCreatingTask] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);

  const handleOverlayOpenChange = (next: boolean) => {
    if (next) {
      setViewDate(selectedDate);
      if (context.type !== 'house') {
        setAssigneeUserId('');
      } else if (Number.isFinite(sessionUserId) && sessionUserId > 0) {
        setAssigneeUserId(sessionUserId);
      }
    }
    onOpenChange(next);
  };

  const calendarTaskDates = useMemo(() => {
    const dayMap = new Map<number, Date>();
    for (const task of tasks) {
      if (!task.due_at) continue;
      const day = getStartOfDay(new Date(task.due_at));
      dayMap.set(day.getTime(), day);
    }
    return Array.from(dayMap.values());
  }, [tasks]);

  const dayTasks = useMemo(
    () => filterTasksBySelectedDay(tasks, viewDate),
    [tasks, viewDate],
  );
  const dayNumber = viewDate.getDay();
  const dayRoutines = useMemo(
    () =>
      routines.filter(
        (routine) =>
          routine.active &&
          (routine.active_days.length === 0 || routine.active_days.includes(dayNumber)),
      ),
    [routines, dayNumber],
  );

  const handleCreateTask = async () => {
    if (!newTitle.trim()) return;
    if (context.type === 'house' && assigneeUserId === '') {
      toast.error('Selecciona un miembro de la casa');
      return;
    }
    try {
      setCreatingTask(true);
      await onCreateTask({
        title: newTitle.trim(),
        dueAt: viewDate,
        ...(context.type === 'house' ? { assignee_user_id: assigneeUserId as number } : {}),
      });
      setNewTitle('');
    } finally {
      setCreatingTask(false);
    }
  };

  const handleCompleteTaskClick = async (taskId: number) => {
    try {
      setCompletingTaskId(taskId);
      await onCompleteTask(taskId);
    } finally {
      setCompletingTaskId(null);
    }
  };

  const createSection = (
    <div className="min-w-0 overflow-hidden rounded-md border border-border/60 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Crear tarea del dia
      </p>
      <p className="mb-2 text-xs text-muted-foreground">
        Esta tarea queda con la fecha del día que elijas en el calendario de arriba.
      </p>
      <div className="flex flex-col gap-3">
        <Input
          className="min-h-11 text-base"
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder="Nueva tarea para este dia"
          aria-label="Nueva tarea para este día"
          disabled={creatingTask}
        />
        {context.type === 'house' ? (
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
            <div className="min-w-0 flex-1">
              <MemberAssigneeSelect
                id="day-dialog-assignee"
                value={assigneeUserId}
                onChange={setAssigneeUserId}
                disabled={creatingTask}
              />
            </div>
            <Button
              className="w-full shrink-0 sm:w-auto"
              onClick={() => void handleCreateTask()}
              disabled={creatingTask}
              aria-busy={creatingTask}
            >
              {creatingTask ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Creando…
                </>
              ) : (
                'Crear'
              )}
            </Button>
          </div>
        ) : (
          <Button
            className="h-11 w-full shrink-0 sm:w-auto sm:self-start"
            onClick={() => void handleCreateTask()}
            disabled={creatingTask}
            aria-busy={creatingTask}
          >
            {creatingTask ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Creando…
              </>
            ) : (
              'Crear'
            )}
          </Button>
        )}
      </div>
    </div>
  );

  const tasksSection = (
    <div className="min-w-0 rounded-md border border-border/60 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Tareas programadas
      </p>
      {dayTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay tareas para este día.</p>
      ) : (
        <div className="space-y-2">
          {dayTasks.map((task) => (
            <div
              key={task.id}
              className="flex flex-col gap-2 rounded-md border border-border/60 p-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {task.assignee ? (
                  <AssigneeAvatar name={task.assignee.name} size="sm" hideFromAccessibility />
                ) : null}
                <p className="min-w-0 truncate text-sm font-medium">
                  {task.assignee ? (
                    <span className="sr-only">{task.assignee.name}: </span>
                  ) : null}
                  {task.title}
                </p>
              </div>
              {task.status === 'DONE' ? (
                <Badge variant="secondary">Completada</Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={completingTaskId !== null}
                  aria-busy={completingTaskId === task.id}
                  onClick={() => void handleCompleteTaskClick(task.id)}
                >
                  {completingTaskId === task.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Completando…
                    </>
                  ) : (
                    'Completar'
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const routinesSection = (
    <div className="rounded-md border border-border/60 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Rutinas del dia
      </p>
      {dayRoutines.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay rutinas para este día.</p>
      ) : (
        <div className="space-y-2">
          {dayRoutines.map((routine) => {
            const latestRunIsSameDay =
              routine.latest_run &&
              isSameDay(new Date(routine.latest_run.run_on), viewDate);
            return (
              <div key={routine.id} className="rounded-md border border-border/60 p-2">
                <p className="text-sm font-medium">{routine.name}</p>
                <p className="text-xs text-muted-foreground">
                  {routine.steps.length} pasos
                  {latestRunIsSameDay ? ' · Con ejecución registrada' : ''}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const bodyDialog = (
    <div className="space-y-4">
      {createSection}
      {tasksSection}
      {routinesSection}
    </div>
  );

  const calendarBlock =
    presentation === 'sheet' ? (
      <div className="flex justify-center rounded-md border border-border/60 bg-muted/20 p-2 md:justify-start">
        <Calendar
          mode="single"
          selected={viewDate}
          onSelect={(date) => {
            if (!date) return;
            setViewDate(date);
          }}
          modifiers={{ hasTasks: calendarTaskDates }}
          modifiersClassNames={{
            hasTasks:
              'relative after:absolute after:bottom-1 after:left-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-primary',
          }}
          className="rounded-md"
        />
      </div>
    ) : null;

  if (presentation === 'sheet') {
    return (
      <Sheet open={open} onOpenChange={handleOverlayOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[90vh] overflow-y-auto rounded-t-xl sm:mx-auto sm:left-1/2 sm:right-auto sm:w-full sm:max-w-3xl sm:-translate-x-1/2"
        >
          <SheetHeader>
            <SheetTitle>{formatDay(viewDate)}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {/* Calendario y tareas del día en la misma fila (md+) para no dejar hueco vacío */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
              {calendarBlock}
              <div className="min-w-0 md:max-h-[min(52vh,28rem)] md:overflow-y-auto md:pr-1">
                {tasksSection}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start md:gap-4">
              <div className="min-w-0">{createSection}</div>
              <div className="min-w-0">{routinesSection}</div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOverlayOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{formatDay(viewDate)}</DialogTitle>
        </DialogHeader>
        {bodyDialog}
      </DialogContent>
    </Dialog>
  );
}

