-- CreateTable
CREATE TABLE "McpOAuthTokenAttempt" (
    "id" SERIAL NOT NULL,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "content_type" TEXT,
    "grant_type" TEXT,
    "has_code" BOOLEAN NOT NULL DEFAULT false,
    "has_verifier" BOOLEAN NOT NULL DEFAULT false,
    "has_assertion" BOOLEAN NOT NULL DEFAULT false,
    "client_id_kind" TEXT,
    "redirect_kind" TEXT,
    "resource_kind" TEXT,
    "error" TEXT,
    "http_status" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('America/Mexico_City'::text, now()),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpOAuthTokenAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "McpOAuthTokenAttempt_created_at_idx" ON "McpOAuthTokenAttempt"("created_at");
