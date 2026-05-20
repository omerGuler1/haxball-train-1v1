import { startBot } from "./botProcess.js";

const roomLink = process.env.HB_ROOM_LINK;
const botName = process.env.HB_BOT_NAME;
const controlWsUrl = process.env.HB_CONTROL_WS_URL;
const password = process.env.HB_ROOM_PASSWORD || "";

if (!roomLink || !botName || !controlWsUrl) {
  console.error("Bot missing env: HB_ROOM_LINK, HB_BOT_NAME, HB_CONTROL_WS_URL");
  process.exit(1);
}

// Register SIGINT handler BEFORE awaiting startBot so a signal during init
// can't bypass the cleanup path.
let bot = null;
process.on("SIGINT", async () => {
  try { await bot?.shutdown?.(); } catch {}
  process.exit(0);
});

bot = await startBot({ roomLink, botName, controlWsUrl, password });
if (process.send) process.send({ type: "bot.ready", name: botName });
