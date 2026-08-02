import { redirect } from 'next/navigation';
import { getAppHomeHref } from '@/lib/fortnight-calendar';

/**
 * Legacy Inicio (`/dashboard`) — redirects to Panel financiero (current month).
 * Keeps owner context query params for bookmarks and old deep links.
 */
export default async function DashboardRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{
    ownerType?: string;
    ownerId?: string;
    [key: string]: string | undefined;
  }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  if (params.ownerType && params.ownerId) {
    query.set('ownerType', params.ownerType);
    query.set('ownerId', params.ownerId);
  }

  redirect(getAppHomeHref(query));
}
