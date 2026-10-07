
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
  // QUESTIONS
  // ============================
  const Questions = {
    list: [
      { text: "Will the next phase gain more than 5 meters?", timer: 12 },
      { text: "Will the next possession end in a kick?", timer: 10 },
      { text: "Will the next scrum result in a penalty?", timer: 18 },
      { text: "Will the next lineout be won cleanly?", timer: 14 },
      { text: "Will the next carry break the gain line?", timer: 11 },
      { text: "Will the next tackle be dominant?", timer: 9 },
      { text: "Will the next ruck be completed in under 3 seconds?", timer: 8 },
      { text: "Will the next attacking phase reach the 22‑meter line?", timer: 20 },
      { text: "Will the next kick be successfully caught?", timer: 13 },
      { text: "Will the next defensive set force a turnover?", timer: 17 }
    ],
    generate() {
  const q = this.list[Math.floor(Math.random() * this.list.length)];
  return {
    ...q,
    stake: 0,              // ensures toFixed() works
    userChoice: null,
    outcome: null,
    cashedOut: false,
    finalPercent: 50
  };
}
  };

// ============================
// TIMER
// ============================
const Timer = {
  start(question, onTick, onEnd) {
    // Always use the same time for every question
    let timeLeft = 15; // e.g. 15 seconds for all

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
        const amt = Number(cashoutBtn.textContent.replace("Cash Out: ", ""));
        return isNaN(amt) ? 0 : amt;
      }
      if (q.userChoice === q.outcome) return q.stake * 2;
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

  start() { this.nextQuestion(); },

  nextQuestion(q) {
    cashoutBtn.disabled = true;
    btnYes.disabled = false;
    btnNo.disabled = false;
    clearInterval(questionCountdown);
    clearInterval(cashoutCountdown);

    if (!q) q = Questions.generate();
    this.currentQuestion = { ...q, stake: 0, userChoice: null, outcome: null };
    updateActiveCard(this.currentQuestion);

    questionCountdown = Timer.start(this.currentQuestion,
      (timeLeft) => {
        qInfo.innerHTML = `You chose: ${this.currentQuestion.userChoice || "--"}<br>
          Stake: £${this.currentQuestion.stake ? this.currentQuestion.stake.toFixed(2) : 0}<br>
          Timer: ${timeLeft}s`;
      },
      () => window.openHostOutcome(this.currentQuestion.text)
    );
  },

  choose(choice) {
    const q = this.currentQuestion;
    if (!q) return;
    q.userChoice = choice;

    // ❌ No balance deduction here anymore
    updateActiveCard(q);
    btnYes.disabled = true;
    btnNo.disabled = true;
    window.openStakePopup();
    cashoutBtn.disabled = true;
  },

  cashout() {
    const q = this.currentQuestion;
    clearInterval(cashoutCountdown);
    q.cashedOut = true;
    q.outcome = "CASHED OUT";

    const result = this.updateBalance("CASHED OUT", q.stake);
    q.oldBalance = result.oldBalance;
    q.newBalance = result.newBalance;

    totalCashouts++;
    document.getElementById("player-cashouts").textContent =
      `Cash-outs: ${totalCashouts}`;

    btnYes.disabled = true;
    btnNo.disabled = true;
    cashoutBtn.disabled = true;
  },

  handleOutcome(outcome) {
  const q = this.currentQuestion;
  if (!q) return;

  // Host sets the true outcome
  q.outcome = outcome;

  // 🔹 If player cashed out, skip balance update
  if (q.cashedOut) {
    qInfo.innerHTML += `<br><small>Outcome: ${outcome} (player already cashed out)</small>`;
    History.push(q);
    History.render();
    this.startNextCountdown();
    return;
  }

  // Normal outcome flow
  let result;
  if (q.userChoice === outcome) {
    result = this.updateBalance("WIN", q.stake);
  } else {
    result = this.updateBalance("LOSE", q.stake);
  }

  q.oldBalance = result.oldBalance;
  q.newBalance = result.newBalance;

  qInfo.innerHTML += `<br><small>Outcome: ${outcome}</small>`;
  History.push(q);
  History.render();

  this.startNextCountdown();
},

  startNextCountdown() {
    window.startPostQuestionCountdown(() => {
      this.nextQuestion();
    });
  },

  updateBalance(outcome, stake) {
  const oldBalance = window.balance;
  let newBalance = oldBalance;

  if (outcome === "WIN") {
    // ✅ Return stake + profit
    newBalance += stake; // return stake
    newBalance += stake; // profit
  } else if (outcome === "CASHED OUT") {
    newBalance += stake * 0.5;
  }
  // LOSE → nothing added

  window.balance = newBalance;

  const balanceEl = document.getElementById("player-balance");
  if (balanceEl) {
    balanceEl.textContent = `Balance: £${Utils.formatMoney(window.balance)}`;
  }

  Leaderboard.update(window.currentPlayerName, window.balance);
  Leaderboard.render();

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
    openStakePopup(); // ⭐ trigger popup
  };
}

if (btnNo) {
  btnNo.onclick = () => {
    Engine.choose("NO");
    sendPrediction("NO");
    openStakePopup(); // ⭐ trigger popup
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

    // ✅ Deduct balance once here
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
      Timer: ${q.timer}s
    `;
  }

  // 🚫 Removed bar + label reset logic
};


// ============================
// POST QUESTION COUNTDOWN
// ============================
window.startPostQuestionCountdown = function (onDone) {
  const el = document.getElementById("postQuestionCountdown");
  if (!el) return;

  el.style.display = "block";
  let count = 3;
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
      }, 500); // short pause so "GO!" is visible
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

    // ✅ Update balance & outcome immediately
    Engine.handleOutcome("YES");

    // ✅ Then start countdown to next question
    window.startPostQuestionCountdown(() => {
      Engine.nextQuestion();
    });
  };
}

if (hostNoBtn) {
  hostNoBtn.onclick = () => {
    window.closeHostOutcome();

    // ✅ Update balance & outcome immediately
    Engine.handleOutcome("NO");

    // ✅ Then start countdown to next question
    window.startPostQuestionCountdown(() => {
      Engine.nextQuestion();
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
