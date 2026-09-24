const path = require("path");
const http = require("http");
const express = require("express");
const { WebSocketServer } = require("ws");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const rooms = new Map();

function id() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function send(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}

function broadcast(room, data) {
  for (const p of room.players.values()) send(p.ws, data);
}

function publicPlayers(room) {
  return [...room.players.values()].map(p => ({
    id: p.id,
    name: p.name,
    color: p.color,
    alive: p.alive
  }));
}

function makeRoom() {
  let code;
  do code = id(); while (rooms.has(code));
  const room = { code, players: new Map(), running: false, seed: Math.random() };
  rooms.set(code, room);
  return room;
}

wss.on("connection", ws => {
  ws.room = null;
  ws.player = null;

  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "create") {
      const room = makeRoom();
      join(room, ws, msg.name);
      return;
    }

    if (msg.type === "join") {
      const room = rooms.get(String(msg.code || "").toUpperCase());
      if (!room) return send(ws, { type: "error", message: "Room not found." });
      if (room.players.size >= 6) return send(ws, { type: "error", message: "Room is full." });
      join(room, ws, msg.name);
      return;
    }

    if (!ws.room || !ws.player) return;
    const room = ws.room;
    const p = ws.player;

    if (msg.type === "ready") {
      p.ready = !!msg.ready;
      broadcast(room, { type: "players", players: publicPlayers(room) });
      if (room.players.size >= 2 && [...room.players.values()].every(x => x.ready)) {
        room.running = true;
        room.seed = Math.random();
        for (const x of room.players.values()) x.alive = true;
        broadcast(room, { type: "start", seed: room.seed });
      }
    }

    if (msg.type === "state") {
      // Relay only compact player state; collision/game rules stay client-side.
      p.x = Number(msg.x) || 0;
      p.y = Number(msg.y) || 0;
      p.vy = Number(msg.vy) || 0;
      p.alive = msg.alive !== false;
      broadcast(room, {
        type: "state",
        player: { id: p.id, x: p.x, y: p.y, vy: p.vy, alive: p.alive }
      });
    }

    if (msg.type === "eliminated") {
      p.alive = false;
      broadcast(room, { type: "eliminated", id: p.id });
      const alive = [...room.players.values()].filter(x => x.alive);
      if (room.running && alive.length <= 1) {
        room.running = false;
        broadcast(room, {
          type: "winner",
          id: alive[0]?.id || null,
          name: alive[0]?.name || null
        });
      }
    }

    if (msg.type === "restart") {
      for (const x of room.players.values()) {
        x.ready = false;
        x.alive = true;
      }
      room.running = false;
      broadcast(room, { type: "players", players: publicPlayers(room) });
    }
  });

  ws.on("close", () => {
    const room = ws.room;
    const p = ws.player;
    if (!room || !p) return;
    room.players.delete(p.id);
    broadcast(room, { type: "players", players: publicPlayers(room) });
    if (room.players.size === 0) rooms.delete(room.code);
  });
});

function join(room, ws, name) {
  const colors = ["#53e6ff", "#ff5ca8", "#ffd166", "#8cff66", "#b58cff", "#ff8b4d"];
  const player = {
    id: id(),
    name: String(name || "Player").slice(0, 16),
    color: colors[room.players.size % colors.length],
    ready: false,
    alive: true,
    ws
  };
  room.players.set(player.id, player);
  ws.room = room;
  ws.player = player;

  send(ws, { type: "joined", code: room.code, self: { id: player.id, name: player.name, color: player.color } });
  broadcast(room, { type: "players", players: publicPlayers(room) });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Dragon Dash Duel running on port ${PORT}`));
