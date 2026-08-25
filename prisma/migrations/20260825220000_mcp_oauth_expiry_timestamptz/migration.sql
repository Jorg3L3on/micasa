-- OAuth expiry columns: legacy TIMESTAMP(3) stored America/Mexico_City wall clock;
-- reinterpret as timestamptz UTC without shifting valid future expiries incorrectly.

ALTER TABLE "McpOAuthAuthorizationCode"
  ALTER COLUMN "expires_at" TYPE TIMESTAMPTZ(3)
  USING "expires_at" AT TIME ZONE 'America/Mexico_City';

ALTER TABLE "McpOAuthAuthorizationCode"
  ALTER COLUMN "used_at" TYPE TIMESTAMPTZ(3)
  USING CASE
    WHEN "used_at" IS NULL THEN NULL
    ELSE "used_at" AT TIME ZONE 'America/Mexico_City'
  END;

ALTER TABLE "McpOAuthGrant"
  ALTER COLUMN "expires_at" TYPE TIMESTAMPTZ(3)
  USING CASE
    WHEN "expires_at" IS NULL THEN NULL
    ELSE "expires_at" AT TIME ZONE 'America/Mexico_City'
  END;

ALTER TABLE "McpOAuthGrant"
  ALTER COLUMN "last_used_at" TYPE TIMESTAMPTZ(3)
  USING CASE
    WHEN "last_used_at" IS NULL THEN NULL
    ELSE "last_used_at" AT TIME ZONE 'America/Mexico_City'
  END;

ALTER TABLE "McpOAuthGrant"
  ALTER COLUMN "revoked_at" TYPE TIMESTAMPTZ(3)
  USING CASE
    WHEN "revoked_at" IS NULL THEN NULL
    ELSE "revoked_at" AT TIME ZONE 'America/Mexico_City'
  END;

ALTER TABLE "McpOAuthTokenAttempt"
  ADD COLUMN "invalid_grant_reason" TEXT;
