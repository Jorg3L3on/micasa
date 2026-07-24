import * as Sentry from '@sentry/nextjs';

import { buildSentryInitOptions } from '@/lib/observability/sentry';

Sentry.init({
  ...buildSentryInitOptions(),
  // Browser replays optional later; keep error monitoring lean for launch.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
});
