import { describe, expect, it, vi } from 'vitest';

import { VIEW_TRANSITION_GUARD_SCRIPT } from '@/lib/ui/view-transition-guard';

type Deferred = {
  promise: Promise<void>;
  reject: (error: unknown) => void;
  resolve: () => void;
};

const defer = (): Deferred => {
  let reject: (error: unknown) => void = () => {};
  let resolve: () => void = () => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
};

const aborted = (message: string) =>
  Object.assign(new Error(message), { name: 'InvalidStateError' });

const install = (
  document: Record<string, unknown>,
  window: Record<string, unknown>,
) => {
  const unhandled: unknown[] = [];
  const onUnhandled = (error: unknown) => {
    unhandled.push(error);
  };
  process.on('unhandledRejection', onUnhandled);
  const context = {
    document,
    window,
    Promise,
    Proxy,
    Reflect,
    WeakMap,
    String,
  };
  const run = new Function(
    'document',
    'window',
    'Promise',
    'Proxy',
    'Reflect',
    'WeakMap',
    'String',
    VIEW_TRANSITION_GUARD_SCRIPT,
  );
  run(
    context.document,
    context.window,
    context.Promise,
    context.Proxy,
    context.Reflect,
    context.WeakMap,
    context.String,
  );
  return {
    unhandled,
    stop: () => process.off('unhandledRejection', onUnhandled),
  };
};

describe('view transition guard', () => {
  it('swallows aborted finished, ready, and updateCallbackDone rejections', async () => {
    const finished = defer();
    const ready = defer();
    const updateCallbackDone = defer();
    const native = vi.fn(() => ({
      finished: finished.promise,
      ready: ready.promise,
      updateCallbackDone: updateCallbackDone.promise,
      skipTransition: () => {},
    }));
    const listeners = new Map<string, Array<(event: unknown) => void>>();
    const window = {
      innerWidth: 390,
      innerHeight: 700,
      setTimeout,
      clearTimeout,
      addEventListener: (type: string, listener: (event: unknown) => void) => {
        const list = listeners.get(type) ?? [];
        list.push(listener);
        listeners.set(type, list);
      },
    };
    const document = { startViewTransition: native };
    const guard = install(document, window);

    const transition = (
      document.startViewTransition as (callback: () => void) => {
        finished: Promise<void> & { finally: Promise<void>['finally'] };
        ready: Promise<void>;
        updateCallbackDone: Promise<void>;
      }
    )(() => {});

    const finishedTail = transition.finished.finally(() => {});
    finished.reject(aborted('Transition was aborted because of invalid state'));
    ready.reject(aborted('Skipping view transition because viewport size changed.'));
    updateCallbackDone.reject(
      aborted('Viewport size changed'),
    );

    await expect(finishedTail).resolves.toBeUndefined();
    await expect(transition.ready).rejects.toThrow(/viewport size changed/i);
    await expect(transition.updateCallbackDone).resolves.toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 20));
    guard.stop();
    expect(guard.unhandled).toEqual([]);
    expect(native).toHaveBeenCalledOnce();
  });

  it('runs the update immediately while the viewport is resizing', () => {
    const native = vi.fn();
    const listeners = new Map<string, Array<() => void>>();
    const window = {
      innerWidth: 390,
      innerHeight: 700,
      setTimeout,
      clearTimeout,
      addEventListener: (type: string, listener: () => void) => {
        const list = listeners.get(type) ?? [];
        list.push(listener);
        listeners.set(type, list);
      },
    };
    const document = { startViewTransition: native };
    const guard = install(document, window);
    window.innerHeight = 640;
    listeners.get('resize')?.forEach((listener) => listener());

    const update = vi.fn();
    const transition = (
      document.startViewTransition as (callback: () => void) => {
        finished: Promise<void>;
      }
    )(update);

    expect(native).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledOnce();
    return transition.finished.then(() => {
      guard.stop();
    });
  });

  it('still starts a native transition when the viewport is stable', () => {
    const native = vi.fn(() => ({
      finished: Promise.resolve(),
      ready: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      skipTransition: () => {},
    }));
    const window = {
      innerWidth: 1280,
      innerHeight: 800,
      setTimeout,
      clearTimeout,
      matchMedia: () => ({ matches: true }),
      addEventListener: () => {},
    };
    const document = { startViewTransition: native };
    const guard = install(document, window);
    (document.startViewTransition as (callback: () => void) => void)(() => {});
    guard.stop();
    expect(native).toHaveBeenCalledOnce();
  });
});
