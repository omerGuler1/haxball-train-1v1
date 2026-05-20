// Browser-only: safe bridge back to Node via exposed function.

(function initBridge() {
  function safePost(type, payload) {
    try {
      window.__hbNodeBridgePost?.({ type, payload });
    } catch {
      // ignore — bridge is best-effort
    }
  }
  window.__HB_BRIDGE__ = { post: safePost };
})();
