'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ListChecks, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useFinanceContext } from '@/context/finance-context';
import { createTaskList, listTaskLists } from '@/lib/api';
import type { TaskListDto } from '@/types/task-list';

export default function TaskListsPageView() {
  const { context } = useFinanceContext();
  const [loading, setLoading] = useState(true);
  const [lists, setLists] = useState<TaskListDto[]>([]);
  const [newListName, setNewListName] = useState('');

  const loadLists = useCallback(async () => {
    try {
      setLoading(true);
      setLists(await listTaskLists(context));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudieron cargar las listas',
      );
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    await createTaskList({ name: newListName.trim() }, context);
    setNewListName('');
    await loadLists();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card className="rounded-xl border-border/60 border-l-[3px] border-l-sky-500/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 dark:bg-sky-500/15">
            <ListChecks className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
          </span>
          Listas de tareas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={newListName}
            placeholder="Nueva lista"
            onChange={(event) => setNewListName(event.target.value)}
            aria-label="Nombre de lista"
          />
          <Button className="w-full sm:w-auto" onClick={() => void handleCreateList()}>
            Crear
          </Button>
        </div>
        {lists.length === 0 ? (
          <EmptyState message="Aún no tienes listas de tareas" />
        ) : (
          <div className="space-y-2">
            {lists.map((list) => (
              <Link
                key={list.id}
                className="block rounded-md border p-2 hover:bg-muted/40"
                href={`/tasks/lists/${list.id}`}
              >
                <p className="text-sm font-medium">{list.name}</p>
                <p className="text-xs text-muted-foreground">
                  {list.completed_count}/{list.tasks_count} completadas
                </p>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
