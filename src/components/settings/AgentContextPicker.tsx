'use client';

import { useEffect, useMemo, useState } from 'react';
import { Home, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentContextEntry } from '@/schemas/agent-context.schema';
import type { SelectableContext } from '@/types/agent-context';

type AgentContextPickerProps = {
  contexts: SelectableContext[];
  value: AgentContextEntry[];
  onChange: (value: AgentContextEntry[]) => void;
  disabled?: boolean;
  idPrefix?: string;
};

const contextKey = (entry: AgentContextEntry): string =>
  `${entry.ownerType}:${entry.ownerId}`;

export default function AgentContextPicker({
  contexts,
  value,
  onChange,
  disabled = false,
  idPrefix = 'ctx',
}: AgentContextPickerProps) {
  const selectedKeys = useMemo(
    () => new Set(value.map((entry) => contextKey(entry))),
    [value],
  );

  const handleToggle = (entry: AgentContextEntry, checked: boolean) => {
    if (disabled) return;
    if (checked) {
      onChange([...value, entry]);
      return;
    }
    onChange(value.filter((item) => contextKey(item) !== contextKey(entry)));
  };

  if (contexts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay contextos disponibles para autorizar.
      </p>
    );
  }

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">
        Contextos visibles
      </legend>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Elige la cuenta personal y/o las casas que este cliente puede consultar.
        Debes seleccionar al menos uno.
      </p>
      <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
        {contexts.map((context) => {
          const entry: AgentContextEntry = {
            ownerType: context.ownerType,
            ownerId: context.ownerId,
          };
          const key = contextKey(entry);
          const inputId = `${idPrefix}-${key}`;
          const checked = selectedKeys.has(key);
          const Icon = context.ownerType === 'user' ? UserRound : Home;

          return (
            <li key={key}>
              <label
                htmlFor={inputId}
                className={cn(
                  'flex cursor-pointer items-start gap-3 bg-card px-3 py-3 transition-colors',
                  disabled && 'cursor-not-allowed opacity-60',
                  checked && 'bg-primary/5',
                )}
              >
                <input
                  id={inputId}
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-primary"
                  checked={checked}
                  disabled={disabled}
                  onChange={(event) => handleToggle(entry, event.target.checked)}
                />
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-lg',
                    context.ownerType === 'user'
                      ? 'bg-sky-500/15 text-sky-500'
                      : 'bg-violet-500/15 text-violet-500',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">
                    {context.label}
                  </span>
                  {context.helper ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {context.helper}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/** Hidden form fields for OAuth consent POST (application/x-www-form-urlencoded). */
export function AgentContextHiddenFields({
  value,
}: {
  value: AgentContextEntry[];
}) {
  return (
    <>
      {value.map((entry) => (
        <span key={contextKey(entry)} className="contents">
          <input type="hidden" name="context_owner_type" value={entry.ownerType} />
          <input type="hidden" name="context_owner_id" value={String(entry.ownerId)} />
        </span>
      ))}
    </>
  );
}

/** Keeps at least personal selected by default when contexts load. */
export const useDefaultContextSelection = (
  contexts: SelectableContext[],
): [AgentContextEntry[], (value: AgentContextEntry[]) => void] => {
  const [value, setValue] = useState<AgentContextEntry[]>([]);

  useEffect(() => {
    if (value.length > 0 || contexts.length === 0) return;
    const personal = contexts.find((ctx) => ctx.ownerType === 'user');
    if (personal) {
      setValue([{ ownerType: personal.ownerType, ownerId: personal.ownerId }]);
      return;
    }
    const first = contexts[0];
    setValue([{ ownerType: first.ownerType, ownerId: first.ownerId }]);
  }, [contexts, value.length]);

  return [value, setValue];
};

export const formatContextLabel = (
  entry: AgentContextEntry,
  contexts: SelectableContext[],
): string => {
  const match = contexts.find(
    (ctx) => ctx.ownerType === entry.ownerType && ctx.ownerId === entry.ownerId,
  );
  if (match) return match.label;
  return entry.ownerType === 'user'
    ? `Cuenta personal (#${entry.ownerId})`
    : `Casa #${entry.ownerId}`;
};
