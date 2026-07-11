import { NextRequest } from 'next/server';
import { POST as nextAuthPost, GET } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/server/rate-limit';

export { GET };

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  if (url.pathname.endsWith('/callback/credentials')) {
    const limited = await enforceRateLimit(request, 'auth:login');
    if (limited) return limited;
  }

  return nextAuthPost(request);
}
