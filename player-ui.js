import { RugbyQuestions } from "./questions.js";
import Pot from "./pot.js";

// ============================
// DOM Helpers for Stake Timer & Delayed Pot Reveal
// ============================
window.isStakeWindowActive = false;

function showCountdown(timeLeft) {
  window.isStakeWindowActive = true;
  document.body.classList.add("stake-active");

  const countdownEl = document.getElementById("stakeCountdown");
  const potEl = document.getElementById("potAmount");

  if (potEl) potEl.style.setProperty("display", "none", "important");
  if (countdownEl) {
    countdownEl.style.display = "inline";
    countdownEl.textContent = "Stake window: " + timeLeft + "s";
  }
}

function revealPot(amount) {
  window.isStakeWindowActive = false;
  document.body.classList.remove("stake-active");

  const countdownEl = document.getElementById("stakeCountdown");
  const potEl = document.getElementById("potAmount");

  if (countdownEl) countdownEl.style.display = "none";
  if (potEl) {
    potEl.style.removeProperty("display");
    potEl.style.display = "inline";
    potEl.textContent = "Pot: £" + Number(amount || 0).toFixed(2);
  }
}

function updatePot(amount) {
  const potEl = document.getElementById("potAmount");
  if (!potEl) return;

  potEl.textContent = "Pot: £" + Number(amount || 0).toFixed(2);
  if (window.isStakeWindowActive) {
    potEl.style.setProperty("display", "none", "important");
  }
}

window.showCountdown = showCountdown;
window.revealPot = revealPot;
window.updatePot = updatePot;

console.log("✅ player-ui.js loaded");

// Connect to Render backend
const socket = io("https://prediction-backend-2e20.onrender.com");
window.socket = socket;

function initPlayerUI() {
  window.totalWins = 0;
  window.totalCashouts = 0;
  
  // 🔑 Read actual wallet credit from localStorage (defaults to 30.00)
  const playerCredit = Number(localStorage.getItem("user_credit") || 30.00);

  // Auto-fill game code from URL parameter if present
  const urlParams = new URLSearchParams(window.location.search);
  const codeParam = urlParams.get("code");
  const codeInput = document.getElementById("game-code-input");
  if (codeParam && codeInput) {
    codeInput.value = codeParam.toUpperCase();
  }

  const joinBtn = document.getElementById("player-join-btn");
  const modal = document.getElementById("gamePreviewModal");
  const confirmJoinBtn = document.getElementById("confirm-join-btn");
  const cancelPreviewBtn = document.getElementById("cancel-preview-btn");
  const setupSlide = document.getElementById("playerSetupSlide");

  if (!joinBtn) {
    console.error("Join button not found.");
    return;
  }

  let pendingGameData = null;

  // 1️⃣ Initial Join Click -> Fetches live room details from backend & opens Preview Modal
  joinBtn.addEventListener("click", async () => {
    console.log("🎯 Player Join button clicked (Preview Gatekeeper)");

    const nameInput = document.getElementById("player-name-input");
    const nameError = document.getElementById("playerNameError");

    const playerName = nameInput ? nameInput.value.trim() : "";
    const gameId = codeInput ? codeInput.value.trim().toUpperCase() : "";

    if (!playerName || !gameId) {
      if (nameError) {
        nameError.textContent = "Name and code required";
        nameError.style.display = "block";
      }
      return;
    }
    if (nameError) nameError.style.display = "none";

    window.currentPlayerName = playerName;
    window.gameId = gameId;

    // Default fallback values from URL query parameters
    let urlBuyin = urlParams.get("buyin") !== null ? Number(urlParams.get("buyin")) : 20;
    let urlQtime = urlParams.get("qtime") !== null ? Number(urlParams.get("qtime")) : 120;
    let sport = "Rugby";
    let questionCount = 40;

    // 🔑 FETCH LIVE GAME ROOM DETAILS FROM BACKEND API
    try {
      const res = await fetch(`https://prediction-backend-2e20.onrender.com/api/game/${gameId}`);
      if (res.ok) {
        const gameData = await res.json();
        if (gameData) {
          if (gameData.startingBalance !== undefined) urlBuyin = Number(gameData.startingBalance);
          if (gameData.qtime !== undefined) urlQtime = Number(gameData.qtime);
          if (gameData.questionCount !== undefined) questionCount = Number(gameData.questionCount);
          if (gameData.sport) sport = gameData.sport.charAt(0).toUpperCase() + gameData.sport.slice(1);
        }
      }
    } catch (err) {
      console.warn("Could not fetch live room details, falling back to URL parameters:", err);
    }

    pendingGameData = {
      sport: sport,
      questionCount: questionCount,
      cardTimer: `${Math.round(urlQtime / 60)} min(s)`,
      startingBalance: urlBuyin
    };

    // Populate Modal Elements
    document.getElementById("preview-sport").textContent = pendingGameData.sport;
    document.getElementById("preview-questions").textContent = pendingGameData.questionCount;
    document.getElementById("preview-timer").textContent = pendingGameData.cardTimer;
    document.getElementById("preview-balance").textContent = `£${pendingGameData.startingBalance.toFixed(2)}`;

    // Re-read latest wallet credit
    const currentWalletCheck = Number(localStorage.getItem("user_credit") || 30.00);

    // Gatekeeper Credit Check against localStorage wallet
    const creditErrorEl = document.getElementById("previewCreditError");
    if (currentWalletCheck < pendingGameData.startingBalance) {
      if (creditErrorEl) {
        creditErrorEl.textContent = `Insufficient credit! Required: £${pendingGameData.startingBalance.toFixed(2)}, Available: £${currentWalletCheck.toFixed(2)}`;
        creditErrorEl.style.display = "block";
      }
      if (confirmJoinBtn) {
        confirmJoinBtn.disabled = true;
        confirmJoinBtn.style.opacity = "0.5";
        confirmJoinBtn.style.cursor = "not-allowed";
      }
    } else {
      if (creditErrorEl) creditErrorEl.style.display = "none";
      if (confirmJoinBtn) {
        confirmJoinBtn.disabled = false;
        confirmJoinBtn.style.opacity = "1";
        confirmJoinBtn.style.cursor = "pointer";
      }
    }

    // Hide setup slide and display Preview Modal cleanly on top
    if (setupSlide) setupSlide.style.display = "none";
    if (modal) {
      modal.style.display = "flex";
      modal.style.zIndex = "1100";
    }
  });

  // 2️⃣ Cancel Modal -> Restores the setup slide
  if (cancelPreviewBtn) {
    cancelPreviewBtn.addEventListener("click", () => {
      if (modal) modal.style.display = "none";
      if (setupSlide) setupSlide.style.display = "flex";
    });
  }

  // 3️⃣ Confirm Join Inside Modal -> Deducts Buy-in, Connects to Room & Opens Dashboard
  if (confirmJoinBtn) {
    confirmJoinBtn.addEventListener("click", () => {
      if (!pendingGameData) return;

      // 🔑 Deduct buy-in from wallet credit
      let currentCredit = Number(localStorage.getItem("user_credit") || 30.00);
      const buyin = pendingGameData.startingBalance;

      if (currentCredit < buyin) {
        alert(`Insufficient credit! Required: £${buyin.toFixed(2)}, Available: £${currentCredit.toFixed(2)}`);
        return;
      }
      currentCredit -= buyin;
      localStorage.setItem("user_credit", currentCredit.toFixed(2));
      console.log(`💳 Player buy-in deducted (£${buyin.toFixed(2)}). Remaining wallet: £${currentCredit.toFixed(2)}`);

      window.isHost = false;

      // Initialize pot with confirmed buy-in amount
      window.pot = new Pot([window.currentPlayerName], buyin);

      // Emit join event to socket
      socket.emit("join_game", { 
        gameId: window.gameId, 
        playerName: window.currentPlayerName, 
        isHost: false 
      });

      // Hide modal completely, show dashboard
      if (modal) modal.style.display = "none";

      const dashboard = document.getElementById("dashboard");
      if (dashboard) {
        dashboard.classList.remove("hidden");
        dashboard.style.opacity = "1";
      }

      const nameEl = document.getElementById("player-name");
      const balanceEl = document.getElementById("player-balance");

      const startingBal = window.pot.balances[window.currentPlayerName] || buyin;

      if (nameEl) nameEl.textContent = `Player: ${window.currentPlayerName}`;
      if (balanceEl) {
        balanceEl.textContent = `Balance: £${Number(startingBal).toFixed(2)}`;
      }
    });
  }

  // 4️⃣ Logout Button Listener -> Adds balance back to wallet & redirects to Main Menu
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      const activeBal = window.pot && window.currentPlayerName && window.pot.balances[window.currentPlayerName] !== undefined
        ? window.pot.balances[window.currentPlayerName]
        : 0;
      
      // 🔑 Add final game balance to existing wallet credit (instead of replacing)
      let currentWallet = Number(localStorage.getItem("user_credit") || 0);
      currentWallet += Number(activeBal);
      localStorage.setItem("user_credit", currentWallet.toFixed(2));
      console.log(`💰 Added player final balance (£${Number(activeBal).toFixed(2)}) to wallet on exit. New total: £${currentWallet.toFixed(2)}`);

      if (socket) socket.disconnect();
      window.location.href = "MainMenu.html";
    });
  }
}

// Safely initialize whether DOM is loading or already parsed
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPlayerUI);
} else {
  initPlayerUI();
}

// ============================
// Helpers & Socket Listeners
// ============================
window.sendPrediction = function (choice) {
  if (!socket || !window.gameId || !window.currentPlayerName) return;
  socket.emit("prediction", {
    gameId: window.gameId,
    playerName: window.currentPlayerName,
    choice
  });
};

window.cashout = function () {
  if (typeof Engine !== "undefined" && typeof Engine.cashout === "function") {
    Engine.cashout();
  }
};

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

socket.on("game_starting", ({ host }) => {
  console.log(`Game starting by host: ${host}`);
  window.startPreCountdown(() => {
    const activeCard = document.getElementById("active-card");
    if (activeCard && !window.isGameOver) activeCard.style.display = "block";
  });
});

let lastSeenPlayerIndex = 0;

socket.on("new_question", ({ id, timer, current, total }) => {
  if (window.isGameOver) return;

  if (current !== undefined) {
    window.currentQuestionNum = current;
    if (current === lastSeenPlayerIndex) return;
    lastSeenPlayerIndex = current;
  }
  if (total !== undefined) window.totalQuestionsCount = total;

  if (typeof RugbyQuestions === "undefined") {
    console.error("❌ RugbyQuestions is not loaded.");
    return;
  }

  const question = RugbyQuestions[id];
  if (!question) return;

  const questionData = {
    ...question,
    timer: timer || 60,
    current,
    total
  };

  if (typeof Engine !== "undefined" && typeof Engine.nextQuestion === "function") {
    Engine.nextQuestion(questionData);
  }

  const tallyEl = document.getElementById("player-question-tally");
  if (tallyEl && current !== undefined && total !== undefined) {
    tallyEl.textContent = `Question ${current} of ${total}`;
  }

  const activeCard = document.getElementById("active-card");
  if (activeCard && !window.isGameOver) activeCard.style.display = "block";
});

socket.on("pot_update", ({ amount }) => {
  if (window.pot) window.pot.potBalance = amount;
  updatePot(amount);
});

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
  window.revealPot(amount);
});

socket.on("balance_update", ({ balance }) => {
  if (window.pot && window.currentPlayerName) {
    window.pot.balances[window.currentPlayerName] = balance;
  }
  const balanceEl = document.getElementById("player-balance");
  if (balanceEl) {
    balanceEl.textContent = `Balance: £${Number(balance).toFixed(2)}`;
  }
});

socket.on("leaderboard_update", (players) => {
  if (typeof Leaderboard !== "undefined") {
    players.forEach(p => Leaderboard.update(p.name, p.balance));
    Leaderboard.render();
  }
});
