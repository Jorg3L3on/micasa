'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plug,
  ShieldOff,
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
import { useIsMobile } from '@/hooks/use-mobile';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { cn } from '@/lib/utils';

export type ApiKeySummary = {
  id: number;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
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
    label: 'ChatGPT (modo desarrollador)',
    description:
      'Activa Developer Mode en Settings → Connectors y crea un conector MCP con autenticación por token de acceso.',
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
};

export default function ConnectionsPanel({ initialKeys }: ConnectionsPanelProps) {
  const [keys, setKeys] = useState<ApiKeySummary[]>(initialKeys);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [allowWrite, setAllowWrite] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  const [renameTarget, setRenameTarget] = useState<ApiKeySummary | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<ApiKeySummary | null>(null);
  const [revoking, setRevoking] = useState(false);

  const mcpUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/api/mcp';
    return `${window.location.origin}/api/mcp`;
  }, []);

  const handleOpenCreate = () => {
    setNewName('');
    setAllowWrite(false);
    setCreatedToken(null);
    setTokenCopied(false);
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

    try {
      setCreating(true);
      const created = await clientFetchFromApi<CreatedKeyResponse>(
        '/api/account/api-keys',
        {
          method: 'POST',
          body: JSON.stringify({
            name,
            scopes: allowWrite ? ['read', 'write'] : ['read'],
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
      <Button
        type="button"
        onClick={handleCreate}
        disabled={creating}
        className="h-11 w-full rounded-xl"
      >
        {creating ? 'Creando…' : 'Crear conexión'}
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
                Llaves de acceso para agentes MCP (Grok, Claude, Cursor,
                ChatGPT). Cada conexión usa tu usuario; el agente elige el
                contexto (personal o casa) en cada consulta.
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
                return (
                  <li
                    key={key.id}
                    className={cn(
                      'flex items-center gap-3 bg-card px-3 py-3',
                      revoked && 'opacity-55',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-xl',
                        revoked
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
                        {revoked ? 'Ya no funciona' : formatRelative(key.last_used_at)}
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
        <CardHeader>
          <CardTitle className="text-base">Cómo conectar un cliente</CardTitle>
          <CardDescription>
            Todos los clientes usan la misma URL del servidor MCP y un token de
            conexión como Bearer.
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
    </div>
  );
}
