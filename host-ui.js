// host-ui.js
import { RugbyQuestions } from "./questions.js";
import Pot from "./pot.js";
import Utils from "./utils.js";
import Engine from "./engine.js";
import Leaderboard from "./leaderboard.js";

// DOM helpers
function showCountdown(timeLeft) {
  const countdownEl = document.getElementById("stakeCountdown");
  if (countdownEl) countdownEl.textContent = "Stake window: " + timeLeft + "s";
}
function revealPot(amount) {
  const countdownEl = document.getElementById("stakeCountdown");
  const potEl = document.getElementById("potAmount");
  if (countdownEl) countdownEl.style.display = "none";
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

console.log("✅ host-ui.js loaded");

// Socket
const socket = io();
window.socket = socket;

// Game code
const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get("code");
window.gameId = gameId;

// DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("host-start-btn");
  if (!startBtn) return;

  startBtn.addEventListener("click", () => {
    const hostNameInput = document.getElementById("host-name-input");
    const hostNameError = document.getElementById("hostNameError");
    const hostName = hostNameInput.value.trim() || "Host";
    if (!hostNameInput.value.trim()) {
      hostNameError.textContent = "Please enter your name";
      hostNameError.style.display = "block";
      return;
    }

    window.currentPlayerName = hostName;
    window.isHost = true;
    window.pot = new Pot([window.currentPlayerName]);
    console.log("Pot balances after host join:", window.pot.balances);

    socket.emit("join_game", { gameId, playerName: hostName, isHost: true });
    socket.emit("start_game", { gameId, host: hostName });

    // Outcome buttons
    const yesBtn = document.getElementById("host-yes-btn");
    const noBtn = document.getElementById("host-no-btn");
    if (yesBtn) yesBtn.onclick = () => Engine.handleOutcome("YES");
    if (noBtn) noBtn.onclick = () => Engine.handleOutcome("NO");

    socket.on("round_outcome", ({ outcome }) => {
      Engine.handleOutcome(outcome);
    });

    // Hide setup, show dashboard
    document.getElementById("hostSetupSlide").style.display = "none";
    const dashboard = document.getElementById("dashboard");
    dashboard.classList.remove("hidden");
    dashboard.style.opacity = "1";

    const nameEl = document.getElementById("player-name");
    const balanceEl = document.getElementById("player-balance");
    if (nameEl) nameEl.textContent = `Host: ${hostName}`;
    if (balanceEl) {
      const balance = window.pot.balances[window.currentPlayerName] || 0;
      balanceEl.textContent = "Balance: £" + Utils.formatMoney(balance);
    }

    socket.on("game_starting", ({ host }) => {
      startPreCountdown(() => {
        const activeCard = document.getElementById("active-card");
        if (activeCard) activeCard.style.display = "block";
      });
    });

    socket.on("new_question", ({ id }) => {
      const question = RugbyQuestions[id];
      Engine.nextQuestion(question);
    });
  });
});

// Pre-countdown only
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

// Host
const hostSlide = document.getElementById("hostSetupSlide");
if (hostSlide) {
  hostSlide.classList.add("slide-away");
  setTimeout(() => {
    hostSlide.style.display = "none";
  }, 700); // match your CSS transition duration
}
