import { describe, expect, it } from 'vitest';
import { parseMercadoPagoStatementText } from './parse-mercado-pago-statement';

/** Synthetic Mercado Pago–shaped extract (no real account or merchant names). */
const SAMPLE_TEXT = `
Fecha: 8 marzo 2026
Número de cuenta: 900112233
Período
8 febrero - 7 marzo
(28 días)
Total a pagar del periodo $ 1,216.46

-- 2 of 8 --

Resumen de movimientos

-- 3 of 8 --

Movimientos
MXN$
08/02 Uso de la tarjeta de crédito - $ 5,030.24
23/04 Compra en PLAZO DEMO 1 11 de 15 $ 463.96
18/10 Compra en PLAZO DEMO 2 5 de 12 $ 192.16
31/12 Compra en PLAZO DEMO 3 3 de 9 $ 380.82
08/02 Compra en BAZAR DEMO SUR $ 59.90
23/02 Compra en SERVICIO SaaS DEMO US$ 20.00 $ 344.40
Subtotal $ 1,216.46
`;

const ALT_LAYOUT = `
Mercado Pago
Fecha de emisión: 5 abril 2026
Número de cuenta: 900009999
Período 1 marzo - 31 marzo
Total a pagar del periodo $ 50.00

Movimientos
MXN$
03/03 Compra nacional DEMO SHOP $ 25.00
04/03 Retiro cajero DEMO $ 25.00
Subtotal $ 50.00
`;

describe('parseMercadoPagoStatementText', () => {
  it('parses metadata and compras from Movimientos (skips saldo inicial)', () => {
    const r = parseMercadoPagoStatementText(SAMPLE_TEXT);

    expect(r.accountNumber).toBe('900112233');
    expect(r.statementYear).toBe(2026);
    expect(r.periodStart?.toISOString().slice(0, 10)).toBe('2026-02-08');
    expect(r.periodEnd?.toISOString().slice(0, 10)).toBe('2026-03-07');
    expect(r.totalDue).toBe(1216.46);

    const descs = r.movements.map((m) => m.description);
    expect(descs.some((d) => d.includes('Uso de la tarjeta'))).toBe(false);

    expect(r.movements).toHaveLength(5);

    const bazar = r.movements.find((m) => m.description.includes('BAZAR DEMO SUR'));
    expect(bazar?.amount).toBe(59.9);
    expect(bazar?.paymentDate.toISOString().slice(0, 10)).toBe('2026-02-08');

    const saas = r.movements.find((m) => m.description.includes('SERVICIO SaaS DEMO'));
    expect(saas?.amount).toBe(344.4);

    const withInstallments = r.movements.find((m) =>
      m.description.includes('11 de 15'),
    );
    expect(withInstallments?.amount).toBe(463.96);
    expect(withInstallments?.installmentCurrent).toBe(11);
    expect(withInstallments?.installmentTotal).toBe(15);
    expect(withInstallments?.paymentDate.getUTCFullYear()).toBe(2025);
    expect(withInstallments?.paymentDate.getUTCMonth()).toBe(3);
    expect(withInstallments?.paymentDate.getUTCDate()).toBe(23);

    expect(bazar?.installmentCurrent).toBeUndefined();
    expect(bazar?.installmentTotal).toBeUndefined();
  });

  it('accepts Fecha de emisión, one-line period, Movimientos/MXN block, Compra/Retiro sin «en»', () => {
    const r = parseMercadoPagoStatementText(ALT_LAYOUT);
    expect(r.movements).toHaveLength(2);
    expect(r.movements[0]?.description).toContain('DEMO SHOP');
    expect(r.movements[0]?.amount).toBe(25);
    expect(r.movements[1]?.description.toLowerCase()).toContain('retiro');
    expect(r.statementIssueDate?.getUTCFullYear()).toBe(2026);
  });
});
