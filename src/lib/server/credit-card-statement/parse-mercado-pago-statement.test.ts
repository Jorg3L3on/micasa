import { describe, expect, it } from 'vitest';
import { parseMercadoPagoStatementText } from './parse-mercado-pago-statement';

const SAMPLE_TEXT = `
Fecha: 8 marzo 2026
Número de cuenta: 572126643
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
23/04 Compra en MERCADO PAGO 1 11 de 15 $ 463.96
18/10 Compra en MERCADO PAGO 5 de 12 $ 192.16
31/12 Compra en MERCADO PAGO 3 de 9 $ 380.82
08/02 Compra en TODOMODA TUXTLAFASHION $ 59.90
23/02 Compra en CURSOR, AI POWERED IDE US$ 20.00 $ 344.40
Subtotal $ 1,216.46
`;

describe('parseMercadoPagoStatementText', () => {
  it('parses metadata and compras from Movimientos (skips saldo inicial)', () => {
    const r = parseMercadoPagoStatementText(SAMPLE_TEXT);

    expect(r.accountNumber).toBe('572126643');
    expect(r.statementYear).toBe(2026);
    expect(r.periodStart?.toISOString().slice(0, 10)).toBe('2026-02-08');
    expect(r.periodEnd?.toISOString().slice(0, 10)).toBe('2026-03-07');
    expect(r.totalDue).toBe(1216.46);

    const descs = r.movements.map((m) => m.description);
    expect(descs.some((d) => d.includes('Uso de la tarjeta'))).toBe(false);

    expect(r.movements).toHaveLength(5);

    const todomoda = r.movements.find((m) => m.description.includes('TODOMODA'));
    expect(todomoda?.amount).toBe(59.9);
    expect(todomoda?.paymentDate.toISOString().slice(0, 10)).toBe('2026-02-08');

    const cursor = r.movements.find((m) => m.description.includes('CURSOR'));
    expect(cursor?.amount).toBe(344.4);

    const msi = r.movements.find((m) => m.description.includes('11 de 15'));
    expect(msi?.amount).toBe(463.96);
    expect(msi?.msiCurrent).toBe(11);
    expect(msi?.msiTotal).toBe(15);
    expect(msi?.paymentDate.getUTCFullYear()).toBe(2025);
    expect(msi?.paymentDate.getUTCMonth()).toBe(3);
    expect(msi?.paymentDate.getUTCDate()).toBe(23);

    const plain = r.movements.find((m) => m.description.includes('TODOMODA'));
    expect(plain?.msiCurrent).toBeUndefined();
    expect(plain?.msiTotal).toBeUndefined();
  });
});
