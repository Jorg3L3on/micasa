'use client';

import { forwardRef, useState, type ComponentProps, type ReactNode } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Shared field and action styles for the auth stage (login, signup).
 * The stage forces `.dark`, so these tokens resolve to the Orion palette.
 */
export const AUTH_INPUT_CLASS = cn(
  // 16px below md: iOS Safari zooms into any focused field under 16px.
  'h-auto rounded-xl border-white/[0.09] bg-white/[0.04] px-3.5 py-3 text-base text-foreground shadow-none md:text-sm',
  'placeholder:text-muted-foreground/60',
  'focus-visible:border-ring/55 focus-visible:bg-white/[0.055] focus-visible:ring-[4px] focus-visible:ring-ring/15',
  'aria-invalid:border-destructive/70',
);

/**
 * Grows a small inline link's hit area to about 44px without changing how it
 * looks (an invisible pseudo-element around the text).
 */
export const AUTH_TAP_TARGET_CLASS =
  "relative after:absolute after:-inset-x-2 after:-inset-y-3.5 after:content-['']";

export const AUTH_LABEL_CLASS = 'mb-2 block text-xs font-medium text-muted-foreground';

export const AuthFormHeader = ({
  eyebrow,
  title,
  eyebrowClassName,
  children,
}: {
  eyebrow?: ReactNode;
  title: string;
  eyebrowClassName?: string;
  /** Optional line under the title. */
  children?: ReactNode;
}) => (
  <div className="mb-6 sm:mb-7">
    {eyebrow ? (
      <p className={cn('mb-1.5 text-xs text-muted-foreground', eyebrowClassName)}>{eyebrow}</p>
    ) : null}
    <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[26px]">
      {title}
    </h1>
    {children}
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
  tone?: 'muted' | 'error' | 'success';
}) => (
  <p
    id={id}
    className={cn(
      'mt-1.5 flex items-center gap-1.5 text-caption',
      tone === 'error' && 'text-status-expense',
      tone === 'success' && 'text-status-success',
      tone === 'muted' && 'text-muted-foreground',
    )}
  >
    {children}
  </p>
);

/** The single primary on an auth form: the shared `Button` (default variant). */
export const AuthPrimaryButton = ({
  className,
  ...props
}: ComponentProps<typeof Button>) => (
  <Button
    className={cn(
      'mt-1 h-12 w-full text-sm font-semibold shadow-[0_8px_24px_-10px_rgba(58,55,252,0.8)]',
      className,
    )}
    {...props}
  />
);

/** Password field with a text toggle (Mostrar / Ocultar) for the auth stage. */
export const AuthPasswordInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn(AUTH_INPUT_CLASS, 'pr-24', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute inset-y-0.5 right-0.5 rounded-[10px] px-3.5 text-[13px] font-medium text-foreground outline-none hover:bg-white/[0.05] focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
    );
  },
);
AuthPasswordInput.displayName = 'AuthPasswordInput';

/** The five signup steps; step 1 is this form, the rest are onboarding. */
export const SIGNUP_STEPS = [
  'Crea tu cuenta',
  'Dónde guardas tu dinero',
  'Cuánto cobras',
  'Qué pagas cada quincena',
  'Tu panel, listo',
] as const;

/** Aside list of the five steps (from 781px). */
export const AuthSignupSteps = ({ current = 1 }: { current?: number }) => (
  <ol className="m-0 flex list-none flex-col gap-0.5 p-0" aria-label="Pasos para empezar">
    {SIGNUP_STEPS.map((label, i) => {
      const n = i + 1;
      const on = n === current;
      return (
        <li
          key={label}
          className="flex min-h-11 items-center gap-3"
          aria-current={on ? 'step' : undefined}
        >
          <span
            className={cn(
              'flex size-7 flex-none items-center justify-center rounded-full border text-xs font-semibold tabular-nums',
              on
                ? 'border-primary bg-primary text-primary-foreground shadow-[0_0_12px_-1px_rgba(58,55,252,0.8)]'
                : 'border-white/[0.16] text-muted-foreground',
            )}
          >
            {n}
          </span>
          <span
            className={cn('text-sm', on ? 'font-semibold text-foreground' : 'text-muted-foreground')}
          >
            {label}
          </span>
        </li>
      );
    })}
  </ol>
);

/** Five-segment progress bar shown above the form below 781px. */
export const AuthStepBar = ({
  current = 1,
  total = SIGNUP_STEPS.length,
  className,
}: {
  current?: number;
  total?: number;
  className?: string;
}) => (
  <div
    role="img"
    aria-label={`Paso ${current} de ${total}`}
    className={cn('flex gap-1', className)}
  >
    {Array.from({ length: total }, (_, i) => (
      <div
        key={i}
        className={cn(
          'h-1 flex-1 rounded-full',
          i < current
            ? 'bg-linear-to-r from-[#3a37fc] to-[#911efe] shadow-[0_0_10px_-1px_rgba(58,55,252,0.8)]'
            : 'bg-white/[0.12]',
        )}
      />
    ))}
  </div>
);

/** "Al crear tu cuenta aceptas…" line under the signup button. */
export const AuthConsentLine = ({ className }: { className?: string }) => (
  <p className={cn('text-center text-caption text-muted-foreground', className)}>
    Al crear tu cuenta aceptas los{' '}
    <Link
      href="/terms"
      className={cn(AUTH_TAP_TARGET_CLASS, 'text-foreground underline underline-offset-[3px]')}
    >
      Términos de uso
    </Link>{' '}
    y el{' '}
    <Link
      href="/privacy"
      className={cn(AUTH_TAP_TARGET_CLASS, 'text-foreground underline underline-offset-[3px]')}
    >
      Aviso de privacidad
    </Link>
    .
  </p>
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
        className={cn(
          AUTH_TAP_TARGET_CLASS,
          'font-medium text-foreground no-underline [border-bottom:1px_solid_rgba(255,255,255,0.25)] hover:border-foreground',
        )}
      >
        {linkLabel}
      </Link>
    </p>
  </>
);

export const AuthLegalLinks = () => (
  <div className="mt-auto flex justify-center gap-4 pt-6 text-caption text-muted-foreground/70">
    <Link
      href="/privacy"
      className={cn(AUTH_TAP_TARGET_CLASS, 'no-underline after:-inset-y-4 hover:text-muted-foreground')}
    >
      Aviso de privacidad
    </Link>
    <span aria-hidden>·</span>
    <Link
      href="/terms"
      className={cn(AUTH_TAP_TARGET_CLASS, 'no-underline after:-inset-y-4 hover:text-muted-foreground')}
    >
      Términos de uso
    </Link>
  </div>
);

/** Skeleton shown while the auth form streams in (`useSearchParams`). */
export const AuthFormSkeleton = () => (
  <div className="h-[280px] animate-pulse rounded-xl bg-white/[0.04]" aria-hidden />
);
