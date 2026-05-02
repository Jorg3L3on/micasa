'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { updateExpenseTemplate } from '@/lib/api/expense-templates';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import {
  expenseTemplateSchema,
  ExpenseTemplateFormValues,
} from '@/schemas/expense-template.schema';
import type {
  ExpenseTemplateListItem,
  CategoryOption,
  PaymentMethodOption,
} from '@/types/catalog';
import { ExpenseTemplateForm } from '@/components/expense-templates/ExpenseTemplateForm';

export default function EditExpenseTemplatePage() {
  const { context } = useFinanceContext();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const id = Number(params.id);
  const [template, setTemplate] = useState<ExpenseTemplateListItem | null>(
    null,
  );
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cutoffSectionOpen, setCutoffSectionOpen] = useState(false);

  const form = useForm<ExpenseTemplateFormValues>({
    resolver: zodResolver(expenseTemplateSchema),
    defaultValues: {
      name: '',
      categoryId: 0,
      suggestedAmount: null,
      paymentMethodId: null,
      active: true,
      dueDayFirst: null,
      dueDaySecond: null,
      cutoffDay: null,
      isRecurring: false,
      appliesFirstFortnight: false,
      appliesSecondFortnight: false,
      isSubscription: false,
    },
  });

  useEffect(() => {
    let isActive = true;

    if (context.id === 0) {
      return () => {
        isActive = false;
      };
    }

    const fetchData = async () => {
      try {
        if (!isActive) {
          return;
        }
        setLoading(true);
        setError(null);
        const [templatesData, categoriesData, paymentMethodsData] =
          await Promise.all([
            clientFetchFromApi<ExpenseTemplateListItem[]>(
              '/api/expense-templates',
              undefined,
              context,
            ),
            clientFetchFromApi<CategoryOption[]>('/api/categories', undefined, context),
            getPaymentMethodOptions(context),
          ]);

        if (!isActive) {
          return;
        }

        const foundTemplate = templatesData.find((t) => t.id === id);
        if (!foundTemplate) {
          setTemplate(null);
          setError('Plantilla no encontrada');
          return;
        }

        setTemplate(foundTemplate);
        setError(null);
        setCategories(categoriesData);
        setPaymentMethods(paymentMethodsData);

        // Set form values
        const paymentMethodId =
          foundTemplate.paymentMethodId != null
            ? Number(foundTemplate.paymentMethodId)
            : null;

        form.reset({
          name: foundTemplate.name,
          categoryId:
            categoriesData.find((c) => c.name === foundTemplate.category)?.id ||
            0,
          suggestedAmount: foundTemplate.suggestedAmount ?? null,
          paymentMethodId,
          active: foundTemplate.active,
          dueDayFirst: foundTemplate.dueDayFirst ?? null,
          dueDaySecond: foundTemplate.dueDaySecond ?? null,
          cutoffDay: foundTemplate.cutoffDay ?? null,
          isRecurring: foundTemplate.isRecurring ?? false,
          appliesFirstFortnight: foundTemplate.appliesFirstFortnight ?? false,
          appliesSecondFortnight: foundTemplate.appliesSecondFortnight ?? false,
          isSubscription: foundTemplate.isSubscription ?? false,
        });
        setCutoffSectionOpen(foundTemplate.cutoffDay != null);
      } catch (err) {
        if (!isActive) {
          return;
        }
        setError(
          err instanceof Error ? err.message : 'Error al cargar los datos',
        );
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      isActive = false;
    };
  }, [id, form, context]);

  const handleSubmit = async (data: ExpenseTemplateFormValues) => {
    try {
      setIsSubmitting(true);
      setError(null);
      await updateExpenseTemplate(id, data, context);
      toast.success('Plantilla de gasto actualizada');
      router.push(`/expense-templates${queryString ? `?${queryString}` : ''}`);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error al actualizar la plantilla de gasto';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-muted-foreground">Cargando...</div>
    );
  }

  if (!template) {
    return (
      <div className="space-y-6">
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error || 'Plantilla no encontrada'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <ExpenseTemplateForm
        form={form}
        title="Editar plantilla de gastos"
        description="Actualiza reglas, quincenas y valores por defecto de esta plantilla."
        submitLabel="Guardar cambios"
        isSubmitting={isSubmitting}
        categories={categories}
        paymentMethods={paymentMethods}
        cutoffSectionOpen={cutoffSectionOpen}
        onCutoffSectionOpenChange={setCutoffSectionOpen}
        onSubmit={handleSubmit}
        cancelHref={`/expense-templates${queryString ? `?${queryString}` : ''}`}
      />
    </div>
  );
}
