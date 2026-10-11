// socket.js
const socket = io("https://prediction-backend-2e20.onrender.com");
window.socket = socket;

// --- Player & Host joins ---
socket.on("host_joined", ({ playerName }) => {
  const list = document.getElementById("host-player-list");
  if (list) {
    const item = document.createElement("li");
    item.textContent = `👑 Host: ${playerName}`;
    list.appendChild(item);
  }
});

socket.on("player_joined", ({ playerName }) => {
  const list = document.getElementById("host-player-list");
  if (list) {
    const item = document.createElement("li");
    item.textContent = `🎮 Player: ${playerName}`;
    list.appendChild(item);
  }
});

// --- Send prediction (YES/NO) ---
function sendPrediction(choice) {
  const gameId = window.gameId;
  const playerName = window.currentPlayerName || "Player";

  if (window.socket) {
    window.socket.emit("prediction", {
      gameId,
      playerName,
      choice
    });
  }

  console.log(`📡 Prediction sent: ${choice}`);
}
window.sendPrediction = sendPrediction;

// --- Host outcome resolution ---
socket.on("host_resolve", ({ outcome }) => {
  Engine.handleOutcome(outcome);
});

// --- Leaderboard object for arrows ---
window.Leaderboard = {
  scores: {},
  lastScores: {},

  update(name, balance) {
    if (this.scores[name] !== undefined) {
      this.lastScores[name] = this.scores[name];
    } else {
      this.lastScores[name] = balance;
    }
    this.scores[name] = balance;
  },

  movement(name) {
    const old = this.lastScores[name] || 0;
    const current = this.scores[name] || 0;
    if (current > old) return "up";
    if (current < old) return "down";
    return "same";
  }
};

// --- Leaderboard updates ---
socket.on("leaderboard_update", (players) => {
  console.log("Leaderboard payload:", JSON.stringify(players, null, 2));

  players.forEach(p => {
    const playerName = p.name;   // server always sends 'name'
    const balance = p.balance;
    const wins = p.wins;
    const cashouts = p.cashouts;

    window.Leaderboard.update(playerName, balance);

    // ✅ ONLY update the dashboard header if this entry belongs to the current user
    if (window.currentPlayerName && playerName.trim().toLowerCase() === window.currentPlayerName.trim().toLowerCase()) {
      const nameEl = document.getElementById("player-name");
      const balanceEl = document.getElementById("player-balance");
      const winsEl = document.getElementById("player-wins");
      const cashoutsEl = document.getElementById("player-cashouts");

      if (nameEl) nameEl.textContent = `Player: ${playerName}`;
      if (balanceEl) balanceEl.textContent = `Balance: £${typeof balance === 'number' ? balance.toFixed(2) : balance}`;
      if (winsEl) winsEl.textContent = `Wins: ${wins}`;
      if (cashoutsEl) cashoutsEl.textContent = `Cash-outs: ${cashouts}`;
    }
  });

  // Let leaderboard.js handle rendering the full list
  window.Leaderboard.render();
});

// --- Cashout updates ---
socket.on("cashout_update", ({ playerName, balance }) => {
  console.log(`${playerName} cashed out. New balance: £${balance}`);
});

// --- New question from server ---
socket.on("new_question", ({ id }) => {
  console.log("📡 New question ID received:", id);

  // Look up the question text locally
  const q = RugbyQuestions[id];
  if (!q) {
    console.error("❌ Question not found for ID:", id);
    return;
  }

  // Pass the full question object to Engine
  Engine.nextQuestion(q);
});

// --- Pot updates (live pot changes from stakings or cashouts) ---
socket.on("pot_update", ({ amount }) => {
  console.log("💰 Pot updated:", amount);
  if (typeof window.updatePot === "function") {
    window.updatePot(amount);
  }
});
