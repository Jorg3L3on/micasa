import { describe, expect, it } from 'vitest';
import { parseDidiCardStatementText } from './parse-didi-card-statement';

/**
 * Synthetic statement-shaped text (amounts/layout mirror production PDFs structurally,
 * but identifiers and merchants are fictional).
 */
const SAMPLE_TEXT = `
Fecha de corte: 03 MAY. 2026
Pago mínimo: MXN$ 39.87
Periodo: 04 ABR. 2026-03 MAY. 2026
Pago para no generar intereses: MXN$ 2,657.90
Fecha límite de pago:
18 MAY. 2026
Saldo total del periodo
MXN$2,657.90
Número de contrato: 9000000000123
Este es tu estado de cuenta de MAY.

Compras y retiros de efectivo (+) Unidades: MXN$
4,602.22
Fecha del movimiento # Tarjeta Comercio Monto
02-05-2026 3295 DLO DEMO RIDES MX 48.00
30-04-2026 3295 D LOCAL*REST DEMIFOOD 475.40
15-04-2026 3295 APP DEMO-TELCO 2 658.00
08-04-2026 3295 MI DEMO APP PAY SERV 1,179.43

Intereses y comisiones (+) Unidades: MXN$
No hay movimientos en este periodo
0.00
`;

/** Layout where "Intereses y comisiones" appears before the movement table (2025+ exports). */
const NEW_LAYOUT_BEFORE_TABLE = `
DiDi Card
Este es tu estado de cuenta de MAY.
Fecha de corte: 03 MAY. 2026
Número de contrato: 9000000000999
Saldo total del periodo
MXN$100.00
Pago mínimo: MXN$ 10.00
Periodo: 04 ABR. 2026-03 MAY. 2026
Fecha límite de pago:
18 MAY. 2026

Compras y retiros de efectivo (+) Unidades: MXN$
3,396.91
Intereses y comisiones (+) Unidades: MXN$
No hay movimientos en este periodo
0.00
Pagos, reembolsos y otros ajustes (±) Unidades: MXN$
Fecha del
movimiento
# Tarjeta
Comercio Monto
08-05-2026 7901 DLO*DIDI FOODS 143.84
06-05-2026 7901 Didi Mexico 44.00

Regigold, S.A. DE C.V. recibe las consultas
`;

describe('parseDidiCardStatementText', () => {
  it('extracts statement metadata correctly', () => {
    const r = parseDidiCardStatementText(SAMPLE_TEXT);
    expect(r.accountNumber).toBe('9000000000123');
    expect(r.statementIssueDate?.toISOString().slice(0, 10)).toBe('2026-05-03');
    expect(r.paymentDueDate?.toISOString().slice(0, 10)).toBe('2026-05-18');
    expect(r.periodStart?.toISOString().slice(0, 10)).toBe('2026-04-04');
    expect(r.periodEnd?.toISOString().slice(0, 10)).toBe('2026-05-03');
    expect(r.totalDue).toBe(2657.9);
    expect(r.minimumPayment).toBe(39.87);
    expect(r.currentBalance).toBeNull();
  });

  it('extracts temporary credit limit when adjacent to label', () => {
    const text = `${SAMPLE_TEXT}\nMXN$ 2,700.00Límite temporal\n`;
    const r = parseDidiCardStatementText(text);
    expect(r.temporaryCreditLimit).toBe(2700);
  });

  it('extracts temporary credit limit after label', () => {
    const r = parseDidiCardStatementText(
      `${SAMPLE_TEXT}\nLímite temporal: MXN$ 3,100.00\n`,
    );
    expect(r.temporaryCreditLimit).toBe(3100);
  });

  it('extracts purchase movements with normalized amounts', () => {
    const r = parseDidiCardStatementText(SAMPLE_TEXT);
    expect(r.movements).toHaveLength(4);

    const ride = r.movements.find((m) => m.description.includes('DEMO RIDES'));
    expect(ride?.amount).toBe(48);
    expect(ride?.paymentDate.toISOString().slice(0, 10)).toBe('2026-05-02');

    const telcoSplitAmount = r.movements.find((m) =>
      m.description.includes('DEMO-TELCO'),
    );
    expect(telcoSplitAmount?.amount).toBe(658);
  });

  it('ignores non-movement lines and non-charge sections', () => {
    const text = SAMPLE_TEXT.replace(
      '30-04-2026 3295 D LOCAL*REST DEMIFOOD 475.40',
      'Gracias por tu pago',
    );
    const r = parseDidiCardStatementText(text);
    expect(r.movements).toHaveLength(3);
  });

  it('parses movements when unpdf-style whitespace collapse removes newlines', () => {
    const oneLineSection = `
Compras y retiros de efectivo (+) Unidades: MXN$
4,602.22
Fecha del movimiento
02-05-2026 3295 DLO DEMO RIDES MX 48.00 30-04-2026 3295 D LOCAL*REST DEMIFOOD 475.40
Intereses y comisiones (+)
`;

    const r = parseDidiCardStatementText(`
Este es tu estado de cuenta de MAY.
DiDi Card
${oneLineSection}
`);
    expect(r.movements).toHaveLength(2);
    expect(r.movements[0]?.amount).toBe(48);
    expect(r.movements[1]?.amount).toBe(475.4);
  });

  it('parses purchases when Intereses block precedes the movement table', () => {
    const r = parseDidiCardStatementText(NEW_LAYOUT_BEFORE_TABLE);
    expect(r.movements).toHaveLength(2);
    expect(r.movements[0]?.amount).toBe(143.84);
    expect(r.movements[1]?.description).toContain('Didi Mexico');
    expect(r.movements[1]?.amount).toBe(44);
  });
});
