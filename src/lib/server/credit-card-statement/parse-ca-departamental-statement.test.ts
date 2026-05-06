import { describe, expect, it } from 'vitest';
import { parseCaDepartamentalStatementText } from './parse-ca-departamental-statement';

/**
 * Synthetic C&A Departamental–shaped extract: layout matches real statements,
 * labels and merchants are fictional.
 */
const SAMPLE_TEXT = `
TARJETA C&A BRADESCARD

Fecha de Corte: 10/MAR/26
Fecha Límite de Pago: 03/ABR/26
PERÍODO: 11/FEB/26 - 10/MAR/26

Efectivo Disponible $ 1,410.00
Disponible para Compras $ 5,202.75
Límite de Crédito $ 5,640.00
Saldo Vencido $ 0.00
Saldo Total: $ 437.25

EN POCAS PALABRAS

Total Mes  Compras  Promociones  Otros   -Pagos   Total
Anterior                         Cargos          Del Mes
$ 48.00 $ 0.00 $ 217.00 $ 3.25 $ -48.00 $ 220.25

ELIGE 1 DE ESTAS OPCIONES
Opción 1   Opción 2
$ 220.25 $ 23.00

TARJETA TITULAR NO. 1234567890123456

15/03 COMPRA TIENDA DEMO NORTE $ 217.00
01/03 COMPRA TIENDA DEMO CUOTA $ 48.00
TOTAL: $ 265.00
`;

describe('parseCaDepartamentalStatementText', () => {
  it('extracts totalDue as the last column of EN POCAS PALABRAS ($220.25, not $437.25)', () => {
    const r = parseCaDepartamentalStatementText(SAMPLE_TEXT);
    expect(r.totalDue).toBe(220.25);
  });

  it('extracts currentBalance from Saldo Total header ($437.25)', () => {
    const r = parseCaDepartamentalStatementText(SAMPLE_TEXT);
    expect(r.currentBalance).toBe(437.25);
  });

  it('extracts minimumPayment from ELIGE 1 DE ESTAS OPCIONES ($23.00)', () => {
    const r = parseCaDepartamentalStatementText(SAMPLE_TEXT);
    expect(r.minimumPayment).toBe(23.0);
  });

  it('extracts statement dates correctly', () => {
    const r = parseCaDepartamentalStatementText(SAMPLE_TEXT);
    expect(r.statementIssueDate?.toISOString().slice(0, 10)).toBe('2026-03-10');
    expect(r.paymentDueDate?.toISOString().slice(0, 10)).toBe('2026-04-03');
    expect(r.periodStart?.toISOString().slice(0, 10)).toBe('2026-02-11');
    expect(r.periodEnd?.toISOString().slice(0, 10)).toBe('2026-03-10');
  });

  it('extracts account number', () => {
    const r = parseCaDepartamentalStatementText(SAMPLE_TEXT);
    expect(r.accountNumber).toBe('1234567890123456');
  });

  it('imports COMPRA movements', () => {
    const r = parseCaDepartamentalStatementText(SAMPLE_TEXT);
    expect(r.movements).toHaveLength(2);
    const amounts = r.movements.map((m) => m.amount).sort((a, b) => a - b);
    expect(amounts).toEqual([48.0, 217.0]);
  });

  it('does not import non-COMPRA movements', () => {
    const text = SAMPLE_TEXT.replace(/COMPRA/g, 'DISPOSICION EFTVO');
    const r = parseCaDepartamentalStatementText(text);
    expect(r.movements).toHaveLength(0);
  });
});
