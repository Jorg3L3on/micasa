#!/usr/bin/env bash
# Validates wallet detail pages via playwright-cli. Saves screenshots to output/playwright/.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p output/playwright

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
BASE="${PLAYWRIGHT_BASE_URL:-http://localhost:3000}"

"$PWCLI" open "$BASE/login"
"$PWCLI" snapshot >/dev/null
"$PWCLI" fill e17 "jorgeleon983@gmail.com"
"$PWCLI" fill e21 "temp1234"
"$PWCLI" click e24
sleep 8

"$PWCLI" open "$BASE/wallets?ownerType=house&ownerId=3"
sleep 3
"$PWCLI" run-code 'await page.screenshot({ path: "output/playwright/wallet-list-after.png", fullPage: true })'

"$PWCLI" open "$BASE/wallets/24?ownerType=house&ownerId=3"
sleep 4
"$PWCLI" run-code 'await page.screenshot({ path: "output/playwright/wallet-detail-after.png", fullPage: true })'

"$PWCLI" open "$BASE/wallets/23?ownerType=house&ownerId=3"
sleep 4
"$PWCLI" run-code 'await page.screenshot({ path: "output/playwright/wallet-detail-negative.png", fullPage: true })'

"$PWCLI" run-code 'console.log(JSON.stringify({ movements: await page.getByRole("heading", { name: "Movimientos" }).count(), hero: await page.getByRole("region", { name: /Billetera/i }).count(), kpis: await page.getByRole("group", { name: "Totales del periodo" }).count() }))'

echo "Screenshots saved under output/playwright/"
