// ============================
// player-ui.js
// ============================

import { RugbyQuestions } from "./questions.js";
import Pot from "./pot.js";

// DOM helpers for stake timer + pot reveal
function showCountdown(timeLeft) {
  const countdownEl = document.getElementById("stakeCountdown");
  if (countdownEl) {
    countdownEl.style.display = "inline";
    countdownEl.textContent = "Stake window: " + timeLeft + "s";
  }
}

function revealPot(amount) {
  const countdownEl = document.getElementById("stakeCountdown");
  const potEl = document.getElementById("potAmount");
  if (countdownEl && potEl) {
    countdownEl.style.display = "none";
    potEl.style.display = "inline";
    potEl.textContent = "Pot: £" + Number(amount || 0).toFixed(2);
  }
}

function updatePot(amount) {
  const potEl = document.getElementById("potAmount");
  if (potEl) {
    potEl.textContent = "Pot: £" + Number(amount || 0).toFixed(2);
  }
}

// Expose helpers globally so Engine can access them
window.showCountdown = showCountdown;
window.revealPot = revealPot;
window.updatePot = updatePot;

console.log("✅ player-ui.js loaded");

// ✅ Connect to your Render backend correctly
const socket = io("https://prediction-backend-2e20.onrender.com");
window.socket = socket;

document.addEventListener("DOMContentLoaded", () => {
  const joinBtn = document.getElementById("player-join-btn");
  if (!joinBtn) {
    console.error("Join button not found — check ID or script placement.");
    return;
  }

  joinBtn.addEventListener("click", () => {
    console.log("🎯 Player Join button clicked!");

    const nameInput = document.getElementById("player-name-input");
    const codeInput = document.getElementById("game-code-input");
    const nameError = document.getElementById("playerNameError");

    const playerName = nameInput.value.trim();
    const gameId = codeInput.value.trim();

    if (!playerName || !gameId) {
      nameError.style.display = "block";
      return;
    }

    // Save globally
    window.currentPlayerName = playerName;
    window.gameId = gameId;
    window.isHost = false;

    // ✅ Create pot with correct player key
    window.pot = new Pot([window.currentPlayerName]);

    // Emit join event
    socket.emit("join_game", { gameId, playerName, isHost: false });

    // Hide setup, show dashboard
    document.getElementById("playerSetupSlide").style.display = "none";
    const dashboard = document.getElementById("dashboard");
    dashboard.classList.remove("hidden");
    dashboard.style.opacity = "1";

    // ✅ Get DOM elements FIRST before referencing them
    const nameEl = document.getElementById("player-name");
    const balanceEl = document.getElementById("player-balance");

    const startingBal = window.pot.balances[window.currentPlayerName] || 100;

    if (nameEl) nameEl.textContent = `Player: ${playerName}`;
    if (balanceEl) {
      balanceEl.textContent = `Balance: £${Number(startingBal).toFixed(2)}`;
    }
  });
});

// ============================
// Helpers
// ============================

// Prediction helper
window.sendPrediction = function (choice) {
  socket.emit("prediction", {
    gameId: window.gameId,
    playerName: window.currentPlayerName,
    choice
  });
};

// Cashout helper
window.cashout = function () {
  const amount = parseInt(document.getElementById("cashout-amount").value, 10);
  if (!amount || amount <= 0) return;
  socket.emit("cashout", {
    gameId: window.gameId,
    playerName: window.currentPlayerName,
    amount
  });
};

// Countdown helper
window.startPreCountdown = function (onDone) {
  const el = document.getElementById("preCountdown");
  if (!el) return;
  el.style.display = "block";
  let count = 3;
  el.textContent = count;
  const interval = setInterval(() => {
    count--;
    el.textContent = count > 0 ? count : "GO!";
    if (count < 0) {
      clearInterval(interval);
      el.style.display = "none";
      onDone();
    }
  }, 1000);
};

// ============================
// Status dot
// ============================

const statusDot = document.createElement("div");
statusDot.id = "socket-status";
statusDot.style.width = "10px";
statusDot.style.height = "10px";
statusDot.style.borderRadius = "50%";
statusDot.style.marginLeft = "8px";
statusDot.style.backgroundColor = socket.connected ? "limegreen" : "red";

const topHeader = document.querySelector(".top-header");
if (topHeader) topHeader.appendChild(statusDot);

socket.on("connect", () => (statusDot.style.backgroundColor = "limegreen"));
socket.on("disconnect", () => (statusDot.style.backgroundColor = "red"));

// ============================
// Socket listeners
// ============================

// 🔑 Game starting broadcast
socket.on("game_starting", ({ host }) => {
  console.log(`Game starting by host: ${host}`);

  startPreCountdown(() => {
    const activeCard = document.getElementById("active-card");
    if (activeCard) activeCard.style.display = "block";
  });
});

// 🔑 Round outcome broadcast
socket.on("round_outcome", ({ outcome }) => {
  if (typeof Engine !== "undefined" && typeof Engine.handleOutcome === "function") {
    Engine.handleOutcome(outcome);
  }

  const balanceEl = document.getElementById("player-balance");
  if (balanceEl && window.pot && window.currentPlayerName) {
    const currentBal = window.pot.balances[window.currentPlayerName] || 0;
    balanceEl.textContent = `Balance: £${Number(currentBal).toFixed(2)}`;
  }

  if (typeof Leaderboard !== "undefined" && window.currentPlayerName) {
    Leaderboard.update(window.currentPlayerName, window.pot.balances[window.currentPlayerName]);
    Leaderboard.render();
  }

  const outcomeEl = document.getElementById("player-outcome");
  if (outcomeEl) outcomeEl.textContent = `Outcome: ${outcome}`;

  window.startPostQuestionCountdown(() => {
    console.log("⏳ Player finished post-question countdown, waiting for server...");
  });
});

// 🔑 New question broadcast
socket.on("new_question", ({ id }) => {
  const question = RugbyQuestions[id];
  if (!question) {
    console.error("❌ Question not found for ID:", id);
    return;
  }
  console.log(`📡 Player received new question: ${question.text}`);

  if (typeof Engine !== "undefined" && typeof Engine.nextQuestion === "function") {
    Engine.nextQuestion(question);
  }

  const activeCard = document.getElementById("active-card");
  if (activeCard) activeCard.style.display = "block";
});

// 🔑 Next round broadcast from host
socket.on("next_round", ({ gameId }) => {
  console.log("📡 Player received next_round for game:", gameId);

  window.startPostQuestionCountdown(() => {
    if (window.pot) {
      window.pot.startStakeTimer(
        10000,
        (timeLeft) => window.showCountdown(timeLeft),
        (amount) => window.revealPot(amount)
      );
    }
  });
});

// 🔑 ✅ Real-time Pot Update Listener (Catch Cash-out & Stake reductions)
socket.on("pot_update", ({ amount }) => {
  console.log("💰 Player received pot update from server:", amount);
  if (window.pot) {
    window.pot.potBalance = amount;
  }

  const potEl = document.getElementById("potAmount");
  if (potEl) {
    potEl.textContent = "Pot: £" + Number(amount || 0).toFixed(2);
    if (amount > 0) {
      potEl.style.display = "inline";
    }
  }
});

// Countdown helper for next question
window.startPostQuestionCountdown = function (onDone) {
  const el = document.getElementById("postQuestionCountdown");
  if (!el) return;
  el.style.display = "block";
  let count = 5;
  el.textContent = count;
  const interval = setInterval(() => {
    count--;
    el.textContent = count > 0 ? count : "Next!";
    if (count < 0) {
      clearInterval(interval);
      el.style.display = "none";
      if (typeof onDone === "function") onDone();
    }
  }, 1000);
};

// ============================
// STAKE COUNTDOWN DISPLAY (Fixed)
// ============================
window.showCountdown = function (timeLeft) {
  const stakeEl = document.getElementById("stakeCountdown");
  const potEl = document.getElementById("potAmount");

  // Only hide pot if the pot balance is literally 0
  if (potEl && (!window.pot || window.pot.potBalance === 0)) {
    potEl.style.display = "none";
  }

  if (stakeEl) {
    stakeEl.style.display = "inline";
    stakeEl.textContent = `Stake window: ${timeLeft}s`;
  }
};

// ============================
// POT REVEAL
// ============================
window.revealPot = function (amount) {
  const stakeEl = document.getElementById("stakeCountdown");
  if (stakeEl) stakeEl.style.display = "none";

  const potEl = document.getElementById("potAmount");
  if (potEl) {
    potEl.style.display = "inline";
    potEl.textContent = "Pot: £" + Number(amount || 0).toFixed(2);
  }
};

socket.on("pot_reveal", ({ amount }) => {
  console.log("💰 Player received pot reveal:", amount);
  window.revealPot(amount);
});
