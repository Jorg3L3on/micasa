import { PASSWORD_MIN_LENGTH } from '@/schemas/auth.schema';

export type PasswordHint = {
  /** True once the password reaches the minimum length. */
  met: boolean;
  text: string;
};

/** Live hint under the signup password: counts what is missing, then confirms. */
export const getPasswordHint = (
  length: number,
  min: number = PASSWORD_MIN_LENGTH,
): PasswordHint => {
  if (length >= min) {
    return { met: true, text: `${min} caracteres o más` };
  }
  if (length <= 0) {
    return { met: false, text: `Mínimo ${min} caracteres.` };
  }
  const missing = min - length;
  return {
    met: false,
    text:
      missing === 1
        ? `Te falta 1 carácter. Mínimo ${min}.`
        : `Te faltan ${missing} caracteres. Mínimo ${min}.`,
  };
};
