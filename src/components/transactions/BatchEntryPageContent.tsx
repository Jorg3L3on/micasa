'use client';

import { useRouter } from 'next/navigation';
import { BatchEntryEditor } from '@/components/transactions/BatchEntryEditor';

/** Desktop table entry. Below `md` the same editor stacks into cards. */
export default function BatchEntryPageContent() {
  const router = useRouter();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <BatchEntryEditor
        layout="page"
        onSaved={() => router.refresh()}
        onAllSaved={() => router.push('/transactions')}
      />
    </div>
  );
}
