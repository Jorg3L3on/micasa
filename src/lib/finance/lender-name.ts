export const normalizeLenderName = (name: string): string =>
  name.trim().replace(/\s+/g, ' ');

export const lenderNameKey = (name: string): string =>
  normalizeLenderName(name).toLocaleLowerCase('es-MX');
