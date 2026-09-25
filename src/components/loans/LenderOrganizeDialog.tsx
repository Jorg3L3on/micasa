'use client';

import { useState } from 'react';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
} from '@/components/overlay/overlay-form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { LenderListItem } from '@/types/lenders';
import type { LoanListItem } from '@/types/loans';

type LenderOrganizeMode = 'merge' | 'split';

type LenderOrganizeDialogProps = {
  open: boolean;
  mode: LenderOrganizeMode;
  lender: LenderListItem | null;
  lenders: LenderListItem[];
  loans: LoanListItem[];
  submitting: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onMerge: (targetLenderId: number) => Promise<void>;
  onSplit: (input: {
    loanIds: number[];
    targetLenderId: number | null;
    name: string | null;
  }) => Promise<void>;
};

const LenderOrganizeForm = ({
  mode,
  lender,
  lenders,
  loans,
  submitting,
  error,
  onMerge,
  onSplit,
  onSelectOpenChange,
}: Omit<LenderOrganizeDialogProps, 'open' | 'onOpenChange'> & {
  onSelectOpenChange: (open: boolean) => void;
}) => {
  const [targetLenderId, setTargetLenderId] = useState('');
  const [useNewName, setUseNewName] = useState(false);
  const [name, setName] = useState('');
  const [loanIds, setLoanIds] = useState<number[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const contracts = loans.filter((loan) => loan.lenderId === lender?.id);
  const otherLenders = lenders.filter((item) => item.id !== lender?.id);

  const handleToggleLoan = (loanId: number, checked: boolean) => {
    setLoanIds((current) => {
      if (checked) return current.includes(loanId) ? current : [...current, loanId];
      return current.filter((id) => id !== loanId);
    });
  };

  const handleSubmit = async () => {
    if (!lender) return;
    if (mode === 'merge') {
      if (!targetLenderId) {
        setLocalError('Elige el prestamista que se queda');
        return;
      }
      setLocalError(null);
      await onMerge(Number(targetLenderId));
      return;
    }

    if (loanIds.length === 0) {
      setLocalError('Elige al menos un contrato para separar');
      return;
    }
    if (loanIds.length >= contracts.length) {
      setLocalError('Deja al menos un contrato en el prestamista original');
      return;
    }
    if (useNewName) {
      if (!name.trim()) {
        setLocalError('Escribe el nombre del prestamista nuevo');
        return;
      }
      setLocalError(null);
      await onSplit({
        loanIds,
        targetLenderId: null,
        name: name.trim(),
      });
      return;
    }
    if (!targetLenderId) {
      setLocalError('Elige un prestamista o escribe un nombre');
      return;
    }
    setLocalError(null);
    await onSplit({
      loanIds,
      targetLenderId: Number(targetLenderId),
      name: null,
    });
  };

  const displayError = localError ?? error;

  return (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
          aria-busy={submitting}
        >
          {displayError ? (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive" role="alert">
              {displayError}
            </div>
          ) : null}

          {mode === 'split' ? (
            <ul className="space-y-1.5" aria-label="Contratos a separar">
              {contracts.map((loan) => {
                const checked = loanIds.includes(loan.id);
                return (
                  <li
                    key={loan.id}
                    className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        handleToggleLoan(loan.id, value === true)
                      }
                      aria-label={`Separar ${loan.name}`}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {loan.name}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <div className={OVERLAY_GROUPED_CARD_CLASS}>
            {mode === 'split' ? (
              <GroupedRow label="Destino">
                <Select
                  value={useNewName ? '__new__' : targetLenderId || undefined}
                  onOpenChange={onSelectOpenChange}
                  onValueChange={(value) => {
                    if (value === '__new__') {
                      setUseNewName(true);
                      setTargetLenderId('');
                      return;
                    }
                    setUseNewName(false);
                    setTargetLenderId(value);
                  }}
                >
                  <SelectTrigger
                    className={OVERLAY_ROW_TRIGGER_CLASS}
                    aria-label="Prestamista destino"
                  >
                    <SelectValue placeholder="Elige o crea uno" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherLenders.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__">Nuevo prestamista…</SelectItem>
                  </SelectContent>
                </Select>
              </GroupedRow>
            ) : (
              <GroupedRow label="Se queda">
                <Select
                  value={targetLenderId || undefined}
                  onOpenChange={onSelectOpenChange}
                  onValueChange={setTargetLenderId}
                >
                  <SelectTrigger
                    className={OVERLAY_ROW_TRIGGER_CLASS}
                    aria-label="Prestamista que conserva los contratos"
                  >
                    <SelectValue placeholder="Elige prestamista" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherLenders.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </GroupedRow>
            )}
            {mode === 'split' && useNewName ? (
              <GroupedRow label="Nombre">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nombre del prestamista"
                  aria-label="Nombre del prestamista nuevo"
                  className={OVERLAY_ROW_TRIGGER_CLASS}
                />
              </GroupedRow>
            ) : null}
          </div>

          <Button
            type="submit"
            className={OVERLAY_PRIMARY_BUTTON_CLASS}
            disabled={submitting}
          >
            {submitting
              ? 'Guardando…'
              : mode === 'merge'
                ? 'Fusionar'
                : 'Separar'}
          </Button>
        </form>
  );
};

export const LenderOrganizeDialog = ({
  open,
  mode,
  lender,
  lenders,
  loans,
  submitting,
  error,
  onOpenChange,
  onMerge,
  onSplit,
}: LenderOrganizeDialogProps) => {
  const title =
    mode === 'merge'
      ? `Fusionar ${lender?.name ?? 'prestamista'}`
      : `Separar contratos de ${lender?.name ?? 'prestamista'}`;

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={
        mode === 'merge'
          ? 'Los contratos y el historial de pagos pasan al prestamista que elijas. Úsalo para unir MELI y Mercado Libre, o dos homónimos.'
          : 'Mueve algunos contratos a otra identidad. El prestamista original conserva al menos uno.'
      }
      busy={submitting}
    >
      {({ handleSelectOpenChange }) =>
        open ? (
          <LenderOrganizeForm
            key={`${mode}:${lender?.id ?? 'none'}`}
            mode={mode}
            lender={lender}
            lenders={lenders}
            loans={loans}
            submitting={submitting}
            error={error}
            onMerge={onMerge}
            onSplit={onSplit}
            onSelectOpenChange={handleSelectOpenChange}
          />
        ) : null
      }
    </ResponsiveOverlay>
  );
};
