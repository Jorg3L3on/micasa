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
import AssigneeAvatar from '@/components/assignee/AssigneeAvatar';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { cn } from '@/lib/utils';

type HouseUserItem = {
  id: number;
  name: string;
  email: string;
};

type MemberAssigneeSelectProps = {
  id?: string;
  value: number | '';
  onChange: (userId: number | '') => void;
  disabled?: boolean;
  label?: string;
  /** Hide the built-in label when the parent already shows one (e.g. GroupedRow). */
  hideLabel?: boolean;
  triggerClassName?: string;
  onOpenChange?: (open: boolean) => void;
};

export default function MemberAssigneeSelect({
  id = 'micasa-assignee',
  value,
  onChange,
  disabled,
  label = 'Asignado a',
  hideLabel = false,
  triggerClassName,
  onOpenChange,
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
    <div className={hideLabel ? undefined : 'space-y-1.5'}>
      {hideLabel ? null : (
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </Label>
      )}
      <Select
        value={value === '' ? undefined : String(value)}
        onValueChange={(next) => onChange(next ? Number(next) : '')}
        onOpenChange={onOpenChange}
        disabled={disabled || loading || members.length === 0}
      >
        <SelectTrigger
          id={id}
          className={cn('w-full min-w-0', triggerClassName)}
          aria-label={label}
        >
          <SelectValue placeholder={loading ? 'Cargando…' : 'Elige un miembro'} />
        </SelectTrigger>
        <SelectContent>
          {members.map((member) => (
            <SelectItem key={member.id} value={String(member.id)}>
              <span className="flex min-w-0 items-center gap-2">
                <AssigneeAvatar name={member.name} size="sm" />
                <span className="truncate">{member.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
