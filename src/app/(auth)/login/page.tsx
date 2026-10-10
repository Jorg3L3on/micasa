import { Suspense } from 'react';
import type { Metadata } from 'next';

import { AuthStage } from '@/components/auth/auth-stage';
import { AuthFormSkeleton } from '@/components/auth/auth-form-kit';
import { LoginForm } from '@/components/login-form';

export const metadata: Metadata = {
  title: 'Iniciar sesión',
};

export default function LoginPage() {
  return (
    <AuthStage eyebrow="Bienvenido de vuelta">
      <Suspense fallback={<AuthFormSkeleton />}>
        <LoginForm />
      </Suspense>
    </AuthStage>
  );
}
