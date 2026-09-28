import { describe, expect, it } from 'vitest';
import { currentCalendarYear } from '@/lib/calendar-dates';
import { formatFortnightOrdinalTitle } from '@/lib/fortnight-calendar';
import { getPageTitle, pageTitleTooltip } from '@/components/PageTitle';

describe('pageTitleTooltip', () => {
  it('exposes the full text only when the heading is truncated', () => {
    expect(pageTitleTooltip(true, 'Primera quincena · Octubre')).toBe(
      'Primera quincena · Octubre',
    );
    expect(pageTitleTooltip(false, 'Primera quincena · Octubre')).toBeUndefined();
  });
});

describe('getPageTitle fortnight titles', () => {
  it('uses the ordinal quincena title and drops the current year', () => {
    const year = currentCalendarYear();
    const title = getPageTitle(`/fortnight/${year}/10/FIRST`).title;
    expect(title).toBe(formatFortnightOrdinalTitle('FIRST', 10, year));
    expect(title).toBe('1ª quincena · Octubre');
    expect(title).not.toContain(String(year));
    expect(getPageTitle(`/fortnight/${year}/10/FIRST`).suppressHeading).toBe(true);
  });

  it('keeps another year on the fortnight toolbar title', () => {
    expect(getPageTitle('/fortnight/2020/10/FIRST').title).toBe(
      '1ª quincena · Octubre 2020',
    );
  });
});
