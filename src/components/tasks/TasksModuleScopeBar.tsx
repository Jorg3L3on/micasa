'use client';

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import AssigneeAvatar from '@/components/tasks/AssigneeAvatar';
import { useTasksModuleScope } from '@/components/tasks/tasks-module-context';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

type Member = { id: number; name: string };

export default function TasksModuleScopeBar() {
  const { context } = useFinanceContext();
  const { todayScopeUserId, setTodayScopeUserId } = useTasksModuleScope();
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    if (context.type !== 'house') return;
    clientFetchFromApi<{ users: Member[] }>('/api/house-users', undefined, context)
      .then((data) => setMembers(data.users))
      .catch(() => setMembers([]));
  }, [context]);

  if (context.type !== 'house') {
    return null;
  }

  const value =
    todayScopeUserId == null ? 'all' : String(todayScopeUserId);

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <Label htmlFor="tasks-scope" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
        Ver en Hoy
      </Label>
      <Select
        value={value}
        onValueChange={(v) =>
          setTodayScopeUserId(v === 'all' ? null : Number.parseInt(v, 10))
        }
      >
        <SelectTrigger
          id="tasks-scope"
          className="w-full min-w-0 sm:w-[220px]"
          aria-label="Filtrar vista Hoy por miembro"
        >
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los miembros</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={String(m.id)}>
              <span className="flex min-w-0 items-center gap-2">
                <AssigneeAvatar name={m.name} size="sm" />
                <span className="truncate">{m.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
