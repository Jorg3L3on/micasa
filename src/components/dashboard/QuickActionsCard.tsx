'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CalendarPlus, type LucideIcon, Plus, TrendingUp } from 'lucide-react';
import CreateMonthForm from '@/components/CreateMonthForm';
import { DASHBOARD_CARD_CLASS } from './constants';

type QuickActionsCardProps = {
  compact?: boolean;
};

const LINK_ACTIONS: Array<{
  href: string;
  label: string;
  labelShort: string;
  ariaLabel: string;
  icon: LucideIcon;
}> = [
  {
    href: '/transactions?action=add-expense',
    label: 'Agregar gasto',
    labelShort: 'Gasto',
    ariaLabel: 'Agregar gasto',
    icon: Plus,
  },
  {
    href: '/transactions?action=add-income',
    label: 'Agregar ingreso',
    labelShort: 'Ingreso',
    ariaLabel: 'Agregar ingreso',
    icon: TrendingUp,
  },
];

const CREATE_MONTH_DIALOG = {
  title: 'Crear mes (dos quincenas)',
  description: 'Elige un mes para crear la primera y segunda quincena.',
  idPrefixCompact: 'quick-actions-create-month',
  idPrefixFull: 'quick-actions-create-month-full',
} as const;

export default function QuickActionsCard({
  compact = false,
}: QuickActionsCardProps) {
  const [createMonthOpen, setCreateMonthOpen] = useState(false);

  const handleCreateMonthSuccess = () => setCreateMonthOpen(false);

  const buttonCompact = 'h-auto flex-col gap-1 py-2 text-xs';
  const buttonFull = 'h-auto flex-col gap-1 py-3';
  const iconSizeCompact = 'size-3.5';
  const iconSizeFull = 'h-4 w-4';

  return (
    <Card className={DASHBOARD_CARD_CLASS}>
      <CardHeader className={compact ? 'pb-2' : undefined}>
        <CardTitle className="text-base font-medium">
          Acciones rápidas
        </CardTitle>
      </CardHeader>
      <CardContent
        className={
          compact
            ? 'grid grid-cols-2 gap-1.5 sm:grid-cols-3'
            : 'grid grid-cols-2 gap-2'
        }
      >
        {LINK_ACTIONS.map(
          ({ href, label, labelShort, ariaLabel, icon: Icon }) => (
            <Button
              key={href}
              variant="outline"
              size="sm"
              asChild
              className={compact ? buttonCompact : buttonFull}
            >
              <Link href={href} aria-label={ariaLabel}>
                <Icon
                  className={compact ? iconSizeCompact : iconSizeFull}
                  aria-hidden
                />
                <span>{compact ? labelShort : label}</span>
              </Link>
            </Button>
          ),
        )}
        <Dialog open={createMonthOpen} onOpenChange={setCreateMonthOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={
                compact
                  ? `${buttonCompact} col-span-2 sm:col-span-1`
                  : `${buttonFull} col-span-2`
              }
              aria-label={CREATE_MONTH_DIALOG.title}
            >
              <CalendarPlus
                className={compact ? iconSizeCompact : iconSizeFull}
                aria-hidden
              />
              <span>{compact ? 'Crear mes' : CREATE_MONTH_DIALOG.title}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{CREATE_MONTH_DIALOG.title}</DialogTitle>
              <DialogDescription>
                {CREATE_MONTH_DIALOG.description}
              </DialogDescription>
            </DialogHeader>
            <CreateMonthForm
              idPrefix={
                compact
                  ? CREATE_MONTH_DIALOG.idPrefixCompact
                  : CREATE_MONTH_DIALOG.idPrefixFull
              }
              onSuccess={handleCreateMonthSuccess}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
