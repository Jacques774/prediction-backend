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

// ✅ Socket.IO join handler
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join_game", ({ gameId, playerName, isHost }) => {
    const game = games[gameId];
    if (!game) {
      socket.emit("error_message", "Game not found");
      return;
    }

    // Track player using socket.id
    game.players[socket.id] = { name: playerName, isHost };

    // Join the socket room
    socket.join(gameId);

    // Broadcast join events
    if (isHost) {
      game.hostId = socket.id;
      io.to(gameId).emit("host_joined", { name: playerName });
      console.log(`Host ${playerName} joined game ${gameId}`);
    } else {
      io.to(gameId).emit("player_joined", { playerName });
      console.log(`Player ${playerName} joined game ${gameId}`);
    }

    // Handle disconnect
    socket.on("disconnect", () => {
      const player = game.players[socket.id];
      if (player) {
        const leftName = player.name;
        delete game.players[socket.id];

        if (player.isHost) {
          io.to(gameId).emit("host_left", { name: leftName });
          console.log(`Host ${leftName} left game ${gameId}`);
        } else {
          io.to(gameId).emit("player_left", { name: leftName });
          console.log(`Player ${leftName} left game ${gameId}`);
        }
      }
    });
  });
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
