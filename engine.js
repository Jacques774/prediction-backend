import { RugbyQuestions } from "./questions.js";
import Pot from "./pot.js";

// ✅ Safe dynamic Pot initializer
window.initGame = function (players) {
  window.pot = new Pot(players);
  players.forEach(p => {
    const balance = window.pot.balances[p];
    const el = document.getElementById(`${p}-balance`);
    if (el) {
      el.innerText = "Balance: £" + balance;
    }
  });
};

document.addEventListener("DOMContentLoaded", () => {
  // ============================
  // SAFE GLOBALS & ELEMENTS
  // ============================
  window.playerName = "";
  let totalCashouts = 0;

  let questionCountdown = null;
  let cashoutCountdown = null;

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
  // TIMER & UTILS
  // ============================
  const Timer = {
    start(question, onTick, onEnd) {
      let timeLeft = question.timer || 30;
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

  const Utils = {
    profit(q) {
      if (q.cashedOut) return q.stake * 0.5;
      if (q.userChoice === q.outcome) return q.stake * 2;
      return 0;
    },
    formatMoney(amount) {
      return Number(amount || 0).toFixed(2);
    }
  };

  // ============================
  // ENGINE OBJECT
  // ============================
  window.Engine = {
    currentQuestion: null,

    nextQuestion(q) {
      if (cashoutBtn) cashoutBtn.disabled = true;
      if (btnYes) btnYes.disabled = false;
      if (btnNo) btnNo.disabled = false;

      clearInterval(window.questionCountdown);
      clearInterval(window.cashoutCountdown);

      this.currentQuestion = { 
        ...q, 
        timer: 30, 
        stake: 0, 
        userChoice: null, 
        outcome: null, 
        cashedOut: false 
      };

      updateActiveCard(this.currentQuestion);

      window.questionCountdown = Timer.start(this.currentQuestion,
        (timeLeft) => {
          if (qInfo) {
            qInfo.innerHTML = `You chose: ${this.currentQuestion.userChoice || "--"}<br>
              Stake: £${this.currentQuestion.stake ? this.currentQuestion.stake.toFixed(2) : 0}<br>
              Timer: ${timeLeft}s`;
          }
        },
        () => {
          if (window.isHost) {
            window.openHostOutcome(this.currentQuestion.text);
          }
        }
      );

      // Safe stake timer restart
      if (window.stakeInterval) {
        clearInterval(window.stakeInterval);
        window.stakeInterval = null;
      }

      // ✅ 10s Stake window: Lock YES/NO buttons & start cashout timer when stake window expires
      if (window.pot && typeof window.pot.startStakeTimer === "function") {
        window.pot.startStakeTimer(
          10000,
          (timeLeft) => window.showCountdown(timeLeft),
          (amount) => {
            window.revealPot(amount);
            if (btnYes) btnYes.disabled = true;
            if (btnNo) btnNo.disabled = true;

            // Start cashout timer unified when stake window finishes (if player staked)
            const activeQ = Engine.currentQuestion;
            if (activeQ && activeQ.stake > 0 && !activeQ.cashedOut) {
              if (typeof startCashoutTimer === "function") {
                startCashoutTimer();
              }
            }
          }
        );
      }
    },

    choose(choice) {
      const q = this.currentQuestion;
      if (!q) return;
      q.userChoice = choice;

      updateActiveCard(q);
      if (btnYes) btnYes.disabled = true;
      if (btnNo) btnNo.disabled = true;
      window.openStakePopup();
      if (cashoutBtn) cashoutBtn.disabled = true;
    },

    // ✅ FIXED CASHOUT: Calculates refund, deducts pot, and updates screen UI
    cashout() {
      const q = this.currentQuestion;
      if (!q || q.stake <= 0) return;

      clearInterval(window.cashoutCountdown);
      q.cashedOut = true;
      q.outcome = "CASHED OUT";

      // Execute cash-out via Pot class
      if (window.pot) {
        window.pot.cashout(window.currentPlayerName, 0.5, (newPotBalance) => {
          const potEl = document.getElementById("potAmount");
          if (potEl) {
            potEl.style.display = "inline";
            potEl.textContent = `Pot: £${Number(newPotBalance).toFixed(2)}`;
          }
        });
      }

      // Tell socket server
      if (window.socket && window.gameId && window.currentPlayerName) {
        window.socket.emit("cashout", {
          gameId: window.gameId,
          playerName: window.currentPlayerName,
          amount: q.stake
        });
      }

      // Track cash-outs and refresh player balance UI
      window.totalCashouts++;
      const cashoutEl = document.getElementById("player-cashouts");
      if (cashoutEl) cashoutEl.textContent = `Cash-outs: ${window.totalCashouts}`;

      const balanceEl = document.getElementById("player-balance");
      if (balanceEl && window.pot && window.currentPlayerName) {
        balanceEl.textContent = `Balance: £${Utils.formatMoney(
          window.pot.balances[window.currentPlayerName]
        )}`;
      }

      // Update leaderboard
      if (typeof Leaderboard !== "undefined" && Leaderboard.update) {
        Leaderboard.update(
          window.currentPlayerName,
          window.pot ? window.pot.balances[window.currentPlayerName] : 0
        );
        if (Leaderboard.render) Leaderboard.render();
      }

      if (btnYes) btnYes.disabled = true;
      if (btnNo) btnNo.disabled = true;
      if (cashoutBtn) cashoutBtn.disabled = true;

      if (typeof History !== "undefined" && History.push) {
        History.push(q);
        if (History.render) History.render();
      }
    },

    handleOutcome(outcome) {
      const q = this.currentQuestion;
      if (!q || q.outcome !== null) return;
      q.outcome = outcome;

      if (q.cashedOut) {
        if (qInfo) qInfo.innerHTML += `<br><small>Outcome: ${outcome} (player already cashed out)</small>`;
      } else {
        const result = (q.userChoice === outcome)
          ? this.updateBalance("WIN", q.stake)
          : this.updateBalance("LOSE", q.stake);

        q.oldBalance = result.oldBalance;
        q.newBalance = result.newBalance;

        const balanceEl = document.getElementById("player-balance");
        if (balanceEl && window.pot && window.currentPlayerName) {
          balanceEl.textContent = `Balance: £${Utils.formatMoney(
            window.pot.balances[window.currentPlayerName]
          )}`;
        }

        if (typeof Leaderboard !== "undefined" && Leaderboard.update) {
          Leaderboard.update(
            window.currentPlayerName,
            window.pot ? window.pot.balances[window.currentPlayerName] : 0
          );
          if (Leaderboard.render) Leaderboard.render();
        }

        if (qInfo) qInfo.innerHTML += `<br><small>Outcome: ${outcome}</small>`;
      }

      if (typeof History !== "undefined" && History.push) {
        History.push(q);
        if (History.render) History.render();
      }

      if (window.pot && typeof window.pot.resetRound === "function") {
        window.pot.resetRound();
      }

      this.startNextCountdown();
    },

    startNextCountdown() {
      window.startPostQuestionCountdown(() => {
        if (window.pot) {
          window.pot.startStakeTimer(
            10000,
            (timeLeft) => window.showCountdown(timeLeft),
            (amount) => {
              window.revealPot(amount);
              if (btnYes) btnYes.disabled = true;
              if (btnNo) btnNo.disabled = true;

              // Start cashout timer unified when stake window finishes (if player staked)
              const activeQ = Engine.currentQuestion;
              if (activeQ && activeQ.stake > 0 && !activeQ.cashedOut) {
                if (typeof startCashoutTimer === "function") {
                  startCashoutTimer();
                }
              }
            }
          );
        }

        if (window.isHost && window.socket) {
          window.socket.emit("next_round", { gameId: window.gameId });
        } else {
          console.log("⏳ Player finished countdown, waiting for server...");
        }
      });
    },

    updateBalance(outcome, stake) {
      const player = window.currentPlayerName;
      if (!window.pot || !window.pot.balances || !player) {
        return { oldBalance: 0, newBalance: 0 };
      }

      const oldBalance = window.pot.balances[player] || 0;
      let newBalance = oldBalance;

      if (outcome === "WIN") {
        newBalance += stake * 2;
      } else if (outcome === "CASHED OUT") {
        newBalance += stake * 0.5;
      }

      window.pot.balances[player] = newBalance;
      return { oldBalance, newBalance };
    }
  };

  // ============================
  // BUTTON LISTENERS
  // ============================
  if (btnYes) {
    btnYes.onclick = () => {
      Engine.choose("YES");
      if (typeof sendPrediction === "function") sendPrediction("YES");
    };
  }

  if (btnNo) {
    btnNo.onclick = () => {
      Engine.choose("NO");
      if (typeof sendPrediction === "function") sendPrediction("NO");
    };
  }

  if (cashoutBtn) {
    cashoutBtn.onclick = () => Engine.cashout();
  }

  window.openStakePopup = function () {
    console.log("🔔 openStakePopup called");
    if (!stakePopup) return;
    stakePopup.style.display = "flex";
    if (stakeInput) stakeInput.value = "";
  };

  // ✅ FIXED STAKE SAVE: Calls window.pot.stake() to register active stakes
  if (stakeSaveBtn) {
    stakeSaveBtn.onclick = () => {
      const amount = Number(stakeInput?.value);

      if (isNaN(amount) || amount <= 0) {
        alert("Enter a valid stake amount.");
        return;
      }

      const player = window.currentPlayerName;

      if (window.pot && window.pot.balances[player] !== undefined && amount > window.pot.balances[player]) {
        alert("Not enough balance for this stake.");
        return;
      }

      const q = Engine.currentQuestion;
      if (!q) {
        alert("No active question found.");
        return;
      }

      q.stake = amount;

      // Register stake in Pot object and update pot UI live
      if (window.pot) {
        window.pot.stake(player, amount, (newPotBalance) => {
          const potEl = document.getElementById("potAmount");
          if (potEl) {
            potEl.style.display = "inline";
            potEl.textContent = `Pot: £${Number(newPotBalance).toFixed(2)}`;
          }
        });
      }

      // Send to socket server
      if (window.socket) {
        window.socket.emit("stake_placed", {
          gameId: window.gameId,
          playerName: player,
          amount
        });
      }

      const balanceEl = document.getElementById("player-balance");
      if (balanceEl && window.pot) {
        balanceEl.textContent = `Balance: £${Utils.formatMoney(window.pot.balances[player])}`;
      }

      if (qInfo) {
        qInfo.innerHTML = `
          You chose: ${q.userChoice}<br>
          Stake: £${amount.toFixed(2)}
        `;
      }

      if (cashoutBtn) {
        cashoutBtn.disabled = false;
        cashoutBtn.textContent = `Cash Out: £${(amount * 0.5).toFixed(2)}`;
      }

      if (stakePopup) stakePopup.style.display = "none";

      // ❌ Removed startCashoutTimer() here so timers don't trigger per-stake!

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

      if (stakePopup) stakePopup.style.display = "none";

      if (btnYes) btnYes.disabled = false;
      if (btnNo) btnNo.disabled = false;
      if (cashoutBtn) cashoutBtn.disabled = true;

      console.log("❌ Stake cancelled (no balance deducted yet)");
    };
  }

  // ============================
  // STAKE COUNTDOWN DISPLAY (Fixed to keep pot visible)
  // ============================
  window.showCountdown = function (timeLeft) {
    const stakeEl = document.getElementById("stakeCountdown");
    const postEl = document.getElementById("postQuestionCountdown");
    const potEl = document.getElementById("potAmount");

    if (postEl) postEl.style.display = "none";

    // Only hide pot if balance is 0
    if (potEl && (!window.pot || window.pot.potBalance === 0)) {
      potEl.style.display = "none";
    }

    if (stakeEl) {
      stakeEl.style.display = "inline";
      stakeEl.textContent = `Stake window: ${timeLeft}s`;
    }
  };

  // ============================
  // UI HELPERS
  // ============================
  function updateActiveCard(q) {
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
  }

  window.updateActiveCard = updateActiveCard;

  // ============================
  // POST QUESTION COUNTDOWN
  // ============================
  window.startPostQuestionCountdown = function (onDone, duration = 3) {
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

  const hostYesBtn = document.getElementById("host-yes-btn");
  const hostNoBtn = document.getElementById("host-no-btn");

  if (hostYesBtn) {
    hostYesBtn.onclick = () => {
      window.closeHostOutcome();
      Engine.handleOutcome("YES");
      window.startPostQuestionCountdown(() => {
        if (window.socket) window.socket.emit("next_round", { gameId: window.gameId });
      });
    };
  }

  if (hostNoBtn) {
    hostNoBtn.onclick = () => {
      window.closeHostOutcome();
      Engine.handleOutcome("NO");
      window.startPostQuestionCountdown(() => {
        if (window.socket) window.socket.emit("next_round", { gameId: window.gameId });
      });
    };
  }

  // Cashout timer
  window.startCashoutTimer = function () {
    let timeLeft = 15;
    if (cashoutTimerEl) cashoutTimerEl.textContent = `${timeLeft}s`;
    cashoutCountdown = setInterval(() => {
      timeLeft--;
      if (cashoutTimerEl) cashoutTimerEl.textContent = `${timeLeft}s`;
      if (timeLeft <= 0) {
        clearInterval(cashoutCountdown);
        if (cashoutBtn) cashoutBtn.disabled = true;
      }
    }, 1000);
  };
});
