import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/core';

import { scrubSentryEvent } from '@/lib/observability/sentry';

describe('scrubSentryEvent', () => {
  it('strips auth headers, cookies, and emails without touching user id', () => {
    const scrubbed = scrubSentryEvent({
      message: 'Failed for user.name@example.com',
      user: {
        id: '42',
        email: 'user.name@example.com',
        username: 'jorge',
        ip_address: '1.2.3.4',
      },
      request: {
        headers: {
          authorization: 'Bearer secret',
          cookie: 'session=abc',
          'content-type': 'application/json',
        },
        cookies: { session: 'abc' },
        data: { password: 'temp1234' },
        query_string: 'email=user@example.com',
      },
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Duplicate email user@example.com',
          },
        ],
      },
    } as ErrorEvent);

    expect(scrubbed.message).toBe('Failed for [email]');
    expect(scrubbed.user).toEqual({
      id: '42',
      email: undefined,
      username: undefined,
      ip_address: undefined,
    });
    expect(scrubbed.request?.headers?.authorization).toBe('[Filtered]');
    expect(scrubbed.request?.headers?.cookie).toBe('[Filtered]');
    expect(scrubbed.request?.headers?.['content-type']).toBe(
      'application/json',
    );
    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.request?.data).toBeUndefined();
    expect(scrubbed.request?.query_string).toBeUndefined();
    expect(scrubbed.exception?.values?.[0]?.value).toBe(
      'Duplicate email [email]',
    );
  });
});
