'use client';

import { useSession } from 'next-auth/react';

/** Orion-style greeting on Panel financiero. */
export const MonthlyWelcome = () => {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.trim().split(/\s+/)[0];

  if (!firstName) return null;

  return (
    <div className="mb-4">
      <p className="text-sm text-muted-foreground">Hola, {firstName}</p>
      <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        Bienvenido de nuevo
      </h1>
    </div>
  );
};
