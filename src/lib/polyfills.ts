/**
 * `Promise.try` (ES2024) — used by some dependencies. Older Node / browsers lack it.
 * Mirrors spec behavior via `Promise.resolve().then` (sync throws → rejection).
 *
 * Loaded from `instrumentation.ts` at server boot; statement/receipt parsers also import
 * this module so `tsx`, Vitest, and any code path that skips instrumentation still works.
 *
 * Also polyfills `crypto.randomUUID` for mobile Safari / non-secure contexts (HTTP LAN)
 * where `crypto` exists but `randomUUID` is missing.
 */
if (typeof Promise !== "undefined" && typeof (Promise as { try?: unknown }).try !== "function") {
  Object.assign(Promise, {
    try(fn: (...args: unknown[]) => unknown, ...args: unknown[]) {
      return Promise.resolve().then(() => fn(...args));
    },
  });
}

function fallbackRandomUUID(): `${string}-${string}-${string}-${string}-${string}` {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  // RFC 4122 version 4
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as `${string}-${string}-${string}-${string}-${string}`;
}

const cryptoObj =
  typeof globalThis !== "undefined"
    ? (globalThis as { crypto?: Crypto }).crypto
    : undefined;

if (cryptoObj && typeof cryptoObj.randomUUID !== "function") {
  try {
    Object.defineProperty(cryptoObj, "randomUUID", {
      value: fallbackRandomUUID,
      configurable: true,
      writable: true,
    });
  } catch {
    // Some environments freeze `crypto`; callers can use `createClientId` instead.
  }
}

/** Stable client/draft id — prefers `crypto.randomUUID`, always works after polyfill attempt. */
export function createClientId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return fallbackRandomUUID();
}
