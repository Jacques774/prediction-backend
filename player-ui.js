// player-ui.js

console.log("✅ player-ui.js loaded");

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
    if (window.socket) {
      window.socket.emit("join_game", { gameId, playerName, isHost: false });
    }

    // Hide setup, show dashboard
    document.getElementById("playerSetupSlide").style.display = "none";
    const dashboard = document.getElementById("dashboard");
    dashboard.classList.remove("hidden");
    dashboard.style.opacity = "1";

    // Update dashboard header
    const nameEl = document.getElementById("player-name");
    const balanceEl = document.getElementById("player-balance");
    if (nameEl) nameEl.textContent = `Player: ${playerName}`;
    if (balanceEl) balanceEl.textContent = "Balance: 120";
  });
});

// Prediction helper
window.sendPrediction = function (choice) {
  if (!window.socket) return;
  window.socket.emit("prediction", {
    gameId: window.gameId,
    playerName: window.currentPlayerName,
    choice
  });
};

// Cashout helper
window.cashout = function () {
  const amount = parseInt(document.getElementById("cashout-amount").value, 10);
  if (!amount || amount <= 0) return;
  if (!window.socket) return;

  window.socket.emit("cashout", {
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

// Status dot
const statusDot = document.createElement("div");
statusDot.id = "socket-status";
statusDot.style.width = "10px";
statusDot.style.height = "10px";
statusDot.style.borderRadius = "50%";
statusDot.style.marginLeft = "8px";
statusDot.style.backgroundColor = socket.connected ? "limegreen" : "red";

document.querySelector(".top-header").appendChild(statusDot);

socket.on("connect", () => statusDot.style.backgroundColor = "limegreen");
socket.on("disconnect", () => statusDot.style.backgroundColor = "red");

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
  console.log(`📡 Round outcome: ${outcome}`);

  const outcomeEl = document.getElementById("outcome-panel");
  if (outcomeEl) {
    outcomeEl.textContent = `Outcome: ${outcome}`;
    outcomeEl.style.display = "block";
  }

  // ✅ Wait for server to send next new_question
  startPreCountdown(() => {
    const activeCard = document.getElementById("active-card");
    if (activeCard) activeCard.style.display = "block";
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
