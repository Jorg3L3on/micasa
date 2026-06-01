'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export const getAssigneeInitials = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const word = parts[0];
    if (word.length >= 2) {
      return (word[0] + word[1]).toLocaleUpperCase('es-MX');
    }
    return word[0].toLocaleUpperCase('es-MX');
  }
  const first = parts[0][0];
  const last = parts[parts.length - 1][0];
  return `${first}${last}`.toLocaleUpperCase('es-MX');
};

type AssigneeAvatarProps = {
  name: string;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  hideFromAccessibility?: boolean;
};

export default function AssigneeAvatar({
  name,
  size = 'sm',
  className,
  hideFromAccessibility = true,
}: AssigneeAvatarProps) {
  const initials = getAssigneeInitials(name);

  return (
    <Avatar
      size={size}
      className={cn('shrink-0', className)}
      aria-hidden={hideFromAccessibility ? true : undefined}
      {...(!hideFromAccessibility ? { 'aria-label': name } : {})}
    >
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}

type AssigneeWithNameProps = {
  name: string;
  size?: 'sm' | 'default' | 'lg';
  nameClassName?: string;
  className?: string;
};

export function AssigneeWithName({
  name,
  size = 'sm',
  nameClassName,
  className,
}: AssigneeWithNameProps) {
  return (
    <div className={cn('flex min-w-0 max-w-full items-center gap-1.5', className)}>
      <AssigneeAvatar name={name} size={size} hideFromAccessibility />
      <span className={cn('min-w-0 truncate font-normal', nameClassName)}>{name}</span>
    </div>
  );
}
