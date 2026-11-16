import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthStage } from '@/components/auth/auth-stage';
import {
  AUTH_TAP_TARGET_CLASS,
  AuthFormSkeleton,
  AuthSignupSteps,
} from '@/components/auth/auth-form-kit';
import { RegisterForm } from '@/components/register-form';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Crear cuenta',
};

type RegisterPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value ? [value] : []) query.append(key, v);
  }
  const loginHref = `/login${query.size ? `?${query}` : ''}`;

  return (
    <AuthStage
      eyebrow="Empieza hoy"
      description="En unos 2 minutos sabrás cuánto te queda libre en cada quincena."
      aside={
        <>
          <AuthSignupSteps current={1} />
          <p className="mt-auto pt-7 text-caption text-muted-foreground">
            Gratis. Sin tarjeta y sin conectar tu banco.
          </p>
        </>
      }
      mobileHeader={
        <Link
          href={loginHref}
          className={cn(
            AUTH_TAP_TARGET_CLASS,
            'text-[13px] font-medium text-foreground underline underline-offset-[3px]',
          )}
        >
          Iniciar sesión
        </Link>
      }
    >
      <Suspense fallback={<AuthFormSkeleton />}>
        <RegisterForm />
      </Suspense>
    </AuthStage>
  );
}
