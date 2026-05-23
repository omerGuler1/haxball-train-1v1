# Haxball 1v1 Training Bot

🇬🇧 **English** | 🇹🇷 [Türkçe](./README_TR.md)

A standalone, headless Haxball 1v1 training room powered by two Chrome instances playing competitive futsal. Perfect for practicing against a skilled adversarial bot in a dedicated environment.

**Live Room:** 🦇🕸️ **Bats Training Bots v1** on Haxball  
**Community:** [Bats Training Bots Discord](https://discord.gg/z84TRaSVT)

<img width="872" height="590" alt="image" src="https://github.com/user-attachments/assets/ef8429fc-ec6f-4f8f-ae02-f6c700a3fb26" />

---

## Overview

This is a lightweight, self-hosted training room for Haxball 1v1 futsal. Here's how it works:

- **Host Instance:** A headless Chrome browser hosts the Haxball room using the Headless API
- **Bot Instance:** A second headless Chrome browser plays as your opponent. It intelligently chases the ball and kicks it away
- **Trainee:** The first human player to join becomes the trainee and faces off against the bot
- **Single Court:** One futsal stadium (`bats_map.hbs`) with no database, authentication, or Discord dependencies

> **Note:** This is a community version stripped down from the much more advanced **Bats Training Bots** private system, which features 3-court squares mode, SQLite leaderboards, Discord integration, and anti-cheat systems.

---

## Quick Start

### Prerequisites
- **Node.js** ≥ 18
- **npm** (comes with Node.js)
- A Haxball headless token (free from [haxball.com/headlesstoken](https://www.haxball.com/headlesstoken))

### Installation

1. **Clone or download this repository:**
   ```bash
   git clone <repository-url>
   cd haxball-train-1v1
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Ensure Chromium is installed:**
   ```bash
   npx puppeteer browsers install chrome
   ```
   This is typically automatic during npm install, but run this if Chromium wasn't downloaded.

4. **Set up your environment file:**
   - Copy or create a `.env` file in the project root
   - Visit [https://www.haxball.com/headlesstoken](https://www.haxball.com/headlesstoken)
   - Paste your fresh headless token into the `.env` file:
     ```
     HEADLESS_TOKEN=your_token_here
     ```

5. **Start the training room:**
   ```bash
   npm start
   # or
   node src/index.js
   ```

6. **Join the room:**
   - Look for the console output: `Room link: https://www.haxball.com/play?c=…`
   - Copy that link and share it, or open it directly in your browser
   - The bot will automatically start playing once you join

---

## Project Structure

```
haxball-train-1v1/
├── src/
│   ├── index.js                 # Entry point
│   ├── orchestrator.js          # Orchestrates host and bot instances
│   ├── hostEntry.js             # Host browser initialization
│   ├── host.js                  # Host logic (room creation, management)
│   ├── botEntry.js              # Bot browser initialization
│   ├── botProcess.js            # Bot logic (decision making, movement)
│   ├── joinRoom.js              # Room joining logic
│   ├── controlServer.js         # WebSocket control server
│   ├── inputController.js       # Input handling for bot
│   ├── protocol.js              # Communication protocol
│   ├── stadiumLoader.js         # Stadium file loading
│   ├── logger.js                # Logging utilities
│   ├── config.js                # Configuration constants
│   └── injected/                # Scripts injected into browser pages
│       ├── main.js              # Main injected script
│       ├── bridge.js            # Communication bridge
│       ├── decision.js          # Bot decision-making logic
│       ├── perception.js        # Game state perception
│       ├── state.js             # State management
│       ├── math.js              # Math utilities
│       └── util.js              # General utilities
├── bats_map.hbs                 # Futsal stadium definition
├── package.json                 # Project metadata & dependencies
├── .env                         # Environment variables (create this)
└── README.md                    # This file
```

---

## How It Works

### Architecture

1. **Orchestrator** (`orchestrator.js`)
   - Spawns two independent Puppeteer processes
   - One launches a host Chrome instance
   - One launches a bot Chrome instance
   - Manages inter-process communication via WebSocket

2. **Host Process**
   - Uses Haxball Headless API to create a room
   - Loads the futsal stadium
   - Accepts player connections
   - Simulates player movements based on bot decisions

3. **Bot Process**
   - Joins the room as a player
   - Analyzes game state (ball position, player position, etc.)
   - Makes intelligent decisions (chase ball, kick, position)
   - Sends movement commands to the host

4. **Injected Scripts**
   - `perception.js`: Extracts game state from the DOM/API
   - `decision.js`: Bot AI logic for decision-making
   - `bridge.js`: Facilitates communication between bot and orchestrator
   - `state.js`: Maintains local game state representation

### Game Loop

```
Host Instance          Bot Instance          Orchestrator
    |                      |                        |
    ├─ Create room         |                        |
    ├─────────────────────────────────────────────→ |
    |                      ├─ Join room             |
    |                      ├─────────────────────→  |
    |                      |                        |
    | [Game Running]       |                        |
    |                      ├─ Extract state         |
    |                      ├─ Make decision         |
    |                      ├─ Send commands         |
    |                      ├────────────────────→   |
    |                      |                        ├─ Apply movement
    |                      |                        ├─ Update game
```

---

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Required
HEADLESS_TOKEN=your_headless_token_here

# Optional (defaults shown)
# PORT=3000
# BOT_NAME=Bot
# HOST_NAME=Host
```

### Game Settings

Edit `src/config.js` to customize:
- Room settings (max players, password, etc.)
- Bot behavior parameters
- Stadium file path
- Network ports

---

## Usage Tips

### For Trainees (Players)

- **Join the room** using the link printed in the console
- The bot plays an **aggressive, chase-and-kick strategy**
- Practice defensive positioning and quick reactions
- The bot's difficulty is consistent and predictable

### For Developers

- **Modify bot behavior** in `src/injected/decision.js`
- **Adjust stadium** by editing or replacing `bats_map.hbs`
- **Monitor game state** via console logs in `logger.js`
- **Add custom logic** in `botProcess.js` for advanced AI

---

## Scripts

```bash
# Start the training room
npm start

# Lint JavaScript files
npm run lint
```

---

## Troubleshooting

### "Token invalid or expired"
- Generate a fresh token at [https://www.haxball.com/headlesstoken](https://www.haxball.com/headlesstoken)
- Make sure it's correctly set in your `.env` file

### Chromium not found
```bash
npx puppeteer browsers install chrome
```

### Room not appearing
- Check console for error messages
- Ensure no firewall is blocking local connections
- Verify your Haxball token is valid

### Bot not moving
- Check WebSocket connection in browser console
- Verify `controlServer.js` is running
- Inspect bot decision logic in `botProcess.js`

---

## Advanced Topics

### Custom Bot AI

Edit `src/injected/decision.js` to implement your own bot strategy:

```javascript
// Example: More defensive positioning
function decideBotAction(gameState) {
  const { ball, bot, player } = gameState;
  
  if (isCloseToGoal(bot)) {
    return { action: 'defend', direction: calculateBlockingAngle() };
  }
  return { action: 'chase', target: ball };
}
```

### Custom Stadium

Replace `bats_map.hbs` with your own Haxball stadium file (Handlebars format). The stadium is loaded by `stadiumLoader.js`.

### Extending the Protocol

The WebSocket protocol between host and bot is defined in `protocol.js`. You can extend it to support:
- Custom game events
- Advanced statistics logging
- Real-time spectator updates

---

## Contributing

This is the community version of a private training system. Contributions, bug reports, and feature requests are welcome!

**Related Projects:**
- 🦇🕸️ [Bats Training Bots](https://discord.gg/z84TRaSVT) — The advanced, production version

---

## License

This project is provided as-is. Check any included LICENSE file for details.

---

## Next Steps

1. ✅ Install dependencies (`npm install`)
2. ✅ Get a headless token
3. ✅ Start the room (`npm start`)
4. ✅ Join and train!

Questions? Join the [Bats Training Bots Discord](https://discord.gg/z84TRaSVT).

---

**Enjoy your training! 🦇⚽**