// Browser-only utilities.

(function initUtil() {
  function createRateLimiter(minIntervalMs) {
    let last = 0;
    return function allow() {
      const now = Date.now();
      if (now - last < minIntervalMs) return false;
      last = now;
      return true;
    };
  }
  window.__HB_UTIL__ = { createRateLimiter };
})();
