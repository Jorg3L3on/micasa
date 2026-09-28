/**
 * Inline script installed before React hydrates.
 * Mobile browsers abort a view transition when the address bar changes the
 * viewport. React leaves `finished.finally()` and `updateCallbackDone`
 * rejections unhandled, which opens the Next.js error overlay.
 * This wraps `document.startViewTransition` so those aborts stay silent,
 * and skips starting a transition while the viewport is resizing.
 * Reduced motion still uses the native transition so the CSS recipes apply.
 */
export const VIEW_TRANSITION_GUARD_SCRIPT = `(function(){
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  var start = document.startViewTransition;
  if (typeof start !== 'function' || start.__micasaGuarded) return;
  var native = start.bind(document);
  var resizing = false;
  var timer = 0;
  var width = window.innerWidth;
  var height = window.innerHeight;

  function isIgnorable(error) {
    if (!error || typeof error !== 'object') return false;
    var name = error.name;
    if (name !== 'InvalidStateError' && name !== 'AbortError') return false;
    var message = String(error.message || '');
    return /viewport|visibility|view transition|invalid state|skipped|aborted/i.test(message);
  }

  function quietError() {
    var error = new Error('Skipping view transition because viewport size changed.');
    error.name = 'InvalidStateError';
    return error;
  }

  function shouldSkip() {
    return resizing || document.visibilityState === 'hidden';
  }

  function calm(promise, mode) {
    if (!promise || typeof promise.then !== 'function') return promise;
    return promise.then(
      function (value) { return value; },
      function (error) {
        if (!isIgnorable(error)) throw error;
        if (mode === 'ready') throw quietError();
        return undefined;
      }
    );
  }

  window.addEventListener('resize', function () {
    var nextWidth = window.innerWidth;
    var nextHeight = window.innerHeight;
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    resizing = true;
    window.clearTimeout(timer);
    timer = window.setTimeout(function () {
      resizing = false;
    }, 350);
  }, { passive: true });

  if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
    window.visualViewport.addEventListener('resize', function () {
      resizing = true;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        resizing = false;
      }, 350);
    }, { passive: true });
  }

  window.addEventListener('unhandledrejection', function (event) {
    if (!isIgnorable(event.reason)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  function immediate(callback) {
    var update = typeof callback === 'function' ? callback : callback && callback.update;
    var result;
    try {
      result = typeof update === 'function' ? update() : undefined;
    } catch (error) {
      var rejected = Promise.reject(error);
      rejected.catch(function () {});
      return {
        finished: rejected,
        ready: rejected,
        updateCallbackDone: rejected,
        skipTransition: function () {}
      };
    }
    var done = result && typeof result.then === 'function' ? result : Promise.resolve(result);
    var settled = done.then(function (value) { return value; }, function (error) {
      if (isIgnorable(error)) return undefined;
      throw error;
    });
    settled.catch(function () {});
    return {
      finished: settled,
      ready: Promise.resolve(),
      updateCallbackDone: settled,
      skipTransition: function () {}
    };
  }

  function guarded(callback) {
    if (shouldSkip()) return immediate(callback);
    var transition = native(callback);
    var finished = calm(transition.finished, 'settle');
    var ready = calm(transition.ready, 'ready');
    var updateCallbackDone = calm(transition.updateCallbackDone, 'settle');
    return new Proxy(transition, {
      get: function (target, prop, receiver) {
        if (prop === 'finished') return finished;
        if (prop === 'ready') return ready;
        if (prop === 'updateCallbackDone') return updateCallbackDone;
        var value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });
  }
  guarded.__micasaGuarded = true;
  document.startViewTransition = guarded;
})();`;
