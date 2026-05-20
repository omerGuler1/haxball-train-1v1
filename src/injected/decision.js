// Browser-only: adversarial chase-and-kick AI.

(function initDecision() {
  const { norm, dist, signAxis } = window.__HB_MATH__;

  const KICK_COOLDOWN_TICKS = 18; // ~300ms at 60fps
  const KICK_RANGE = 28;          // distance threshold to fire kick

  function adversarialIntent(ball, ballVel, botDisc, lastKickTick, currentTick) {
    if (!ball || !botDisc) {
      return { targetPos: { x: 0, y: 0 }, kick: false, kickPower: 0 };
    }
    // Intercept with a small velocity lead.
    const targetPos = {
      x: ball.x + ballVel.x * 2.5,
      y: ball.y + ballVel.y * 2.5,
    };
    const controlled = dist(botDisc, ball) < KICK_RANGE;
    const offCooldown = currentTick - lastKickTick >= KICK_COOLDOWN_TICKS;
    return { targetPos, kick: controlled && offCooldown, kickPower: 1.0 };
  }

  function moveIntentToAxes(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const v = norm(dx, dy);
    const dead = 0.22;
    return { ax: signAxis(v.x, dead), ay: signAxis(v.y, dead) };
  }

  window.__HB_DECISION__ = { adversarialIntent, moveIntentToAxes };
})();
