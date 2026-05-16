export type MonthlyRouteParams = {
  year: number;
  month: number;
};

export type MonthlyRouteParamResult =
  | { ok: true; value: MonthlyRouteParams }
  | { ok: false; reason: 'invalid-year' | 'invalid-month' };

export function parseMonthlyRouteParams(
  yearParam: string,
  monthParam: string,
): MonthlyRouteParamResult {
  if (!/^\d{4}$/.test(yearParam)) {
    return { ok: false, reason: 'invalid-year' };
  }
  if (!/^\d{1,2}$/.test(monthParam)) {
    return { ok: false, reason: 'invalid-month' };
  }

  const year = Number(yearParam);
  const month = Number(monthParam);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { ok: false, reason: 'invalid-year' };
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, reason: 'invalid-month' };
  }

  return { ok: true, value: { year, month } };
}

export function getMonthlyPreferenceScope(
  ownerKey: string,
  year: number,
  month: number,
): string {
  return `${ownerKey}:${year}-${String(month).padStart(2, '0')}`;
}
