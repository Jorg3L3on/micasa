import { redirect } from 'next/navigation';

export default async function SettingsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ ownerType?: string; ownerId?: string }>;
}) {
  const resolved = await searchParams;
  const params = new URLSearchParams();
  if (resolved.ownerType) params.set('ownerType', resolved.ownerType);
  if (resolved.ownerId) params.set('ownerId', resolved.ownerId);
  const qs = params.toString();
  redirect(qs ? `/settings/account?${qs}` : '/settings/account');
}
