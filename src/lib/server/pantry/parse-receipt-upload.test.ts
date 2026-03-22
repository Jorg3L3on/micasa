import { describe, expect, it } from 'vitest';
import { parsePantryReceiptText } from './parse-receipt-upload';

describe('parsePantryReceiptText', () => {
  it('parses Bodega Aurrera–style tab lines with pz and kg', () => {
    const text = [
      'Frutos del huerto 500 g \t1 pz $35.00',
      'Papa blanca alfa por kilo \t0.536 kg $29.48',
      'Subtotal \t$1,206.48',
      'Total \t$1,091.44',
      'Pedido el 16 de marzo',
      'Pedido#6422648-001741',
    ].join('\n');

    const r = parsePantryReceiptText(text);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]?.description).toContain('Frutos del huerto');
    expect(r.lines[0]?.line_total).toBe(35);
    expect(r.lines[1]?.quantity).toBe(0.536);
    expect(r.lines[1]?.unit_label).toBe('kg');
    expect(r.subtotal).toBe(1206.48);
    expect(r.grand_total).toBe(1091.44);
    expect(r.merchant_ref).toBe('6422648-001741');
    expect(r.purchased_at).toBeInstanceOf(Date);
  });
});
