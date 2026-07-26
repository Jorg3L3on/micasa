import { Suspense } from 'react';

import { LoginStage } from '@/components/auth/login-stage';
import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <LoginStage>
      <Suspense
        fallback={
          <div
            className="h-[280px] animate-pulse rounded-xl bg-white/[0.04]"
            aria-hidden
          />
        }
      >
        <LoginForm />
      </Suspense>
    </LoginStage>
  );
}
