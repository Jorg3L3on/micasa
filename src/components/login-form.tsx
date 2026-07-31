'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';

const fieldInputClassName = cn(
  'h-auto rounded-xl border-white/[0.09] bg-white/[0.04] px-3.5 py-3 text-sm text-[#f4f3f8] shadow-none',
  'placeholder:text-[#55535f]',
  'focus-visible:border-[rgba(124,110,255,0.55)] focus-visible:bg-white/[0.055] focus-visible:ring-[4px] focus-visible:ring-[rgba(124,110,255,0.12)]',
);

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
        setError('Email o contraseña incorrectos');
        return;
      }

      router.push(`/dashboard${queryString ? `?${queryString}` : ''}`);
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
      <div className="mb-8">
        <p className="mb-1.5 text-xs text-[#8b899a]">Acceder a tu cuenta</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#f4f3f8]">
          Iniciar sesión
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="mb-[18px]">
          <Label
            htmlFor="email"
            className="mb-2 block text-xs font-medium text-[#8b899a]"
          >
            Correo electrónico
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="nombre@ejemplo.com"
            autoComplete="email"
            required
            className={fieldInputClassName}
          />
        </div>

        <div className="mb-[18px]">
          <Label
            htmlFor="password"
            className="mb-2 block text-xs font-medium text-[#8b899a]"
          >
            Contraseña
          </Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            className={fieldInputClassName}
          />
        </div>

        {error ? (
          <div className="mb-3 text-sm text-red-400" role="alert">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            'group relative mt-1.5 w-full overflow-hidden rounded-xl border-0 bg-linear-to-br from-[#2E8DF5] to-[#AC3DF3] px-4 py-3.5 text-sm font-semibold text-white',
            'shadow-[0_8px_24px_-8px_rgba(90,80,240,0.55)] transition-[transform,box-shadow] duration-200',
            'hover:-translate-y-px hover:shadow-[0_12px_28px_-8px_rgba(90,80,240,0.7)]',
            'active:translate-y-0',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#AC3DF3]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08080b]',
            'disabled:pointer-events-none disabled:opacity-60',
          )}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-[60%] w-2/5 skew-x-[-20deg] bg-linear-to-r from-transparent via-white/35 to-transparent transition-[left] duration-700 group-hover:left-[130%]"
          />
          <span className="relative">
            {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </span>
        </button>
      </form>

      <div className="my-[22px] flex items-center gap-2.5" aria-hidden>
        <div className="h-px flex-1 bg-white/[0.09]" />
      </div>

      <p className="text-center text-[13px] text-[#8b899a]">
        ¿No tienes cuenta?{' '}
        <Link
          href="/register"
          className="font-medium text-[#f4f3f8] no-underline [border-bottom:1px_solid_rgba(255,255,255,0.25)] hover:[border-color:#f4f3f8]"
        >
          Crear cuenta
        </Link>
      </p>

      <div className="mt-auto flex justify-center gap-2 pt-6 text-[11px] text-[#55535f]">
        <Link href="/privacy" className="text-[#55535f] no-underline hover:text-[#8b899a]">
          Aviso de privacidad
        </Link>
        <span>·</span>
        <Link href="/terms" className="text-[#55535f] no-underline hover:text-[#8b899a]">
          Términos de uso
        </Link>
      </div>
    </div>
  );
}
