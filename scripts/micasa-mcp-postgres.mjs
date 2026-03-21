#!/usr/bin/env node
/**
 * Cursor MCP stdio bridge: loads DATABASE_URL from project .env files (Cursor's
 * ${env:...} in mcp.json resolves against the host shell, not envFile — so args
 * were empty). This script reads .env / .env.local from the repo root, then
 * execs the read-only postgres MCP server.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const applyEnvLine = (line, set) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) return;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  if (key) set(key, val);
};

const loadEnvFile = (rel, { overrideExisting }) => {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return;
  const raw = fs.readFileSync(full, "utf8");
  for (const line of raw.split("\n")) {
    applyEnvLine(line, (key, val) => {
      if (!overrideExisting && process.env[key] !== undefined) return;
      process.env[key] = val;
    });
  }
};

// Dotenv-style: .env fills missing keys; .env.local overrides .env for local dev.
loadEnvFile(".env", { overrideExisting: false });
loadEnvFile(".env.local", { overrideExisting: true });

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error(
    "micasa-mcp-postgres: DATABASE_URL is not set. Add it to .env or .env.local in the project root.",
  );
  process.exit(1);
}

const child = spawn(
  "npx",
  ["-y", "@modelcontextprotocol/server-postgres", databaseUrl],
  {
    stdio: "inherit",
    env: process.env,
    cwd: root,
  },
);

child.on("error", (err) => {
  console.error("micasa-mcp-postgres: failed to spawn npx:", err.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
