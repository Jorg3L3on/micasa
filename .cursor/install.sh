#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for MiCasa.
# Installs PostgreSQL 16, provisions the local micasa role/db, writes a dev .env,
# installs npm dependencies, generates the Prisma client, applies migrations and
# seeds the database on a fresh install.
set -euo pipefail

DB_USER="micasa"
DB_PASS="micasa123"
DB_NAME="micasa"

# --- System dependency: PostgreSQL 16 ---
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y --no-install-recommends postgresql postgresql-contrib
fi

# --- Ensure the cluster is running (needed for migrate/seed below) ---
sudo pg_ctlcluster 16 main start || true
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done

# --- Role + database (idempotent) ---
sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
  "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${DB_USER}') THEN CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}'; END IF; END \$\$;"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
fi

# --- Local dev environment file (gitignored) ---
if [ ! -f .env ]; then
  cat > .env <<EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
NEXTAUTH_SECRET="dev-local-secret-change-me-9f2b8c1a4d7e"
NEXTAUTH_URL="http://localhost:3000"
EOF
fi

# --- Node dependencies ---
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

# --- Prisma client + schema ---
npx prisma generate
npx prisma migrate deploy

# --- Seed only when the database has no users (seed is destructive) ---
USER_COUNT=$(PGPASSWORD="${DB_PASS}" psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -tAc \
  "SELECT count(*) FROM \"User\";" 2>/dev/null || echo 0)
if [ "${USER_COUNT:-0}" = "0" ]; then
  npx prisma db seed
fi

echo "MiCasa environment ready."
