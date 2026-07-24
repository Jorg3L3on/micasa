import { Users } from 'lucide-react';

export default function AdminHomePage() {
  return (
    <div className="space-y-4" role="region" aria-label="Panel de administración">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Soporte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Herramientas mínimas para recuperación de acceso e investigación.
          La búsqueda de usuarios se agregará en el siguiente slice.
        </p>
      </div>
      <div className="rounded-lg border border-border/60 border-l-[3px] border-l-amber-500/50 bg-card px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 dark:bg-amber-500/15">
            <Users
              className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400"
              aria-hidden
            />
          </span>
          <div>
            <p className="text-sm font-semibold leading-none">Usuarios</p>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Listado, detalle y anulación de contraseña temporal — próximos
              cambios en esta rama de integración.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
