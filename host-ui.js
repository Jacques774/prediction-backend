// host-ui.js
import { RugbyQuestions } from "./questions.js";


import Pot from "./pot.js";

// DOM helpers for stake timer + pot reveal
function showCountdown(timeLeft) {
  const countdownEl = document.getElementById("stakeCountdown");
  if (countdownEl) {
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

console.log("✅ host-ui.js loaded");

// ✅ Create socket connection
const socket = io();
window.socket = socket;

// Read ?code= from URL
const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get("code");

if (!gameId) {
  console.error("❌ No game code found in URL. Did you come from setup.html?");
}
window.gameId = gameId;

document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("host-start-btn");
  if (!startBtn) {
    console.error("Start button not found — check ID or script placement.");
    return;
  }

  // Listen for server broadcast
    socket.on("game_starting", ({ host }) => {
      console.log(`Game starting by host: ${host}`);

      startPreCountdown(() => {
        const activeCard = document.getElementById("active-card");
        if (activeCard) activeCard.style.display = "block";
      });
    });

  // Listen for server broadcast of new question
    socket.on("new_question", ({ id }) => {
      const question = RugbyQuestions[id];
      console.log(`📡 Host received new question: ${question.text}`);
      Engine.nextQuestion(question);
    });

  
  startBtn.addEventListener("click", () => {
    console.log("🎯 Host Start button clicked!");

    const hostNameInput = document.getElementById("host-name-input");
    const hostNameError = document.getElementById("hostNameError");
    const hostName =
      hostNameInput && hostNameInput.value.trim()
        ? hostNameInput.value.trim()
        : "Host";

    if (!hostNameInput.value.trim()) {
      hostNameError.textContent = "Please enter your name";
      hostNameError.style.display = "block";
      return;
    }

    // ✅ Save globally so updateBalance can use it
    window.currentPlayerName = hostName;
    window.isHost = true;

    
// ✅ Create pot with correct host key
window.pot = new Pot([window.currentPlayerName]);

    // Host joins only when Start is pressed
    socket.emit("join_game", { gameId, playerName: hostName, isHost: true });
    socket.emit("start_game", { gameId, host: hostName });

    // Outcome buttons
    const yesBtn = document.getElementById("host-yes-btn");
    const noBtn = document.getElementById("host-no-btn");

    if (yesBtn) {
  yesBtn.addEventListener("click", () => {
    console.log("✅ Host chose outcome YES");
    socket.emit("round_outcome", { gameId: window.gameId, outcome: "YES" });

    // After outcome, trigger next round via server
    window.startPostQuestionCountdown(() => {
      socket.emit("next_round", { gameId: window.gameId });
    });
  });
}

if (noBtn) {
  noBtn.addEventListener("click", () => {
    console.log("✅ Host chose outcome NO");
    socket.emit("round_outcome", { gameId: window.gameId, outcome: "NO" });

    // After outcome, trigger next round via server
    window.startPostQuestionCountdown(() => {
      socket.emit("next_round", { gameId: window.gameId });
    });
  });
}

    socket.on("round_outcome", ({ outcome }) => {
  const result = Engine.handleOutcome(outcome);

  document.getElementById("player-balance").textContent =
  `Balance: £${Utils.formatMoney(window.pot.balances[window.currentPlayerName])}`;

  Leaderboard.update(
  window.currentPlayerName,
  window.pot.balances[window.currentPlayerName]
);
  Leaderboard.render();

  // Outcome panel only for host
  document.getElementById("outcome-panel").textContent = `Outcome: ${outcome}`;
});

    // Animate + hide setup slide
    const hostSlide = document.getElementById("hostSetupSlide");
    if (hostSlide) {
      hostSlide.classList.add("slide-away");
      setTimeout(() => {
        hostSlide.style.display = "none";
      }, 700);
    }

    // Show dashboard
    const dashboard = document.getElementById("dashboard");
    if (dashboard) {
      dashboard.classList.remove("hidden");
      dashboard.style.opacity = "1";
    }

const nameEl = document.getElementById("player-name");
const balanceEl = document.getElementById("player-balance");

if (nameEl) nameEl.textContent = `Host: ${hostName}`;
if (balanceEl) {
  balanceEl.textContent = "Balance: £" + 
    (typeof Utils !== "undefined" && Utils.formatMoney
      ? Utils.formatMoney(window.pot.balances[window.currentPlayerName])
      : window.pot.balances[window.currentPlayerName].toFixed(2));
}

  });
});

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

socket.on("connect", () => (statusDot.style.backgroundColor = "limegreen"));
socket.on("disconnect", () => (statusDot.style.backgroundColor = "red"));
