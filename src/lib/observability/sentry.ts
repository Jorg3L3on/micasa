import * as Sentry from '@sentry/nextjs';
import type { ErrorEvent } from '@sentry/core';

/** Shared init flags so missing DSN never breaks local/dev builds. */
export const getSentryEnabled = () => {
  const dsn =
    process.env.SENTRY_DSN?.trim() ||
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  return Boolean(dsn);
};

export const getSentryDsn = () =>
  process.env.SENTRY_DSN?.trim() ||
  process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
  undefined;

export const getSentryEnvironment = () =>
  process.env.SENTRY_ENVIRONMENT?.trim() ||
  process.env.VERCEL_ENV?.trim() ||
  process.env.NODE_ENV ||
  'development';

export type OwnerErrorContext = {
  /** Authenticated caller user id (numeric string / number only — never email). */
  userId?: number | string | null;
  ownerType?: 'user' | 'house' | string | null;
  ownerId?: number | string | null;
  /** Stable route or feature tag, e.g. `statement-import`. */
  feature?: string;
  /** Extra non-PII tags (string/number/boolean only). */
  tags?: Record<string, string | number | boolean>;
  /** Extra non-PII context bag. */
  extras?: Record<string, unknown>;
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Strip emails / auth material from event payloads before send. */
export const scrubSentryEvent = (event: ErrorEvent): ErrorEvent => {
  const clone: ErrorEvent = { ...event };

  if (clone.request) {
    const headers = { ...(clone.request.headers ?? {}) };
    for (const key of Object.keys(headers)) {
      const lower = key.toLowerCase();
      if (
        lower === 'authorization' ||
        lower === 'cookie' ||
        lower === 'set-cookie' ||
        lower === 'x-api-key'
      ) {
        headers[key] = '[Filtered]';
      }
    }
    clone.request = {
      ...clone.request,
      cookies: undefined,
      data: undefined,
      headers,
      query_string: undefined,
    };
  }

  if (clone.user) {
    clone.user = {
      id: clone.user.id,
      // Never send email / username / IP from our app identity.
      email: undefined,
      username: undefined,
      ip_address: undefined,
    };
  }

  if (typeof clone.message === 'string') {
    clone.message = clone.message.replace(EMAIL_RE, '[email]');
  }

  if (clone.exception?.values) {
    clone.exception = {
      ...clone.exception,
      values: clone.exception.values.map((value) => ({
        ...value,
        value:
          typeof value.value === 'string'
            ? value.value.replace(EMAIL_RE, '[email]')
            : value.value,
      })),
    };
  }

  return clone;
};

export const applyOwnerErrorContext = (context: OwnerErrorContext) => {
  const userId =
    context.userId == null || context.userId === ''
      ? undefined
      : String(context.userId);

  if (userId) {
    Sentry.setUser({ id: userId });
  }

  if (context.ownerType) {
    Sentry.setTag('owner_type', String(context.ownerType));
  }
  if (context.ownerId != null && context.ownerId !== '') {
    Sentry.setTag('owner_id', String(context.ownerId));
  }
  if (context.feature) {
    Sentry.setTag('feature', context.feature);
  }
  if (context.tags) {
    for (const [key, value] of Object.entries(context.tags)) {
      Sentry.setTag(key, String(value));
    }
  }
  if (context.extras) {
    Sentry.setContext('micasa', context.extras);
  }
};

/**
 * Capture a server/API failure with owner tags. Titles stay generic (error message /
 * class) — never put email or names in `feature` / tags.
 */
export const captureOwnerError = (
  error: unknown,
  context: OwnerErrorContext,
) => {
  if (!getSentryEnabled()) return;

  Sentry.withScope((scope) => {
    applyOwnerErrorContext(context);
    if (context.feature) {
      scope.setFingerprint([
        context.feature,
        error instanceof Error ? error.name : 'Error',
      ]);
    }
    Sentry.captureException(error);
  });
};

/** Shared Sentry.init options for server / edge / client. */
export const buildSentryInitOptions = (): Parameters<typeof Sentry.init>[0] => {
  const enabled = getSentryEnabled();
  return {
    dsn: getSentryDsn(),
    enabled,
    environment: getSentryEnvironment(),
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  };
};
