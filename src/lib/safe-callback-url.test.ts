import { describe, expect, it } from 'vitest';
import { safeCallbackPath } from '@/lib/safe-callback-url';

describe('safeCallbackPath', () => {
  it('keeps the authorize URL, including an https redirect_uri in the query', () => {
    const path =
      '/api/oauth/authorize?response_type=code&redirect_uri=https%3A%2F%2Fclient.example.test%2Fcb';
    expect(safeCallbackPath(path)).toBe(path);
    expect(
      safeCallbackPath(
        '/api/oauth/authorize?redirect_uri=https://client.example.test/cb',
      ),
    ).toContain('client.example.test');
  });

  it.each([
    null,
    '',
    'https://client.example.test/cb',
    '//client.example.test/cb',
    '/\\client.example.test',
    '/%2F%2Fclient.example.test',
  ])('rejects %s', (value) => {
    expect(safeCallbackPath(value)).toBeNull();
  });
});
