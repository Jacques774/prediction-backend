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
  },

  choose(choice) {
    const q = this.currentQuestion;
    if (!q) return;
    q.userChoice = choice;

    // ✅ Deduct stake immediately
    if (q.stake > 0) {
      window.balance -= q.stake;
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

  const result = this.updateBalance("CASHED OUT", q.stake);
  q.oldBalance = result.oldBalance;
  q.newBalance = result.newBalance;

  window.totalCashouts++;
  document.getElementById("player-cashouts").textContent =
    `Cash-outs: ${window.totalCashouts}`;

  const balanceEl = document.getElementById("player-balance");
  if (balanceEl) {
    balanceEl.textContent = `Balance: £${Utils.formatMoney(window.balance)}`;
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

    // ✅ Prevent duplicate processing
    if (q.outcome !== null) {
      return; // already handled once
    }

    q.outcome = outcome;

    if (q.cashedOut) {
      qInfo.innerHTML += `<br><small>Outcome: ${outcome} (player already cashed out)</small>`;
    } else {
      let result;
      if (q.userChoice === outcome) {
        result = this.updateBalance("WIN", q.stake);
      } else {
        result = this.updateBalance("LOSE", q.stake);
      }

      q.oldBalance = result.oldBalance;
      q.newBalance = result.newBalance;

      const balanceEl = document.getElementById("player-balance");
      if (balanceEl) {
        balanceEl.textContent = `Balance: £${Utils.formatMoney(window.balance)}`;
      }

      Leaderboard.update(window.currentPlayerName, window.balance);
      Leaderboard.render();

      qInfo.innerHTML += `<br><small>Outcome: ${outcome}</small>`;
    }

    // ✅ Push history only once per round
    History.push(q);
    History.render();

  },


  updateBalance(outcome, stake) {
    const oldBalance = window.balance;
    let newBalance = oldBalance;

    if (outcome === "WIN") {
      // Stake was already deducted → add back stake + profit
      newBalance += stake * 2;
    } else if (outcome === "CASHED OUT") {
      newBalance += stake * 0.5;
    }
    // LOSE → nothing added

    window.balance = newBalance;
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

    if (amount > window.balance) {
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

    // ✅ Deduct balance
    const oldBalance = window.balance;
    window.balance -= amount;

    q.oldBalance = oldBalance;
    q.newBalance = window.balance;

    // ✅ Update balance display
    const balanceEl = document.getElementById("player-balance");
    if (balanceEl) {
      balanceEl.textContent = `Balance: £${Utils.formatMoney(window.balance)}`;
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
