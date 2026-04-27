'use client';

import { useCallback, useEffect, useState } from 'react';
import { Repeat2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useFinanceContext } from '@/context/finance-context';
import { completeHabit, createHabit, listHabits } from '@/lib/api';
import type { HabitDto } from '@/types/habit';

export default function HabitsPageView() {
  const { context } = useFinanceContext();
  const [loading, setLoading] = useState(true);
  const [habits, setHabits] = useState<HabitDto[]>([]);
  const [newHabitName, setNewHabitName] = useState('');
  const [recentCompletedHabitId, setRecentCompletedHabitId] = useState<number | null>(null);

  const loadHabits = useCallback(async () => {
    try {
      setLoading(true);
      setHabits(await listHabits(context));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudieron cargar los hábitos',
      );
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void loadHabits();
  }, [loadHabits]);

  const handleCreateHabit = async () => {
    if (!newHabitName.trim()) return;
    await createHabit(
      { name: newHabitName.trim(), recurrence_unit: 'DAY', recurrence_every: 1 },
      context,
    );
    setNewHabitName('');
    await loadHabits();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card className="rounded-xl border-border/60 border-l-[3px] border-l-emerald-500/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
            <Repeat2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </span>
          Hábitos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={newHabitName}
            placeholder="Nuevo hábito"
            onChange={(event) => setNewHabitName(event.target.value)}
            aria-label="Nombre de hábito"
          />
          <Button className="w-full sm:w-auto" onClick={() => void handleCreateHabit()}>
            Crear
          </Button>
        </div>
        {habits.length === 0 ? (
          <EmptyState message="Aún no tienes hábitos" />
        ) : (
          <div className="space-y-2">
            {habits.map((habit) => (
              <div
                key={habit.id}
                className="rounded-md border p-2"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{habit.name}</p>
                      <Badge variant="secondary">Racha {habit.current_streak}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <HabitMetrics habit={habit} />
                  <Button
                    size="sm"
                    variant="outline"
                    className={`w-full sm:w-auto ${
                      recentCompletedHabitId === habit.id
                        ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300'
                        : ''
                    }`}
                    onClick={() =>
                      void completeHabit(habit.id, {}, context).then(async () => {
                        setRecentCompletedHabitId(habit.id);
                        toast.success('Hábito completado');
                        await loadHabits();
                        setTimeout(() => setRecentCompletedHabitId(null), 1500);
                      })
                    }
                  >
                    {recentCompletedHabitId === habit.id ? 'Listo' : 'Marcar hoy'}
                  </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const HabitMetrics = ({ habit }: { habit: HabitDto }) => {
  const last7DaysCompleted = habit.logs.filter((log) => {
    const logDate = new Date(log.completed_on);
    const diffMs = Date.now() - logDate.getTime();
    return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
  }).length;
  const weeklyRate = Math.round((last7DaysCompleted / 7) * 100);

  return (
    <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
      <span>{last7DaysCompleted}/7 d</span>
      <span>{weeklyRate}%</span>
    </div>
  );
};
