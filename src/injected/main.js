// Browser-only: wires HBInit callbacks, runs the 1v1 match lifecycle, drives the bot AI.

/* global HBInit */

(function boot() {
  const cfg = window.__HB_CONFIG__;
  if (!cfg) throw new Error("Missing __HB_CONFIG__");

  const room = HBInit({
    roomName: cfg.room.name,
    maxPlayers: cfg.room.maxPlayers,
    public: cfg.room.public,
    password: cfg.room.password || null,
    token: cfg.room.token,
    geo: cfg.room.geo || undefined,
    noPlayer: cfg.room.noPlayer,
  });
  window.__HB_ROOM__ = room;

  const state = window.__HB_STATE__;
  const { isBotPlayer, getBall, getPlayersWithDisc, estimateBallVel } = window.__HB_PERCEPTION__;
  const { adversarialIntent, moveIntentToAxes } = window.__HB_DECISION__;

  const botTeam = cfg.training?.botTeamId === 2 ? 2 : 1;
  const traineeTeam = cfg.training?.traineeTeamId === 1 ? 1 : 2;
  const botName = String(cfg.bots?.name || "BatBot");

  // ── Stadium ────────────────────────────────────────────
  if (cfg.stadium?.jsonString) {
    try { room.setCustomStadium(cfg.stadium.jsonString); }
    catch (e) { console.log("[HB] Stadium load failed: " + (e?.message || e)); }
  }
  room.setScoreLimit(state.scoreLimit);
  room.setTimeLimit(state.timeLimit);

  // ── Room link → host ───────────────────────────────────
  room.onRoomLink = function (link) {
    window.__HB_BRIDGE__?.post("room.link", { link });
  };

  // ── Match lifecycle ────────────────────────────────────

  let lifecycleEpoch = 0;
  function transitionTo(newState) {
    state.matchState = newState;
    lifecycleEpoch++;
  }
  function scheduleGuarded(fn, delayMs) {
    const epoch = lifecycleEpoch;
    setTimeout(() => {
      if (lifecycleEpoch !== epoch) return; // state changed since we scheduled
      fn();
    }, delayMs);
  }

  function teamCount(t) {
    return room.getPlayerList().filter((p) => p.id !== 0 && p.team === t).length;
  }

  function ensureTeams() {
    const players = room.getPlayerList().filter((p) => p.id !== 0);
    for (const p of players) {
      if (isBotPlayer(p)) {
        if (p.team !== botTeam) room.setPlayerTeam(p.id, botTeam);
      } else if (state.activeHumanId && p.id === state.activeHumanId) {
        if (p.team !== traineeTeam) room.setPlayerTeam(p.id, traineeTeam);
      } else {
        if (p.team !== 0) room.setPlayerTeam(p.id, 0);
      }
    }
  }

  function attemptAutoStart() {
    if (state.matchState !== "STARTING") return;
    if (room.getScores() != null) {
      try { room.stopGame(); } catch {}
      return; // retry next poll cycle
    }
    ensureTeams();
    if (teamCount(botTeam) < 1 || teamCount(traineeTeam) < 1) return;
    if (!state.activeHumanId) return;
    const human = room.getPlayer(state.activeHumanId);
    if (!human || human.team !== traineeTeam) return;
    try { room.startGame(); }
    catch (e) { window.__HB_BRIDGE__?.post("room.startGameError", { message: String(e?.message || e) }); }
  }

  let startingPollTimer = null;
  function startNewMatch() {
    if (state.activeHumanId) {
      const p = room.getPlayer(state.activeHumanId);
      if (!p) state.activeHumanId = null;
    }
    if (!state.activeHumanId) {
      promoteNextHuman();
      return;
    }
    transitionTo("STARTING");
    ensureTeams();
    // Re-try startGame at staggered intervals to ride out brief player state changes.
    [150, 400, 900, 1800, 3500].forEach((ms) => setTimeout(attemptAutoStart, ms));

    clearInterval(startingPollTimer);
    const startedAt = Date.now();
    startingPollTimer = setInterval(() => {
      if (state.matchState !== "STARTING") {
        clearInterval(startingPollTimer);
        startingPollTimer = null;
        return;
      }
      if (Date.now() - startedAt > 15000) {
        clearInterval(startingPollTimer);
        startingPollTimer = null;
        transitionTo("WAITING");
        promoteNextHuman();
        return;
      }
      attemptAutoStart();
    }, 500);
  }

  function promoteNextHuman() {
    while (state.queuedHumanIds.length > 0) {
      const nextId = state.queuedHumanIds[0];
      if (!room.getPlayer(nextId)) { state.queuedHumanIds.shift(); continue; }
      break;
    }
    if (state.queuedHumanIds.length === 0) {
      // Fallback: any human in the room not currently active
      const candidate = state.humanIds.find((id) => id !== state.activeHumanId && room.getPlayer(id));
      if (candidate) {
        state.activeHumanId = candidate;
        startNewMatch();
      }
      return;
    }
    state.activeHumanId = state.queuedHumanIds.shift();
    room.sendAnnouncement("Sira sende — basliyoruz!", state.activeHumanId, 0x66ff66, "bold", 1);
    startNewMatch();
  }

  // ── HBInit callbacks ───────────────────────────────────

  room.onPlayerJoin = function (player) {
    window.__HB_BRIDGE__?.post("room.playerJoin", { id: player.id, name: player.name, team: player.team });

    if (isBotPlayer(player)) {
      room.setPlayerTeam(player.id, botTeam);
      // If a human was already waiting, kick off the match now.
      if (state.activeHumanId && state.matchState === "WAITING") {
        startNewMatch();
      } else if (state.activeHumanId && state.matchState === "STARTING") {
        ensureTeams();
      }
      return;
    }

    // Human join
    state.humanIds.push(player.id);
    room.sendAnnouncement("Antrenman odasina hosgeldin!", player.id, 0x66ff66, "bold", 1);

    if (state.matchState === "WAITING" && !state.activeHumanId) {
      state.activeHumanId = player.id;
      room.sendAnnouncement("Hosgeldin " + player.name + " — basliyoruz!", null, 0x66ff66, "small", 1);
      startNewMatch();
    } else {
      state.queuedHumanIds.push(player.id);
      room.setPlayerTeam(player.id, 0);
      room.sendAnnouncement(
        "Su an oyun var. Sirana gelince oynayacaksin (#" + state.queuedHumanIds.length + ").",
        player.id, 0xdddddd, "small", 1
      );
    }
  };

  room.onPlayerLeave = function (player) {
    window.__HB_BRIDGE__?.post("room.playerLeave", { id: player.id, name: player.name, team: player.team });

    state.humanIds = state.humanIds.filter((id) => id !== player.id);
    state.queuedHumanIds = state.queuedHumanIds.filter((id) => id !== player.id);

    if (state.activeHumanId === player.id) {
      state.activeHumanId = null;
      try { if (room.getScores() != null) room.stopGame(); } catch {}
      transitionTo("WAITING");
      scheduleGuarded(() => promoteNextHuman(), 500);
    }
  };

  room.onGameStart = function () {
    transitionTo("PLAYING");
    state.matchScore = { red: 0, blue: 0 };
  };

  room.onGameStop = function () {
    if (state.matchState !== "MATCH_OVER" && state.matchState !== "RESETTING") {
      transitionTo("WAITING");
    }
  };

  room.onTeamGoal = function (team) {
    if (team === 1) state.matchScore.red++;
    else if (team === 2) state.matchScore.blue++;
    transitionTo("GOAL_SCORED");
  };

  room.onTeamVictory = function () {
    transitionTo("MATCH_OVER");
    scheduleGuarded(() => {
      try { if (room.getScores() != null) room.stopGame(); } catch {}
      transitionTo("RESETTING");
      scheduleGuarded(() => {
        transitionTo("WAITING");
        if (state.activeHumanId) startNewMatch();
        else promoteNextHuman();
      }, 600);
    }, state.matchOverPauseMs);
  };

  // ── Bot control dispatch (deduped) ─────────────────────

  let lastIntent = null;   // { moveX, moveY, kick, sentAt }
  function postBotControl(intent) {
    const now = Date.now();
    const changed = !lastIntent
      || lastIntent.moveX !== intent.moveX
      || lastIntent.moveY !== intent.moveY
      || lastIntent.kick !== intent.kick;
    if (!changed && !intent.kick && lastIntent && now - lastIntent.sentAt < 250) return;
    lastIntent = { moveX: intent.moveX, moveY: intent.moveY, kick: intent.kick, sentAt: now };
    window.__HB_BRIDGE__?.post("bot.control", {
      botName,
      tick: state.tick,
      moveX: intent.moveX,
      moveY: intent.moveY,
      kick: intent.kick,
      kickPower: intent.kickPower,
    });
  }

  // ── AI tick ────────────────────────────────────────────

  function aiTick() {
    if (room.getScores() == null) return;
    const ball = getBall(room);
    if (!ball) return;
    state.ballVel = estimateBallVel(state.lastBall, ball);
    state.lastBall = ball;

    const players = getPlayersWithDisc(room);
    const botPlayer = players.find((x) => x.isBot);
    if (!botPlayer?.disc) return;

    const intent = adversarialIntent(ball, state.ballVel, botPlayer.disc, state.botLastKickTick, state.tick);
    if (intent.kick) state.botLastKickTick = state.tick;
    const axes = moveIntentToAxes(botPlayer.disc, intent.targetPos);
    postBotControl({ moveX: axes.ax, moveY: axes.ay, kick: intent.kick, kickPower: intent.kickPower });
  }

  room.onGameTick = function () {
    state.tick++;
    if (state.matchState === "PLAYING") aiTick();
  };

  console.log("[HB] Room initialized: " + cfg.room.name);
})();
