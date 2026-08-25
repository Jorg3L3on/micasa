'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  KeyRound,
  Layers,
  MoreHorizontal,
  Pencil,
  Plug,
  ShieldOff,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ToggleField } from '@/components/ui/toggle';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { cn } from '@/lib/utils';
import AgentContextPicker, {
  formatContextLabel,
  useDefaultContextSelection,
  type SelectableContext,
} from '@/components/settings/AgentContextPicker';
import type { AgentContextEntry } from '@/schemas/agent-context.schema';

export type ApiKeySummary = {
  id: number;
  name: string;
  key_prefix: string;
  scopes: string[];
  allowed_contexts: AgentContextEntry[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type OAuthGrantSummary = {
  id: number;
  client_id: string;
  client_name: string;
  scopes: string[];
  allowed_contexts: AgentContextEntry[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type CreatedKeyResponse = ApiKeySummary & { token: string };

const RELATIVE_UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
];

const formatRelative = (iso: string | null): string => {
  if (!iso) return 'Nunca usada';
  const diffMs = new Date(iso).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' });
  for (const { unit, ms } of RELATIVE_UNITS) {
    if (Math.abs(diffMs) >= ms) {
      return `Usada ${rtf.format(Math.round(diffMs / ms), unit)}`;
    }
  }
  return 'Usada hace un momento';
};

const scopesLabel = (scopes: string[]): string =>
  scopes.includes('write') ? 'Lectura y escritura' : 'Lectura';

const contextsSummary = (
  contexts: AgentContextEntry[],
  selectableContexts: SelectableContext[],
): string => {
  if (contexts.length === 0) return 'Sin contextos (bloqueado)';
  return contexts
    .map((entry) => formatContextLabel(entry, selectableContexts))
    .join(', ');
};

const isExpired = (key: ApiKeySummary): boolean =>
  key.expires_at != null && new Date(key.expires_at).getTime() <= Date.now();

const formatExpiry = (iso: string): string => {
  const diffMs = new Date(iso).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' });
  for (const { unit, ms } of RELATIVE_UNITS) {
    if (Math.abs(diffMs) >= ms) {
      return `Expira ${rtf.format(Math.round(diffMs / ms), unit)}`;
    }
  }
  return 'Expira pronto';
};

const EXPIRY_OPTIONS: Array<{ value: string; label: string; days: number | null }> = [
  { value: 'never', label: 'Sin expiración', days: null },
  { value: '30', label: '30 días', days: 30 },
  { value: '90', label: '90 días', days: 90 },
  { value: '365', label: '1 año', days: 365 },
];

const copyToClipboard = async (value: string, message: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  } catch {
    toast.error('No se pudo copiar. Copia el texto manualmente.');
  }
};

type ClientSnippet = {
  id: string;
  label: string;
  description: string;
  snippet: (url: string) => string;
};

const CLIENT_SNIPPETS: ClientSnippet[] = [
  {
    id: 'grok',
    label: 'Grok Bot',
    description:
      'En la configuración del bot agrega un conector MCP tipo HTTP con esta URL y pega el token como Bearer.',
    snippet: (url) => `URL: ${url}\nAuthorization: Bearer <TU_TOKEN>`,
  },
  {
    id: 'cursor',
    label: 'Cursor',
    description: 'Agrega esto a tu mcp.json (Settings → MCP).',
    snippet: (url) =>
      JSON.stringify(
        {
          mcpServers: {
            micasa: {
              url,
              headers: { Authorization: 'Bearer <TU_TOKEN>' },
            },
          },
        },
        null,
        2,
      ),
  },
  {
    id: 'claude',
    label: 'Claude',
    description:
      'En Claude (web o Desktop) agrega un conector personalizado: Settings → Connectors → Add custom connector, con la URL y el token como header Authorization.',
    snippet: (url) => `URL: ${url}\nHeader: Authorization: Bearer <TU_TOKEN>`,
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT (OAuth)',
    description:
      'En Settings → Connectors activa Developer Mode, crea un conector MCP con autenticación OAuth. No necesitas client id: ChatGPT usa registro dinámico (DCR).',
    snippet: (url) =>
      `MCP Server URL: ${url}\nAutenticación: OAuth\n(No client id / secret — DCR automático)`,
  },
  {
    id: 'chatgpt-dev',
    label: 'ChatGPT (token manual)',
    description:
      'Modo desarrollador con token Bearer manual (alternativa a OAuth).',
    snippet: (url) => `MCP Server URL: ${url}\nAccess token: <TU_TOKEN>`,
  },
];

type OverlayShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
};

/** Dialog on desktop, bottom Sheet on mobile (responsive-overlays rule). */
function OverlayShell({
  open,
  onOpenChange,
  title,
  description,
  children,
}: OverlayShellProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex max-h-[92vh] flex-col gap-0 rounded-t-xl p-0"
        >
          <SheetHeader className="border-b border-border/50 px-4 py-3">
            <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
            <SheetDescription className="sr-only">{description}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {open ? children : null}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md gap-4 p-5">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          <DialogDescription className="sr-only">{description}</DialogDescription>
        </DialogHeader>
        {open ? children : null}
      </DialogContent>
    </Dialog>
  );
}

type ConnectionsPanelProps = {
  initialKeys: ApiKeySummary[];
  initialOAuthGrants?: OAuthGrantSummary[];
  selectableContexts: SelectableContext[];
};

export default function ConnectionsPanel({
  initialKeys,
  initialOAuthGrants = [],
  selectableContexts,
}: ConnectionsPanelProps) {
  const [keys, setKeys] = useState<ApiKeySummary[]>(initialKeys);
  const [oauthGrants, setOAuthGrants] =
    useState<OAuthGrantSummary[]>(initialOAuthGrants);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [allowWrite, setAllowWrite] = useState(false);
  const [expiryOption, setExpiryOption] = useState('never');
  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  const [renameTarget, setRenameTarget] = useState<ApiKeySummary | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<ApiKeySummary | null>(null);
  const [revoking, setRevoking] = useState(false);

  const [revokeOAuthTarget, setRevokeOAuthTarget] =
    useState<OAuthGrantSummary | null>(null);
  const [revokingOAuth, setRevokingOAuth] = useState(false);

  const [editContextsTarget, setEditContextsTarget] = useState<
    | { kind: 'api_key'; item: ApiKeySummary }
    | { kind: 'oauth_grant'; item: OAuthGrantSummary }
    | null
  >(null);
  const [editContextsValue, setEditContextsValue] = useState<AgentContextEntry[]>(
    [],
  );
  const [savingContexts, setSavingContexts] = useState(false);

  const [createContexts, setCreateContexts] = useDefaultContextSelection(
    selectableContexts,
  );

  const mcpUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/api/mcp';
    return `${window.location.origin}/api/mcp`;
  }, []);

  const handleOpenCreate = () => {
    setNewName('');
    setAllowWrite(false);
    setExpiryOption('never');
    setCreatedToken(null);
    setTokenCopied(false);
    setCreateContexts([]);
    setCreateOpen(true);
  };

  const handleCreateOpenChange = (open: boolean) => {
    if (!open && creating) return;
    setCreateOpen(open);
    if (!open) {
      setCreatedToken(null);
      setTokenCopied(false);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error('Ponle un nombre a la conexión');
      return;
    }
    if (createContexts.length === 0) {
      toast.error('Selecciona al menos un contexto');
      return;
    }

    try {
      setCreating(true);
      const expiresInDays =
        EXPIRY_OPTIONS.find((option) => option.value === expiryOption)?.days ??
        null;
      const created = await clientFetchFromApi<CreatedKeyResponse>(
        '/api/account/api-keys',
        {
          method: 'POST',
          body: JSON.stringify({
            name,
            scopes: allowWrite ? ['read', 'write'] : ['read'],
            allowed_contexts: createContexts,
            expires_in_days: expiresInDays,
          }),
        },
      );
      const { token, ...summary } = created;
      setKeys((prev) => [summary, ...prev]);
      setCreatedToken(token);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo crear la conexión',
      );
    } finally {
      setCreating(false);
    }
  };

  const handleCopyToken = async () => {
    if (!createdToken) return;
    await copyToClipboard(createdToken, 'Token copiado');
    setTokenCopied(true);
  };

  const handleOpenRename = (key: ApiKeySummary) => {
    setRenameTarget(key);
    setRenameValue(key.name);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) {
      toast.error('El nombre no puede quedar vacío');
      return;
    }

    try {
      setRenaming(true);
      await clientFetchFromApi<{ id: number; name: string }>(
        `/api/account/api-keys/${renameTarget.id}`,
        { method: 'PATCH', body: JSON.stringify({ name }) },
      );
      setKeys((prev) =>
        prev.map((key) =>
          key.id === renameTarget.id ? { ...key, name } : key,
        ),
      );
      toast.success('Conexión renombrada');
      setRenameTarget(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo renombrar',
      );
    } finally {
      setRenaming(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      setRevoking(true);
      await clientFetchFromApi<{ revoked: boolean }>(
        `/api/account/api-keys/${revokeTarget.id}`,
        { method: 'DELETE' },
      );
      const revokedAt = new Date().toISOString();
      setKeys((prev) =>
        prev.map((key) =>
          key.id === revokeTarget.id ? { ...key, revoked_at: revokedAt } : key,
        ),
      );
      toast.success('Conexión revocada. El token dejó de funcionar.');
      setRevokeTarget(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo revocar',
      );
    } finally {
      setRevoking(false);
    }
  };

  const handleRevokeOAuth = async () => {
    if (!revokeOAuthTarget) return;
    try {
      setRevokingOAuth(true);
      await clientFetchFromApi<{ revoked: boolean }>(
        `/api/account/oauth-grants/${revokeOAuthTarget.id}`,
        { method: 'DELETE' },
      );
      const revokedAt = new Date().toISOString();
      setOAuthGrants((prev) =>
        prev.map((grant) =>
          grant.id === revokeOAuthTarget.id
            ? { ...grant, revoked_at: revokedAt }
            : grant,
        ),
      );
      toast.success('Conexión OAuth revocada. El access token dejó de funcionar.');
      setRevokeOAuthTarget(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo revocar',
      );
    } finally {
      setRevokingOAuth(false);
    }
  };

  const handleOpenEditContexts = (
    target:
      | { kind: 'api_key'; item: ApiKeySummary }
      | { kind: 'oauth_grant'; item: OAuthGrantSummary },
  ) => {
    setEditContextsTarget(target);
    setEditContextsValue(target.item.allowed_contexts);
  };

  const handleSaveContexts = async () => {
    if (!editContextsTarget) return;
    try {
      setSavingContexts(true);
      const endpoint =
        editContextsTarget.kind === 'api_key'
          ? `/api/account/api-keys/${editContextsTarget.item.id}`
          : `/api/account/oauth-grants/${editContextsTarget.item.id}`;
      const updated = await clientFetchFromApi<{
        allowed_contexts: AgentContextEntry[];
      }>(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({ allowed_contexts: editContextsValue }),
      });
      if (editContextsTarget.kind === 'api_key') {
        setKeys((prev) =>
          prev.map((key) =>
            key.id === editContextsTarget.item.id
              ? { ...key, allowed_contexts: updated.allowed_contexts }
              : key,
          ),
        );
      } else {
        setOAuthGrants((prev) =>
          prev.map((grant) =>
            grant.id === editContextsTarget.item.id
              ? { ...grant, allowed_contexts: updated.allowed_contexts }
              : grant,
          ),
        );
      }
      toast.success('Contextos actualizados');
      setEditContextsTarget(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudieron guardar los contextos',
      );
    } finally {
      setSavingContexts(false);
    }
  };

  const createBody = createdToken ? (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
        <p className="text-xs leading-relaxed text-foreground">
          Copia el token ahora. Por seguridad{' '}
          <span className="font-semibold">no se volverá a mostrar</span>: si lo
          pierdes tendrás que crear otra conexión.
        </p>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-3">
        <p className="break-all font-mono text-xs text-foreground">
          {createdToken}
        </p>
      </div>
      <Button
        type="button"
        onClick={handleCopyToken}
        className="h-11 w-full rounded-xl"
      >
        {tokenCopied ? (
          <>
            <Check className="size-4" aria-hidden /> Copiado
          </>
        ) : (
          <>
            <Copy className="size-4" aria-hidden /> Copiar token
          </>
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-9 w-full"
        onClick={() => handleCreateOpenChange(false)}
      >
        Listo
      </Button>
    </div>
  ) : (
    <div className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <label
          htmlFor="connection-name"
          className="text-sm font-medium text-foreground"
        >
          Nombre
        </label>
        <Input
          id="connection-name"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="Grok Bot, Claude, Cursor…"
          maxLength={60}
          disabled={creating}
          autoFocus
        />
      </div>
      <ToggleField
        label="Permitir escritura"
        helper="Con escritura el agente puede registrar compras, pagos y ajustes. Sin ella solo consulta."
        checked={allowWrite}
        onCheckedChange={setAllowWrite}
        disabled={creating}
      />
      <AgentContextPicker
        idPrefix="create-key"
        contexts={selectableContexts}
        value={createContexts}
        onChange={setCreateContexts}
        disabled={creating}
      />
      <div className="space-y-1.5">
        <label
          htmlFor="connection-expiry"
          className="text-sm font-medium text-foreground"
        >
          Expiración
        </label>
        <Select
          value={expiryOption}
          onValueChange={setExpiryOption}
          disabled={creating}
        >
          <SelectTrigger id="connection-expiry" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPIRY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] leading-snug text-muted-foreground">
          Al expirar, el token deja de funcionar automáticamente.
        </p>
      </div>
      <Button
        type="button"
        onClick={handleCreate}
        disabled={creating || createContexts.length === 0}
        className="h-11 w-full rounded-xl"
      >
        {creating ? 'Creando…' : 'Crear conexión'}
      </Button>
    </div>
  );

  const editContextsBody = (
    <div className="flex flex-col gap-4">
      <AgentContextPicker
        idPrefix="edit-contexts"
        contexts={selectableContexts}
        value={editContextsValue}
        onChange={setEditContextsValue}
        disabled={savingContexts}
      />
      <Button
        type="button"
        onClick={handleSaveContexts}
        disabled={savingContexts}
        className="h-11 w-full rounded-xl"
      >
        {savingContexts ? 'Guardando…' : 'Guardar contextos'}
      </Button>
    </div>
  );

  const renameBody = (
    <div className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <label
          htmlFor="connection-rename"
          className="text-sm font-medium text-foreground"
        >
          Nuevo nombre
        </label>
        <Input
          id="connection-rename"
          value={renameValue}
          onChange={(event) => setRenameValue(event.target.value)}
          maxLength={60}
          disabled={renaming}
          autoFocus
        />
      </div>
      <Button
        type="button"
        onClick={handleRename}
        disabled={renaming}
        className="h-11 w-full rounded-xl"
      >
        {renaming ? 'Guardando…' : 'Guardar'}
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Plug className="size-4" aria-hidden />
            </span>
            <div className="space-y-1">
              <CardTitle className="text-base">Conexiones</CardTitle>
              <CardDescription>
                Llaves Bearer (`micasa_…`) para agentes MCP (Grok, Claude, Cursor).
                ChatGPT puede usar OAuth en su lugar (sección de abajo).
              </CardDescription>
            </div>
          </div>
          <Button
            type="button"
            onClick={handleOpenCreate}
            className="h-9 shrink-0 rounded-xl"
          >
            Nueva conexión
          </Button>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              Aún no tienes conexiones. Crea una para conectar un agente a
              MiCasa.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
              {keys.map((key) => {
                const revoked = key.revoked_at != null;
                const expired = !revoked && isExpired(key);
                const inactive = revoked || expired;
                return (
                  <li
                    key={key.id}
                    className={cn(
                      'flex items-center gap-3 bg-card px-3 py-3',
                      inactive && 'opacity-55',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-xl',
                        inactive
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-sky-500/15 text-sky-500',
                      )}
                    >
                      <KeyRound className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {key.name}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {scopesLabel(key.scopes)}
                        </Badge>
                        {revoked ? (
                          <Badge
                            variant="outline"
                            className="border-red-500/40 text-[10px] text-red-500"
                          >
                            Revocada
                          </Badge>
                        ) : expired ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 text-[10px] text-amber-500"
                          >
                            Expirada
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 text-[10px] text-emerald-500"
                          >
                            Activa
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        <span className="font-mono">{key.key_prefix}…</span>
                        {' · '}
                        {inactive
                          ? 'Ya no funciona'
                          : formatRelative(key.last_used_at)}
                        {!inactive && key.expires_at
                          ? ` · ${formatExpiry(key.expires_at)}`
                          : ''}
                      </p>
                      <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Layers className="mt-0.5 size-3 shrink-0" aria-hidden />
                        <span className="line-clamp-2">
                          {contextsSummary(key.allowed_contexts, selectableContexts)}
                        </span>
                      </p>
                    </div>
                    {!revoked && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0"
                            aria-label={`Más acciones para ${key.name}`}
                          >
                            <MoreHorizontal className="size-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() =>
                              handleOpenEditContexts({ kind: 'api_key', item: key })
                            }
                          >
                            <Layers className="size-4" aria-hidden /> Editar contextos
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleOpenRename(key)}>
                            <Pencil className="size-4" aria-hidden /> Renombrar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setRevokeTarget(key)}
                          >
                            <ShieldOff className="size-4" aria-hidden /> Revocar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-500">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div className="space-y-1">
            <CardTitle className="text-base">Conexiones OAuth</CardTitle>
            <CardDescription>
              Clientes como ChatGPT que completaron login OAuth contra tu cuenta.
              Revoca aquí si dejas de usar el conector.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {oauthGrants.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              Aún no hay conexiones OAuth. Al autorizar ChatGPT u otro cliente
              MCP con OAuth, aparecerán aquí.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
              {oauthGrants.map((grant) => {
                const revoked = grant.revoked_at != null;
                const expired =
                  !revoked &&
                  grant.expires_at != null &&
                  new Date(grant.expires_at).getTime() <= Date.now();
                const inactive = revoked || expired;
                return (
                  <li
                    key={grant.id}
                    className={cn(
                      'flex items-center gap-3 bg-card px-3 py-3',
                      inactive && 'opacity-55',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-xl',
                        inactive
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-violet-500/15 text-violet-500',
                      )}
                    >
                      <Sparkles className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {grant.client_name}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          OAuth
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {scopesLabel(grant.scopes)}
                        </Badge>
                        {revoked ? (
                          <Badge
                            variant="outline"
                            className="border-red-500/40 text-[10px] text-red-500"
                          >
                            Revocada
                          </Badge>
                        ) : expired ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 text-[10px] text-amber-500"
                          >
                            Expirada
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 text-[10px] text-emerald-500"
                          >
                            Activa
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        <span className="font-mono">{grant.client_id.slice(0, 18)}…</span>
                        {' · '}
                        {inactive
                          ? 'Ya no funciona'
                          : formatRelative(grant.last_used_at)}
                        {!inactive && grant.expires_at
                          ? ` · ${formatExpiry(grant.expires_at)}`
                          : ''}
                      </p>
                      <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Layers className="mt-0.5 size-3 shrink-0" aria-hidden />
                        <span className="line-clamp-2">
                          {contextsSummary(grant.allowed_contexts, selectableContexts)}
                        </span>
                      </p>
                    </div>
                    {!revoked && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0"
                            aria-label={`Más acciones para ${grant.client_name}`}
                          >
                            <MoreHorizontal className="size-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() =>
                              handleOpenEditContexts({
                                kind: 'oauth_grant',
                                item: grant,
                              })
                            }
                          >
                            <Layers className="size-4" aria-hidden /> Editar contextos
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setRevokeOAuthTarget(grant)}
                          >
                            <ShieldOff className="size-4" aria-hidden /> Revocar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cómo conectar un cliente</CardTitle>
          <CardDescription>
            Todos los clientes usan la misma URL del servidor MCP. Grok, Cursor
            y Claude usan un token Bearer; ChatGPT puede usar OAuth (recomendado).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
              {mcpUrl}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label="Copiar URL del servidor MCP"
              onClick={() => copyToClipboard(mcpUrl, 'URL copiada')}
            >
              <Copy className="size-4" aria-hidden />
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {CLIENT_SNIPPETS.map((client) => (
              <div
                key={client.id}
                className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {client.label}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    aria-label={`Copiar configuración para ${client.label}`}
                    onClick={() =>
                      copyToClipboard(
                        client.snippet(mcpUrl),
                        'Configuración copiada',
                      )
                    }
                  >
                    <Copy className="size-3.5" aria-hidden />
                  </Button>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {client.description}
                </p>
                <pre className="overflow-x-auto rounded-lg bg-muted/50 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {client.snippet(mcpUrl)}
                </pre>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Reemplaza <span className="font-mono">&lt;TU_TOKEN&gt;</span> con el
            token que se muestra al crear la conexión. Guárdalo en un lugar
            seguro: no se vuelve a mostrar.
          </p>
        </CardContent>
      </Card>

      <OverlayShell
        open={createOpen}
        onOpenChange={handleCreateOpenChange}
        title={createdToken ? 'Token de conexión' : 'Nueva conexión'}
        description={
          createdToken
            ? 'Copia el token; solo se muestra una vez.'
            : 'Crea una llave para conectar un agente MCP.'
        }
      >
        {createBody}
      </OverlayShell>

      <OverlayShell
        open={renameTarget != null}
        onOpenChange={(open) => {
          if (!open && !renaming) setRenameTarget(null);
        }}
        title="Renombrar conexión"
        description="Cambia el nombre visible de la conexión."
      >
        {renameBody}
      </OverlayShell>

      <OverlayShell
        open={editContextsTarget != null}
        onOpenChange={(open) => {
          if (!open && !savingContexts) setEditContextsTarget(null);
        }}
        title="Editar contextos"
        description="Cambia qué contextos puede ver esta conexión."
      >
        {editContextsBody}
      </OverlayShell>

      <AlertDialog
        open={revokeTarget != null}
        onOpenChange={(open) => {
          if (!open && !revoking) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revocar esta conexión?</AlertDialogTitle>
            <AlertDialogDescription>
              El token de “{revokeTarget?.name}” dejará de funcionar de
              inmediato. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleRevoke}
              disabled={revoking}
            >
              {revoking ? 'Revocando…' : 'Revocar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={revokeOAuthTarget != null}
        onOpenChange={(open) => {
          if (!open && !revokingOAuth) setRevokeOAuthTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revocar conexión OAuth?</AlertDialogTitle>
            <AlertDialogDescription>
              El acceso de “{revokeOAuthTarget?.client_name}” dejará de
              funcionar de inmediato. El cliente tendrá que volver a pedir
              autorización.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokingOAuth}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleRevokeOAuth}
              disabled={revokingOAuth}
            >
              {revokingOAuth ? 'Revocando…' : 'Revocar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
