import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

// All active games live here
const games = {};

// ✅ Create Game route
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

// ✅ Health check route
app.get("/api/healthz", (req, res) => {
  res.json({ status: "ok" });
});

// ✅ Socket.IO handlers
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // --- Game join handler ---
  socket.on("join_game", ({ gameId, playerName, isHost }) => {
    const game = games[gameId];
    if (!game) {
      socket.emit("error_message", "Game not found");
      return;
    }

    if (game.started) {
      socket.emit("error_message", "Game already started. Room is closed.");
      return;
    }

    // Track player using socket.id
    game.players[socket.id] = { playerName, isHost, balance: 120, wins: 0, cashouts: 0 };
    socket.join(gameId);

    if (isHost) {
      game.hostId = socket.id;
      io.to(gameId).emit("host_joined", { playerName });
      console.log(`Host ${playerName} joined game ${gameId}`);
    } else {
      io.to(gameId).emit("player_joined", { playerName });
      console.log(`Player ${playerName} joined game ${gameId}`);
    }

    // Broadcast updated leaderboard immediately
    broadcastLeaderboard(gameId);

    // Handle disconnect
    socket.on("disconnect", () => {
      const player = game.players[socket.id];
      if (player) {
        const leftName = player.playerName;
        delete game.players[socket.id];

        if (player.isHost) {
          io.to(gameId).emit("host_left", { playerName: leftName });
          console.log(`Host ${leftName} left game ${gameId}`);
        } else {
          io.to(gameId).emit("player_left", { playerName: leftName });
          console.log(`Player ${leftName} left game ${gameId}`);
        }

        broadcastLeaderboard(gameId);
      }
    });
  });

  // --- Host starts game with countdown ---
  socket.on("start_game", ({ gameId, host }) => {
    const game = games[gameId];
    if (!game) return;

    game.started = true; // 🚪 lock the room

    io.to(gameId).emit("pre_countdown", { seconds: 3 });
    setTimeout(() => {
      io.to(gameId).emit("game_started", { host });
      game.predictions = { YES: 0, NO: 0 };
    }, 3000);
  });

 // --- Player answers ---
socket.on("player_action", ({ gameId, playerName, answer }) => {
  const game = games[gameId];
  if (!game) return;

  // Ensure predictions object exists
  if (!game.predictions) game.predictions = { YES: 0, NO: 0 };

  // Increment vote count
  if (answer === "YES") game.predictions.YES++;
  if (answer === "NO") game.predictions.NO++;

  // Calculate percentages
  const total = game.predictions.YES + game.predictions.NO;
  const yesPercent = total > 0 ? (game.predictions.YES / total) * 100 : 0;
  const noPercent = total > 0 ? (game.predictions.NO / total) * 100 : 0;

  // Broadcast aggregated percentages (not individual votes)
  io.to(gameId).emit("prediction_update", {
    yesPercent,
    noPercent,
    totals: game.predictions
  });

  console.log(`Answer in ${gameId} from ${playerName}: ${answer}`);
});

// --- Host resolves outcome ---
socket.on("host_resolve", ({ gameId, outcome }) => {
  const game = games[gameId];
  if (!game) return;

  io.to(gameId).emit("host_resolve", { outcome });
  console.log(`Outcome in ${gameId}: ${outcome}`);

  // Update balances & wins
  for (const player of Object.values(game.players)) {
    if (!player.isHost) {
      if (outcome === "YES") {
        player.balance += 10;
        player.wins++;
      } else if (outcome === "NO") {
        player.balance -= 5;
      }
    }
  }

  broadcastLeaderboard(gameId);

  // Reset predictions for next round
  game.predictions = { YES: 0, NO: 0 };
  io.to(gameId).emit("prediction_update", {
    yesPercent: 0,
    noPercent: 0,
    totals: game.predictions
  });
});

  // --- Cashout handler ---
  socket.on("cashout", ({ gameId, playerName, amount }) => {
    const game = games[gameId];
    const player = Object.values(game.players).find(p => p.playerName === playerName);

    if (player) {
      player.balance += amount;
      player.cashouts++;
      io.to(gameId).emit("cashout_update", { playerName, balance: player.balance });
      broadcastLeaderboard(gameId);
    }
  });
});

// ✅ Helper: broadcast leaderboard sorted by balance
function broadcastLeaderboard(gameId) {
  const game = games[gameId];
  if (!game) return;

  const leaderboard = Object.values(game.players)
    .sort((a, b) => b.balance - a.balance)
    .map(p => ({
      name: p.playerName,
      balance: p.balance,
      wins: p.wins,
      cashouts: p.cashouts
    }));

  io.to(gameId).emit("leaderboard_update", leaderboard);
}

// ✅ Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
