'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AssigneeWithName } from '@/components/tasks/AssigneeAvatar';
import EmptyState from '@/components/EmptyState';
import MemberAssigneeSelect from '@/components/tasks/MemberAssigneeSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useFinanceContext } from '@/context/finance-context';
import { completeRoutine, createRoutine, listRoutines } from '@/lib/api/tasks';
import type { RoutineDto } from '@/types/routine';

export default function RoutinesPageView() {
  const { context } = useFinanceContext();
  const { data: session } = useSession();
  const sessionUserId = Number(session?.user?.id);
  const [loading, setLoading] = useState(true);
  const [routines, setRoutines] = useState<RoutineDto[]>([]);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newAssignee, setNewAssignee] = useState<number | ''>('');
  const [creatingRoutine, setCreatingRoutine] = useState(false);
  const [executingRoutineId, setExecutingRoutineId] = useState<number | null>(null);

  const loadRoutines = useCallback(async () => {
    try {
      setLoading(true);
      setRoutines(await listRoutines(context));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudieron cargar las rutinas',
      );
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void loadRoutines();
  }, [loadRoutines]);

  useEffect(() => {
    if (context.type === 'house' && Number.isFinite(sessionUserId) && sessionUserId > 0) {
      setNewAssignee((prev) => (prev === '' ? sessionUserId : prev));
    }
    if (context.type === 'user') {
      setNewAssignee('');
    }
  }, [context.type, sessionUserId]);

  const handleCreateRoutine = async () => {
    if (!newRoutineName.trim()) return;
    if (context.type === 'house' && newAssignee === '') {
      toast.error('Selecciona un miembro de la casa');
      return;
    }
    try {
      setCreatingRoutine(true);
      await createRoutine(
        {
          name: newRoutineName.trim(),
          time_of_day: 'MORNING',
          active_days: [1, 2, 3, 4, 5],
          steps: [{ title: 'Primer paso' }],
          ...(context.type === 'house' ? { assignee_user_id: newAssignee as number } : {}),
        },
        context,
      );
      setNewRoutineName('');
      if (context.type === 'house' && Number.isFinite(sessionUserId)) {
        setNewAssignee(sessionUserId);
      }
      await loadRoutines();
    } finally {
      setCreatingRoutine(false);
    }
  };

  const handleExecuteRoutine = async (routineId: number) => {
    try {
      setExecutingRoutineId(routineId);
      await completeRoutine(routineId, {}, context);
      await loadRoutines();
    } finally {
      setExecutingRoutineId(null);
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
    <Card className="rounded-xl border-border/60 border-l-[3px] border-l-violet-500/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
            <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          </span>
          Rutinas diarias
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Input
              value={newRoutineName}
              placeholder="Nueva rutina diaria"
              onChange={(event) => setNewRoutineName(event.target.value)}
              aria-label="Nombre de rutina diaria"
              disabled={creatingRoutine}
            />
          </div>
          <MemberAssigneeSelect
            id="new-routine-assignee"
            value={newAssignee}
            onChange={setNewAssignee}
            disabled={creatingRoutine}
          />
          <Button
            className="w-full shrink-0 sm:w-auto"
            onClick={() => void handleCreateRoutine()}
            disabled={creatingRoutine}
            aria-busy={creatingRoutine}
          >
            {creatingRoutine ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Creando…
              </>
            ) : (
              'Crear'
            )}
          </Button>
        </div>
        {routines.length === 0 ? (
          <EmptyState message="Aún no tienes rutinas diarias" />
        ) : (
          <div className="space-y-2">
            {routines.map((routine) => (
              <div
                key={routine.id}
                className="rounded-md border p-2"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{routine.name}</p>
                      <RoutineReadyBadge routine={routine} />
                      {context.type === 'house' &&
                        (routine.assignee ? (
                          <AssigneeWithName
                            name={routine.assignee.name}
                            nameClassName="text-xs text-muted-foreground"
                          />
                        ) : (
                          <Badge variant="destructive" className="font-normal">
                            Sin asignar
                          </Badge>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {routine.steps.length} pasos · {getRoutineProgressCopy(routine)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={executingRoutineId !== null}
                    aria-busy={executingRoutineId === routine.id}
                    onClick={() => void handleExecuteRoutine(routine.id)}
                  >
                    {executingRoutineId === routine.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Ejecutando…
                      </>
                    ) : (
                      'Ejecutar'
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const RoutineReadyBadge = ({ routine }: { routine: RoutineDto }) => {
  const day = new Date().getDay();
  const isReadyToday = routine.active_days.length === 0 || routine.active_days.includes(day);
  return isReadyToday ? (
    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
      Lista hoy
    </Badge>
  ) : (
    <Badge variant="secondary">No toca hoy</Badge>
  );
};

const getRoutineProgressCopy = (routine: RoutineDto): string => {
  if (!routine.latest_run) return 'Sin ejecuciones aún';
  const percent = routine.latest_run.total_steps
    ? Math.round((routine.latest_run.completed_steps / routine.latest_run.total_steps) * 100)
    : 0;
  return `Último run: ${percent}%`;
};
