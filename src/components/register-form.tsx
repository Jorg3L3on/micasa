'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { ErrorBanner } from '@/components/error-banner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check } from 'lucide-react';
import {
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_TAP_TARGET_CLASS,
  AuthConsentLine,
  AuthFieldHint,
  AuthFormHeader,
  AuthPasswordInput,
  AuthPrimaryButton,
  AuthStepBar,
  AuthSwitchPrompt,
} from '@/components/auth/auth-form-kit';
import { getPasswordHint } from '@/components/auth/password-hint';
import {
  GENERIC_REGISTER_ERROR_MESSAGE,
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
  const passwordHint = getPasswordHint(
    useWatch({ control: form.control, name: 'password' })?.length ?? 0,
  );
  const existingAccount = apiError?.kind === 'existing-account';
  const emailDescribedBy =
    [errors.email && 'register-email-error', existingAccount && 'register-email-existing']
      .filter(Boolean)
      .join(' ') || undefined;

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
      <AuthStepBar className="mb-2 min-[781px]:hidden" />
      <AuthFormHeader
        title="Crear cuenta"
        eyebrow={
          <>
            <span className="min-[781px]:hidden">Paso 1 de 5 · Sigue: Billeteras</span>
            <span className="max-[780px]:hidden">Paso 1 de 5</span>
          </>
        }
        eyebrowClassName="text-caption max-[780px]:mb-3.5"
      >
        <p className="mt-1.5 text-sm leading-[1.45] text-muted-foreground min-[781px]:hidden">
          En unos 2 minutos sabrás cuánto te queda libre en cada quincena.
        </p>
      </AuthFormHeader>

      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-3.5 sm:gap-[18px]"
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
            aria-invalid={errors.email || existingAccount ? true : undefined}
            aria-describedby={emailDescribedBy}
            className={AUTH_INPUT_CLASS}
            {...form.register('email', {
              onChange: () => {
                if (existingAccount) setApiError(null);
              },
            })}
          />
          {errors.email ? (
            <AuthFieldHint id="register-email-error" tone="error">
              {errors.email.message}
            </AuthFieldHint>
          ) : null}
          {existingAccount ? (
            <p
              id="register-email-existing"
              role="alert"
              className="mt-2 text-[13px] leading-[1.45] text-status-expense"
            >
              {GENERIC_REGISTER_ERROR_MESSAGE}{' '}
              <Link
                href={loginHref}
                className={cn(
                  AUTH_TAP_TARGET_CLASS,
                  'font-semibold text-foreground underline underline-offset-[3px]',
                )}
              >
                Iniciar sesión
              </Link>
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="register-password" className={AUTH_LABEL_CLASS}>
            Contraseña
          </Label>
          <AuthPasswordInput
            id="register-password"
            autoComplete="new-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby="register-password-hint"
            {...form.register('password')}
          />
          <AuthFieldHint
            id="register-password-hint"
            tone={passwordHint.met ? 'success' : errors.password ? 'error' : 'muted'}
          >
            {passwordHint.met ? <Check aria-hidden className="size-3.5" strokeWidth={2.5} /> : null}
            <span aria-live="polite">{passwordHint.text}</span>
          </AuthFieldHint>
        </div>

        {apiError && !existingAccount ? (
          <ErrorBanner>
            {apiError.kind === 'message' ? apiError.text : null}
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
          {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta y continuar'}
        </AuthPrimaryButton>
        <AuthConsentLine />
      </form>

      {/* Phones get the login link in the header above the panel. */}
      <div className="max-[780px]:hidden">
        <AuthSwitchPrompt
          question="¿Ya tienes cuenta?"
          href={loginHref}
          linkLabel="Iniciar sesión"
        />
      </div>
      <p className="mt-auto pt-6 text-center text-caption text-muted-foreground min-[781px]:hidden">
        Gratis. Sin tarjeta y sin conectar tu banco.
      </p>
    </div>
  );
}
