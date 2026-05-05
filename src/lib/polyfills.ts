/**
 * `Promise.try` (ES2024) — used by some dependencies. Older Node / browsers lack it.
 * Mirrors spec behavior via `Promise.resolve().then` (sync throws → rejection).
 */
if (typeof Promise !== "undefined" && typeof (Promise as { try?: unknown }).try !== "function") {
  Object.assign(Promise, {
    try(fn: (...args: unknown[]) => unknown, ...args: unknown[]) {
      return Promise.resolve().then(() => fn(...args));
    },
  });
}

export {};
