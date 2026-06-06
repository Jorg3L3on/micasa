'use client';

import { useState, useEffect } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  formatCalendarDate,
  parseCalendarDate,
  todayCalendarDate,
} from '@/lib/calendar-dates';
import { dateStringSchema } from '@/schemas/common.schema';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { createIncome } from '@/lib/api/incomes';

type HouseUserItem = {
  id: number;
  name: string;
  email: string;
};

const quickIncomeSchema = z.object({
  source: z.string().min(1, 'La descripción es requerida'),
  amount: z
    .number({
      error: (issue) =>
        issue.code === 'invalid_type'
          ? 'El monto debe ser un número'
          : 'El monto es requerido',
    })
    .positive('El monto debe ser mayor a 0'),
  date: dateStringSchema,
});

type QuickIncomeFormValues = z.infer<typeof quickIncomeSchema>;

type DashboardQuickIncomeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fortnight: {
    id: number;
    label: string;
    year: number;
    month: number;
    period: 'FIRST' | 'SECOND';
  };
  onCreated: () => void;
};

function getDefaultIncomeDate(
  year: number,
  month: number,
  period: 'FIRST' | 'SECOND',
): string {
  const todayYmd = todayCalendarDate();
  const [currentYear, currentMonth, currentDay] = todayYmd.split('-').map(Number);

  if (year === currentYear && month === currentMonth) {
    if (period === 'FIRST' && currentDay >= 1 && currentDay <= 15) {
      return todayYmd;
    }
    if (period === 'SECOND' && currentDay >= 16) {
      return todayYmd;
    }
  }

  const day = period === 'FIRST' ? 1 : 16;
  return formatCalendarDate(
    parseCalendarDate(
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    ),
  );
}

export default function DashboardQuickIncomeDialog({
  open,
  onOpenChange,
  fortnight,
  onCreated,
}: DashboardQuickIncomeDialogProps) {
  const { context } = useFinanceContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTransferFromMember, setIsTransferFromMember] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [houseMembers, setHouseMembers] = useState<HouseUserItem[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const isHouseContext = context.type === 'house';

  useEffect(() => {
    if (!open || !isHouseContext) return;
    setLoadingMembers(true);
    clientFetchFromApi<{ users: HouseUserItem[] }>('/api/house-users', undefined, context)
      .then((data) => setHouseMembers(data.users))
      .catch(() => setHouseMembers([]))
      .finally(() => setLoadingMembers(false));
  }, [open, isHouseContext, context]);

  const form = useForm<QuickIncomeFormValues>({
    resolver: zodResolver(quickIncomeSchema),
    defaultValues: {
      source: '',
      amount: 0,
      date: getDefaultIncomeDate(
        fortnight.year,
        fortnight.month,
        fortnight.period,
      ),
    },
  });

  const handleSubmit = async (values: QuickIncomeFormValues) => {
    if (isHouseContext && isTransferFromMember && !selectedMemberId) {
      return;
    }
    setIsSubmitting(true);
    try {
      await createIncome(
        {
          fortnight_id: fortnight.id,
          amount: values.amount,
          source: values.source,
          received_at: values.date,
          ...(isHouseContext && isTransferFromMember && selectedMemberId
            ? { transfer_from_user_id: Number(selectedMemberId) }
            : {}),
        },
        context,
      );
      form.reset({
        source: '',
        amount: 0,
        date: getDefaultIncomeDate(
          fortnight.year,
          fortnight.month,
          fortnight.period,
        ),
      });
      setIsTransferFromMember(false);
      setSelectedMemberId('');
      onOpenChange(false);
      onCreated();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset({
        source: '',
        amount: 0,
        date: getDefaultIncomeDate(
          fortnight.year,
          fortnight.month,
          fortnight.period,
        ),
      });
      setIsTransferFromMember(false);
      setSelectedMemberId('');
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar ingreso — {fortnight.label}</DialogTitle>
          <DialogDescription>
            Registra un nuevo ingreso rápido para este periodo.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => {
              void handleSubmit(values);
            })}
            className="space-y-4"
          >
            {isHouseContext && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="income-transfer-from-member"
                    checked={isTransferFromMember}
                    onCheckedChange={(checked) => {
                      setIsTransferFromMember(checked === true);
                      if (checked !== true) setSelectedMemberId('');
                    }}
                    aria-label="Es transferencia de un miembro"
                  />
                  <label
                    htmlFor="income-transfer-from-member"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Es transferencia de un miembro
                  </label>
                </div>
                {isTransferFromMember && (
                  <div className="space-y-2">
                    <FormLabel>Miembro que transfiere</FormLabel>
                    <Select
                      value={selectedMemberId}
                      onValueChange={setSelectedMemberId}
                      disabled={loadingMembers}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona un miembro" />
                      </SelectTrigger>
                      <SelectContent>
                        {houseMembers.map((member) => (
                          <SelectItem
                            key={member.id}
                            value={String(member.id)}
                          >
                            {member.name}
                            {member.email ? ` (${member.email})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isTransferFromMember && !selectedMemberId && (
                      <p className="text-destructive text-xs">
                        Selecciona el miembro que transfiere a la casa.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input placeholder="Descripción del ingreso" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      {...field}
                      value={field.value || ''}
                      onChange={(event) =>
                        field.onChange(
                          parseFloat(event.target.value) || 0,
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  (isHouseContext && isTransferFromMember && !selectedMemberId)
                }
              >
                {isSubmitting ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
