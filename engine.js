import { RugbyQuestions } from "./questions.js";


document.addEventListener("DOMContentLoaded", () => {
  // ============================
  // SAFE GLOBALS
  // ============================
  window.playerName = "";
  let balance = 100;
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
      return q.stake * 0.5; // refund shown in history
    }
    // WIN/LOSE handled by pot.js, so no maths here
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

  // ✅ Use pot.js cashout logic
  window.pot.cashout(window.currentPlayerName, 0.5);

  // ✅ Read balance from pot.balances
  const newBalance = window.pot.balances[window.currentPlayerName];
  q.oldBalance = q.oldBalance || newBalance;
  q.newBalance = newBalance;

  window.totalCashouts++;
  document.getElementById("player-cashouts").textContent =
    `Cash-outs: ${window.totalCashouts}`;

  const balanceEl = document.getElementById("player-balance");
  if (balanceEl) {
    balanceEl.textContent = `Balance: £${Utils.formatMoney(newBalance)}`;
  }

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
  if (q.outcome !== null) return; // already handled once
  q.outcome = outcome;

  if (q.cashedOut) {
    qInfo.innerHTML += `<br><small>Outcome: ${outcome} (player already cashed out)</small>`;
  } else {
    // ✅ Build winners list
    const winners = [];
    if (q.userChoice === outcome) {
      winners.push(window.currentPlayerName);
    }

    // ✅ Resolve outcome using pot.js maths
    window.pot.resolveOutcome(winners);

    // ✅ Update balance UI
    const balanceEl = document.getElementById("player-balance");
    if (balanceEl) {
      balanceEl.textContent = `Balance: £${Utils.formatMoney(window.pot.balances[window.currentPlayerName])}`;
    }

    Leaderboard.update(window.currentPlayerName, window.pot.balances[window.currentPlayerName]);
    Leaderboard.render();

    qInfo.innerHTML += `<br><small>Outcome: ${outcome}</small>`;
  }

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
stakeSaveBtn.onclick = () => {
  const amount = Number(stakeInput?.value);

  if (isNaN(amount) || amount <= 0) {
    alert("Enter a valid stake amount.");
    return;
  }

  const q = Engine.currentQuestion;
  if (!q) {
    alert("No active question found.");
    return;
  }

  // ✅ Check balance from pot
  if (amount > window.pot.balances[window.playerName]) {
    alert("Not enough balance for this stake.");
    return;
  }

  // ✅ Save stake in question
  q.stake = amount;

  // ✅ Deduct balance via pot.js
  const oldBalance = window.pot.balances[window.playerName];
  window.pot.stake(window.playerName, amount);
  const newBalance = window.pot.balances[window.playerName];

  q.oldBalance = oldBalance;
  q.newBalance = newBalance;

  // ✅ Tell server about this stake
  if (window.socket) {
    window.socket.emit("stake_placed", {
      gameId: window.gameId,
      playerName: window.playerName,
      amount
    });
  }

  // ✅ Update balance display
  const balanceEl = document.getElementById("player-balance");
  if (balanceEl) {
    balanceEl.textContent = `Balance: £${Utils.formatMoney(newBalance)}`;
  }

  // ✅ Update info panel
  qInfo.innerHTML = `
    You chose: ${q.userChoice}<br>
    Stake: £${amount.toFixed(2)}
  `;

  cashoutBtn.disabled = false;
  cashoutBtn.textContent = `Cash Out: £${(amount * 0.5).toFixed(2)}`;

  stakePopup.style.display = "none";

  if (typeof startCashoutTimer === "function") {
    startCashoutTimer();
  }

  console.log(`✅ Stake saved & balance deducted: £${amount}`);
};

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
