'use client';

import { useSession } from 'next-auth/react';
import { useFinanceContext } from '@/context/finance-context';

export const LiquidityWelcome = () => {
  const { data: session } = useSession();
  const { context } = useFinanceContext();
  const firstName = session?.user?.name?.trim().split(/\s+/)[0];
  const scopeLabel =
    context?.type === 'house' ? 'finanzas de tu casa' : 'tus finanzas';

  return (
    <div>
      {firstName ? (
        <p className="text-sm text-muted-foreground">Hola, {firstName}</p>
      ) : null}
      <h1 className="text-lg font-semibold leading-tight">Liquidez y análisis</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Te mostramos {scopeLabel} en dos momentos: qué pasó y qué viene.
      </p>
    </div>
  );
};
