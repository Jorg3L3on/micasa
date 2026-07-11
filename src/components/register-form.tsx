'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { PasswordInput } from '@/components/ui/password-input';
import {
  GENERIC_REGISTER_ERROR_MESSAGE,
  registerSchema,
  RegisterValues,
} from '@/schemas/auth.schema';

const RATE_LIMIT_MESSAGE =
  'Demasiados intentos. Espera un momento e inténtalo de nuevo.';

export function RegisterForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [apiError, setApiError] = useState<string | null>(null);
  const [autoSignInFailed, setAutoSignInFailed] = useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const handleSubmit = async (data: RegisterValues) => {
    setApiError(null);
    setAutoSignInFailed(false);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const payload = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setApiError(RATE_LIMIT_MESSAGE);
        return;
      }

      if (!res.ok) {
        setApiError(payload.error ?? GENERIC_REGISTER_ERROR_MESSAGE);
        return;
      }

      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setAutoSignInFailed(true);
        setApiError(
          'Cuenta creada, pero no pudimos iniciar sesión automáticamente.'
        );
        return;
      }

      const onboardingPath = `/onboarding${queryString ? `?${queryString}` : ''}`;
      router.push(onboardingPath);
      router.refresh();
    } catch (e) {
      console.error(e);
      setApiError('Algo salió mal. Por favor, inténtalo de nuevo.');
    }
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="flex flex-col gap-1">
            <div className="flex flex-col items-center gap-4">
              <Link
                href="/"
                className="flex flex-col items-center gap-2 font-medium"
              >
                <div className="flex h-24 w-60 items-center justify-center rounded-md">
                  <Image
                    src="/logo-black.svg"
                    alt="MiCasa logo"
                    width={240}
                    height={76}
                    className="h-auto w-60"
                    unoptimized
                  />
                </div>
                <span className="sr-only">MiCasa</span>
              </Link>
              <h1 className="text-xl font-bold">Crear cuenta</h1>
            </div>
            <div className="flex flex-col gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Tu nombre"
                        autoComplete="name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo electrónico</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="m@ejemplo.com"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar contraseña</FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {apiError && (
                <div className="text-sm text-red-500" role="alert">
                  {apiError}
                  {autoSignInFailed && (
                    <p className="mt-2">
                      <Link
                        href="/login"
                        className="underline hover:text-foreground"
                      >
                        Iniciar sesión
                      </Link>
                    </p>
                  )}
                  {!autoSignInFailed &&
                    apiError === GENERIC_REGISTER_ERROR_MESSAGE && (
                      <p className="mt-2 text-muted-foreground">
                        ¿Ya tienes cuenta?{' '}
                        <Link
                          href="/login"
                          className="underline hover:text-foreground"
                        >
                          Iniciar sesión
                        </Link>
                      </p>
                    )}
                </div>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting
                  ? 'Creando cuenta...'
                  : 'Crear cuenta'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                ¿Ya tienes cuenta?{' '}
                <Link
                  href="/login"
                  className="underline hover:text-foreground"
                >
                  Iniciar sesión
                </Link>
              </p>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
