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
    potEl.textContent = "Pot: £" + Number(amount).toFixed(2);
  }
}

function updatePot(amount) {
  const potEl = document.getElementById("potAmount");
  if (potEl) {
    potEl.textContent = "Pot: £" + Number(amount).toFixed(2);
  }
}

// Expose helpers globally so Engine can access them
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
  console.error("❌ No game code found in URL. Did you come from gamesetup.html?");
}
window.gameId = gameId;

document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("host-start-btn");
  if (!startBtn) {
    console.error("Start button not found — check ID or script placement.");
    return;
  }

  // --- Socket Listeners (Registered globally once on load) ---
  socket.on("game_starting", ({ host }) => {
    console.log(`Game starting by host: ${host}`);

    startPreCountdown(() => {
      const activeCard = document.getElementById("active-card");
      if (activeCard) activeCard.style.display = "block";
    });
  });

  socket.on("new_question", ({ id }) => {
    const question = RugbyQuestions[id];
    console.log(`📡 Host received new question: ${question.text}`);
    if (window.Engine && typeof window.Engine.nextQuestion === "function") {
      window.Engine.nextQuestion(question);
    }
  });

  socket.on("round_outcome", ({ outcome }) => {
    if (window.Engine && typeof window.Engine.handleOutcome === "function") {
      Engine.handleOutcome(outcome);
    }

    const balanceEl = document.getElementById("player-balance");
    if (balanceEl && window.pot && window.currentPlayerName) {
      balanceEl.textContent = `Balance: £${Utils.formatMoney(window.pot.balances[window.currentPlayerName])}`;
    }

    if (window.Leaderboard && window.currentPlayerName) {
      Leaderboard.update(
        window.currentPlayerName,
        window.pot.balances[window.currentPlayerName]
      );
      Leaderboard.render();
    }

    const outcomePanel = document.getElementById("outcome-panel");
    if (outcomePanel) {
      outcomePanel.textContent = `Outcome: ${outcome}`;
    }
  });

  // --- Host Start Button Click ---
  startBtn.addEventListener("click", () => {
    console.log("🎯 Host Start button clicked!");

    const hostNameInput = document.getElementById("host-name-input");
    const hostNameError = document.getElementById("hostNameError");
    const hostName =
      hostNameInput && hostNameInput.value.trim()
        ? hostNameInput.value.trim()
        : "Host";

    if (!hostNameInput.value.trim()) {
      if (hostNameError) {
        hostNameError.textContent = "Please enter your name";
        hostNameError.style.display = "block";
      }
      return;
    }

    // ✅ Save globally
    window.currentPlayerName = hostName;
    window.isHost = true;

    // ✅ Create pot with correct host key & expose globally
    window.pot = new Pot([window.currentPlayerName]);

    // Host joins and starts game via server
    socket.emit("join_game", { gameId, playerName: hostName, isHost: true });
    socket.emit("start_game", { gameId, host: hostName });

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

  // Outcome buttons setup
  const yesBtn = document.getElementById("host-yes-btn");
  const noBtn = document.getElementById("host-no-btn");

  if (yesBtn) {
    yesBtn.addEventListener("click", () => {
      console.log("✅ Host chose outcome YES");
      socket.emit("round_outcome", { gameId: window.gameId, outcome: "YES" });

      window.startPostQuestionCountdown(() => {
        socket.emit("next_round", { gameId: window.gameId });
      });
    });
  }

  if (noBtn) {
    noBtn.addEventListener("click", () => {
      console.log("✅ Host chose outcome NO");
      socket.emit("round_outcome", { gameId: window.gameId, outcome: "NO" });

      window.startPostQuestionCountdown(() => {
        socket.emit("next_round", { gameId: window.gameId });
      });
    });
  }
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

const topHeader = document.querySelector(".top-header");
if (topHeader) {
  topHeader.appendChild(statusDot);
}

socket.on("connect", () => (statusDot.style.backgroundColor = "limegreen"));
socket.on("disconnect", () => (statusDot.style.backgroundColor = "red"));
