/** `[perf]` step timings, printed only with MICASA_PERF_LOG=1 (local measurements). */
const perfLogEnabled = () => process.env.MICASA_PERF_LOG === '1';

export const measure = async <T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> => {
  if (!perfLogEnabled()) return fn();
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const durationMs = performance.now() - start;
    console.log(`[perf] ${label} ${durationMs.toFixed(2)}ms`);
  }
};
