'use client';

import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_INPUT_CLASS,
  OVERLAY_ROW_TEXTAREA_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
  OverlayErrorBanner,
  OverlayHint,
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
import type { IncomeTemplateListItem, PaymentMethodOption } from '@/types/catalog';

export type LoanEditFormState = {
  name: string;
  lender: string;
  linkedWalletId: string;
  incomeTemplateId: string;
  notes: string;
};

export type LoanEditErrors = Partial<
  Record<keyof LoanEditFormState | 'general', string>
>;

type LoanEditOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: LoanEditFormState;
  errors: LoanEditErrors;
  wallets: PaymentMethodOption[];
  incomeTemplates: IncomeTemplateListItem[];
  payroll: boolean;
  submitting: boolean;
  onFieldChange: <K extends keyof LoanEditFormState>(
    key: K,
    value: LoanEditFormState[K],
  ) => void;
  onSubmit: () => void;
};

const FieldError = ({ id, message }: { id: string; message?: string }) => {
  if (!message) return null;
  return (
    <p id={id} className="px-3 pb-2 text-xs text-status-overdue" role="alert">
      {message}
    </p>
  );
};

export const LoanEditOverlay = ({
  open,
  onOpenChange,
  form,
  errors,
  wallets,
  incomeTemplates,
  payroll,
  submitting,
  onFieldChange,
  onSubmit,
}: LoanEditOverlayProps) => {
  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Editar datos seguros"
      description="Estos campos no recalculan el calendario ni alteran pagos ya generados."
      busy={submitting}
    >
      {({ handleSelectOpenChange }) => (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <OverlayHint>
            El calendario de pagos queda bloqueado. Solo cambian el nombre, la entidad y los vínculos.
          </OverlayHint>
          {errors.general ? <OverlayErrorBanner>{errors.general}</OverlayErrorBanner> : null}
          <div className={OVERLAY_GROUPED_CARD_CLASS}>
            <GroupedRow label="Nombre" htmlFor="loan-edit-name">
              <Input
                id="loan-edit-name"
                value={form.name}
                onChange={(event) => onFieldChange('name', event.target.value)}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'loan-edit-name-error' : undefined}
                className={OVERLAY_ROW_INPUT_CLASS}
              />
            </GroupedRow>
            <FieldError id="loan-edit-name-error" message={errors.name} />
            <GroupedRow label="Entidad" htmlFor="loan-edit-lender">
              <Input
                id="loan-edit-lender"
                value={form.lender}
                onChange={(event) => onFieldChange('lender', event.target.value)}
                aria-invalid={Boolean(errors.lender)}
                aria-describedby={errors.lender ? 'loan-edit-lender-error' : undefined}
                className={OVERLAY_ROW_INPUT_CLASS}
              />
            </GroupedRow>
            <FieldError id="loan-edit-lender-error" message={errors.lender} />
            <GroupedRow label="Billetera">
              <Select
                value={form.linkedWalletId}
                onOpenChange={handleSelectOpenChange}
                onValueChange={(value) => onFieldChange('linkedWalletId', value)}
              >
                <SelectTrigger
                  aria-label="Billetera relacionada para seguimiento"
                  aria-invalid={Boolean(errors.linkedWalletId)}
                  className={OVERLAY_ROW_TRIGGER_CLASS}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin cuenta vinculada</SelectItem>
                  {wallets.map((wallet) => (
                    <SelectItem key={wallet.id} value={String(wallet.id)}>
                      {wallet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </GroupedRow>
            <FieldError id="loan-edit-linked-error" message={errors.linkedWalletId} />
            {payroll ? (
              <>
                <GroupedRow label="Ingreso">
                  <Select
                    value={form.incomeTemplateId}
                    onOpenChange={handleSelectOpenChange}
                    onValueChange={(value) => onFieldChange('incomeTemplateId', value)}
                  >
                    <SelectTrigger
                      aria-label="Ingreso relacionado con la deducción"
                      aria-invalid={Boolean(errors.incomeTemplateId)}
                      className={OVERLAY_ROW_TRIGGER_CLASS}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin ingreso vinculado</SelectItem>
                      {incomeTemplates.map((template) => (
                        <SelectItem key={template.id} value={String(template.id)}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </GroupedRow>
                <FieldError
                  id="loan-edit-income-error"
                  message={errors.incomeTemplateId}
                />
              </>
            ) : null}
            <GroupedRow label="Notas" htmlFor="loan-edit-notes">
              <Textarea
                id="loan-edit-notes"
                value={form.notes}
                onChange={(event) => onFieldChange('notes', event.target.value)}
                placeholder="Condiciones, referencia, comentarios"
                rows={2}
                className={OVERLAY_ROW_TEXTAREA_CLASS}
              />
            </GroupedRow>
          </div>
          {!payroll ? (
            <OverlayHint>El ingreso relacionado solo aplica a deducción de nómina.</OverlayHint>
          ) : (
            <OverlayHint>
              Vincular una plantilla de ingreso mejora las etiquetas del inicio.
            </OverlayHint>
          )}
          <Button
            type="submit"
            className={OVERLAY_PRIMARY_BUTTON_CLASS}
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
      )}
    </ResponsiveOverlay>
  );
};
