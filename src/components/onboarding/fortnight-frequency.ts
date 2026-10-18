export type FortnightFrequency = 'BOTH' | 'FIRST' | 'SECOND';

export const FORTNIGHT_FREQUENCY_OPTIONS: { value: FortnightFrequency; label: string }[] = [
  { value: 'BOTH', label: 'Las dos quincenas' },
  { value: 'FIRST', label: 'Solo la 1ª quincena' },
  { value: 'SECOND', label: 'Solo la 2ª quincena' },
];

export const frequencyFromFlags = (flags: {
  appliesFirstFortnight: boolean;
  appliesSecondFortnight: boolean;
}): FortnightFrequency => {
  if (flags.appliesFirstFortnight && !flags.appliesSecondFortnight) return 'FIRST';
  if (!flags.appliesFirstFortnight && flags.appliesSecondFortnight) return 'SECOND';
  return 'BOTH';
};

export const flagsFromFrequency = (frequency: FortnightFrequency) => ({
  appliesFirstFortnight: frequency !== 'SECOND',
  appliesSecondFortnight: frequency !== 'FIRST',
});

export const frequencyLabel = (frequency: FortnightFrequency): string =>
  FORTNIGHT_FREQUENCY_OPTIONS.find((option) => option.value === frequency)?.label ??
  'Las dos quincenas';

/** Compact form for summary rows: `Cada quincena`, `1ª quincena`, `2ª quincena`. */
export const frequencyShortLabel = (frequency: FortnightFrequency): string =>
  frequency === 'FIRST' ? '1ª quincena' : frequency === 'SECOND' ? '2ª quincena' : 'Cada quincena';
