#!/usr/bin/env node
/**
 * Mint (or revoke) an agent bearer token for the MCP connector (/api/mcp).
 *
 * Usage:
 *   node scripts/mint-agent-token.mjs --email you@example.com --name "Grok Bot" [--scopes read,write]
 *   node scripts/mint-agent-token.mjs --revoke <key_prefix>
 *
 * The plaintext token is printed ONCE; only its bcrypt hash is stored.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const loadEnvFile = (rel) => {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
};

loadEnvFile('.env.local');
loadEnvFile('.env');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set (checked .env.local / .env).');
  process.exit(1);
}

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
};

const TOKEN_PREFIX = 'micasa_';
const LOOKUP_LENGTH = 15; // keep in sync with src/lib/server/resolve-agent-context.ts

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const revokePrefix = getArg('--revoke');

try {
  await client.connect();

  if (revokePrefix) {
    const res = await client.query(
      'UPDATE "ApiKey" SET revoked_at = now() WHERE key_prefix = $1 AND revoked_at IS NULL RETURNING id, name',
      [revokePrefix],
    );
    if (res.rowCount === 0) {
      console.error(`No active key found with prefix ${revokePrefix}.`);
      process.exit(1);
    }
    console.log(`Revoked key "${res.rows[0].name}" (id ${res.rows[0].id}).`);
    process.exit(0);
  }

  const email = getArg('--email');
  const name = getArg('--name');
  const scopes = (getArg('--scopes') ?? 'read')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!email || !name) {
    console.error(
      'Usage: node scripts/mint-agent-token.mjs --email <email> --name <name> [--scopes read,write]',
    );
    process.exit(1);
  }

  const invalid = scopes.filter((s) => s !== 'read' && s !== 'write');
  if (invalid.length > 0) {
    console.error(`Invalid scopes: ${invalid.join(', ')} (allowed: read, write)`);
    process.exit(1);
  }

  const userRes = await client.query(
    'SELECT id, name FROM "User" WHERE email = $1 AND active = true',
    [email],
  );
  if (userRes.rowCount === 0) {
    console.error(`No active user found with email ${email}.`);
    process.exit(1);
  }
  const user = userRes.rows[0];

  const token = `${TOKEN_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
  const keyPrefix = token.slice(0, LOOKUP_LENGTH);
  const keyHash = await bcrypt.hash(token, 10);

  await client.query(
    'INSERT INTO "ApiKey" (user_id, name, key_hash, key_prefix, scopes) VALUES ($1, $2, $3, $4, $5)',
    [user.id, name, keyHash, keyPrefix, scopes],
  );

  console.log(`Agent token for ${user.name} (${email}) — "${name}"`);
  console.log(`Scopes: ${scopes.join(', ')}`);
  console.log('');
  console.log('Token (shown once, store it now):');
  console.log(`  ${token}`);
  console.log('');
  console.log(`Revoke later with: node scripts/mint-agent-token.mjs --revoke ${keyPrefix}`);
} finally {
  await client.end();
}
