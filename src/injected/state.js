// Browser-only: mutable 1v1 match state.

(function initState() {
  const cfg = window.__HB_CONFIG__;
  const { clamp } = window.__HB_MATH__;

  window.__HB_STATE__ = {
    tick: 0,
    matchState: "WAITING",        // WAITING | STARTING | PLAYING | GOAL_SCORED | MATCH_OVER | RESETTING
    matchScore: { red: 0, blue: 0 },
    scoreLimit: clamp(Number(cfg.match?.scoreLimit || 3), 1, 20),
    timeLimit: Math.max(0, Number(cfg.match?.timeLimit ?? 180)),
    matchOverPauseMs: Math.max(0, Number(cfg.match?.matchOverPauseMs ?? 5000)),

    humanIds: [],
    activeHumanId: null,
    queuedHumanIds: [],

    lastBall: null,
    ballVel: { x: 0, y: 0 },
    botLastKickTick: -999999,
  };
})();
