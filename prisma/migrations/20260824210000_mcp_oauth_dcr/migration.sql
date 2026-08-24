-- CreateTable
CREATE TABLE "McpOAuthClient" (
    "id" SERIAL NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret_hash" TEXT,
    "client_name" TEXT NOT NULL,
    "redirect_uris" TEXT[],
    "grant_types" TEXT[] DEFAULT ARRAY['authorization_code', 'refresh_token']::TEXT[],
    "response_types" TEXT[] DEFAULT ARRAY['code']::TEXT[],
    "token_endpoint_auth_method" TEXT NOT NULL DEFAULT 'none',
    "client_uri" TEXT,
    "logo_uri" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('America/Mexico_City'::text, now()),

    CONSTRAINT "McpOAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpOAuthAuthorizationCode" (
    "id" SERIAL NOT NULL,
    "code_hash" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "scopes" TEXT[],
    "code_challenge" TEXT NOT NULL,
    "code_challenge_method" TEXT NOT NULL DEFAULT 'S256',
    "resource" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('America/Mexico_City'::text, now()),

    CONSTRAINT "McpOAuthAuthorizationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpOAuthGrant" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "client_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "refresh_token_hash" TEXT,
    "refresh_token_prefix" TEXT,
    "scopes" TEXT[],
    "resource" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('America/Mexico_City'::text, now()),

    CONSTRAINT "McpOAuthGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthClient_client_id_key" ON "McpOAuthClient"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthAuthorizationCode_code_hash_key" ON "McpOAuthAuthorizationCode"("code_hash");

-- CreateIndex
CREATE INDEX "McpOAuthAuthorizationCode_client_id_idx" ON "McpOAuthAuthorizationCode"("client_id");

-- CreateIndex
CREATE INDEX "McpOAuthAuthorizationCode_user_id_idx" ON "McpOAuthAuthorizationCode"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthGrant_token_prefix_key" ON "McpOAuthGrant"("token_prefix");

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthGrant_refresh_token_hash_key" ON "McpOAuthGrant"("refresh_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthGrant_refresh_token_prefix_key" ON "McpOAuthGrant"("refresh_token_prefix");

-- CreateIndex
CREATE INDEX "McpOAuthGrant_user_id_idx" ON "McpOAuthGrant"("user_id");

-- CreateIndex
CREATE INDEX "McpOAuthGrant_client_id_idx" ON "McpOAuthGrant"("client_id");

-- AddForeignKey
ALTER TABLE "McpOAuthAuthorizationCode" ADD CONSTRAINT "McpOAuthAuthorizationCode_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "McpOAuthClient"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpOAuthAuthorizationCode" ADD CONSTRAINT "McpOAuthAuthorizationCode_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpOAuthGrant" ADD CONSTRAINT "McpOAuthGrant_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "McpOAuthClient"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpOAuthGrant" ADD CONSTRAINT "McpOAuthGrant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
