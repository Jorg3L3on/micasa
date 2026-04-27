'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { RoutineDto } from '@/types/routine';
import type { TaskItemDto } from '@/types/task-item';
import { filterTasksBySelectedDay, isSameDay } from '@/components/tasks/task-time-groups';

type TasksDayDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  tasks: TaskItemDto[];
  routines: RoutineDto[];
  onCreateTask: (payload: { title: string; dueAt: Date }) => Promise<void>;
  onCompleteTask: (taskId: number) => Promise<void>;
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
}: TasksDayDialogProps) {
  const [newTitle, setNewTitle] = useState('');
  const dayTasks = useMemo(
    () => filterTasksBySelectedDay(tasks, selectedDate),
    [tasks, selectedDate],
  );
  const dayNumber = selectedDate.getDay();
  const dayRoutines = useMemo(
    () =>
      routines.filter(
        (routine) =>
          routine.active_days.length === 0 || routine.active_days.includes(dayNumber),
      ),
    [routines, dayNumber],
  );

  const handleCreateTask = async () => {
    if (!newTitle.trim()) return;
    await onCreateTask({ title: newTitle.trim(), dueAt: selectedDate });
    setNewTitle('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{formatDay(selectedDate)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Crear tarea del dia
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Nueva tarea para este dia"
                aria-label="Nueva tarea para este día"
              />
              <Button className="w-full sm:w-auto" onClick={() => void handleCreateTask()}>
                Crear
              </Button>
            </div>
          </div>

          <div className="rounded-md border p-3">
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
                    className="flex flex-col gap-2 rounded-md border p-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p className="min-w-0 truncate text-sm font-medium">{task.title}</p>
                    {task.status === 'DONE' ? (
                      <Badge variant="secondary">Completada</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => void onCompleteTask(task.id)}
                      >
                        Completar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border p-3">
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
                    isSameDay(new Date(routine.latest_run.run_on), selectedDate);
                  return (
                    <div key={routine.id} className="rounded-md border p-2">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

