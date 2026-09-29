import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP + Socket.IO server
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

// All active games live here
const games = {};

// ✅ Create Game route
app.post("/api/create-game", (req, res) => {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  games[code] = { players: {}, hostId: null };
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

    // Track player using socket.id
    game.players[socket.id] = { playerName, isHost };
    socket.join(gameId);

    // Broadcast join events
    if (isHost) {
      game.hostId = socket.id;
      io.to(gameId).emit("host_joined", { playerName });
      console.log(`Host ${playerName} joined game ${gameId}`);
    } else {
      io.to(gameId).emit("player_joined", { playerName });
      console.log(`Player ${playerName} joined game ${gameId}`);
    }

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
      }
    });
  });

  // --- Chat handler ---
  socket.on("chat_message", ({ gameId, playerName, message }) => {
    io.to(gameId).emit("chat_message", { playerName, message });
    console.log(`Chat in ${gameId} from ${playerName}: ${message}`);
  });

  // --- Player answers ---
  socket.on("player_action", ({ gameId, playerName, answer }) => {
    io.to(gameId).emit("player_action", { playerName, answer });
    console.log(`Answer in ${gameId} from ${playerName}: ${answer}`);
  });

  // --- Host resolves outcome ---
  socket.on("host_resolve", ({ gameId, outcome }) => {
    io.to(gameId).emit("host_resolve", { outcome });
    console.log(`Outcome in ${gameId}: ${outcome}`);
  });
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
