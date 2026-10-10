// ============================
// player-ui.js
// ============================

import { RugbyQuestions } from "./questions.js";

import Pot from "./pot.js";

// Create pot instance once for the player
const pot = new Pot([window.currentPlayerName || "Player"]);

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
    potEl.textContent = "Pot: £" + amount.toFixed(2);
  }
}

function updatePot(amount) {
  const potEl = document.getElementById("potAmount");
  if (potEl) {
    potEl.textContent = "Pot: £" + amount.toFixed(2);
  }
}

// Expose pot + helpers globally so Engine can access them
window.pot = pot;
window.showCountdown = showCountdown;
window.revealPot = revealPot;
window.updatePot = updatePot;

console.log("✅ player-ui.js loaded");

// ✅ Create socket connection
const socket = io();
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

    // Emit join event
    socket.emit("join_game", { gameId, playerName, isHost: false });

    // Hide setup, show dashboard
    document.getElementById("playerSetupSlide").style.display = "none";
    const dashboard = document.getElementById("dashboard");
    dashboard.classList.remove("hidden");
    dashboard.style.opacity = "1";

    // Starting balance already set in pot.js
balanceEl.textContent = `Balance: £${Utils.formatMoney(window.pot.balances[playerName])}`;
    const nameEl = document.getElementById("player-name");
    const balanceEl = document.getElementById("player-balance");
    if (nameEl) nameEl.textContent = `Player: ${playerName}`;
    if (balanceEl) {
      balanceEl.textContent = `Balance: £${Utils.formatMoney(window.balance)}`;
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

document.querySelector(".top-header").appendChild(statusDot);

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
    // ✅ Wait for server to send new_question
  });
});

// 🔑 Round outcome broadcast
socket.on("round_outcome", ({ outcome }) => {
  const result = Engine.handleOutcome(outcome);

  document.getElementById("player-balance").textContent =
  `Balance: £${Utils.formatMoney(window.pot.balances[window.currentPlayerName])}`;

  Leaderboard.update(window.currentPlayerName, window.balance);
  Leaderboard.render();

  // Show outcome text (optional)
  const outcomeEl = document.getElementById("player-outcome");
  if (outcomeEl) outcomeEl.textContent = `Outcome: ${outcome}`;

  // 🔧 Add countdown before next question
  window.startPostQuestionCountdown(() => {
    // Players don’t emit next_round — they just wait for server’s new_question
    console.log("⏳ Player finished post-question countdown, waiting for server...");
  });
});

// 🔑 New question broadcast
socket.on("new_question", ({ id }) => {
  const question = RugbyQuestions[id];
  console.log(`📡 Player received new question: ${question.text}`);

  // ✅ Use Engine to handle the resolved question
  Engine.nextQuestion(question);

  const activeCard = document.getElementById("active-card");
  if (activeCard) activeCard.style.display = "block";
});

// 🔑 Next round broadcast from host
socket.on("next_round", ({ gameId }) => {
  console.log("📡 Player received next_round for game:", gameId);

  // Run post-question countdown locally
  window.startPostQuestionCountdown(() => {
    // Start stake timer after countdown finishes
    window.pot.startStakeTimer(
      10000, // 10s stake window
      (timeLeft) => window.showCountdown(timeLeft),
      (amount) => window.revealPot(amount)
    );
  });
});


// Countdown helper for next question
window.startPostQuestionCountdown = function (onDone) {
  const el = document.getElementById("postQuestionCountdown"); // ✅ match HTML
  if (!el) return;
  el.style.display = "block";
  let count = 5; // or however many seconds you want
  el.textContent = count;
  const interval = setInterval(() => {
    count--;
    el.textContent = count > 0 ? count : "Next!";
    if (count < 0) {
      clearInterval(interval);
      el.style.display = "none";
      onDone();
    }
  }, 1000);
};

// ============================
// STAKE COUNTDOWN DISPLAY
// ============================
window.showCountdown = function (timeLeft) {
  const stakeEl = document.getElementById("stakeCountdown");
  const postEl = document.getElementById("postQuestionCountdown");
  const potEl = document.getElementById("potAmount");

  
  // Hide pot while stake timer is active
  if (potEl) potEl.style.display = "none";

  // Show stake timer
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
    potEl.textContent = "Pot: £" + amount.toFixed(2);
  }
};

// ✅ Listen for pot reveal from server
socket.on("pot_reveal", ({ amount }) => {
  console.log("💰 Player received pot reveal:", amount);
  window.revealPot(amount);   // update the pot UI correctly
});
