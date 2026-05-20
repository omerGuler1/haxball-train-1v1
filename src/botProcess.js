import process from "node:process";

import puppeteer from "puppeteer";
import WebSocket from "ws";

import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { ControlMsgType, makeHello } from "./protocol.js";
import { joinRoomClient } from "./joinRoom.js";
import { createInputController } from "./inputController.js";

export async function startBot({ roomLink, botName, controlWsUrl, password }) {
  const config = loadConfig();
  const log = createLogger(config);

  const browser = await puppeteer.launch({
    headless: config.puppeteer.headless,
    executablePath: config.puppeteer.executablePath || undefined,
    args: config.puppeteer.launchArgs,
  });
  const page = await browser.newPage();

  if (config.bots.userAgent) {
    try { await page.setUserAgent(config.bots.userAgent); }
    catch (e) { log.warn(`Failed to set UA: ${e?.message || e}`); }
  }

  // Accept password / OK dialogs that some Haxball flows trigger.
  let promptUsed = false;
  page.on("dialog", async (d) => {
    try {
      if (d.type?.() === "prompt" && !promptUsed && password) {
        promptUsed = true;
        await d.accept(password);
      } else {
        await d.accept();
      }
    } catch {}
  });

  await page.setViewport({ width: 1200, height: 800 });

  await joinRoomClient({ page, roomLink, password, nickname: botName });

  const input = createInputController({ page, logger: log });

  const botAvatar = config.bots.avatar || "";
  let avatarSent = false;
  async function sendChat(text) {
    try {
      await input.releaseAll();
      await page.keyboard.press("Enter");
      await new Promise((r) => setTimeout(r, 250));
      await page.keyboard.type(text, { delay: 25 });
      await new Promise((r) => setTimeout(r, 250));
      await page.keyboard.press("Enter");
    } catch (e) {
      log.warn(`sendChat failed: ${e?.message || e}`);
    }
  }
  async function maybeSendAvatar() {
    if (avatarSent || !botAvatar) return;
    avatarSent = true;
    await new Promise((r) => setTimeout(r, 1500));
    await sendChat(`/avatar ${botAvatar}`);
    log.info(`Sent avatar command: /avatar ${botAvatar}`);
  }

  let botInGame = false;
  const isInGame = async () => {
    try {
      const ok = await page.evaluate(() => {
        const c = document.querySelector("canvas");
        return c && c.width > 100;
      });
      if (ok) return true;
      for (const f of page.frames()) {
        if (f === page.mainFrame()) continue;
        try {
          const has = await f.evaluate(() => {
            const c = document.querySelector("canvas");
            return c && c.width > 100;
          });
          if (has) return true;
        } catch {}
      }
      return false;
    } catch { return false; }
  };

  // Re-attempt join if the first one didn't land us in the game canvas.
  (async function retryUntilInGame() {
    await new Promise((r) => setTimeout(r, 5000));
    for (let attempt = 0; attempt < 10; attempt++) {
      if (botInGame || await isInGame()) { botInGame = true; maybeSendAvatar(); return; }
      log.warn(`Bot not in game. Retrying in 10s… (attempt ${attempt + 1}/10)`);
      await new Promise((r) => setTimeout(r, 10000));
      if (botInGame || await isInGame()) { botInGame = true; maybeSendAvatar(); return; }
      try {
        await page.goto(roomLink, { waitUntil: "domcontentloaded" });
        await new Promise((r) => setTimeout(r, 3000));
        await joinRoomClient({ page, roomLink, password, nickname: botName });
      } catch (e) {
        log.warn(`Retry join failed: ${e?.message || e}`);
      }
      await new Promise((r) => setTimeout(r, 3000));
      if (await isInGame()) { botInGame = true; log.info("Bot joined after retry."); maybeSendAvatar(); return; }
    }
    log.error("Bot failed to join after 10 retries. Exiting for orchestrator restart.");
    process.exit(1);
  })();

  // ── Control WebSocket (host → bot) ─────────────────────
  let lastPacketAt = Date.now();
  let ws = null;
  let reconnects = 0;
  const MAX_RECONNECTS = 5;

  function connectWs() {
    ws = new WebSocket(controlWsUrl);
    ws.on("open", () => {
      ws.send(JSON.stringify(makeHello({ name: botName })));
      log.info(`Bot connected to control: ${botName}`);
      reconnects = 0;
      lastPacketAt = Date.now();
    });
    ws.on("message", async (data) => {
      lastPacketAt = Date.now();
      let msg;
      try { msg = JSON.parse(String(data)); } catch { return; }
      if (msg?.t === ControlMsgType.CONTROL || msg?.t === "control") {
        botInGame = true;
        await input.applyAxes(msg.moveX, msg.moveY, msg.kick);
        if (msg.kick) await input.kickPulse();
      } else if (msg?.t === ControlMsgType.RELEASE) {
        await input.releaseAll();
      }
    });
    ws.on("close", async () => {
      log.warn("Control WS closed.");
      await input.releaseAll();
      scheduleReconnect();
    });
    ws.on("error", (e) => log.error(`Control WS error: ${e?.message || e}`));
  }
  function scheduleReconnect() {
    reconnects++;
    if (reconnects > MAX_RECONNECTS) {
      log.error("Max WS reconnects reached. Exiting for orchestrator restart.");
      cleanExit(1);
      return;
    }
    const delay = 3000 * Math.pow(2, reconnects - 1);
    log.warn(`Reconnecting in ${delay / 1000}s (attempt ${reconnects}/${MAX_RECONNECTS})…`);
    setTimeout(connectWs, delay);
  }
  connectWs();

  // If host packets stop arriving, release keys so the bot doesn't keep moving.
  const failsafe = setInterval(async () => {
    if (Date.now() - lastPacketAt > 1500) await input.releaseAll();
  }, 500);

  // Watchdog: WebRTC drops / Cloudflare interstitials / renderer crashes can
  // strand the bot in a tab without it being in the room. Re-check periodically.
  let missedChecks = 0;
  const watchdog = setInterval(async () => {
    if (!botInGame) return;
    if (await isInGame()) { missedChecks = 0; return; }
    missedChecks++;
    log.warn(`Watchdog: bot not in game [${missedChecks}/2].`);
    if (missedChecks >= 2) {
      log.error("Watchdog: bot lost room. Exiting for orchestrator restart.");
      cleanExit(1);
    }
  }, 120_000);

  // Always close Chromium before exit — otherwise renderer/gpu/audio child
  // processes orphan to init and accumulate over restarts.
  let exiting = false;
  async function cleanExit(code) {
    if (exiting) return;
    exiting = true;
    clearInterval(failsafe);
    clearInterval(watchdog);
    try { ws?.close(); } catch {}
    try { await page.close({ runBeforeUnload: false }); } catch {}
    try { await browser.close(); } catch {}
    setTimeout(() => process.exit(code), 3000).unref();
    process.exit(code);
  }

  browser.on("disconnected", () => {
    log.error("Chromium disconnected. Exiting for orchestrator restart.");
    cleanExit(1);
  });
  page.on("close", () => {
    log.error("Chromium page closed. Exiting for orchestrator restart.");
    cleanExit(1);
  });

  return {
    shutdown: async () => { await cleanExit(0); },
  };
}
