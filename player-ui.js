import { RugbyQuestions } from "./questions.js";
import Pot from "./pot.js";

// ============================
// DOM Helpers for Stake Timer & Delayed Pot Reveal
// ============================
window.isStakeWindowActive = false;

function showCountdown(timeLeft) {
  window.isStakeWindowActive = true;
  document.body.classList.add("stake-active"); // Locks pot hidden via CSS

  const countdownEl = document.getElementById("stakeCountdown");
  const potEl = document.getElementById("potAmount");

  if (potEl) {
    potEl.style.setProperty("display", "none", "important");
  }

  if (countdownEl) {
    countdownEl.style.display = "inline";
    countdownEl.textContent = "Stake window: " + timeLeft + "s";
  }
}

function revealPot(amount) {
  window.isStakeWindowActive = false;
  document.body.classList.remove("stake-active"); // Unlocks pot display

  const countdownEl = document.getElementById("stakeCountdown");
  const potEl = document.getElementById("potAmount");

  if (countdownEl) {
    countdownEl.style.display = "none";
  }

  if (potEl) {
    potEl.style.removeProperty("display");
    potEl.style.display = "inline";
    potEl.textContent = "Pot: £" + Number(amount || 0).toFixed(2);
  }
}

function updatePot(amount) {
  const potEl = document.getElementById("potAmount");
  if (!potEl) return;

  // Update text silently
  potEl.textContent = "Pot: £" + Number(amount || 0).toFixed(2);

  // If stake window is running, force element hidden
  if (window.isStakeWindowActive) {
    potEl.style.setProperty("display", "none", "important");
  }
}

// Expose helpers globally so Engine can access them
window.showCountdown = showCountdown;
window.revealPot = revealPot;
window.updatePot = updatePot;

console.log("✅ player-ui.js loaded");

// ✅ Connect to Render backend
const socket = io("https://prediction-backend-2e20.onrender.com");
window.socket = socket;

document.addEventListener("DOMContentLoaded", () => {
  // ============================
  // STAT TRACKING GLOBALS
  // ============================
  window.totalWins = 0;
  window.totalCashouts = 0;

  // 🔑 Auto-fill game code from URL query parameter if present
  const urlParams = new URLSearchParams(window.location.search);
  const codeParam = urlParams.get("code");
  const codeInput = document.getElementById("game-code-input");
  if (codeParam && codeInput) {
    codeInput.value = codeParam.toUpperCase();
  }

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

    const playerName = nameInput ? nameInput.value.trim() : "";
    const gameId = codeInput ? codeInput.value.trim() : "";

    if (!playerName || !gameId) {
      if (nameError) nameError.style.display = "block";
      return;
    }

    // Save globally
    window.currentPlayerName = playerName;
    window.gameId = gameId;
    window.isHost = false;

    // Check for custom buy-in in URL if passed
    const currentUrlParams = new URLSearchParams(window.location.search);
    const buyInAmount = Number(currentUrlParams.get("buyin")) || 100;

    // ✅ Initialize pot with player name & buy-in amount
    window.pot = new Pot([window.currentPlayerName], buyInAmount);

    // Emit join event
    socket.emit("join_game", { gameId, playerName, isHost: false });

    // Hide setup, show dashboard
    const setupSlide = document.getElementById("playerSetupSlide");
    if (setupSlide) setupSlide.style.display = "none";

    const dashboard = document.getElementById("dashboard");
    if (dashboard) {
      dashboard.classList.remove("hidden");
      dashboard.style.opacity = "1";
    }

    // Get DOM elements
    const nameEl = document.getElementById("player-name");
    const balanceEl = document.getElementById("player-balance");

    const startingBal = window.pot.balances[window.currentPlayerName] || buyInAmount;

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
  if (!socket || !window.gameId || !window.currentPlayerName) return;
  socket.emit("prediction", {
    gameId: window.gameId,
    playerName: window.currentPlayerName,
    choice
  });
};

// Cashout helper (connects through Engine)
window.cashout = function () {
  if (typeof Engine !== "undefined" && typeof Engine.cashout === "function") {
    Engine.cashout();
  }
};

// Countdown helper
window.startPreCountdown = function (onDone) {
  const el = document.getElementById("preCountdown");
  if (!el) {
    if (typeof onDone === "function") onDone();
    return;
  }
  el.style.display = "block";
  let count = 3;
  el.textContent = count;
  const interval = setInterval(() => {
    count--;
    el.textContent = count > 0 ? count : "GO!";
    if (count < 0) {
      clearInterval(interval);
      el.style.display = "none";
      if (typeof onDone === "function") onDone();
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

  window.startPreCountdown(() => {
    const activeCard = document.getElementById("active-card");
    if (activeCard) activeCard.style.display = "block";
  });
});

// 🔑 Deduplication guard to prevent double-firing
let lastSeenPlayerIndex = 0;

// 🔑 New question broadcast
socket.on("new_question", ({ id, timer, current, total }) => {
  if (current !== undefined && current === lastSeenPlayerIndex) return;
  if (current !== undefined) lastSeenPlayerIndex = current;

  if (typeof RugbyQuestions === "undefined") {
    console.error("❌ RugbyQuestions is not loaded.");
    return;
  }

  const question = RugbyQuestions[id];
  if (!question) {
    console.error("❌ Question not found for ID:", id);
    return;
  }

  // ✅ Pass the server's custom timer attached to the question
  const questionWithTimer = {
    ...question,
    timer: timer || 60
  };

  console.log(`📡 Player received new question: ${question.text} (Timer: ${questionWithTimer.timer}s)`);

  if (typeof Engine !== "undefined" && typeof Engine.nextQuestion === "function") {
    Engine.nextQuestion(questionWithTimer);
  }

  // ✅ Update player question tally display
  const tallyEl = document.getElementById("player-question-tally");
  if (tallyEl && current !== undefined && total !== undefined) {
    tallyEl.textContent = `Question ${current} of ${total}`;
  }

  const activeCard = document.getElementById("active-card");
  if (activeCard) activeCard.style.display = "block";
});

// 🔑 Real-time Pot Update Listener (Guarded by active countdown flag)
socket.on("pot_update", ({ amount }) => {
  console.log("💰 Player received pot update from server:", amount);
  if (window.pot) {
    window.pot.potBalance = amount;
  }
  updatePot(amount);
});

// Countdown helper for next question
window.startPostQuestionCountdown = function (onDone, duration = 5) {
  const el = document.getElementById("postQuestionCountdown");
  if (!el) {
    if (typeof onDone === "function") onDone();
    return;
  }
  el.style.display = "block";
  let count = duration;
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

socket.on("pot_reveal", ({ amount }) => {
  console.log("💰 Player received pot reveal:", amount);
  window.revealPot(amount);
});

// 🔑 Direct Authoritative Balance Update from Server
socket.on("balance_update", ({ balance }) => {
  console.log("💰 Player received direct balance update:", balance);
  
  if (window.pot && window.currentPlayerName) {
    window.pot.balances[window.currentPlayerName] = balance;
  }

  const balanceEl = document.getElementById("player-balance");
  if (balanceEl) {
    balanceEl.textContent = `Balance: £${Number(balance).toFixed(2)}`;
  }
});

// 🔑 Real-time Leaderboard Sync using leaderboard.js
socket.on("leaderboard_update", (players) => {
  console.log("📊 Player received leaderboard update from server:", players);

  if (typeof Leaderboard !== "undefined") {
    players.forEach(p => {
      Leaderboard.update(p.name, p.balance);
    });
    Leaderboard.render();
  }
});
