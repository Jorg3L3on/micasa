'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ListChecks, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AssigneeWithName } from '@/components/tasks/AssigneeAvatar';
import EmptyState from '@/components/EmptyState';
import MemberAssigneeSelect from '@/components/tasks/MemberAssigneeSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useFinanceContext } from '@/context/finance-context';
import { createTaskList, listTaskLists } from '@/lib/api/tasks';
import type { TaskListDto } from '@/types/task-list';

export default function TaskListsPageView() {
  const { context } = useFinanceContext();
  const { data: session } = useSession();
  const sessionUserId = Number(session?.user?.id);
  const [loading, setLoading] = useState(true);
  const [lists, setLists] = useState<TaskListDto[]>([]);
  const [newListName, setNewListName] = useState('');
  const [newAssignee, setNewAssignee] = useState<number | ''>('');
  const [creatingList, setCreatingList] = useState(false);

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

  useEffect(() => {
    if (context.type === 'house' && Number.isFinite(sessionUserId) && sessionUserId > 0) {
      setNewAssignee((prev) => (prev === '' ? sessionUserId : prev));
    }
    if (context.type === 'user') {
      setNewAssignee('');
    }
  }, [context.type, sessionUserId]);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    if (context.type === 'house' && newAssignee === '') {
      toast.error('Selecciona un miembro de la casa');
      return;
    }
    try {
      setCreatingList(true);
      await createTaskList(
        {
          name: newListName.trim(),
          ...(context.type === 'house' ? { assignee_user_id: newAssignee as number } : {}),
        },
        context,
      );
      setNewListName('');
      if (context.type === 'house' && Number.isFinite(sessionUserId)) {
        setNewAssignee(sessionUserId);
      }
      await loadLists();
    } finally {
      setCreatingList(false);
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Input
              value={newListName}
              placeholder="Nueva lista"
              onChange={(event) => setNewListName(event.target.value)}
              aria-label="Nombre de lista"
              disabled={creatingList}
            />
          </div>
          <MemberAssigneeSelect
            id="new-list-assignee"
            value={newAssignee}
            onChange={setNewAssignee}
            disabled={creatingList}
          />
          <Button
            className="w-full shrink-0 sm:w-auto"
            onClick={() => void handleCreateList()}
            disabled={creatingList}
            aria-busy={creatingList}
          >
            {creatingList ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Creando…
              </>
            ) : (
              'Crear'
            )}
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
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    {list.completed_count}/{list.tasks_count} completadas
                  </p>
                  {context.type === 'house' &&
                    (list.assignee ? (
                      <AssigneeWithName
                        name={list.assignee.name}
                        nameClassName="text-[10px] text-muted-foreground"
                      />
                    ) : (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        Sin asignar
                      </Badge>
                    ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
