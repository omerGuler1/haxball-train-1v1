import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer";

import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createControlServer } from "./controlServer.js";
import { loadStadiumJsonString } from "./stadiumLoader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function pickFreePort() {
  return await new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

export async function startHost({ onReady }) {
  const config = loadConfig();
  const log = createLogger(config);

  if (!config.room.token) {
    log.error("Missing HAXBALL_TOKEN. Put a fresh one-shot token in .env.");
    process.exit(1);
  }

  const controlPort = await pickFreePort();
  const control = createControlServer({ port: controlPort, logger: log });

  // ── Stadium ───────────────────────────────────────────
  const stadiumPath = config.stadium.path
    ? path.resolve(process.cwd(), config.stadium.path)
    : null;
  let stadiumJsonString = null;
  if (stadiumPath) {
    try {
      stadiumJsonString = await loadStadiumJsonString(stadiumPath);
      log.info(`Loaded stadium: ${stadiumPath}`);
    } catch (e) {
      log.error(`Failed to load stadium: ${stadiumPath} — ${e?.message || e}`);
    }
  } else {
    log.info("No STADIUM_PATH set — using Haxball default classic stadium.");
  }

  // ── Browser ───────────────────────────────────────────
  const browser = await puppeteer.launch({
    headless: config.puppeteer.headless,
    executablePath: config.puppeteer.executablePath || undefined,
    args: config.puppeteer.launchArgs,
  });
  const page = await browser.newPage();

  page.on("pageerror", (err) => log.error(`Page error: ${err?.message || err}`));
  page.on("error", (err) => log.error(`Puppeteer page crashed: ${err?.message || err}`));
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.startsWith("[HB]")) log.info(text);
  });

  // ── Bridge: browser → host ────────────────────────────
  await page.exposeFunction("__hbNodeBridgePost", (msg) => {
    if (!msg?.type) return;
    if (msg.type === "room.link") {
      const roomLink = msg.payload?.link;
      if (roomLink && onReady) onReady({ roomLink, controlWsUrl: control.url });
      log.info(`Room link: ${roomLink}`);
    } else if (msg.type === "room.playerJoin") {
      const { id, name, team } = msg.payload || {};
      log.info(`Player joined: id=${id} name=${name} team=${team}`);
    } else if (msg.type === "room.playerLeave") {
      const { id, name, team } = msg.payload || {};
      log.info(`Player left: id=${id} name=${name} team=${team}`);
    } else if (msg.type === "bot.control") {
      const { botName, tick, moveX, moveY, kick } = msg.payload || {};
      if (!botName) return;
      control.sendToBot(botName, { t: "control", tick, moveX, moveY, kick, kickPower: 1.0 });
    } else if (msg.type === "room.startGameError") {
      log.warn(`startGame error: ${msg.payload?.message}`);
    }
  });

  // ── Inject browser modules ────────────────────────────
  const injectedParts = [
    "injected/bridge.js",
    "injected/math.js",
    "injected/util.js",
    "injected/state.js",
    "injected/perception.js",
    "injected/decision.js",
    "injected/main.js",
  ];
  const injected = (
    await Promise.all(
      injectedParts.map((p) => fs.readFile(path.join(__dirname, p), "utf8"))
    )
  ).join("\n\n");

  await page.goto("https://www.haxball.com/headless", { waitUntil: "networkidle2" });
  await page.waitForFunction(() => typeof window.HBInit === "function", { timeout: 30_000 });

  await page.evaluate((cfg, stadiumJson) => {
    window.__HB_CONFIG__ = cfg;
    if (stadiumJson) {
      window.__HB_CONFIG__.stadium = window.__HB_CONFIG__.stadium || {};
      window.__HB_CONFIG__.stadium.jsonString = stadiumJson;
    }
  }, config, stadiumJsonString);

  await page.evaluate(injected);

  log.info(`Host started. Control WS at ${control.url}`);

  process.on("unhandledRejection", (e) => log.error(`Unhandled rejection: ${e?.message || e}`));

  return {
    shutdown: async () => {
      try { await control.close(); } catch {}
      try { await page.close({ runBeforeUnload: false }); } catch {}
      try { await browser.close(); } catch {}
    },
  };
}
