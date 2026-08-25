import { APP_TIMEZONE } from '@/lib/calendar-dates';

/**
 * Legacy `TIMESTAMP(3)` OAuth expiry columns stored Mexico City wall clock but
 * node-pg exposes those parts as UTC on the returned Date. Convert back to a
 * real UTC instant (matches migration `AT TIME ZONE 'America/Mexico_City'`).
 */
export const mexicoWallClockToUtcInstant = (stored: Date): Date => {
  const y = stored.getUTCFullYear();
  const mo = stored.getUTCMonth() + 1;
  const d = stored.getUTCDate();
  const h = stored.getUTCHours();
  const mi = stored.getUTCMinutes();
  const s = stored.getUTCSeconds();
  const ms = stored.getUTCMilliseconds();

  const probe = new Date(Date.UTC(y, mo - 1, d, h, mi, s, ms));
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  let utcMs = probe.getTime();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = formatter.formatToParts(new Date(utcMs));
    const read = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    const asUtc = Date.UTC(
      read('year'),
      read('month') - 1,
      read('day'),
      read('hour'),
      read('minute'),
      read('second'),
    );
    const desired = Date.UTC(y, mo - 1, d, h, mi, s);
    utcMs += desired - asUtc;
  }

  return new Date(utcMs + ms);
};

/** UTC instant for OAuth code/grant expiry writes (stored as timestamptz). */
export const oauthExpiresAtFromNow = (ttlMs: number, nowMs = Date.now()): Date =>
  new Date(nowMs + ttlMs);

/** True when a timestamptz (or correctly-read UTC) expiry is in the past. */
export const isOAuthExpiryPast = (
  stored: Date,
  nowMs = Date.now(),
): boolean => stored.getTime() <= nowMs;

/**
 * Simulate how node-pg returns a legacy TIMESTAMP(3) Mexico wall-clock value
 * (for tests only).
 */
export const simulateLegacyTimestampRead = (
  mexicoWallUtcInstant: Date,
): Date => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(mexicoWallUtcInstant);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return new Date(
    Date.UTC(
      read('year'),
      read('month') - 1,
      read('day'),
      read('hour'),
      read('minute'),
      read('second'),
    ),
  );
};

/** Pre-migration read path: legacy naive Mexico wall vs real UTC now. */
export const isLegacyOAuthExpiryPast = (
  stored: Date,
  nowMs = Date.now(),
): boolean => {
  if (stored.getTime() > nowMs) return false;
  return mexicoWallClockToUtcInstant(stored).getTime() <= nowMs;
};
