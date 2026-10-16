const socket = io("https://prediction-backend-2e20.onrender.com");
window.socket = socket;

// ============================
// LOBBY & PLAYER JOINS
// ============================
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

// ============================
// PREDICTIONS & STAKES
// ============================
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

// ✅ NEW: Listen for other players placing stakes in real time
socket.on("remote_stake_placed", ({ playerName, amount }) => {
  if (window.pot && playerName !== window.currentPlayerName) {
    window.pot.stakes[playerName] = (window.pot.stakes[playerName] || 0) + amount;
    window.pot.potBalance += amount;
  }
});

// ✅ NEW: Listen for other players cashing out in real time
socket.on("remote_cashout", ({ playerName, amount }) => {
  if (window.pot && playerName !== window.currentPlayerName) {
    const refund = amount * 0.5;
    window.pot.potBalance -= refund;
    window.pot.stakes[playerName] = 0;

    const potEl = document.getElementById("potAmount");
    if (potEl) {
      potEl.textContent = `Pot: £${Number(window.pot.potBalance).toFixed(2)}`;
    }
  }
});

// ============================
// POT & REVEAL LISTENERS
// ============================
socket.on("pot_update", ({ amount }) => {
  console.log("💰 Pot updated from server:", amount);

  if (window.pot) {
    window.pot.potBalance = amount;
  }

  const potEl = document.getElementById("potAmount");
  if (potEl) {
    potEl.textContent = `Pot: £${Number(amount || 0).toFixed(2)}`;
    if (amount > 0) {
      potEl.style.display = "inline";
    }
  }
});

// ✅ Clean pot_reveal response handling
socket.on("pot_reveal", ({ amount }) => {
  console.log("🔓 Pot revealed:", amount);
  if (window.pot) {
    window.pot.revealPot(amount);
  }
});

// ============================
// HOST RESOLUTION & ROUND END
// ============================
// Handles simple outcome push
socket.on("host_resolve", ({ outcome }) => {
  if (typeof Engine !== "undefined" && typeof Engine.handleOutcome === "function") {
    Engine.handleOutcome(outcome);
  }
});

// ✅ NEW: Handles full round resolution with server winner list
socket.on("round_outcome", ({ outcome, winners }) => {
  console.log(`🏁 Round outcome resolved: ${outcome}`, winners);
  if (typeof Engine !== "undefined" && typeof Engine.handleOutcome === "function") {
    Engine.handleOutcome(outcome, winners);
  }
});

// ============================
// LEADERBOARD & BALANCE SYNC
// ============================
if (!window.Leaderboard) {
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
    },

    render() {}
  };
}

socket.on("leaderboard_update", (players) => {
  console.log("Leaderboard payload:", JSON.stringify(players, null, 2));

  players.forEach(p => {
    const playerName = p.name;   
    const balance = p.balance;
    const wins = p.wins;
    const cashouts = p.cashouts;

    if (window.pot && window.pot.balances) {
      window.pot.balances[playerName] = balance;
    }

    if (window.Leaderboard && typeof window.Leaderboard.update === "function") {
      window.Leaderboard.update(playerName, balance);
    }

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

  if (window.Leaderboard && typeof window.Leaderboard.render === "function") {
    window.Leaderboard.render();
  }
});

socket.on("cashout_update", ({ playerName, balance }) => {
  console.log(`💸 ${playerName} cashed out. New balance: £${balance}`);
  
  if (window.pot && window.pot.balances) {
    window.pot.balances[playerName] = balance;
  }
});

// ============================
// QUESTION FLOW
// ============================
socket.on("new_question", ({ id }) => {
  console.log("📡 New question ID received:", id);

  if (typeof RugbyQuestions === "undefined") {
    console.error("❌ RugbyQuestions is not loaded.");
    return;
  }

  const q = RugbyQuestions[id];
  if (!q) {
    console.error("❌ Question not found for ID:", id);
    return;
  }

  if (typeof Engine !== "undefined" && typeof Engine.nextQuestion === "function") {
    Engine.nextQuestion(q);
  }
});
