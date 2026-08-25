-- CreateEnum
CREATE TYPE "AgentContextOwnerType" AS ENUM ('USER', 'HOUSE');

-- CreateTable
CREATE TABLE "AgentConnectionAllowedContext" (
    "id" SERIAL NOT NULL,
    "owner_type" "AgentContextOwnerType" NOT NULL,
    "owner_id" INTEGER NOT NULL,
    "api_key_id" INTEGER,
    "oauth_grant_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('America/Mexico_City'::text, now()),

    CONSTRAINT "AgentConnectionAllowedContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpOAuthAuthorizationCodeContext" (
    "id" SERIAL NOT NULL,
    "authorization_code_id" INTEGER NOT NULL,
    "owner_type" "AgentContextOwnerType" NOT NULL,
    "owner_id" INTEGER NOT NULL,

    CONSTRAINT "McpOAuthAuthorizationCodeContext_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentConnectionAllowedContext_api_key_id_idx" ON "AgentConnectionAllowedContext"("api_key_id");

-- CreateIndex
CREATE INDEX "AgentConnectionAllowedContext_oauth_grant_id_idx" ON "AgentConnectionAllowedContext"("oauth_grant_id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentConnectionAllowedContext_api_key_id_owner_type_owner_id_key" ON "AgentConnectionAllowedContext"("api_key_id", "owner_type", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentConnectionAllowedContext_oauth_grant_id_owner_type_owner_id_key" ON "AgentConnectionAllowedContext"("oauth_grant_id", "owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "McpOAuthAuthorizationCodeContext_authorization_code_id_idx" ON "McpOAuthAuthorizationCodeContext"("authorization_code_id");

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthAuthorizationCodeContext_authorization_code_id_owner_type_owner_id_key" ON "McpOAuthAuthorizationCodeContext"("authorization_code_id", "owner_type", "owner_id");

-- AddForeignKey
ALTER TABLE "AgentConnectionAllowedContext" ADD CONSTRAINT "AgentConnectionAllowedContext_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConnectionAllowedContext" ADD CONSTRAINT "AgentConnectionAllowedContext_oauth_grant_id_fkey" FOREIGN KEY ("oauth_grant_id") REFERENCES "McpOAuthGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpOAuthAuthorizationCodeContext" ADD CONSTRAINT "McpOAuthAuthorizationCodeContext_authorization_code_id_fkey" FOREIGN KEY ("authorization_code_id") REFERENCES "McpOAuthAuthorizationCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ensure each row belongs to exactly one connection (api key XOR oauth grant).
ALTER TABLE "AgentConnectionAllowedContext" ADD CONSTRAINT "AgentConnectionAllowedContext_connection_xor_check"
  CHECK (
    ("api_key_id" IS NOT NULL AND "oauth_grant_id" IS NULL)
    OR ("api_key_id" IS NULL AND "oauth_grant_id" IS NOT NULL)
  );
