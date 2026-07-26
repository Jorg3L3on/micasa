export const mapLoanFormIssues = <T extends string>(
  issues: Array<{ path: PropertyKey[]; message: string }>,
  fieldKeys: ReadonlySet<T>,
): Partial<Record<T | 'general', string>> => {
  const errors: Partial<Record<T | 'general', string>> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && fieldKeys.has(key as T)) {
      errors[key as T] = issue.message;
      continue;
    }
    errors.general = issue.message;
  }
  return errors;
};
