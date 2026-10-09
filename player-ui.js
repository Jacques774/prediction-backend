// player-ui.js
import { RugbyQuestions } from "./questions.js";
import Pot from "./pot.js";
import Utils from "./utils.js";
import Engine from "./engine.js";
import Leaderboard from "./leaderboard.js";

// DOM helpers
function showCountdown(timeLeft) {
  const stakeEl = document.getElementById("stakeCountdown");
  const potEl = document.getElementById("potAmount");
  if (potEl) potEl.style.display = "none";
  if (stakeEl) {
    stakeEl.style.display = "inline";
    stakeEl.textContent = `Stake window: ${timeLeft}s`;
  }
}
function revealPot(amount) {
  const stakeEl = document.getElementById("stakeCountdown");
  if (stakeEl) stakeEl.style.display = "none";
  const potEl = document.getElementById("potAmount");
  if (potEl) {
    potEl.style.display = "inline";
    potEl.textContent = "Pot: £" + amount.toFixed(2);
  }
}
function updatePot(amount) {
  const potEl = document.getElementById("potAmount");
  if (potEl) potEl.textContent = "Pot: £" + amount.toFixed(2);
}
window.showCountdown = showCountdown;
window.revealPot = revealPot;
window.updatePot = updatePot;

console.log("✅ player-ui.js loaded");

// Socket
const socket = io();
window.socket = socket;

document.addEventListener("DOMContentLoaded", () => {
  const joinBtn = document.getElementById("player-join-btn");
  if (!joinBtn) return;

  joinBtn.addEventListener("click", () => {
    const nameInput = document.getElementById("player-name-input");
    const codeInput = document.getElementById("game-code-input");
    const nameError = document.getElementById("playerNameError");

    const playerName = nameInput.value.trim();
    const gameId = codeInput.value.trim();
    if (!playerName || !gameId) {
      nameError.style.display = "block";
      return;
    }

    window.currentPlayerName = playerName;
    window.gameId = gameId;
    window.isHost = false;
    window.pot = new Pot([window.currentPlayerName]);
    console.log("Pot balances after join:", window.pot.balances);

    socket.emit("join_game", { gameId, playerName, isHost: false });

    document.getElementById("playerSetupSlide").style.display = "none";
    const dashboard = document.getElementById("dashboard");
    dashboard.classList.remove("hidden");
    dashboard.style.opacity = "1";

    const nameEl = document.getElementById("player-name");
    const balanceEl = document.getElementById("player-balance");
    if (nameEl) nameEl.textContent = `Player: ${playerName}`;
    if (balanceEl) {
      const balance = window.pot.balances[window.currentPlayerName] || 0;
      balanceEl.textContent = `Balance: £${Utils.formatMoney(balance)}`;
    }
  });
});

// Helpers
window.sendPrediction = (choice) => {
  socket.emit("prediction", {
    gameId: window.gameId,
    playerName: window.currentPlayerName,
    choice
  });
};
window.cashout = () => {
  const amount = parseInt(document.getElementById("cashout-amount").value, 10);
  if (!amount || amount <= 0) return;
  socket.emit("cashout", {
    gameId: window.gameId,
    playerName: window.currentPlayerName,
    amount
  });
};
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
socket.on("connect", () => (statusDot.style.backgroundColor = "limegreen"));
socket.on("disconnect", () => (statusDot.style.backgroundColor = "red"));

// Socket listeners
socket.on("game_starting", ({ host }) => {
  startPreCountdown(() => {
    const activeCard = document.getElementById("active-card");
    if (activeCard) activeCard.style.display = "block";
  });
});
socket.on("round_outcome", ({ outcome }) => {
  Engine.handleOutcome(outcome);
});
socket.on("new_question", ({ id }) => {
  const question = RugbyQuestions[id];
  Engine.nextQuestion(question);
  const activeCard = document.getElementById("active-card");
  if (activeCard) activeCard.style.display = "block";
});
socket.on("next_round", ({ gameId }) => {
  console.log("📡 Player received next_round for game:", gameId);
  // Engine.startNextCountdown will handle post-question countdown
});
socket.on("pot_reveal", ({ amount }) => {
  window.revealPot(amount);
});
