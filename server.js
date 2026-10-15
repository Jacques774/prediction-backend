import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

// ✅ Import shared rugby questions
import { RugbyQuestions } from "./questions.js";

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

// ✅ ES modules __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from project directory
app.use(express.static(__dirname));

// ✅ Serve pages
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "MainMenu.html")));
app.get("/gamesetup.html", (req, res) => res.sendFile(path.join(__dirname, "gamesetup.html")));
app.get("/host", (req, res) => res.sendFile(path.join(__dirname, "host.html")));
app.get("/player", (req, res) => res.sendFile(path.join(__dirname, "player.html")));

// --- Game state ---
const games = {};

app.post("/api/create-game", (req, res) => {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  games[code] = {
    players: {},
    hostId: null,
    potBalance: 0, // ✅ Persistent pot tracker for the room
    predictions: { YES: 0, NO: 0 },
    started: false,
    currentQuestionId: null,
    lastOutcome: null
  };
  res.json({ code });
});

app.get("/api/healthz", (req, res) => res.json({ status: "ok" }));

// Helper: Get persistent pot balance
function getGamePot(gameId) {
  if (!games[gameId]) return 0;
  return games[gameId].potBalance || 0;
}

// ✅ Helper: Broadcast leaderboard
function broadcastLeaderboard(gameId) {
  const game = games[gameId];
  if (!game) return;

  const players = Object.values(game.players).map(p => ({
    name: p.name,
    balance: p.balance,
    wins: p.wins,
    cashouts: p.cashouts
  }));

  io.to(gameId).emit("leaderboard_update", players);
}

// ✅ Socket.IO handlers
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  // --- Pot reveal ---
  socket.on("pot_reveal", ({ gameId }) => {
    if (!games[gameId]) return;

    const potAmount = getGamePot(gameId);

    // Broadcast pot to all clients
    io.to(gameId).emit("pot_reveal", { amount: potAmount });

    // Reset stakes immediately so next round starts fresh
    Object.values(games[gameId].players).forEach(p => p.stake = 0);

    console.log(`💰 Pot revealed for ${gameId}: £${potAmount}`);
  });

  // Handle join_game
  socket.on("join_game", ({ gameId, playerName, isHost }) => {
    if (!games[gameId]) {
      console.warn(`Game ${gameId} not found`);
      return;
    }

    socket.join(gameId);

    games[gameId].players[socket.id] = {
      name: playerName,
      balance: 100,
      wins: 0,
      cashouts: 0,
      stake: 0 
    };

    if (isHost) {
      games[gameId].hostId = socket.id;
      io.to(gameId).emit("host_joined", { playerName });
    } else {
      io.to(gameId).emit("player_joined", { playerName });
    }

    broadcastLeaderboard(gameId);
  });

  // Handle prediction
  socket.on("prediction", ({ gameId, playerName, choice }) => {
    console.log(`📡 Prediction from ${playerName} in ${gameId}: ${choice}`);
    io.to(gameId).emit("prediction_made", { player: playerName, choice });
  });

  // Handle stake_placed
  socket.on("stake_placed", ({ gameId, playerName, amount }) => {
    if (!games[gameId]) return;
    const player = Object.values(games[gameId].players).find(p => p.name === playerName);
    if (player) {
      player.stake = amount;
      player.balance -= amount;

      // ✅ Add stake to room's persistent pot balance
      games[gameId].potBalance = (games[gameId].potBalance || 0) + amount;
      const newPot = games[gameId].potBalance;

      // Broadcast stake and live pot update to room
      io.to(gameId).emit("stake_update", {
        playerName,
        amount,
        balance: player.balance
      });
      io.to(gameId).emit("pot_update", { amount: newPot });

      broadcastLeaderboard(gameId);
    }
  });

  // ✅ Handle cashout (Refunds 50%, retains remaining 50% in the persistent pot)
  socket.on("cashout", ({ gameId, playerName, amount }) => {
    if (!games[gameId]) return;

    const player = Object.values(games[gameId].players).find(p => p.name === playerName);
    if (player) {
      const refund = amount * 0.5;

      player.balance += refund;
      player.cashouts += 1;
      player.stake = 0; // Remove player's active stake

      // ✅ Deduct only the 50% refund from pot, leaving the other 50% intact
      games[gameId].potBalance = Math.max(0, (games[gameId].potBalance || 0) - refund);
      const newPot = games[gameId].potBalance;

      // Broadcast updated pot & cashout notification
      io.to(gameId).emit("pot_update", { amount: newPot });
      io.to(gameId).emit("cashout_update", { playerName, balance: player.balance });

      broadcastLeaderboard(gameId);
      console.log(`💸 ${playerName} cashed out. Refund: £${refund}. Remaining Pot: £${newPot}`);
    }
  });

  // Handle start_game
  socket.on("start_game", ({ gameId, host }) => {
    console.log(`🎮 Game ${gameId} started by host ${host}`);
    io.to(gameId).emit("game_starting", { host });

    setTimeout(() => {
      games[gameId].started = true;
      io.to(gameId).emit("game_started", { host });

      const ids = Object.keys(RugbyQuestions);
      const randomId = ids[Math.floor(Math.random() * ids.length)];
      games[gameId].currentQuestionId = randomId;

      io.to(gameId).emit("new_question", { id: randomId });
    }, 4000);
  });

  // Handle round outcome
  socket.on("round_outcome", ({ gameId, outcome }) => {
    console.log(`✅ Outcome for ${gameId}: ${outcome}`);
    io.to(gameId).emit("round_outcome", { outcome });
    if (games[gameId]) {
      games[gameId].lastOutcome = outcome;
    }
  });

  // ✅ Handle next round (Resets active stakes & zeroes pot for all clients)
  socket.on("next_round", ({ gameId }) => {
    if (!games[gameId]) return;

    // Reset persistent pot & individual stakes on server
    games[gameId].potBalance = 0;
    Object.values(games[gameId].players).forEach(p => {
      p.stake = 0;
    });

    // Zero out pot for all clients
    io.to(gameId).emit("pot_update", { amount: 0 });

    const ids = Object.keys(RugbyQuestions);
    const randomId = ids[Math.floor(Math.random() * ids.length)];
    games[gameId].currentQuestionId = randomId;
    io.to(gameId).emit("new_question", { id: randomId });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
    for (const [gameId, game] of Object.entries(games)) {
      if (game.players[socket.id]) {
        const playerName = game.players[socket.id].name;
        delete game.players[socket.id];
        io.to(gameId).emit("player_left", { playerName });
        broadcastLeaderboard(gameId);
      }
    }
  });
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
