#!/usr/bin/env bash
# E2E: register → onboarding step 1 → complete onboarding → dashboard.
# Requires: PostgreSQL, npm run dev, playwright-cli (CODEX_HOME/skills/playwright).
# Run: bash scripts/playwright-auth-funnel.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p output/playwright

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
BASE="${PLAYWRIGHT_BASE_URL:-http://localhost:3000}"

if [[ ! -x "$PWCLI" ]]; then
  echo "playwright-cli not found at $PWCLI" >&2
  exit 1
fi

"$PWCLI" open "$BASE/register"

"$PWCLI" run-code "$(cat <<JS
const unique = \`e2e-\${Date.now()}@micasa.test\`;
const password = 'testpass1';
const base = '${BASE}';

await page.goto(\`\${base}/register\`);
await page.getByLabel('Nombre').fill('Usuario E2E');
await page.getByLabel('Correo electrónico').fill(unique);
await page.getByLabel('Contraseña', { exact: true }).fill(password);
await page.getByLabel('Confirmar contraseña').fill(password);
await page.getByRole('button', { name: 'Crear cuenta' }).click();

await page.waitForURL(/\\/onboarding/, { timeout: 30000 });

if ((await page.getByText('Paso 1 de 6').count()) < 1) {
  throw new Error('Onboarding step 1 copy not visible');
}

await page.screenshot({
  path: 'output/playwright/auth-funnel-onboarding-step1.png',
  fullPage: true,
});

const continueButton = () =>
  page.getByRole('button', { name: 'Continuar al siguiente paso' });

await continueButton().click();

await page.getByPlaceholder('Ej. Efectivo').fill('Efectivo E2E');
await page.getByPlaceholder('Ej. BBVA o cuenta de débito').fill('Debito E2E');
await continueButton().click();

await continueButton().click();

await page.locator('input[type="number"]').first().fill('10000');
await page.getByRole('combobox').first().click();
await page.getByRole('option').first().click();
await continueButton().click();

const amountInputs = page.locator('input[type="number"]');
if ((await amountInputs.count()) < 2) {
  throw new Error('Expected expense amount inputs on step 5');
}
await amountInputs.nth(0).fill('5000');
await amountInputs.nth(1).fill('3000');

const comboboxes = page.getByRole('combobox');
const comboboxCount = await comboboxes.count();
for (let i = 0; i < comboboxCount; i += 1) {
  await comboboxes.nth(i).click();
  await page.getByRole('option').first().click();
}

await continueButton().click();
await page.getByRole('button', { name: /Finalizar/i }).click();

await page.waitForURL(/\\/dashboard/, { timeout: 60000 });

await page.screenshot({
  path: 'output/playwright/auth-funnel-dashboard.png',
  fullPage: true,
});

console.log(JSON.stringify({ ok: true, email: unique, url: page.url() }));
JS
)"

echo "Auth funnel E2E passed. Screenshots in output/playwright/"
