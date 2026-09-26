import type { Metadata } from 'next';

export const SITE_NAME = 'MiCasa';
export const DOCUMENT_TITLE_TEMPLATE = 'MiCasa | %s';

/**
 * Nested layouts that set `title` as a string clear Next’s inherited template,
 * so child routes would render as “Carteras” instead of “MiCasa | Carteras”.
 * Keep the template on every layout that defines a page title.
 */
export const documentTitle = (
  page: string,
  extras: Omit<Metadata, 'title'> = {},
): Metadata => ({
  ...extras,
  title: {
    default: page,
    template: DOCUMENT_TITLE_TEMPLATE,
  },
});
