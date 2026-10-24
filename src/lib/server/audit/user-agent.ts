/**
 * Reduces a User-Agent header to browser and OS family ("Safari · iOS"), the
 * only device detail stored on auth events. The raw string is never kept.
 */

const BROWSERS: ReadonlyArray<[RegExp, string]> = [
  [/\bEdg(e|A|iOS)?\//, 'Edge'],
  [/\bOPR\/|\bOpera\b/, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\bFirefox\/|\bFxiOS\//, 'Firefox'],
  [/\bCriOS\/|\bChrome\//, 'Chrome'],
  [/\bVersion\/[\d.]+.*\bSafari\//, 'Safari'],
  [/\bcurl\//, 'curl'],
  [/\bnode\b|\bundici\b/i, 'Node.js'],
  [/\bClaude\b/i, 'Claude'],
  [/\bChatGPT\b|\bOpenAI\b/i, 'ChatGPT'],
  [/\bCursor\b/i, 'Cursor'],
]

const SYSTEMS: ReadonlyArray<[RegExp, string]> = [
  [/\biPad\b/, 'iPadOS'],
  [/\biPhone\b|\biPod\b/, 'iOS'],
  [/\bAndroid\b/, 'Android'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
  [/\bWindows\b/, 'Windows'],
  [/\bLinux\b/, 'Linux'],
]

const firstMatch = (ua: string, table: ReadonlyArray<[RegExp, string]>) =>
  table.find(([re]) => re.test(ua))?.[1] ?? null

export const describeUserAgent = (raw: string | null | undefined): string | null => {
  const ua = raw?.trim()
  if (!ua) return null
  const browser = firstMatch(ua, BROWSERS)
  const os = firstMatch(ua, SYSTEMS)
  if (browser && os) return `${browser} · ${os}`
  return browser ?? os ?? 'Otro'
}

/** Client IP from the proxy headers (Vercel first). */
export const clientIp = (headers: Headers | null | undefined): string | null => {
  if (!headers) return null
  const forwarded =
    headers.get('x-vercel-forwarded-for') ?? headers.get('x-forwarded-for') ?? headers.get('x-real-ip')
  const first = forwarded?.split(',')[0]?.trim()
  return first ? first.slice(0, 64) : null
}
