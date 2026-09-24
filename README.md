# Dragon Dash Duel

A tiny online multiplayer endless-runner inspired by the simplicity of the Chrome offline dinosaur game.

## Gameplay
- 2–6 players share a room.
- Everyone jumps over increasingly frequent obstacles.
- Last surviving player wins.
- Desktop: Space / Arrow Up.
- Mobile: tap the game.
- Difficulty ramps continuously; speed caps at a brutal level.

## Run locally
1. Install Node.js 18+.
2. In this folder run:
   npm install
   npm start
3. Open http://localhost:3000 in two browser tabs/devices on the same network.

## Put it online
Deploy this Node project to a host that supports Node.js + WebSockets (for example Render or Railway).
Use:
- Build command: npm install
- Start command: npm start
- Environment: Node.js

After deployment, open the HTTPS URL. The game automatically uses WSS when served over HTTPS.

## Project files
- server.js — Express server + WebSocket rooms
- public/index.html — UI
- public/style.css — responsive styling
- public/game.js — canvas game + multiplayer client

## Next upgrades
Leaderboard, sound effects, power-ups, character skins, persistent accounts, matchmaking, and server-authoritative collision validation.
