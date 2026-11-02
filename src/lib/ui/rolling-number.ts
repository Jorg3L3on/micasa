export type RollingChar =
  | { kind: 'digit'; digit: number; key: string }
  | { kind: 'char'; char: string; key: string };

/**
 * Splits formatted text into columns. Keys count from the right so the same
 * place value (units, tens, thousands) keeps its column when the length
 * changes and its digits roll instead of the whole string remounting.
 */
export const splitRollingChars = (text: string): RollingChar[] => {
  const chars = Array.from(text);
  return chars.map((char, index) => {
    const fromRight = chars.length - 1 - index;
    return /^[0-9]$/.test(char)
      ? { kind: 'digit', digit: Number(char), key: `d${fromRight}` }
      : { kind: 'char', char, key: `c${fromRight}` };
  });
};
