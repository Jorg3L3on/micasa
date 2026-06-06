#!/usr/bin/env bash
# Validates Lucide category icon picker (PRD #4) via playwright-cli.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p output/playwright

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
BASE="${PLAYWRIGHT_BASE_URL:-http://localhost:3000}"
EMAIL="${PLAYWRIGHT_EMAIL:-jorgeleon983@gmail.com}"
PASSWORD="${PLAYWRIGHT_PASSWORD:-temp1234}"
OWNER="${PLAYWRIGHT_OWNER_QUERY:-ownerType=house&ownerId=3}"
TEST_NAME="QA Icon $(date +%s)"

if ! "$PWCLI" run-code "async (page) => {
  const results = { login: false, iconPicker: false, preview: false, created: false, lucideOnExpenses: false };
  await page.goto('${BASE}/login', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill('${EMAIL}');
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('${PASSWORD}');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 180000 });
  results.login = !page.url().includes('/login');
  await page.goto('${BASE}/categories?${OWNER}', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: 'Agregar categoría' }).click();
  await page.getByRole('listbox', { name: 'Íconos de categoría' }).waitFor({ state: 'visible', timeout: 30000 });
  results.iconPicker = true;
  await page.getByRole('option', { name: 'Comida' }).click();
  results.preview = (await page.getByText('Vista previa').count()) > 0;
  await page.getByPlaceholder('Nombre de la categoría').fill('${TEST_NAME}');
  await page.getByRole('button', { name: 'Crear' }).click();
  await page.waitForTimeout(4000);
  results.created = (await page.getByText('${TEST_NAME}').count()) > 0;
  await page.screenshot({ path: 'output/playwright/categories-icon-picker.png', fullPage: true });
  await page.goto('${BASE}/expenses?${OWNER}', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(4000);
  results.lucideOnExpenses = (await page.locator('svg.lucide').count()) > 0;
  await page.screenshot({ path: 'output/playwright/expenses-category-icons.png', fullPage: true });
  const failed = Object.entries(results).filter(([, ok]) => !ok).map(([k]) => k);
  if (failed.length) throw new Error('Playwright QA failed: ' + failed.join(', '));
  console.log(JSON.stringify({ ok: true, results, testCategory: '${TEST_NAME}' }));
}"; then
  echo "Playwright run-code failed" >&2
  exit 1
fi

echo "Category icon Playwright QA passed. Screenshots: output/playwright/categories-icon-picker.png"
