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

  it('parses EU/ES money format with comma as decimal separator', () => {
    const text = [
      'Pan integral \t1 pz $1.234,56',
      'Subtotal \t$1.234,56',
      'Total \t$1.234,56',
    ].join('\n');

    const r = parsePantryReceiptText(text);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]?.line_total).toBe(1234.56);
    expect(r.subtotal).toBe(1234.56);
    expect(r.grand_total).toBe(1234.56);
  });

  it('falls back to flat-line parsing when reconstructed text has no tabs', () => {
    const text = [
      'Manzana roja 1 kg $35.50',
      'Leche entera 2 pz $48.00',
      'Total $83.50',
    ].join('\n');

    const r = parsePantryReceiptText(text);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]?.description).toContain('Manzana roja');
    expect(r.lines[0]?.quantity).toBe(1);
    expect(r.lines[0]?.unit_label).toBe('kg');
    expect(r.lines[0]?.line_total).toBe(35.5);
    expect(r.lines[1]?.quantity).toBe(2);
    expect(r.lines[1]?.unit_label).toBe('pz');
    expect(r.grand_total).toBe(83.5);
  });

  it('joins a wrapped product description across two lines', () => {
    const text = [
      'Aceite de oliva extra',
      'virgen 500ml \t1 pz $189.90',
      'Total \t$189.90',
    ].join('\n');

    const r = parsePantryReceiptText(text);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]?.description).toContain('Aceite de oliva');
    expect(r.lines[0]?.description).toContain('virgen 500ml');
    expect(r.lines[0]?.line_total).toBe(189.9);
  });

  it('emits a structural warning when no tabs were reconstructed', () => {
    const text = ['Algo de texto', 'Sin precios ni columnas'].join('\n');
    const r = parsePantryReceiptText(text);
    expect(r.lines).toHaveLength(0);
    expect(r.warnings.some((w) => /estructura/i.test(w))).toBe(true);
  });

  it('accepts Pedido# with surrounding whitespace', () => {
    const text = ['Pedido # 1234-5678', 'Total \t$0.00'].join('\n');
    const r = parsePantryReceiptText(text);
    expect(r.merchant_ref).toBe('1234-5678');
  });
});
