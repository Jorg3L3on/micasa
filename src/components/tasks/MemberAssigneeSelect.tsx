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
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

type HouseUserItem = {
  id: number;
  name: string;
  email: string;
};

type MemberAssigneeSelectProps = {
  id?: string;
  /** Selected member user id; empty string means none chosen yet. */
  value: number | '';
  onChange: (userId: number | '') => void;
  disabled?: boolean;
  label?: string;
};

export default function MemberAssigneeSelect({
  id = 'micasa-task-assignee',
  value,
  onChange,
  disabled,
  label = 'Asignado a',
}: MemberAssigneeSelectProps) {
  const { context } = useFinanceContext();
  const [members, setMembers] = useState<HouseUserItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (context.type !== 'house') {
      setMembers([]);
      return;
    }
    setLoading(true);
    clientFetchFromApi<{ users: HouseUserItem[] }>('/api/house-users', undefined, context)
      .then((data) => setMembers(data.users))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, [context]);

  if (context.type !== 'house') {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select
        value={value === '' ? undefined : String(value)}
        onValueChange={(next) => onChange(next ? Number(next) : '')}
        disabled={disabled || loading || members.length === 0}
      >
        <SelectTrigger id={id} className="w-full min-w-0">
          <SelectValue placeholder={loading ? 'Cargando…' : 'Elige un miembro'} />
        </SelectTrigger>
        <SelectContent>
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
