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
  games[code] = { players: {} };
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

    const playerId = Math.random().toString(36).substring(2, 9);
    game.players[playerId] = { name: playerName };

    if (isHost) {
      game.hostId = playerId;
      io.to(gameId).emit("host_joined", { name: playerName });
    } else {
      io.to(gameId).emit("player_joined", { name: playerName });
    }

    socket.join(gameId);

    socket.on("disconnect", () => {
      if (!isHost) {
        io.to(gameId).emit("player_left", { name: playerName });
        delete game.players[playerId];
      }
    });
  });
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
