/**
 * Same-origin path safe to navigate to after login. Allows an OAuth
 * authorize URL (query may contain an https redirect_uri) and rejects
 * scheme-relative or off-site targets.
 */
export const safeCallbackPath = (
  value: string | null | undefined,
): string | null => {
  if (!value || value.length > 2048) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }

  if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;
  if (/[\r\n\0\\]/.test(decoded)) return null;

  const pathOnly = decoded.split('?')[0]?.split('#')[0] ?? '';
  if (!pathOnly.startsWith('/') || pathOnly.startsWith('//')) return null;
  if (pathOnly.includes(':') || pathOnly.includes('\\')) return null;

  return value;
};
