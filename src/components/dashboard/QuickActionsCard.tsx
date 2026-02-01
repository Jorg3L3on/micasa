import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Plus,
  TrendingUp,
  Calendar,
  FolderTree,
} from 'lucide-react';

function getCurrentMonthHref(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `/monthly/${year}/${month}`;
}

export default function QuickActionsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Acciones rápidas
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" asChild className="h-auto flex-col gap-1 py-3">
          <Link href="/transactions?action=add-expense" aria-label="Agregar gasto">
            <Plus className="h-4 w-4" />
            <span>Agregar gasto</span>
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="h-auto flex-col gap-1 py-3">
          <Link href="/transactions?action=add-income" aria-label="Agregar ingreso">
            <TrendingUp className="h-4 w-4" />
            <span>Agregar ingreso</span>
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="h-auto flex-col gap-1 py-3">
          <Link href={getCurrentMonthHref()} aria-label="Ir a planificación">
            <Calendar className="h-4 w-4" />
            <span>Ir a planificación</span>
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="h-auto flex-col gap-1 py-3">
          <Link href="/expense-templates" aria-label="Ir a catálogos">
            <FolderTree className="h-4 w-4" />
            <span>Ir a catálogos</span>
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
