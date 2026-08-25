import { describe, expect, it } from 'vitest';
import * as apiTokenRoute from '@/app/api/oauth/token/route';
import * as rootTokenRoute from '@/app/token/route';
import * as oauthTokenRoute from '@/app/oauth/token/route';

describe('OAuth token endpoint aliases', () => {
  it('POST /token re-exports the /api/oauth/token handler', () => {
    expect(rootTokenRoute.POST).toBe(apiTokenRoute.POST);
    expect(rootTokenRoute.OPTIONS).toBe(apiTokenRoute.OPTIONS);
    expect(rootTokenRoute.GET).toBe(apiTokenRoute.GET);
  });

  it('POST /oauth/token re-exports the /api/oauth/token handler', () => {
    expect(oauthTokenRoute.POST).toBe(apiTokenRoute.POST);
    expect(oauthTokenRoute.OPTIONS).toBe(apiTokenRoute.OPTIONS);
    expect(oauthTokenRoute.GET).toBe(apiTokenRoute.GET);
  });
});
