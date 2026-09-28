#!/usr/bin/env bash
# Validates wallet detail pages via playwright-cli. Saves screenshots to output/playwright/.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p output/playwright

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
BASE="${PLAYWRIGHT_BASE_URL:-http://localhost:3000}"
# E2E_EMAIL and E2E_PASSWORD: login for a local seeded account. Not stored in this script.
if [[ -z "${E2E_EMAIL:-}" || -z "${E2E_PASSWORD:-}" ]]; then
  echo "E2E_EMAIL and E2E_PASSWORD must be set to a local seeded account before running this script." >&2
  exit 1
fi
# PLAYWRIGHT_OWNER_QUERY: owner scope for that account, e.g. ownerType=house&ownerId=1
if [[ -z "${PLAYWRIGHT_OWNER_QUERY:-}" ]]; then
  echo "PLAYWRIGHT_OWNER_QUERY must be set (for example ownerType=house&ownerId=<house id>)." >&2
  exit 1
fi
if [[ -z "${PLAYWRIGHT_WALLET_ID:-}" || -z "${PLAYWRIGHT_WALLET_NEGATIVE_ID:-}" ]]; then
  echo "PLAYWRIGHT_WALLET_ID and PLAYWRIGHT_WALLET_NEGATIVE_ID must be set to local wallet ids." >&2
  exit 1
fi
OWNER="$PLAYWRIGHT_OWNER_QUERY"

"$PWCLI" open "$BASE/login"
"$PWCLI" snapshot >/dev/null
"$PWCLI" fill e17 "$E2E_EMAIL"
"$PWCLI" fill e21 "$E2E_PASSWORD"
"$PWCLI" click e24
sleep 8

"$PWCLI" open "$BASE/wallets?${OWNER}"
sleep 3
"$PWCLI" run-code 'await page.screenshot({ path: "output/playwright/wallet-list-after.png", fullPage: true })'

"$PWCLI" open "$BASE/wallets/${PLAYWRIGHT_WALLET_ID}?${OWNER}"
sleep 4
"$PWCLI" run-code 'await page.screenshot({ path: "output/playwright/wallet-detail-after.png", fullPage: true })'

"$PWCLI" open "$BASE/wallets/${PLAYWRIGHT_WALLET_NEGATIVE_ID}?${OWNER}"
sleep 4
"$PWCLI" run-code 'await page.screenshot({ path: "output/playwright/wallet-detail-negative.png", fullPage: true })'

"$PWCLI" run-code 'console.log(JSON.stringify({ movements: await page.getByRole("heading", { name: "Movimientos" }).count(), hero: await page.getByRole("region", { name: /Billetera/i }).count(), kpis: await page.getByRole("group", { name: "Totales del periodo" }).count() }))'

echo "Screenshots saved under output/playwright/"
