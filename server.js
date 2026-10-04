import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Needed for ES modules (__dirname equivalent)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Serve static files (CSS, images, JS)
app.use(express.static(__dirname));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

// ✅ Serve MainMenu.html at root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "MainMenu.html"));
});

// ✅ Serve other pages
app.get("/gamesetup.html", (req, res) => {
  res.sendFile(path.join(__dirname, "gamesetup.html"));
});

app.get("/host", (req, res) => {
  res.sendFile(path.join(__dirname, "host.html"));
});

app.get("/player", (req, res) => {
  res.sendFile(path.join(__dirname, "player.html"));
});

// --- Your existing game logic below ---
