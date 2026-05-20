import { fork } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function waitForMessage(child, predicate, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for child message"));
    }, timeoutMs);

    function onMessage(msg) {
      try {
        if (predicate(msg)) {
          cleanup();
          resolve(msg);
        }
      } catch (e) {
        cleanup();
        reject(e);
      }
    }
    function onExit(code, signal) {
      cleanup();
      reject(new Error(`Child exited before message (code=${code}, signal=${signal})`));
    }
    function cleanup() {
      clearTimeout(t);
      child.off("message", onMessage);
      child.off("exit", onExit);
    }
    child.on("message", onMessage);
    child.on("exit", onExit);
  });
}

export async function spawnOrchestrator() {
  const config = loadConfig();
  const log = createLogger(config);

  log.info("Starting orchestrator…");
  process.on("unhandledRejection", (e) => log.error(`Unhandled rejection: ${e?.message || e}`));

  if (!config.room.token) {
    log.error("Missing HAXBALL_TOKEN. Put a fresh one-shot token in .env.");
    process.exit(1);
  }

  const host = fork(path.join(__dirname, "hostEntry.js"), [], {
    env: { ...process.env },
    stdio: ["inherit", "inherit", "inherit", "ipc"],
  });

  let ready;
  try {
    ready = await waitForMessage(
      host,
      (m) => m && m.type === "host.ready" && typeof m.roomLink === "string" && typeof m.controlWsUrl === "string",
      60_000
    );
  } catch (e) {
    log.error(String(e?.message || e));
    process.exit(1);
  }

  const { roomLink, controlWsUrl } = ready;
  log.info(`Room link: ${roomLink}`);
  log.info(`Bot control WS: ${controlWsUrl}`);

  // ── Bot launcher with exponential backoff restart ───────

  let botBackoff = 5000;
  function launchBot() {
    const bot = fork(path.join(__dirname, "botEntry.js"), [], {
      env: {
        ...process.env,
        HB_ROOM_LINK: roomLink,
        HB_BOT_NAME: config.bots.name,
        HB_CONTROL_WS_URL: controlWsUrl,
        HB_ROOM_PASSWORD: config.room.password ?? "",
      },
      stdio: ["inherit", "inherit", "inherit", "ipc"],
    });

    bot.on("message", (m) => {
      if (m?.type === "bot.ready") {
        log.info(`Bot ready: ${m.name}`);
        botBackoff = 5000;
      }
    });

    bot.on("exit", (code, signal) => {
      const wait = botBackoff;
      log.warn(`Bot exited (code=${code}, signal=${signal}). Restarting in ${wait / 1000}s…`);
      botBackoff = Math.min(botBackoff * 2, 60_000);
      setTimeout(launchBot, wait);
    });
  }

  const launchDelay = Math.max(0, Number(config.bots.launchDelayMs) || 0);
  setTimeout(launchBot, launchDelay);

  // ── Host crash recovery ─────────────────────────────────

  host.on("exit", (code, signal) => {
    log.error(`Host exited (code=${code}, signal=${signal}). Entire stack restarting in 10s.`);
    setTimeout(() => process.exit(1), 10_000); // PM2 / supervisor brings us back
  });

  // ── Graceful shutdown ───────────────────────────────────

  function shutdown(sig) {
    log.info(`${sig} received, shutting down…`);
    try { host.kill("SIGINT"); } catch {}
    setTimeout(() => process.exit(0), 3000);
  }
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}
