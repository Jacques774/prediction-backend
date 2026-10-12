import { RugbyQuestions } from "./questions.js";

import Pot from "./pot.js";

function initGame(players) {
  // ✅ Create a new Pot with all players (host included)
  window.pot = new Pot(players);

  // ✅ Update UI for each player with starting balance
  players.forEach(p => {
    const balance = window.pot.balances[p];
    const el = document.getElementById(`${p}-balance`);
    if (el) {
      el.innerText = "Balance: £" + balance;
    }
  });
}

// Example usage at game start:
const players = ["Host", "Alice", "Bob"];
initGame(players);

document.addEventListener("DOMContentLoaded", () => {
  // ============================
  // SAFE GLOBALS
  // ============================
  window.playerName = "";
  let totalCashouts = 0;

  let questionCountdown = null;
  let cashoutCountdown = null;

  // ============================
  // ELEMENTS
  // ============================
  const qText = document.getElementById("q-text");
  const qInfo = document.getElementById("q-info");

  const btnYes = document.getElementById("btn-yes");
  const btnNo = document.getElementById("btn-no");
  const cashoutBtn = document.getElementById("cashout-btn");
  const cashoutTimerEl = document.getElementById("timer");

  const stakePopup = document.getElementById("stakePopup");
const stakeInput = document.getElementById("stakeInput");
const stakeSaveBtn = document.getElementById("stake-save-btn");
const stakeCancelBtn = document.getElementById("stake-cancel-btn");


// ============================
// TIMER
// ============================
const Timer = {
  start(question, onTick, onEnd) {
    // Use question.timer if available, fallback to 15
    let timeLeft = question.timer || 15;

    onTick(timeLeft);
    const interval = setInterval(() => {
      timeLeft--;
      onTick(timeLeft);
      if (timeLeft <= 0) {
        clearInterval(interval);
        onEnd();
      }
    }, 1000);
    return interval;
  }
};

// ============================
// UTILS
// ============================
const Utils = {
  profit(q) {
    if (q.cashedOut) {
      // ✅ Use stake directly instead of button text
      return q.stake * 0.5;
    }
    if (q.userChoice === q.outcome) {
      return q.stake * 2; // stake return + profit
    }
    return 0;
  },

  formatMoney(amount) {
    return Number(amount).toFixed(2);
  }
};


// ============================
// ENGINE
// ============================

window.Engine = {
  currentQuestion: null,


  nextQuestion(q) {
    cashoutBtn.disabled = true;
    btnYes.disabled = false;
    btnNo.disabled = false;
    clearInterval(window.questionCountdown);
    clearInterval(window.cashoutCountdown);


    this.currentQuestion = { 
      ...q, 
      timer: 15, 
      stake: 0, 
      userChoice: null, 
      outcome: null, 
      cashedOut: false 
    };

    updateActiveCard(this.currentQuestion);

    window.questionCountdown = Timer.start(this.currentQuestion,
      (timeLeft) => {
        qInfo.innerHTML = `You chose: ${this.currentQuestion.userChoice || "--"}<br>
          Stake: £${this.currentQuestion.stake ? this.currentQuestion.stake.toFixed(2) : 0}<br>
          Timer: ${timeLeft}s`;
      },
      () => {
        // ✅ Only the host decides the outcome locally
        if (window.isHost) {
          window.openHostOutcome(this.currentQuestion.text);
        }
        // Players wait for socket outcome
      }
    );

// ✅ clear any old stake timer before starting a new one
if (window.stakeInterval) {
  clearInterval(window.stakeInterval);
  window.stakeInterval = null;
}

// ✅ restart stake timer fresh each round
window.pot.startStakeTimer(
  10000,
  (timeLeft) => window.showCountdown(timeLeft),   // updates #stakeCountdown
  (amount) => window.revealPot(amount)            // flips to pot reveal
);
    
  },

  choose(choice) {
    const q = this.currentQuestion;
    if (!q) return;
    q.userChoice = choice;

    // ✅ Deduct stake immediately
    if (q.stake > 0) {
      window.pot.balances[window.currentPlayerName] -= q.stake;
    }

    updateActiveCard(q);
    btnYes.disabled = true;
    btnNo.disabled = true;
    window.openStakePopup();
    cashoutBtn.disabled = true;
  },

  cashout() {
  const q = this.currentQuestion;
  clearInterval(window.cashoutCountdown);
  q.cashedOut = true;
  q.outcome = "CASHED OUT";

  // ✅ Update balance through pot
  const result = this.updateBalance("CASHED OUT", q.stake);
  q.oldBalance = result.oldBalance;
  q.newBalance = result.newBalance;

  // ✅ Track cashouts
  window.totalCashouts++;
  document.getElementById("player-cashouts").textContent =
    `Cash-outs: ${window.totalCashouts}`;

  // ✅ Refresh balance display from pot
  const balanceEl = document.getElementById("player-balance");
  if (balanceEl) {
    balanceEl.textContent = `Balance: £${Utils.formatMoney(
      window.pot.balances[window.currentPlayerName]
    )}`;
  }

  // ✅ Update leaderboard from pot
  Leaderboard.update(
    window.currentPlayerName,
    window.pot.balances[window.currentPlayerName]
  );
  Leaderboard.render();

  // ✅ Disable buttons
  btnYes.disabled = true;
  btnNo.disabled = true;
  cashoutBtn.disabled = true;

  // ✅ Log cash‑out immediately in history
  History.push(q);
  History.render();
},

  handleOutcome(outcome) {
  const q = this.currentQuestion;
  if (!q) return;

  // ✅ Prevent duplicate processing
  if (q.outcome !== null) return;
  q.outcome = outcome;

  if (q.cashedOut) {
    qInfo.innerHTML += `<br><small>Outcome: ${outcome} (player already cashed out)</small>`;
  } else {
    // ✅ Update balance through pot
    const result = (q.userChoice === outcome)
      ? this.updateBalance("WIN", q.stake)
      : this.updateBalance("LOSE", q.stake);

    q.oldBalance = result.oldBalance;
    q.newBalance = result.newBalance;

    // ✅ Refresh balance display from pot
    const balanceEl = document.getElementById("player-balance");
    if (balanceEl) {
      balanceEl.textContent = `Balance: £${Utils.formatMoney(
        window.pot.balances[window.currentPlayerName]
      )}`;
    }

    // ✅ Update leaderboard from pot
    Leaderboard.update(
      window.currentPlayerName,
      window.pot.balances[window.currentPlayerName]
    );
    Leaderboard.render();

    qInfo.innerHTML += `<br><small>Outcome: ${outcome}</small>`;
  }

  // ✅ Log history
  History.push(q);
  History.render();

  // ✅ Reset pot for next round
  window.pot.resetRound();

  // ✅ Trigger post-question countdown
  this.startNextCountdown();
},

  // 🔧 New method
  startNextCountdown() {
  window.startPostQuestionCountdown(() => {
    // ✅ Start stake timer after countdown finishes
    window.pot.startStakeTimer(
      10000,
      (timeLeft) => window.showCountdown(timeLeft),
      (amount) => window.revealPot(amount)
    );

    if (window.isHost) {
      socket.emit("next_round", { gameId: window.gameId });
    } else {
      console.log("⏳ Player finished countdown, waiting for server...");
    }
  });
},

  

  updateBalance(outcome, stake) {
  const player = window.currentPlayerName;
  const oldBalance = window.pot.balances[player];
  let newBalance = oldBalance;

  if (outcome === "WIN") {
    // Stake was already deducted → add back stake + profit
    newBalance += stake * 2;
  } else if (outcome === "CASHED OUT") {
    newBalance += stake * 0.5;
  }
  // LOSE → nothing added

  window.pot.balances[player] = newBalance;
  return { oldBalance, newBalance };
}
};
  
// ============================
// BUTTON LISTENERS (safe)
// ============================
if (btnYes) {
  btnYes.onclick = () => {
    Engine.choose("YES");
    sendPrediction("YES");
    // ❌ remove openStakePopup here, Engine.choose already calls it
  };
}

if (btnNo) {
  btnNo.onclick = () => {
    Engine.choose("NO");
    sendPrediction("NO");
    // ❌ remove openStakePopup here too
  };
}

if (cashoutBtn) {
  cashoutBtn.onclick = () => Engine.cashout();
}

window.openStakePopup = function () {
  console.log("🔔 openStakePopup called");
  if (!stakePopup) {
    console.error("Stake popup element not found");
    return;
  }
  stakePopup.style.display = "flex";
  if (stakeInput) stakeInput.value = "";
};
  
// ============================
// STAKE POPUP LOGIC
// ============================
if (stakeSaveBtn) {
  stakeSaveBtn.onclick = () => {
    const amount = Number(stakeInput?.value);

    if (isNaN(amount) || amount <= 0) {
      alert("Enter a valid stake amount.");
      return;
    }

    const player = window.currentPlayerName;

    // ✅ Check balance from pot
    if (amount > window.pot.balances[player]) {
      alert("Not enough balance for this stake.");
      return;
    }

    const q = Engine.currentQuestion;
    if (!q) {
      alert("No active question found.");
      return;
    }

    // ✅ Save stake
    q.stake = amount;

    // ✅ Deduct balance directly from pot
    const oldBalance = window.pot.balances[player];
    window.pot.balances[player] -= amount;
    q.oldBalance = oldBalance;
    q.newBalance = window.pot.balances[player];

    // ✅ Tell server about this stake
    if (window.socket) {
      window.socket.emit("stake_placed", {
        gameId: window.gameId,
        playerName: player,
        amount
      });
    }

    // ✅ Update balance display
    const balanceEl = document.getElementById("player-balance");
    if (balanceEl) {
      balanceEl.textContent = `Balance: £${Utils.formatMoney(window.pot.balances[player])}`;
    }

    // ✅ Update info panel
    qInfo.innerHTML = `
      You chose: ${q.userChoice}<br>
      Stake: £${amount.toFixed(2)}
    `;

    // Enable cashout
    cashoutBtn.disabled = false;
    cashoutBtn.textContent = `Cash Out: £${(amount * 0.5).toFixed(2)}`;

    // Close popup
    stakePopup.style.display = "none";

    if (typeof startCashoutTimer === "function") {
      startCashoutTimer();
    }

    console.log(`✅ Stake saved & balance deducted: £${amount}`);
  };
}

if (stakeCancelBtn) {
  stakeCancelBtn.onclick = () => {
    const q = Engine.currentQuestion;
    if (q) {
      q.userChoice = null;
      q.stake = 0;
    }

    if (qInfo) {
      qInfo.innerHTML = `
        You chose: --<br>
        Stake: --<br>
        Timer: ${Engine.currentQuestion?.timer || "--"}s
      `;
    }

    stakePopup.style.display = "none";

    if (btnYes) btnYes.disabled = false;
    if (btnNo) btnNo.disabled = false;
    if (cashoutBtn) cashoutBtn.disabled = true;

    console.log("❌ Stake cancelled (no balance deducted yet)");
  };
}

  // ============================
// STAKE COUNTDOWN DISPLAY
// ============================
window.showCountdown = function (timeLeft) {
  const stakeEl = document.getElementById("stakeCountdown");
  const postEl = document.getElementById("postQuestionCountdown");
  const potEl = document.getElementById("potAmount");

  // Hide post-question countdown if still visible
  if (postEl) postEl.style.display = "none";

  // Hide pot while stake timer is active
  if (potEl) potEl.style.display = "none";

  // Show stake timer
  if (stakeEl) {
    stakeEl.style.display = "inline";
    stakeEl.textContent = `Stake window: ${timeLeft}s`;
  }
};

// ============================
// UI HELPERS
// ============================
window.updateActiveCard = function (q) {
  const safeStake = (typeof q.stake === "number" && !isNaN(q.stake)) ? q.stake : 0;
  const qText = document.getElementById("q-text");
  const qInfo = document.getElementById("q-info");

  if (qText) qText.textContent = q.text;
  if (qInfo) {
    qInfo.innerHTML = `
      You chose: ${q.userChoice || "--"}<br>
      Stake: £${safeStake.toFixed(2)}<br>
      Timer: ${q.timer || "--"}s
    `;
  }
};

// ============================
// POST QUESTION COUNTDOWN
// ============================
window.startPostQuestionCountdown = function (onDone, duration = 3) {
  const el = document.getElementById("postQuestionCountdown");
  if (!el) return;

  el.style.display = "block";
  let count = duration;
  el.textContent = count;

  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      el.textContent = count;
    } else if (count === 0) {
      el.textContent = "GO!";
      clearInterval(interval);
      setTimeout(() => {
        el.style.display = "none";
        if (typeof onDone === "function") onDone();
      }, 500);
    }
  }, 1000);
};



  
// ============================
// HOST OUTCOME PANEL
// ============================
window.openHostOutcome = function (questionText) {
  const panel = document.querySelector(".host-outcome-panel");
  const text = document.getElementById("host-outcome-question");
  if (!panel || !text) return;
  text.textContent = questionText;
  panel.classList.add("active");
};

window.closeHostOutcome = function () {
  const panel = document.querySelector(".host-outcome-panel");
  if (panel) panel.classList.remove("active");
};

// Host YES/NO buttons
const hostYesBtn = document.getElementById("host-yes-btn");
const hostNoBtn = document.getElementById("host-no-btn");

if (hostYesBtn) {
  hostYesBtn.onclick = () => {
    window.closeHostOutcome();
    Engine.handleOutcome("YES");
    window.startPostQuestionCountdown(() => {
  socket.emit("next_round", { gameId: window.gameId });
});
  };
}

if (hostNoBtn) {
  hostNoBtn.onclick = () => {
    window.closeHostOutcome();
    Engine.handleOutcome("NO");
    window.startPostQuestionCountdown(() => {
  socket.emit("next_round", { gameId: window.gameId });
});
  };
}

// Cashout timer
window.startCashoutTimer = function () {
  let timeLeft = 5;
  cashoutTimerEl.textContent = `${timeLeft}s`;
  cashoutCountdown = setInterval(() => {
    timeLeft--;
    cashoutTimerEl.textContent = `${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(cashoutCountdown);
      cashoutBtn.disabled = true;
    }
  }, 1000);
};
});
