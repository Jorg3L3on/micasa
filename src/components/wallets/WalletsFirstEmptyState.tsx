import { CreditCard, Landmark, Plus, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';

const HINTS = [
  { icon: Wallet, label: 'Efectivo' },
  { icon: Landmark, label: 'Tarjeta de débito' },
  { icon: CreditCard, label: 'Tarjeta de crédito' },
];

/** First-run state: no wallets exist yet (not the same as "filters match nothing"). */
export const WalletsFirstEmptyState = ({ onCreate }: { onCreate: () => void }) => (
  <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-12 text-center">
    <div
      aria-hidden
      className="flex aspect-[1.586] w-56 items-end rounded-face border border-dashed border-border bg-muted/40 p-4"
    >
      <div className="h-2.5 w-24 rounded-full bg-muted-foreground/25" />
    </div>
    <div className="space-y-1">
      <h2 className="text-lg font-semibold text-foreground">
        Crea tu primera billetera
      </h2>
      <p className="text-body text-muted-foreground">
        Agrega el efectivo o la tarjeta que usas para empezar a ver tu saldo y
        tus pagos en un solo lugar.
      </p>
    </div>
    <Button type="button" onClick={onCreate} className="gap-2">
      <Plus className="h-4 w-4" aria-hidden />
      Agregar billetera
    </Button>
    <ul className="flex flex-wrap justify-center gap-2">
      {HINTS.map(({ icon: Icon, label }) => (
        <li
          key={label}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1 text-caption text-muted-foreground"
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  </div>
);
