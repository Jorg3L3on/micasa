import { describe, expect, it } from 'vitest';
import {
  commitCurrencyDraft,
  formatCurrencyDraft,
  parseCurrencyDraft,
  sanitizeCurrencyDraft,
} from './currency-input';

describe('sanitizeCurrencyDraft', () => {
  it('keeps digits and a single decimal point', () => {
    expect(sanitizeCurrencyDraft('12.5')).toBe('12.5');
    expect(sanitizeCurrencyDraft('12.')).toBe('12.');
    expect(sanitizeCurrencyDraft('.5')).toBe('.5');
  });

  it('normalizes comma to decimal point', () => {
    expect(sanitizeCurrencyDraft('12,50')).toBe('12.50');
    expect(sanitizeCurrencyDraft(',5')).toBe('.5');
  });

  it('strips invalid characters and extra dots', () => {
    expect(sanitizeCurrencyDraft('$12.5a')).toBe('12.5');
    expect(sanitizeCurrencyDraft('1.2.3')).toBe('1.23');
  });

  it('caps fraction digits at 2', () => {
    expect(sanitizeCurrencyDraft('12.345')).toBe('12.34');
  });
});

describe('parseCurrencyDraft', () => {
  it('returns 0 for empty or lone decimal', () => {
    expect(parseCurrencyDraft('')).toBe(0);
    expect(parseCurrencyDraft('.')).toBe(0);
  });

  it('parses partial and complete decimals without wiping intermediates', () => {
    expect(parseCurrencyDraft('1.')).toBe(1);
    expect(parseCurrencyDraft('1.5')).toBe(1.5);
    expect(parseCurrencyDraft('0.01')).toBe(0.01);
  });
});

describe('commitCurrencyDraft', () => {
  it('commits trailing decimal and empty values', () => {
    expect(commitCurrencyDraft('12.')).toBe(12);
    expect(commitCurrencyDraft('')).toBe(0);
    expect(commitCurrencyDraft('.')).toBe(0);
  });

  it('clamps input to two decimal places and commits commas', () => {
    expect(commitCurrencyDraft('1.999')).toBe(1.99);
    expect(commitCurrencyDraft('12,56')).toBe(12.56);
  });
});

describe('formatCurrencyDraft', () => {
  it('shows empty for zero or invalid', () => {
    expect(formatCurrencyDraft(0)).toBe('');
    expect(formatCurrencyDraft(NaN)).toBe('');
    expect(formatCurrencyDraft(null)).toBe('');
  });

  it('formats integers and decimals without thousand separators', () => {
    expect(formatCurrencyDraft(12)).toBe('12');
    expect(formatCurrencyDraft(12.5)).toBe('12.5');
    expect(formatCurrencyDraft(1000)).toBe('1000');
  });
});
