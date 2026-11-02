'use client';

import { Bot, Database, LifeBuoy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SOURCE_LABELS } from '@/lib/audit/labels';
import { STATUS_BADGE_CLASS, STATUS_NEUTRAL_BADGE_CLASS } from '@/lib/status-tone';
import { cn } from '@/lib/utils';
import type { AuditActorDto, AuditChangeDto } from '@/types/audit';

/** Who, as people read it: the name, or "Fuera de la app" / "Sistema". */
export const auditActorName = (actor: AuditActorDto): string => {
  if (actor.missingActor) return 'Fuera de la app';
  if (actor.name) return actor.name;
  return actor.source === 'SYSTEM' ? 'Sistema' : 'Alguien';
};

/** Origin badge; plain app edits by a person carry none. */
export function AuditSourceBadge({ actor, className }: { actor: AuditActorDto; className?: string }) {
  if (actor.missingActor) {
    return (
      <Badge variant="outline" className={cn(STATUS_BADGE_CLASS.pending, 'gap-1', className)}>
        <Database className="h-3 w-3" aria-hidden />
        Fuera de la app
      </Badge>
    );
  }
  if (actor.source === 'AGENT') {
    return (
      <Badge variant="outline" className={cn(STATUS_BADGE_CLASS.info, 'gap-1', className)} title={actor.tool ?? undefined}>
        <Bot className="h-3 w-3" aria-hidden />
        {actor.agent ? `Agente · ${actor.agent}` : SOURCE_LABELS.AGENT}
      </Badge>
    );
  }
  if (actor.source === 'ADMIN') {
    return (
      <Badge variant="outline" className={cn(STATUS_NEUTRAL_BADGE_CLASS, 'gap-1', className)}>
        <LifeBuoy className="h-3 w-3" aria-hidden />
        {SOURCE_LABELS.ADMIN}
      </Badge>
    );
  }
  // A nameless system write already reads "Sistema"; only label named ones.
  if (actor.source === 'SYSTEM' && actor.name) {
    return (
      <Badge variant="outline" className={cn(STATUS_NEUTRAL_BADGE_CLASS, className)}>
        {SOURCE_LABELS.SYSTEM}
      </Badge>
    );
  }
  return null;
}

/** Campo / Antes / Después. Stacks per field so it never scrolls sideways. */
export function AuditChangeTable({ changes }: { changes: AuditChangeDto[] }) {
  if (changes.length === 0) {
    return <p className="px-1 text-caption text-muted-foreground">Sin campos visibles en este cambio.</p>;
  }
  return (
    <dl className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
      {changes.map((change) => (
        <div key={change.field} className="grid gap-1 px-3 py-2 sm:grid-cols-[8rem_1fr] sm:gap-3">
          <dt className="text-caption font-medium text-muted-foreground sm:pt-0.5">{change.label}</dt>
          <dd className="min-w-0 space-y-0.5 text-sm">
            {change.before !== null ? (
              <p className="break-words text-muted-foreground line-through decoration-muted-foreground/50">
                <span className="sr-only">Antes: </span>
                {change.before}
              </p>
            ) : null}
            {change.after !== null ? (
              <p className="break-words font-medium text-foreground">
                <span className="sr-only">Después: </span>
                {change.after}
              </p>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
