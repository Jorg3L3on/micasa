'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { ErrorBanner } from '@/components/error-banner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_TAP_TARGET_CLASS,
  AuthFieldHint,
  AuthFormHeader,
  AuthLegalLinks,
  AuthPrimaryButton,
  AuthSwitchPrompt,
} from '@/components/auth/auth-form-kit';
import {
  GENERIC_REGISTER_ERROR_MESSAGE,
  PASSWORD_MIN_LENGTH,
  registerSchema,
  type RegisterValues,
} from '@/schemas/auth.schema';

const RATE_LIMIT_MESSAGE =
  'Demasiados intentos. Espera un momento e inténtalo de nuevo.';

type ApiError =
  | { kind: 'message'; text: string }
  | { kind: 'existing-account' }
  | { kind: 'sign-in-failed' };

export function RegisterForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const loginHref = `/login${queryString ? `?${queryString}` : ''}`;
  const [apiError, setApiError] = useState<ApiError | null>(null);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: { name: '', email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const handleSubmit = async (data: RegisterValues) => {
    setApiError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };

      if (res.status === 429) {
        setApiError({ kind: 'message', text: RATE_LIMIT_MESSAGE });
        return;
      }

      if (!res.ok) {
        const text = payload.error ?? GENERIC_REGISTER_ERROR_MESSAGE;
        setApiError(
          text === GENERIC_REGISTER_ERROR_MESSAGE
            ? { kind: 'existing-account' }
            : { kind: 'message', text },
        );
        return;
      }

      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setApiError({ kind: 'sign-in-failed' });
        return;
      }

      router.push(`/onboarding${queryString ? `?${queryString}` : ''}`);
      router.refresh();
    } catch (e) {
      console.error(e);
      setApiError({
        kind: 'message',
        text: 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
      });
    }
  };

  return (
    <div className={cn('flex h-full flex-col', className)} {...props}>
      <AuthFormHeader eyebrow="Gratis, en menos de un minuto" title="Crear cuenta" />

      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-[18px]"
        noValidate
      >
        <div>
          <Label htmlFor="register-name" className={AUTH_LABEL_CLASS}>
            Nombre
          </Label>
          <Input
            id="register-name"
            placeholder="¿Cómo te llamas?"
            autoComplete="given-name"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'register-name-error' : undefined}
            className={AUTH_INPUT_CLASS}
            {...form.register('name')}
          />
          {errors.name ? (
            <AuthFieldHint id="register-name-error" tone="error">
              {errors.name.message}
            </AuthFieldHint>
          ) : null}
        </div>

        <div>
          <Label htmlFor="register-email" className={AUTH_LABEL_CLASS}>
            Correo electrónico
          </Label>
          <Input
            id="register-email"
            type="email"
            inputMode="email"
            placeholder="nombre@ejemplo.com"
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'register-email-error' : undefined}
            className={AUTH_INPUT_CLASS}
            {...form.register('email')}
          />
          {errors.email ? (
            <AuthFieldHint id="register-email-error" tone="error">
              {errors.email.message}
            </AuthFieldHint>
          ) : null}
        </div>

        <div>
          <Label htmlFor="register-password" className={AUTH_LABEL_CLASS}>
            Contraseña
          </Label>
          <PasswordInput
            id="register-password"
            autoComplete="new-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby="register-password-hint"
            className={AUTH_INPUT_CLASS}
            {...form.register('password')}
          />
          <AuthFieldHint
            id="register-password-hint"
            tone={errors.password ? 'error' : 'muted'}
          >
            {errors.password?.message ?? `Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`}
          </AuthFieldHint>
        </div>

        {apiError ? (
          <ErrorBanner>
            {apiError.kind === 'message' ? apiError.text : null}
            {apiError.kind === 'existing-account' ? (
              <>
                {GENERIC_REGISTER_ERROR_MESSAGE}{' '}
                <Link href={loginHref} className={cn(AUTH_TAP_TARGET_CLASS, 'font-medium underline underline-offset-2')}>
                  Iniciar sesión
                </Link>
              </>
            ) : null}
            {apiError.kind === 'sign-in-failed' ? (
              <>
                Tu cuenta está creada, pero no pudimos entrar automáticamente.{' '}
                <Link href={loginHref} className={cn(AUTH_TAP_TARGET_CLASS, 'font-medium underline underline-offset-2')}>
                  Iniciar sesión
                </Link>
              </>
            ) : null}
          </ErrorBanner>
        ) : null}

        <AuthPrimaryButton type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </AuthPrimaryButton>
      </form>

      <AuthSwitchPrompt
        question="¿Ya tienes cuenta?"
        href={loginHref}
        linkLabel="Iniciar sesión"
      />
      <AuthLegalLinks />
    </div>
  );
}
