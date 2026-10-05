import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

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

// ✅ Serve MainMenu.html at root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "MainMenu.html"));
});

app.get("/gamesetup.html", (req, res) => {
  res.sendFile(path.join(__dirname, "gamesetup.html"));
});

// ✅ Optional: serve host and player pages directly
app.get("/host", (req, res) => {
  res.sendFile(path.join(__dirname, "host.html"));
});

app.get("/player", (req, res) => {
  res.sendFile(path.join(__dirname, "player.html"));
});

// --- Game state ---
const games = {};

app.post("/api/create-game", (req, res) => {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  games[code] = {
    players: {},
    hostId: null,
    predictions: { YES: 0, NO: 0 },
    started: false
  };
  res.json({ code });
});

app.get("/api/healthz", (req, res) => {
  res.json({ status: "ok" });
});

// ✅ Socket.IO handlers
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

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

  // Tell everyone the countdown is starting
  io.to(gameId).emit("game_starting", { host });

  // After 3 seconds + "GO!", mark the game as started
  setTimeout(() => {
    games[gameId].started = true;
    io.to(gameId).emit("game_started", { host });
  }, 4000); // 3 seconds countdown + 1 second for "GO!"
});


  // Handle round outcome (YES/NO)
  socket.on("round_outcome", ({ gameId, outcome }) => {
    console.log(`✅ Outcome for ${gameId}: ${outcome}`);

    // Broadcast to everyone in the room
    io.to(gameId).emit("round_outcome", { outcome });

    // Optional: update game state
    if (games[gameId]) {
      games[gameId].lastOutcome = outcome;
    }
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
