import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * Shared field and action styles for the auth stage (login, signup).
 * The stage forces `.dark`, so these tokens resolve to the Orion palette.
 */
export const AUTH_INPUT_CLASS = cn(
  'h-auto rounded-xl border-white/[0.09] bg-white/[0.04] px-3.5 py-3 text-sm text-foreground shadow-none',
  'placeholder:text-muted-foreground/60',
  'focus-visible:border-ring/55 focus-visible:bg-white/[0.055] focus-visible:ring-[4px] focus-visible:ring-ring/15',
  'aria-invalid:border-destructive/70',
);

export const AUTH_LABEL_CLASS = 'mb-2 block text-xs font-medium text-muted-foreground';

export const AuthFormHeader = ({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) => (
  <div className="mb-8">
    <p className="mb-1.5 text-xs text-muted-foreground">{eyebrow}</p>
    <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
  </div>
);

/** Hint or validation line under an auth field. */
export const AuthFieldHint = ({
  id,
  children,
  tone = 'muted',
}: {
  id?: string;
  children: ReactNode;
  tone?: 'muted' | 'error';
}) => (
  <p
    id={id}
    className={cn(
      'mt-1.5 text-caption',
      tone === 'error' ? 'text-status-expense' : 'text-muted-foreground',
    )}
  >
    {children}
  </p>
);

/** The single primary on an auth form: electric blue pill with a sheen. */
export const AuthPrimaryButton = ({
  className,
  children,
  ...props
}: ComponentProps<'button'>) => (
  <button
    className={cn(
      'group relative mt-1.5 w-full overflow-hidden rounded-full border-0 bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground',
      'shadow-[0_8px_24px_-8px_rgba(58,55,252,0.7)] ring-1 ring-ring/40 transition-[transform,box-shadow,filter] duration-200',
      'hover:-translate-y-px hover:brightness-110 hover:shadow-[0_12px_28px_-8px_rgba(58,55,252,0.85)]',
      'active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
      'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
      'disabled:pointer-events-none disabled:opacity-60',
      className,
    )}
    {...props}
  >
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 -left-[60%] w-2/5 skew-x-[-20deg] bg-linear-to-r from-transparent via-white/35 to-transparent transition-[left] duration-700 group-hover:left-[130%] motion-reduce:hidden"
    />
    <span className="relative">{children}</span>
  </button>
);

/** "¿No tienes cuenta? Crear cuenta" style row under the divider. */
export const AuthSwitchPrompt = ({
  question,
  href,
  linkLabel,
}: {
  question: string;
  href: string;
  linkLabel: string;
}) => (
  <>
    <div className="my-[22px] h-px bg-white/[0.09]" aria-hidden />
    <p className="text-center text-[13px] text-muted-foreground">
      {question}{' '}
      <Link
        href={href}
        className="font-medium text-foreground no-underline [border-bottom:1px_solid_rgba(255,255,255,0.25)] hover:border-foreground"
      >
        {linkLabel}
      </Link>
    </p>
  </>
);

export const AuthLegalLinks = () => (
  <div className="mt-auto flex justify-center gap-2 pt-6 text-caption text-muted-foreground/70">
    <Link href="/privacy" className="no-underline hover:text-muted-foreground">
      Aviso de privacidad
    </Link>
    <span aria-hidden>·</span>
    <Link href="/terms" className="no-underline hover:text-muted-foreground">
      Términos de uso
    </Link>
  </div>
);

/** Skeleton shown while the auth form streams in (`useSearchParams`). */
export const AuthFormSkeleton = () => (
  <div className="h-[280px] animate-pulse rounded-xl bg-white/[0.04]" aria-hidden />
);
