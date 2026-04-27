'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import EmptyState from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useFinanceContext } from '@/context/finance-context';
import { completeRoutine, createRoutine, listRoutines } from '@/lib/api';
import type { RoutineDto } from '@/types/routine';

export default function RoutinesPageView() {
  const { context } = useFinanceContext();
  const [loading, setLoading] = useState(true);
  const [routines, setRoutines] = useState<RoutineDto[]>([]);
  const [newRoutineName, setNewRoutineName] = useState('');

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

  const handleCreateRoutine = async () => {
    if (!newRoutineName.trim()) return;
    await createRoutine(
      {
        name: newRoutineName.trim(),
        time_of_day: 'MORNING',
        active_days: [1, 2, 3, 4, 5],
        steps: [{ title: 'Primer paso' }],
      },
      context,
    );
    setNewRoutineName('');
    await loadRoutines();
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
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={newRoutineName}
            placeholder="Nueva rutina diaria"
            onChange={(event) => setNewRoutineName(event.target.value)}
            aria-label="Nombre de rutina diaria"
          />
          <Button className="w-full sm:w-auto" onClick={() => void handleCreateRoutine()}>
            Crear
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
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{routine.name}</p>
                      <RoutineReadyBadge routine={routine} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {routine.steps.length} pasos · {getRoutineProgressCopy(routine)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      void completeRoutine(routine.id, {}, context).then(loadRoutines)
                    }
                  >
                    Ejecutar
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
