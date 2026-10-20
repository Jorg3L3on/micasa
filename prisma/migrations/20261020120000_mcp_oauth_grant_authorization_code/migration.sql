-- MIC-I5-2: link each OAuth grant to the authorization code it was issued from,
-- so replaying a used code can revoke those grants (OAuth 2.1 §4.1.2).
-- Existing grants keep NULL.
ALTER TABLE "McpOAuthGrant" ADD COLUMN "authorization_code_id" INTEGER;

CREATE INDEX "McpOAuthGrant_authorization_code_id_idx" ON "McpOAuthGrant"("authorization_code_id");

ALTER TABLE "McpOAuthGrant"
ADD CONSTRAINT "McpOAuthGrant_authorization_code_id_fkey"
FOREIGN KEY ("authorization_code_id") REFERENCES "McpOAuthAuthorizationCode"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
