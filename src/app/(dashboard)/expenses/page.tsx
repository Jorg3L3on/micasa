import { redirect } from 'next/navigation';

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * /expenses was a simplified duplicate of the expense-templates catalog.
 * Redirect to the single source of truth: Plantillas de gastos.
 */
export default async function ExpensesPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, Array.isArray(value) ? value[0] : value);
    }
  });
  const qs = query.toString();
  redirect(`/expense-templates${qs ? `?${qs}` : ''}`);
}
