'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AssigneeWithName } from '@/components/tasks/AssigneeAvatar';
import EmptyState from '@/components/EmptyState';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import MemberAssigneeSelect from '@/components/tasks/MemberAssigneeSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useFinanceContext } from '@/context/finance-context';
import {
  completeTaskItem,
  createTaskItem,
  getTaskList,
  listTaskItems,
} from '@/lib/api/tasks';
import type { TaskItemDto } from '@/types/task-item';
import type { TaskListDto } from '@/types/task-list';

export default function TaskListDetailView({ listId }: { listId: number }) {
  const { context } = useFinanceContext();
  const { data: session } = useSession();
  const sessionUserId = Number(session?.user?.id);
  const [loading, setLoading] = useState(true);
  const [listMeta, setListMeta] = useState<TaskListDto | null>(null);
  const [tasks, setTasks] = useState<TaskItemDto[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState<number | ''>('');
  const [creatingTask, setCreatingTask] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [list, taskRows] = await Promise.all([
        getTaskList(listId, context),
        listTaskItems(context, listId),
      ]);
      setListMeta(list);
      setTasks(taskRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar las tareas');
    } finally {
      setLoading(false);
    }
  }, [context, listId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (context.type !== 'house') {
      setNewAssignee('');
      return;
    }
    const fromList = listMeta?.assignee_user_id;
    if (fromList) {
      setNewAssignee(fromList);
      return;
    }
    if (Number.isFinite(sessionUserId) && sessionUserId > 0) {
      setNewAssignee(sessionUserId);
    }
  }, [context.type, listMeta?.assignee_user_id, sessionUserId]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    if (context.type === 'house' && newAssignee === '') {
      toast.error('Selecciona un miembro de la casa');
      return;
    }
    try {
      setCreatingTask(true);
      await createTaskItem(
        {
          list_id: listId,
          title: newTitle.trim(),
          ...(context.type === 'house' ? { assignee_user_id: newAssignee as number } : {}),
        },
        context,
      );
      setNewTitle('');
      await loadData();
    } finally {
      setCreatingTask(false);
    }
  };

  const handleCompleteTask = async (taskId: number) => {
    try {
      setCompletingTaskId(taskId);
      await completeTaskItem(taskId, context);
      await loadData();
    } finally {
      setCompletingTaskId(null);
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
      <Card className="rounded-xl border-border/60">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <span>Tareas de la lista</span>
            {context.type === 'house' &&
              listMeta &&
              (listMeta.assignee ? (
                <span className="flex max-w-full min-w-0 items-center gap-1.5">
                  <span className="shrink-0 text-xs text-muted-foreground">Lista:</span>
                  <AssigneeWithName
                    name={listMeta.assignee.name}
                    nameClassName="text-xs font-normal"
                  />
                </span>
              ) : (
                <Badge variant="secondary" className="font-normal">
                  Lista sin asignar
                </Badge>
              ))}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Input
                value={newTitle}
                placeholder="Nueva tarea"
                onChange={(event) => setNewTitle(event.target.value)}
                aria-label="Título de tarea"
                disabled={creatingTask}
              />
            </div>
            <MemberAssigneeSelect
              id={`task-assignee-${listId}`}
              value={newAssignee}
              onChange={setNewAssignee}
              label="Asignar a"
              disabled={creatingTask}
            />
            <Button
              className="w-full shrink-0 sm:w-auto"
              onClick={() => void handleCreate()}
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
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-md border p-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{task.title}</p>
                    {context.type === 'house' &&
                      (task.assignee ? (
                        <div className="mt-1">
                          <AssigneeWithName
                            name={task.assignee.name}
                            nameClassName="text-xs text-muted-foreground"
                          />
                        </div>
                      ) : (
                        <Badge variant="secondary" className="mt-1 font-normal">
                          Sin asignar
                        </Badge>
                      ))}
                  </div>
                  {task.status === 'DONE' ? (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      Completada
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={completingTaskId !== null}
                      aria-busy={completingTaskId === task.id}
                      onClick={() => void handleCompleteTask(task.id)}
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
