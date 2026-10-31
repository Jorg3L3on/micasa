import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearBatchReplayCache,
  getBatchReplay,
  rememberBatch,
} from './batch-idempotency';

const response = {
  results: [],
  summary: { total: 0, created: 0, failed: 0 },
};

describe('batch idempotency cache', () => {
  beforeEach(() => clearBatchReplayCache());

  it('replays within the TTL and is scoped per owner', () => {
    rememberBatch('user-1', 'k1', response, 1000);
    expect(getBatchReplay('user-1', 'k1', 2000)).toBe(response);
    expect(getBatchReplay('user-2', 'k1', 2000)).toBeNull();
  });

  it('expires entries after the TTL', () => {
    rememberBatch('user-1', 'k1', response, 0);
    expect(getBatchReplay('user-1', 'k1', 11 * 60 * 1000)).toBeNull();
  });
});
