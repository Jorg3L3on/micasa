import { redirect } from 'next/navigation';
import { getAppHomeHref } from '@/lib/fortnight-calendar';

type RedirectTasksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RedirectTasksPage({
  searchParams,
}: RedirectTasksPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(params)) {
    if (typeof rawValue === 'string') {
      query.set(key, rawValue);
      continue;
    }
    if (Array.isArray(rawValue)) {
      for (const value of rawValue) {
        query.append(key, value);
      }
    }
  }

  redirect(getAppHomeHref(query));
}
