import { describe, expect, it } from 'vitest';
import { currentCalendarYear } from '@/lib/calendar-dates';
import { formatFortnightToolbarTitle } from '@/lib/fortnight-calendar';
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
  it('drops the current year from the fortnight toolbar title', () => {
    const year = currentCalendarYear();
    const title = getPageTitle(`/fortnight/${year}/10/FIRST`).title;
    expect(title).toBe(formatFortnightToolbarTitle(year, 10, 'FIRST'));
    expect(title).not.toContain(String(year));
  });

  it('keeps another year on the fortnight toolbar title', () => {
    expect(getPageTitle('/fortnight/2020/10/FIRST').title).toBe(
      '30 de septiembre al 14 de octubre · 2020',
    );
  });
});
