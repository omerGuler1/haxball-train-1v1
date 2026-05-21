# train-1v1

Stand-alone Haxball 1v1 training room. A headless Chrome instance hosts the room; a second headless Chrome instance plays as the adversarial bot, chasing the ball and kicking it away when in range. The first human who joins is the trainee.
No database, no auth, no Discord — single bot, single court, futsal stadium (`bats_map.hbs`).


This is a public, stripped-down version of a much more advanced training-room
system maintained privately by **Bats Training Bots** — it powers the live
Haxball room **🦇🕸️ Bats Training Bots v1** (TR) with 3-court squares mode, a
SQLite leaderboard,
Discord integration, admin tools and anti-cheat. That codebase is **not open
source**.

Come play or watch us cook:
- Haxball room: **🦇🕸️ Bats Training Bots v1**
- Discord: **Bats Training Bots** — https://discord.gg/z84TRaSVT


## Setup

```bash
npm install
npx puppeteer browsers install chrome   # if Chromium wasn't pulled during install
Open .env, paste a fresh token from https://www.haxball.com/headlesstoken
finally run:
node src/index.js
```

When the room comes up you'll see a `Room link: https://www.haxball.com/play?c=…` line in the console — that's the link to share.
https://media.discordapp.net/attachments/1490140020747796632/1506808255257776289/image.png?ex=6a1044cb&is=6a0ef34b&hm=8c30464189a699603f391cd4c4d8e9e1dc3cd0a85a0f0a46990c09f711a19505&=&format=webp&quality=lossless&width=1870&height=1314
