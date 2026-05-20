import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import dotenv from "dotenv";

function parseBool(s, fallback) {
  if (s == null) return fallback;
  if (typeof s === "boolean") return s;
  const v = String(s).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(v)) return true;
  if (["0", "false", "no", "n", "off"].includes(v)) return false;
  return fallback;
}

function parseIntSafe(s, fallback) {
  const n = Number.parseInt(String(s), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseFloatSafe(s, fallback) {
  const n = Number.parseFloat(String(s));
  return Number.isFinite(n) ? n : fallback;
}

function teamId(name, fallback) {
  const v = String(name || "").trim().toLowerCase();
  if (v === "red") return 1;
  if (v === "blue") return 2;
  return fallback;
}

export function loadConfig() {
  // Support: node src/index.js --env path/to/.env  (otherwise loads ./.env)
  const argIdx = process.argv.indexOf("--env");
  const envArg = argIdx !== -1 ? process.argv[argIdx + 1] : process.env.HB_ENV_FILE;
  const envPath = envArg ? path.resolve(process.cwd(), envArg) : path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
  else dotenv.config();

  const botTeam = teamId(process.env.BOT_TEAM, 1);
  const traineeTeam = teamId(process.env.TRAINEE_TEAM, botTeam === 1 ? 2 : 1);

  return {
    room: {
      token: process.env.HAXBALL_TOKEN || "",
      name: process.env.ROOM_NAME || "Futsal 1v1 Training",
      password: process.env.ROOM_PASSWORD || "",
      public: parseBool(process.env.ROOM_PUBLIC, true),
      maxPlayers: parseIntSafe(process.env.ROOM_MAX_PLAYERS, 10),
      noPlayer: parseBool(process.env.ROOM_NO_PLAYER, true),
      geo: {
        code: process.env.ROOM_GEO_CODE || "TR",
        lat: parseFloatSafe(process.env.ROOM_GEO_LAT, 39.0),
        lon: parseFloatSafe(process.env.ROOM_GEO_LON, 35.0),
      },
    },
    stadium: {
      path: process.env.STADIUM_PATH || "",
    },
    bots: {
      name: process.env.BOT_NAME || "TrainBot",
      avatar: process.env.BOT_AVATAR ?? "🦇",
      launchDelayMs: parseIntSafe(process.env.BOT_LAUNCH_DELAY_MS, 3000),
      userAgent: process.env.BOT_USER_AGENT || "",
    },
    training: {
      botTeamId: botTeam,
      traineeTeamId: traineeTeam,
    },
    match: {
      scoreLimit: parseIntSafe(process.env.MATCH_SCORE_LIMIT, 3),
      timeLimit: parseIntSafe(process.env.MATCH_TIME_LIMIT, 180),
      matchOverPauseMs: parseIntSafe(process.env.MATCH_OVER_PAUSE_MS, 5000),
    },
    puppeteer: {
      headless: parseBool(process.env.PUPPETEER_HEADLESS, true),
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "",
      launchArgs: [
        "--disable-features=WebRtcHideLocalIpsWithMdns",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--mute-audio",
      ],
    },
    debug: {
      logLevel: process.env.LOG_LEVEL || "info",
    },
  };
}
