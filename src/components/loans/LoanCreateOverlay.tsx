'use client';

import { Loader2 } from 'lucide-react';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  AmountRow,
  DateStepper,
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
} from '@/components/overlay/overlay-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';
import { cn } from '@/lib/utils';
import type { IncomeTemplateListItem, PaymentMethodOption } from '@/types/catalog';
import type { LenderListItem } from '@/types/lenders';

export type LoanCreateFormState = {
  name: string;
  lender: string;
  lenderId: string;
  type: 'PERSONAL' | 'PAYROLL';
  principalAmount: string;
  paymentAmount: string;
  paymentCount: string;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
  startDate: string;
  paymentSource: 'WALLET' | 'PAYROLL_DEDUCTION';
  sourceWalletId: string;
  linkedWalletId: string;
  incomeTemplateId: string;
  notes: string;
};

export type LoanCreateFormErrors = Partial<
  Record<keyof LoanCreateFormState | 'general', string>
>;

type LoanCreateOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: LoanCreateFormState;
  errors: LoanCreateFormErrors;
  lenders: LenderListItem[];
  fundingWallets: PaymentMethodOption[];
  wallets: PaymentMethodOption[];
  incomeTemplates: IncomeTemplateListItem[];
  submitting: boolean;
  onSubmit: () => void;
  onFieldChange: <K extends keyof LoanCreateFormState>(
    key: K,
    value: LoanCreateFormState[K],
  ) => void;
  onLenderSelect: (lenderId: string, lenderName: string) => void;
  onNewLender: () => void;
};

const FieldError = ({ id, message }: { id: string; message?: string }) => {
  if (!message) return null;
  return (
    <p id={id} className="px-3 pb-2 text-xs text-destructive" role="alert">
      {message}
    </p>
  );
};

export const LoanCreateOverlay = ({
  open,
  onOpenChange,
  form,
  errors,
  lenders,
  fundingWallets,
  wallets,
  incomeTemplates,
  submitting,
  onSubmit,
  onFieldChange,
  onLenderSelect,
  onNewLender,
}: LoanCreateOverlayProps) => {
  const selectedSource = fundingWallets.find(
    (wallet) => String(wallet.id) === form.sourceWalletId,
  );
  const selectedLinked = wallets.find(
    (wallet) => String(wallet.id) === form.linkedWalletId,
  );
  const selectedIncome = incomeTemplates.find(
    (template) => String(template.id) === form.incomeTemplateId,
  );

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo préstamo"
      description="Captura el total, frecuencia y origen de pago para generar el calendario."
      busy={submitting}
      contentClassName="sm:max-w-lg"
    >
      {({ handleSelectOpenChange }) => (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          aria-busy={submitting}
        >
          {errors.general ? (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              role="alert"
            >
              {errors.general}
            </div>
          ) : null}

          <div className={OVERLAY_GROUPED_CARD_CLASS}>
            <GroupedRow label="Nombre">
              <Input
                id="loan-name"
                value={form.name}
                onChange={(event) => onFieldChange('name', event.target.value)}
                placeholder="Préstamo DiDi"
                aria-invalid={Boolean(errors.name)}
                className={cn(
                  OVERLAY_ROW_TRIGGER_CLASS,
                  errors.name && 'text-destructive',
                )}
                required
              />
            </GroupedRow>
            <FieldError id="loan-name-error" message={errors.name} />
            <GroupedRow label="Prestamista">
              <Select
                value={form.lenderId || (form.lender ? '__new__' : undefined)}
                onOpenChange={handleSelectOpenChange}
                onValueChange={(value) => {
                  if (value === '__new__') {
                    onNewLender();
                    return;
                  }
                  const selected = lenders.find(
                    (lender) => String(lender.id) === value,
                  );
                  onLenderSelect(value, selected?.name ?? '');
                }}
              >
                <SelectTrigger
                  id="loan-lender"
                  aria-invalid={Boolean(errors.lender)}
                  className={OVERLAY_ROW_TRIGGER_CLASS}
                >
                  <SelectValue placeholder="Elige o crea uno" />
                </SelectTrigger>
                <SelectContent>
                  {lenders.map((lender) => (
                    <SelectItem key={lender.id} value={String(lender.id)}>
                      {lender.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">Nuevo prestamista…</SelectItem>
                </SelectContent>
              </Select>
            </GroupedRow>
            {!form.lenderId ? (
              <GroupedRow label="Nombre">
                <Input
                  value={form.lender}
                  onChange={(event) =>
                    onFieldChange('lender', event.target.value)
                  }
                  placeholder="Nombre del prestamista"
                  aria-label="Nombre del nuevo prestamista"
                  className={OVERLAY_ROW_TRIGGER_CLASS}
                />
              </GroupedRow>
            ) : null}
            <FieldError id="loan-lender-error" message={errors.lender} />
          </div>

          <div className={OVERLAY_GROUPED_CARD_CLASS}>
            <GroupedRow label="Tipo">
              <Select
                value={form.type}
                onOpenChange={handleSelectOpenChange}
                onValueChange={(value) =>
                  onFieldChange('type', value as LoanCreateFormState['type'])
                }
              >
                <SelectTrigger
                  aria-label="Tipo de préstamo"
                  className={OVERLAY_ROW_TRIGGER_CLASS}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERSONAL">Préstamo personal</SelectItem>
                  <SelectItem value="PAYROLL">Préstamo de nómina</SelectItem>
                </SelectContent>
              </Select>
            </GroupedRow>
            <GroupedRow label="Periodo">
              <Select
                value={form.frequency}
                onOpenChange={handleSelectOpenChange}
                onValueChange={(value) =>
                  onFieldChange(
                    'frequency',
                    value as LoanCreateFormState['frequency'],
                  )
                }
              >
                <SelectTrigger
                  aria-label="Periodicidad del préstamo"
                  className={OVERLAY_ROW_TRIGGER_CLASS}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Semanal</SelectItem>
                  <SelectItem value="FORTNIGHTLY">Quincenal</SelectItem>
                  <SelectItem value="MONTHLY">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </GroupedRow>
            <GroupedRow label="Pagos">
              <Input
                id="loan-count"
                type="number"
                min="1"
                step="1"
                value={form.paymentCount}
                onChange={(event) =>
                  onFieldChange('paymentCount', event.target.value)
                }
                className={OVERLAY_ROW_TRIGGER_CLASS}
                required
              />
            </GroupedRow>
            <FieldError id="loan-count-error" message={errors.paymentCount} />
            <GroupedRow label="Inicio">
              <DateStepper
                value={form.startDate}
                onChange={(next) => onFieldChange('startDate', next)}
              />
            </GroupedRow>
            <FieldError id="loan-start-error" message={errors.startDate} />
          </div>

          <div className={OVERLAY_GROUPED_CARD_CLASS}>
            <AmountRow
              label="Total"
              value={Number(form.principalAmount) || 0}
              onChange={(val) =>
                onFieldChange('principalAmount', val === 0 ? '' : String(val))
              }
              ariaLabel="Total del préstamo"
            />
            <FieldError
              id="loan-principal-error"
              message={errors.principalAmount}
            />
            <AmountRow
              label="Pago"
              value={Number(form.paymentAmount) || 0}
              onChange={(val) =>
                onFieldChange('paymentAmount', val === 0 ? '' : String(val))
              }
              ariaLabel="Cantidad del pago"
            />
            <FieldError id="loan-payment-error" message={errors.paymentAmount} />
          </div>

          <div className={OVERLAY_GROUPED_CARD_CLASS}>
            <GroupedRow label="Origen">
              <Select
                value={form.paymentSource}
                onOpenChange={handleSelectOpenChange}
                onValueChange={(value) =>
                  onFieldChange(
                    'paymentSource',
                    value as LoanCreateFormState['paymentSource'],
                  )
                }
              >
                <SelectTrigger
                  aria-label="Forma de pago del préstamo"
                  className={OVERLAY_ROW_TRIGGER_CLASS}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WALLET">Desde billetera</SelectItem>
                  <SelectItem value="PAYROLL_DEDUCTION">
                    Deducción de nómina
                  </SelectItem>
                </SelectContent>
              </Select>
            </GroupedRow>
            {form.paymentSource === 'WALLET' ? (
              <GroupedRow label="Billetera">
                <Select
                  value={form.sourceWalletId || undefined}
                  onOpenChange={handleSelectOpenChange}
                  onValueChange={(value) =>
                    onFieldChange('sourceWalletId', value)
                  }
                >
                  <SelectTrigger
                    aria-label="Billetera que pagará el préstamo"
                    className={OVERLAY_ROW_TRIGGER_CLASS}
                  >
                    <SelectValue placeholder="Selecciona">
                      {selectedSource ? (
                        <WalletIdentity
                          name={selectedSource.name}
                          providerIconKey={selectedSource.provider_icon_key}
                          iconClassName="h-8 w-8 rounded-lg"
                        />
                      ) : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {fundingWallets.map((wallet) => (
                      <SelectItem key={wallet.id} value={String(wallet.id)}>
                        <WalletIdentity
                          name={wallet.name}
                          providerIconKey={wallet.provider_icon_key}
                          iconClassName="h-8 w-8 rounded-lg"
                        />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </GroupedRow>
            ) : (
              <GroupedRow label="Ingreso">
                <Select
                  value={form.incomeTemplateId || undefined}
                  onOpenChange={handleSelectOpenChange}
                  onValueChange={(value) =>
                    onFieldChange('incomeTemplateId', value)
                  }
                >
                  <SelectTrigger
                    aria-label="Ingreso relacionado con la deducción"
                    className={OVERLAY_ROW_TRIGGER_CLASS}
                  >
                    <SelectValue placeholder="Opcional">
                      {selectedIncome?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {incomeTemplates.map((template) => (
                      <SelectItem
                        key={template.id}
                        value={String(template.id)}
                      >
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </GroupedRow>
            )}
            <GroupedRow label="Cuenta">
              <Select
                value={form.linkedWalletId || 'none'}
                onOpenChange={handleSelectOpenChange}
                onValueChange={(value) =>
                  onFieldChange('linkedWalletId', value === 'none' ? '' : value)
                }
              >
                <SelectTrigger
                  aria-label="Cuenta relacionada para seguimiento"
                  className={OVERLAY_ROW_TRIGGER_CLASS}
                >
                  <SelectValue placeholder="Opcional">
                    {selectedLinked ? (
                      <WalletIdentity
                        name={selectedLinked.name}
                        providerIconKey={selectedLinked.provider_icon_key}
                        iconClassName="h-8 w-8 rounded-lg"
                      />
                    ) : (
                      'Sin cuenta vinculada'
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin cuenta vinculada</SelectItem>
                  {wallets.map((wallet) => (
                    <SelectItem key={wallet.id} value={String(wallet.id)}>
                      <WalletIdentity
                        name={wallet.name}
                        providerIconKey={wallet.provider_icon_key}
                        iconClassName="h-8 w-8 rounded-lg"
                      />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </GroupedRow>
          </div>

          <div className={OVERLAY_GROUPED_CARD_CLASS}>
            <GroupedRow label="Notas">
              <Textarea
                id="loan-notes"
                value={form.notes}
                onChange={(event) => onFieldChange('notes', event.target.value)}
                placeholder="Opcional"
                rows={2}
                className="min-h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </GroupedRow>
          </div>

          <Button
            type="submit"
            className={OVERLAY_PRIMARY_BUTTON_CLASS}
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? (
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-hidden
                data-icon="inline-start"
              />
            ) : null}
            {submitting ? 'Creando…' : 'Crear préstamo'}
          </Button>
        </form>
      )}
    </ResponsiveOverlay>
  );
};
