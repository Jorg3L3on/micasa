import { describe, expect, it } from 'vitest';
import {
  canStartPullToRefresh,
  isPullToRefreshAtTop,
} from '@/components/motion/pull-to-refresh';

describe('isPullToRefreshAtTop', () => {
  it('stays true when the page and the panel are already at the top', () => {
    const root = {
      scrollTop: 0,
      parentElement: {
        scrollTop: 0,
        parentElement: null,
      },
    } as unknown as HTMLElement;

    const scrolling = { scrollTop: 0 };
    const previousDocument = globalThis.document;
    const previousGetComputedStyle = globalThis.getComputedStyle;

    globalThis.document = {
      scrollingElement: scrolling,
    } as Document;
    globalThis.getComputedStyle = () =>
      ({ overflowY: 'visible' }) as CSSStyleDeclaration;

    expect(isPullToRefreshAtTop(root)).toBe(true);

    globalThis.document = previousDocument;
    globalThis.getComputedStyle = previousGetComputedStyle;
  });

  it('stays false once a scrollable ancestor has moved', () => {
    const root = {
      scrollTop: 0,
      parentElement: {
        scrollTop: 40,
        parentElement: null,
      },
    } as unknown as HTMLElement;

    const previousDocument = globalThis.document;
    const previousGetComputedStyle = globalThis.getComputedStyle;

    globalThis.document = { scrollingElement: { scrollTop: 0 } } as Document;
    globalThis.getComputedStyle = () =>
      ({ overflowY: 'auto' }) as CSSStyleDeclaration;

    expect(isPullToRefreshAtTop(root)).toBe(false);

    globalThis.document = previousDocument;
    globalThis.getComputedStyle = previousGetComputedStyle;
  });
});

describe('canStartPullToRefresh', () => {
  it('ignores a pull that starts on a nested list still scrolled down', () => {
    const list = {
      scrollTop: 24,
      parentElement: null,
    };
    const root = {
      scrollTop: 0,
      parentElement: null,
    };
    Object.defineProperty(list, 'parentElement', { value: root });

    const previousDocument = globalThis.document;
    const previousGetComputedStyle = globalThis.getComputedStyle;

    globalThis.document = { scrollingElement: { scrollTop: 0 } } as Document;
    globalThis.getComputedStyle = ((node: { scrollTop?: number }) =>
      ({
        overflowY: node === list ? 'auto' : 'visible',
      }) as CSSStyleDeclaration) as typeof getComputedStyle;

    expect(
      canStartPullToRefresh(
        root as unknown as HTMLElement,
        list as unknown as EventTarget,
      ),
    ).toBe(false);

    globalThis.document = previousDocument;
    globalThis.getComputedStyle = previousGetComputedStyle;
  });
});
