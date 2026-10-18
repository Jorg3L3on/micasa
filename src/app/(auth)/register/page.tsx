import { Suspense } from 'react';
import type { Metadata } from 'next';

import { AuthStage } from '@/components/auth/auth-stage';
import { AuthFormSkeleton } from '@/components/auth/auth-form-kit';
import { RegisterForm } from '@/components/register-form';

export const metadata: Metadata = {
  title: 'Crear cuenta',
};

export default function RegisterPage() {
  return (
    <AuthStage eyebrow="Empieza hoy">
      <Suspense fallback={<AuthFormSkeleton />}>
        <RegisterForm />
      </Suspense>
    </AuthStage>
  );
}
