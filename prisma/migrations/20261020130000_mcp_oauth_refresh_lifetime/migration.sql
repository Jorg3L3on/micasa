-- MIC-I5-4: refresh tokens expire and a replayed (already rotated) refresh
-- token revokes the whole grant.
ALTER TABLE "McpOAuthGrant" ADD COLUMN "previous_refresh_token_hash" TEXT;
ALTER TABLE "McpOAuthGrant" ADD COLUMN "refresh_expires_at" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "McpOAuthGrant_previous_refresh_token_hash_key" ON "McpOAuthGrant"("previous_refresh_token_hash");

-- Existing grants: 365 days from creation (created_at is Mexico City wall time).
UPDATE "McpOAuthGrant"
SET "refresh_expires_at" = ("created_at" AT TIME ZONE 'America/Mexico_City') + INTERVAL '365 days'
WHERE "refresh_token_hash" IS NOT NULL;
