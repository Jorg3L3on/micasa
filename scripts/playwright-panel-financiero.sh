#!/usr/bin/env bash
# Validates Panel financiero UI restructure (resumen + view controls) via playwright-cli.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p output/playwright

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
BASE="${PLAYWRIGHT_BASE_URL:-http://localhost:3000}"
EMAIL="${PLAYWRIGHT_EMAIL:-jorgeleon983@gmail.com}"
PASSWORD="${PLAYWRIGHT_PASSWORD:-temp1234}"
OWNER="${PLAYWRIGHT_OWNER_QUERY:-ownerType=house&ownerId=3}"

run_pw() {
  local out
  out=$("$PWCLI" "$@" 2>&1) || true
  if echo "$out" | grep -qE '^### Error'; then
    echo "$out" >&2
    return 1
  fi
  echo "$out"
  return 0
}

YEAR=$(date +%Y)
MONTH=$(date +%m | sed 's/^0//')
MONTH_PAD=$(printf '%02d' "$MONTH")
MONTHLY_URL="${BASE}/monthly/${YEAR}/${MONTH_PAD}?${OWNER}"

run_pw open "${BASE}/login"
sleep 2
run_pw snapshot >/dev/null
run_pw fill e17 "$EMAIL"
run_pw fill e21 "$PASSWORD"
run_pw click e24
sleep 15

run_pw open "$MONTHLY_URL"
sleep 8

ASSERT_SCRIPT='async (page) => {
  const results = {
    monthlyPage: page.url().includes("/monthly/"),
    resumenTitle: (await page.getByText(/Resumen de la [12]ª quincena/).count()) > 0,
    quincenaControls: (await page.getByRole("group", { name: "Quincena" }).count()) > 0,
    periodoControls: (await page.getByRole("group", { name: "Período" }).count()) > 0,
    viewOptionsMenu: (await page.getByRole("button", { name: "Opciones adicionales de vista" }).count()) > 0,
    ingresosKpi: (await page.getByText("Ingresos del periodo").count()) > 0,
    incomeRing: (await page.getByText("del ingreso").count()) > 0,
  };
  await page.screenshot({ path: "output/playwright/panel-financiero-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  results.mobileViewport =
    (await page.getByText("Ingresos del periodo").count()) > 0 &&
    (await page.getByRole("group", { name: "Quincena" }).count()) > 0;
  await page.screenshot({ path: "output/playwright/panel-financiero-mobile.png", fullPage: true });
  const failed = Object.entries(results).filter(([, ok]) => !ok).map(([k]) => k);
  if (failed.length) throw new Error("Playwright QA failed: " + failed.join(", "));
  console.log(JSON.stringify({ ok: true, results, url: page.url() }));
}'

run_pw run-code "$ASSERT_SCRIPT"

if [[ ! -f output/playwright/panel-financiero-desktop.png ]]; then
  echo "Missing desktop screenshot" >&2
  exit 1
fi

echo "Panel financiero Playwright QA passed."
echo "Screenshots: output/playwright/panel-financiero-desktop.png output/playwright/panel-financiero-mobile.png"
