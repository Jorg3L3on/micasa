export const measure = async <T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> => {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const durationMs = performance.now() - start;
    console.log(`[perf] ${label} ${durationMs.toFixed(2)}ms`);
  }
};
