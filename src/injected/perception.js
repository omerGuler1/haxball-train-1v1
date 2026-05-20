// Browser-only: ball + player sensing.

(function initPerception() {
  const cfg = window.__HB_CONFIG__;
  // Bot identified by exact name match — single bot, single name.
  const botName = String(cfg.bots?.name || "");

  function isBotPlayer(p) {
    return !!p && p.name === botName;
  }

  function getBall(room) {
    try { return room.getDiscProperties(0); } catch { return null; }
  }

  function getPlayersWithDisc(room) {
    const list = room.getPlayerList().filter((p) => p.id !== 0);
    const result = [];
    for (const p of list) {
      let disc = null;
      try { disc = room.getPlayerDiscProperties(p.id); } catch { disc = null; }
      result.push({ p, disc, isBot: isBotPlayer(p) });
    }
    return result;
  }

  function estimateBallVel(prevBall, ball) {
    if (!prevBall || !ball) return { x: 0, y: 0 };
    return { x: ball.x - prevBall.x, y: ball.y - prevBall.y };
  }

  window.__HB_PERCEPTION__ = {
    isBotPlayer,
    getBall,
    getPlayersWithDisc,
    estimateBallVel,
  };
})();
