export async function joinRoomClient({ page, roomLink, password, nickname }) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  await page.goto("https://www.haxball.com", { waitUntil: "domcontentloaded" });
  await page.evaluate((nick) => {
    try { localStorage.setItem("player_name", nick); } catch {}
  }, nickname);

  await page.goto(roomLink, { waitUntil: "domcontentloaded" });
  await sleep(3000);

  // Haxball renders inside an iframe. Find it.
  async function getGameFrame() {
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue;
      try {
        if (await f.evaluate(() => !!document.querySelector("input") || !!document.querySelector("canvas"))) {
          return f;
        }
      } catch {}
    }
    return null;
  }

  let frame = null;
  for (let i = 0; i < 15; i++) {
    frame = await getGameFrame();
    if (frame) break;
    await sleep(1000);
  }
  const ctx = frame || page;

  for (let attempt = 0; attempt < 20; attempt++) {
    const inGame = await ctx.evaluate(() => {
      const c = document.querySelector("canvas");
      return c && c.width > 100;
    }).catch(() => false);
    if (inGame) return;

    const result = await ctx.evaluate((nick) => {
      const inputs = document.querySelectorAll("input");
      for (const inp of inputs) {
        const t = (inp.type || "text").toLowerCase();
        if (t === "password" || t === "hidden") continue;
        inp.focus();
        inp.value = nick;
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.dispatchEvent(new Event("change", { bubbles: true }));
        return "filled";
      }
      return "no-input";
    }, nickname).catch(() => "error");

    if (result === "filled") {
      await ctx.evaluate(() => {
        for (const b of document.querySelectorAll("button")) {
          if (b.offsetParent === null) continue;
          const txt = (b.innerText || "").toLowerCase().trim();
          if (txt === "ok" || txt === "join" || txt === "play") { b.click(); return; }
        }
        for (const el of document.querySelectorAll("div, span, a")) {
          if (el.offsetParent === null) continue;
          if ((el.innerText || "").toLowerCase().trim() === "ok") { el.click(); return; }
        }
        for (const b of document.querySelectorAll("button")) {
          if (b.offsetParent !== null) { b.click(); return; }
        }
      }).catch(() => {});
      await sleep(300);
      if (frame) {
        await frame.evaluate(() => {
          const inp = document.querySelector("input");
          if (inp) {
            inp.focus();
            inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
            inp.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
          }
        }).catch(() => {});
      }
      await page.keyboard.press("Enter").catch(() => {});
      await sleep(500);
    }

    if (password) {
      const hasPw = await ctx.evaluate((pw) => {
        const inp = document.querySelector('input[type="password"]');
        if (!inp) return false;
        inp.focus();
        inp.value = pw;
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }, password).catch(() => false);
      if (hasPw) {
        await page.keyboard.press("Enter").catch(() => {});
        await sleep(500);
      }
    }

    await sleep(1000);
  }
  await sleep(2000);
}
