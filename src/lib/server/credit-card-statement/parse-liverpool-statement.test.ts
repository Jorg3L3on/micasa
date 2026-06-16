import { describe, expect, it } from 'vitest';
import {
  decodeLiverpoolAmountToken,
  decodeLiverpoolNumericToken,
} from './liverpool-statement-encoding';
import {
  parseLiverpoolObfuscatedDate,
  parseLiverpoolStatementText,
} from './parse-liverpool-statement';

/** Synthetic decoded text — amounts and account are fictional, not from a real statement. */
const SAMPLE_TEXT = `
FECHA LuMITE DE PAGOp4\`QUN\`1p15FECHA DE CORTEp4\`MAY\`1p15NOK DE CUENTA01pppp01234567
PAGO MuNIMO \\70K14PAGO PARA NO GENERAR INTEREbEb701K4p
bALDO ACTUAL AL CORTE21ppKpp
DETALLE DE MOVIMIENTOb DEL p5\`ABR\`1p15 AL p4\`MAY\`1p15
2p\`ABRGRACIAb POR bU PAGO\`401Kpp
04\`ABR\`DEMO COMERCIO EN LINEA701K4p
REbUMEN DE PLANES
`;

describe('liverpool-statement-encoding', () => {
  it('decodes obfuscated amount tokens', () => {
    expect(decodeLiverpoolAmountToken('701K4p')).toBe(812.5);
    expect(decodeLiverpoolAmountToken('\\70K14')).toBe(81.25);
    expect(decodeLiverpoolAmountToken('21ppKpp')).toBe(3200);
    expect(decodeLiverpoolAmountToken('`401Kpp')).toBe(-512);
  });

  it('decodes obfuscated numeric tokens', () => {
    expect(decodeLiverpoolNumericToken('p4')).toBe('05');
    expect(decodeLiverpoolNumericToken('1p15')).toBe('2026');
    expect(decodeLiverpoolNumericToken('01pppp01234567')).toBe('12000012345678');
  });
});

describe('parseLiverpoolStatementText', () => {
  it('extracts statement metadata from decoded text', () => {
    const r = parseLiverpoolStatementText(SAMPLE_TEXT);
    expect(r.accountNumber).toBe('12-000-012345678');
    expect(r.statementIssueDate?.toISOString().slice(0, 10)).toBe('2026-05-05');
    expect(r.paymentDueDate?.toISOString().slice(0, 10)).toBe('2026-06-05');
    expect(r.periodStart?.toISOString().slice(0, 10)).toBe('2026-04-06');
    expect(r.periodEnd?.toISOString().slice(0, 10)).toBe('2026-05-05');
    expect(r.totalDue).toBe(812.5);
    expect(r.minimumPayment).toBe(81.25);
    expect(r.currentBalance).toBe(3200);
  });

  it('imports purchases and skips payments', () => {
    const r = parseLiverpoolStatementText(SAMPLE_TEXT);
    expect(r.movements).toHaveLength(1);
    expect(r.movements[0]?.description).toContain('DEMO COMERCIO');
    expect(r.movements[0]?.amount).toBe(812.5);
    expect(r.movements[0]?.paymentDate.toISOString().slice(0, 10)).toBe('2026-04-15');
  });

  it('parses obfuscated date triples', () => {
    const d = parseLiverpoolObfuscatedDate('p4', 'MAY', '1p15');
    expect(d?.toISOString().slice(0, 10)).toBe('2026-05-05');
  });

  it('parses every supported Liverpool month token', () => {
    const cases: Array<[string, string]> = [
      ['ENE', '2026-01-01'],
      ['FEB', '2026-02-01'],
      ['MAR', '2026-03-01'],
      ['ABR', '2026-04-01'],
      ['MAY', '2026-05-01'],
      ['JUN', '2026-06-01'],
      ['QUN', '2026-06-01'],
      ['JUL', '2026-07-01'],
      ['QUL', '2026-07-01'],
      ['AGO', '2026-08-01'],
      ['SEP', '2026-09-01'],
      ['OCT', '2026-10-01'],
      ['NOV', '2026-11-01'],
      ['DIC', '2026-12-01'],
    ];

    for (const [token, expected] of cases) {
      const d = parseLiverpoolObfuscatedDate('p0', token, '1p15');
      expect(d?.toISOString().slice(0, 10)).toBe(expected);
    }
  });

  it('extracts a July payment due date from Liverpool QUL token', () => {
    const r = parseLiverpoolStatementText(
      'FECHA LuMITE DE PAGO02`QUL`1p15FECHA DE CORTE02`QUN`1p15',
    );

    expect(r.paymentDueDate?.toISOString().slice(0, 10)).toBe('2026-07-13');
    expect(r.statementIssueDate?.toISOString().slice(0, 10)).toBe('2026-06-13');
  });
});
