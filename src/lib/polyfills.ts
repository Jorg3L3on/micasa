if (typeof (Promise as { try?: unknown }).try !== "function") {
  (Promise as unknown as { try: <T>(fn: (...args: unknown[]) => T | PromiseLike<T>, ...args: unknown[]) => Promise<T> }).try = function <T>(
    fn: (...args: unknown[]) => T | PromiseLike<T>,
    ...args: unknown[]
  ): Promise<T> {
    return new Promise<T>((resolve) => {
      resolve(fn(...args));
    });
  };
}

export {};
