'use client';

import { PantryHomeInsights } from '@/components/pantry/PantryHomeInsights';
import { PantryLayoutShell } from '@/components/pantry/PantryLayoutShell';

export default function PantryPage() {
  return (
    <PantryLayoutShell className="space-y-6">
      <PantryHomeInsights />
    </PantryLayoutShell>
  );
}
