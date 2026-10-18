'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

import { cn } from '@/lib/utils';
import { getAppHomeHref } from '@/lib/fortnight-calendar';
import { ErrorBanner } from '@/components/error-banner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AuthFormHeader,
  AuthLegalLinks,
  AuthPrimaryButton,
  AuthSwitchPrompt,
} from '@/components/auth/auth-form-kit';

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Correo o contraseña incorrectos.');
        return;
      }

      router.push(getAppHomeHref(queryString));
      router.refresh();
    } catch (e) {
      console.error(e);
      setError('Algo salió mal. Por favor, inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn('flex h-full flex-col', className)} {...props}>
      <AuthFormHeader eyebrow="Acceder a tu cuenta" title="Iniciar sesión" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
        <div>
          <Label htmlFor="email" className={AUTH_LABEL_CLASS}>
            Correo electrónico
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="nombre@ejemplo.com"
            autoComplete="email"
            required
            className={AUTH_INPUT_CLASS}
          />
        </div>

        <div>
          <Label htmlFor="password" className={AUTH_LABEL_CLASS}>
            Contraseña
          </Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            className={AUTH_INPUT_CLASS}
          />
        </div>

        {error ? <ErrorBanner>{error}</ErrorBanner> : null}

        <AuthPrimaryButton type="submit" disabled={isLoading}>
          {isLoading ? 'Iniciando sesión…' : 'Iniciar sesión'}
        </AuthPrimaryButton>
      </form>

      <AuthSwitchPrompt
        question="¿No tienes cuenta?"
        href={`/register${queryString ? `?${queryString}` : ''}`}
        linkLabel="Crear cuenta"
      />
      <AuthLegalLinks />
    </div>
  );
}
