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

console.log("✅ host-ui.js loaded");

// ✅ Create socket connection to Render backend
const socket = io("https://prediction-backend-2e20.onrender.com");
window.socket = socket;

// Read ?code= and optional ?buyin= from URL
const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get("code");
const buyInAmount = Number(urlParams.get("buyin")) || 100;

if (!gameId) {
  console.error("❌ No game code found in URL. Did you come from setup.html?");
}
window.gameId = gameId;

document.addEventListener("DOMContentLoaded", () => {
  // ============================
  // STAT TRACKING GLOBALS
  // ============================
  window.totalWins = 0;
  window.totalCashouts = 0;

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

  // Listen for joined players and add them to local pot balance tracker
  socket.on("player_joined", ({ playerName }) => {
    console.log(`🎮 Player joined host session: ${playerName}`);
    if (window.pot && window.pot.balances) {
      if (window.pot.balances[playerName] === undefined) {
        window.pot.balances[playerName] = buyInAmount;
        window.pot.stakes[playerName] = 0;
      }
    }
  });

  // Listen for server broadcast of new question
  socket.on("new_question", ({ id }) => {
    const question = RugbyQuestions[id];
    if (!question) return;
    console.log(`📡 Host received new question: ${question.text}`);
    if (typeof Engine !== "undefined" && typeof Engine.nextQuestion === "function") {
      Engine.nextQuestion(question);
    }
  });

  // Real-time Pot Update Listener for Host Screen (Guarded by active countdown flag)
  socket.on("pot_update", ({ amount }) => {
    console.log("💰 Pot updated on Host screen:", amount);
    if (window.pot) {
      window.pot.potBalance = amount;
    }
    updatePot(amount);
  });

  // ✅ Round Outcome socket handler (Includes Win counter increment)
  socket.on("round_outcome", ({ outcome, winners }) => {
    if (typeof Engine !== "undefined" && typeof Engine.handleOutcome === "function") {
      Engine.handleOutcome(outcome, winners);
    }

    const player = window.currentPlayerName;
    if (winners && player && winners.map(w => w.trim().toLowerCase()).includes(player.trim().toLowerCase())) {
      window.totalWins++;
      const winsEl = document.getElementById("player-wins");
      if (winsEl) winsEl.textContent = `Wins: ${window.totalWins}`;
    }

    const balanceEl = document.getElementById("player-balance");
    if (balanceEl && window.pot && window.pot.balances[player] !== undefined) {
      const bal = window.pot.balances[player];
      balanceEl.textContent = `Balance: £${Number(bal).toFixed(2)}`;
    }

    const outcomePanel = document.getElementById("outcome-panel");
    if (outcomePanel) outcomePanel.textContent = `Outcome: ${outcome}`;
  });

  // ============================
  // OUTCOME BUTTONS
  // ============================
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

  // ============================
  // START BUTTON CLICK
  // ============================
  startBtn.addEventListener("click", () => {
    console.log("🎯 Host Start button clicked!");

    const hostNameInput = document.getElementById("host-name-input");
    const hostNameError = document.getElementById("hostNameError");
    const hostName =
      hostNameInput && hostNameInput.value.trim()
        ? hostNameInput.value.trim()
        : "Host";

    if (!hostNameInput || !hostNameInput.value.trim()) {
      if (hostNameError) {
        hostNameError.textContent = "Please enter your name";
        hostNameError.style.display = "block";
      }
      return;
    }

    // Save globally so Engine/Pot can use it
    window.currentPlayerName = hostName;
    window.isHost = true;

    // ✅ Initialize pot with host name & configured buy-in amount
    window.pot = new Pot([window.currentPlayerName], buyInAmount);

    // Host joins and starts game
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
    if (balanceEl && window.pot) {
      const startingBal = window.pot.balances[window.currentPlayerName] || buyInAmount;
      balanceEl.textContent = `Balance: £${Number(startingBal).toFixed(2)}`;
    }
  });
});

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

// 🔑 Direct Authoritative Balance Update from Server
socket.on("balance_update", ({ balance }) => {
  console.log("💰 Host received direct balance update:", balance);
  
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
  console.log("📊 Leaderboard update received from server:", players);

  if (typeof Leaderboard !== "undefined") {
    players.forEach(p => {
      Leaderboard.update(p.name, p.balance);
    });
    Leaderboard.render();
  }
});

// Status dot
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
