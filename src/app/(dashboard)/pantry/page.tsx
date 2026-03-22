'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingBasket } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { PantryHomeInsights } from '@/components/pantry/PantryHomeInsights';

export default function PantryPage() {
  const { context } = useFinanceContext();
  const qs =
    context.type === 'user' && context.id === 0
      ? ''
      : `?ownerType=${context.type}&ownerId=${context.id}`;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <PantryHomeInsights />
    </div>
  );
}
