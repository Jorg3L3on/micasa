import { describe, expect, it } from 'vitest';
import { parseCaDepartamentalStatementText } from '@/lib/server/credit-card-statement/parse-ca-departamental-statement';

const SAMPLE_WITH_PAYMENT = `
TARJETA C&A BRADESCARD
Fecha de Corte: 10/MAR/26
Fecha Límite de Pago: 03/ABR/26
PERÍODO: 11/FEB/26 - 10/MAR/26
Saldo Total: $ 1,500.00
TARJETA TITULAR NO. 1234567890123456
10/03 PAGO EN LINEA $ 800.00
15/02 COMPRA EN TIENDA $ 250.00
TOTAL:
`;

describe('parseCaDepartamentalStatementText payments', () => {
  it('includes both payment and charge in movements', () => {
    const result = parseCaDepartamentalStatementText(SAMPLE_WITH_PAYMENT);
    expect(result.movements).toHaveLength(2);
    const payment = result.movements.find((m) => m.kind === 'payment');
    const charge = result.movements.find((m) => m.kind === 'charge');
    expect(payment?.amount).toBe(800);
    expect(charge?.amount).toBe(250);
  });
});
