import { describe, expect, it } from 'vitest';
import { DOCUMENT_TITLE_TEMPLATE, documentTitle } from '@/lib/document-title';

describe('documentTitle', () => {
  it('keeps the MiCasa template so nested routes do not drop the prefix', () => {
    expect(documentTitle('Carteras').title).toEqual({
      default: 'Carteras',
      template: DOCUMENT_TITLE_TEMPLATE,
    });
  });
});
