import { describe, expect, it } from 'vitest';
import { parseCaDepartamentalStatementText } from '@/lib/server/credit-card-statement/parse-ca-departamental-statement';

const SAMPLE_PAYMENT_ONLY_HEADER = `
TARJETA C&A BRADESCARD
Fecha de Corte: 10/MAR/26
Fecha Límite de Pago: 03/ABR/26
Saldo Total: $ 2,400.00
Pago Mínimo: $ 480.00
TARJETA TITULAR NO. 1234567890123456
10/03 PAGO EN LINEA $ 800.00
TOTAL:
`;

describe('statement import preview content', () => {
  it('allows preview when only payments and header totals exist', () => {
    const parsed = parseCaDepartamentalStatementText(SAMPLE_PAYMENT_ONLY_HEADER);
    expect(parsed.movements.some((m) => m.kind === 'payment')).toBe(true);
    expect(parsed.totalDue).toBe(2400);
    expect(parsed.paymentDueDate).not.toBeNull();
  });
});
