'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { createExpenseTemplate } from '@/lib/api/expense-templates';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import {
  expenseTemplateSchema,
  ExpenseTemplateFormValues,
} from '@/schemas/expense-template.schema';
import type { CategoryOption, PaymentMethodOption } from '@/types/catalog';
import { ExpenseTemplateForm } from '@/components/expense-templates/ExpenseTemplateForm';

export default function NewExpenseTemplatePage() {
  const { context } = useFinanceContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    const fetchData = async () => {
      try {
        setLoading(true);
        const [categoriesData, paymentMethodsData] = await Promise.all([
          clientFetchFromApi<CategoryOption[]>('/api/categories', undefined, context),
          getPaymentMethodOptions(context),
        ]);
        setCategories(categoriesData);
        setPaymentMethods(paymentMethodsData);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Error al cargar los datos';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [context]);

  const getErrorMessage = (err: unknown): string => {
    if (!(err instanceof Error)) {
      return 'Error al crear la plantilla de gasto';
    }

    // Check if error has details (validation errors)
    const errorWithDetails = err as any;
    if (
      errorWithDetails.details &&
      Array.isArray(errorWithDetails.details) &&
      errorWithDetails.details.length > 0
    ) {
      // Map field names to Spanish
      const fieldNames: Record<string, string> = {
        name: 'Nombre',
        categoryId: 'Categoría',
        suggestedAmount: 'Monto por defecto',
        paymentMethodId: 'Método de pago',
        dueDayFirst: 'Vencimiento 1ª quincena',
        dueDaySecond: 'Vencimiento 2ª quincena',
        cutoffDay: 'Día de corte',
        isRecurring: 'Recurrente',
        appliesFirstFortnight: 'Primera quincena',
        appliesSecondFortnight: 'Segunda quincena',
        isSubscription: 'Suscripción',
      };

      // Format validation errors
      const messages = errorWithDetails.details.map((issue: any) => {
        const fieldName =
          fieldNames[issue.path?.[0]] || issue.path?.[0] || 'Campo';
        let message = issue.message || '';

        // Translate common validation messages
        if (message.includes('Required') || message.includes('required')) {
          message = 'es requerido';
        } else if (message.includes('Expected')) {
          message = 'tiene un formato inválido';
        } else if (message.includes('positive')) {
          message = 'debe ser un número positivo';
        } else if (message.includes('int')) {
          message = 'debe ser un número entero';
        } else if (message.includes('Invalid')) {
          message = 'tiene un valor inválido';
        }

        return `${fieldName} ${message}`;
      });

      return messages.join('. ');
    }

    // Check for specific error messages and translate them
    const errorMessage = err.message;
    if (errorMessage.includes('Validation error')) {
      return 'Por favor, verifica los campos del formulario';
    }
    if (errorMessage.includes('already exists')) {
      return 'Ya existe una plantilla con este nombre';
    }
    if (errorMessage.includes('Failed to create')) {
      return 'Error al crear la plantilla de gasto';
    }

    return errorMessage || 'Error al crear la plantilla de gasto';
  };

  const handleSubmit = async (data: ExpenseTemplateFormValues) => {
    try {
      setIsSubmitting(true);
      await createExpenseTemplate(data, context);
      toast.success('Plantilla de gasto creada exitosamente');
      setTimeout(() => {
        router.push(`/expense-templates${queryString ? `?${queryString}` : ''}`);
      }, 500);
    } catch (err) {
      const message = getErrorMessage(err);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-muted-foreground">Cargando...</div>
    );
  }

  return (
    <ExpenseTemplateForm
      form={form}
      title="Nueva plantilla de gastos"
      description="Configura una plantilla reutilizable para registrar gastos mas rapido."
      submitLabel="Crear plantilla"
      isSubmitting={isSubmitting}
      categories={categories}
      paymentMethods={paymentMethods}
      cutoffSectionOpen={cutoffSectionOpen}
      onCutoffSectionOpenChange={setCutoffSectionOpen}
      onSubmit={handleSubmit}
      cancelHref={`/expense-templates${queryString ? `?${queryString}` : ''}`}
    />
  );
}
