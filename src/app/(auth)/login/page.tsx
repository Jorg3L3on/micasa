import { Suspense } from 'react';
import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense fallback={<div className="h-[280px] animate-pulse rounded-md bg-muted" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
