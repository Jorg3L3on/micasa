import { redirect } from 'next/navigation';
import {
  scheduledListHref,
  type OwnerSearchParams,
} from '@/components/scheduled/owner-context';

/** Create and edit happen in the list's overlay (MIC-I16-4); old links land on the list. */
export default async function RetiredScheduledFormPage({
  searchParams,
}: {
  searchParams: Promise<OwnerSearchParams>;
}) {
  redirect(scheduledListHref('income', await searchParams));
}
