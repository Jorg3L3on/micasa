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
  var armed = typeof WeakMap === 'function' ? new WeakMap() : null;

  function isIgnorable(error) {
    if (!error || typeof error !== 'object') return false;
    var name = error.name;
    if (name !== 'InvalidStateError' && name !== 'AbortError') return false;
    var message = String(error.message || '');
    return (
      message.indexOf('invalid state') !== -1 ||
      message.indexOf('viewport size') !== -1 ||
      message.indexOf('Viewport size') !== -1 ||
      message.indexOf('visibility') !== -1
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

  window.addEventListener('unhandledrejection', function (event) {
    if (!isIgnorable(event.reason)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  function arm(promise) {
    if (!promise || typeof promise.then !== 'function') return promise;
    promise.catch(function (error) {
      if (isIgnorable(error)) return;
      window.setTimeout(function () { throw error; }, 0);
    });
    return new Proxy(promise, {
      get: function (target, prop, receiver) {
        if (prop === 'finally') {
          return function (onFinally) {
            var next = target.finally(onFinally);
            next.catch(function (error) {
              if (isIgnorable(error)) return;
              window.setTimeout(function () { throw error; }, 0);
            });
            return next;
          };
        }
        if (prop === 'then') {
          return function (onFulfilled, onRejected) {
            return target.then(onFulfilled, onRejected);
          };
        }
        if (prop === 'catch') {
          return function (onRejected) {
            return target.catch(onRejected);
          };
        }
        var value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });
  }

  function armProp(transition, prop) {
    if (!armed) return arm(transition[prop]);
    var cache = armed.get(transition);
    if (!cache) {
      cache = {};
      armed.set(transition, cache);
    }
    if (!cache[prop]) cache[prop] = arm(transition[prop]);
    return cache[prop];
  }

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
    if (resizing) return immediate(callback);
    var transition = native(callback);
    return new Proxy(transition, {
      get: function (target, prop, receiver) {
        if (prop === 'finished' || prop === 'ready' || prop === 'updateCallbackDone') {
          return armProp(target, prop);
        }
        var value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });
  }
  guarded.__micasaGuarded = true;
  document.startViewTransition = guarded;
})();`;
