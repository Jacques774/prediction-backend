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

// ✅ Needed for ES modules (__dirname equivalent)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files (CSS, JS, images) from the project directory
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
    predictions: { YES: 0, NO: 0 },
    started: false,
    currentQuestionId: null,
    lastOutcome: null
  };
  res.json({ code });
});

app.get("/api/healthz", (req, res) => res.json({ status: "ok" }));

// ✅ Socket.IO handlers
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  socket.on("stake_placed", ({ gameId, playerName, amount }) => {
  const player = Object.values(games[gameId].players).find(p => p.name === playerName);
  if (player) {
    player.stake = amount;
  }
  console.log(`💰 Stake placed: ${playerName} staked £${amount}`);
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
      balance: 120,
      wins: 0,
      cashouts: 0
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

  // Handle cashout
  socket.on("cashout", ({ gameId, playerName, amount }) => {
    const player = Object.values(games[gameId].players).find(p => p.name === playerName);
    if (player) {
      player.balance += amount;
      player.cashouts += 1;
      io.to(gameId).emit("cashout_update", { playerName, balance: player.balance });
      broadcastLeaderboard(gameId);
    }
  });

  // Handle start_game
  socket.on("start_game", ({ gameId, host }) => {
    console.log(`🎮 Game ${gameId} started by host ${host}`);
    io.to(gameId).emit("game_starting", { host });

    setTimeout(() => {
      games[gameId].started = true;
      io.to(gameId).emit("game_started", { host });

      // ✅ Pick random ID from RugbyQuestions
      const ids = Object.keys(RugbyQuestions);
      const randomId = ids[Math.floor(Math.random() * ids.length)];
      games[gameId].currentQuestionId = randomId;

      // Broadcast only ID
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

  // Helper at top of file
function calculatePot(gameId) {
  const game = games[gameId];
  if (!game) return 0;
  return Object.values(game.players)
    .reduce((sum, p) => sum + (p.stake || 0), 0);
}

// Handle next round
socket.on("next_round", ({ gameId }) => {
  if (!games[gameId]) return;

  // ✅ Step 3: Calculate pot before new question
  const potAmount = calculatePot(gameId);
  io.to(gameId).emit("pot_reveal", { amount: potAmount });

  // ✅ Reset stakes for next round
  Object.values(games[gameId].players).forEach(p => p.stake = 0);

  // ✅ Pick next question
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

// ✅ Helper: broadcast leaderboard
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

// ✅ Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
