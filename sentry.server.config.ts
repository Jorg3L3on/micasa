import * as Sentry from '@sentry/nextjs';

import { buildSentryInitOptions } from '@/lib/observability/sentry';

Sentry.init(buildSentryInitOptions());
