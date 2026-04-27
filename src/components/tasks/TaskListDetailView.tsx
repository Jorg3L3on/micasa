'use client';

import { useCallback, useEffect, useState } from 'react';
import EmptyState from '@/components/EmptyState';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useFinanceContext } from '@/context/finance-context';
import { completeTaskItem, createTaskItem, listTaskItems } from '@/lib/api';
import type { TaskItemDto } from '@/types/task-item';

export default function TaskListDetailView({ listId }: { listId: number }) {
  const { context } = useFinanceContext();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskItemDto[]>([]);
  const [newTitle, setNewTitle] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setTasks(await listTaskItems(context, listId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar las tareas');
    } finally {
      setLoading(false);
    }
  }, [context, listId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await createTaskItem({ list_id: listId, title: newTitle.trim() }, context);
    setNewTitle('');
    await loadData();
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
      <Card className="rounded-xl border-border/60">
        <CardHeader>
          <CardTitle className="text-sm">Tareas de la lista</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={newTitle}
              placeholder="Nueva tarea"
              onChange={(event) => setNewTitle(event.target.value)}
              aria-label="Título de tarea"
            />
            <Button className="w-full sm:w-auto" onClick={() => void handleCreate()}>
              Crear
            </Button>
          </div>
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-md border p-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="min-w-0 truncate text-sm">{task.title}</p>
                  {task.status === 'DONE' ? (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      Completada
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => void completeTaskItem(task.id, context).then(loadData)}
                    >
                      Completar
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {tasks.length === 0 && (
              <EmptyState
                message="No hay tareas en esta lista"
                action={{
                  label: 'Crear primera tarea',
                  onClick: () => {
                    const input = document.querySelector<HTMLInputElement>(
                      'input[aria-label="Título de tarea"]',
                    );
                    input?.focus();
                  },
                }}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
