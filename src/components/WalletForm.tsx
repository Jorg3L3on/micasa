'use client';
import { useForm, useWatch } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  walletSchema,
  WalletFormValues,
  WalletFormInput,
} from '@/schemas/wallet.schema';
import { Checkbox } from '@/components/ui/checkbox';

type WalletFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: WalletFormValues) => Promise<void>;
  defaultValues?: WalletFormValues;
  mode: 'create' | 'edit';
  error?: string | null;
  allowedTypes?: WalletFormValues['type'][];
  showAmountField?: boolean;
};

export default function WalletForm({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  mode,
  error,
  allowedTypes,
  showAmountField = true,
}: WalletFormProps) {
  const form = useForm<WalletFormInput>({
    resolver: zodResolver(walletSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      amount: defaultValues?.amount ?? 0,
      credit_limit: defaultValues?.credit_limit ?? null,
      type: defaultValues?.type ?? 'CASH',
      active: defaultValues?.active ?? true,
      cutoff_day: defaultValues?.cutoff_day ?? null,
      due_day: defaultValues?.due_day ?? null,
    },
  });

  const handleSubmit = async (data: WalletFormInput) => {
    const parsedData = walletSchema.parse(data);
    await onSubmit(parsedData);
    form.reset();
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  const type = useWatch({
    control: form.control,
    name: 'type',
  });
  const typeOptions = allowedTypes ?? [
    'CASH',
    'DEBIT_CARD',
    'CREDIT_CARD',
    'DEPARTMENT_STORE_CARD',
  ];

  const typeLabels: Record<WalletFormValues['type'], string> = {
    CASH: 'Efectivo',
    DEBIT_CARD: 'Tarjeta de débito',
    CREDIT_CARD: 'Tarjeta de crédito',
    DEPARTMENT_STORE_CARD: 'Tienda departamental',
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Agregar billetera' : 'Editar billetera'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Crea una nueva cartera para tus transacciones.'
              : 'Actualiza la información de la cartera.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre de la billetera" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showAmountField && (
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => {
                  const numericValue =
                    field.value === undefined || field.value === null || field.value === ''
                      ? ''
                      : Number(field.value);

                  return (
                    <FormItem>
                      <FormLabel>
                        {type === 'CREDIT_CARD' || type === 'DEPARTMENT_STORE_CARD'
                          ? 'Saldo actual'
                          : 'Monto'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={numericValue}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === '' ? '' : Number(e.target.value),
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            )}

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Activo</FormLabel>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {typeOptions.map((value) => (
                          <SelectItem key={value} value={value}>
                            {typeLabels[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(type === 'CREDIT_CARD' || type === 'DEPARTMENT_STORE_CARD') && (
              <>
                <FormField
                  control={form.control}
                  name="credit_limit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Línea de crédito</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={
                            field.value != null &&
                            typeof field.value === 'number'
                              ? field.value
                              : ''
                          }
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ''
                                ? null
                                : Number(e.target.value),
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Cutoff Day */}
                <FormField
                  control={form.control}
                  name="cutoff_day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Día de corte</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={31}
                          step="1"
                          value={
                            field.value != null &&
                            typeof field.value === 'number'
                              ? field.value
                              : ''
                          }
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ''
                                ? null
                                : Number(e.target.value),
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Due Date */}
                <FormField
                  control={form.control}
                  name="due_day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Día de pago</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={31}
                          step="1"
                          value={
                            field.value != null &&
                            typeof field.value === 'number'
                              ? field.value
                              : ''
                          }
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ''
                                ? null
                                : Number(e.target.value),
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {mode === 'create' ? 'Creando…' : 'Actualizando…'}
                  </>
                ) : mode === 'create' ? (
                  'Crear'
                ) : (
                  'Actualizar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
