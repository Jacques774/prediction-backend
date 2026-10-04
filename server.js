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

// ✅ Serve MainMenu.html at root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "MainMenu.html"));
});

// ✅ Optional: serve host and player pages directly
app.get("/host", (req, res) => {
  res.sendFile(path.join(__dirname, "host.html"));
});

app.get("/player", (req, res) => {
  res.sendFile(path.join(__dirname, "player.html"));
});

// --- Your existing game logic below ---
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

// ✅ Socket.IO handlers (unchanged)
io.on("connection", (socket) => {
  // ... all your existing socket logic ...
});

// ✅ Helper: broadcast leaderboard (unchanged)
function broadcastLeaderboard(gameId) {
  // ... your existing leaderboard logic ...
}

// ✅ Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
