class Pot {
  constructor(players = []) {
    this.balances = {};
    this.stakes = {};
    this.potBalance = 0;
    this.stakeOpen = false;
    this.interval = null;

    // Default player initializations fixed at £100
    players.forEach(p => {
      this.balances[p] = 100;
      this.stakes[p] = 0;
    });
  }

  // ✅ Start stake timer with default 10,000ms (10s) duration
  startStakeTimer(durationMs = 10000, onCountdown, onReveal) {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.stakeOpen = true;
    let timeLeft = Math.floor(durationMs / 1000);

    this.interval = setInterval(() => {
      if (timeLeft >= 0) {
        if (onCountdown) onCountdown(timeLeft);
        timeLeft--;
      } else {
        clearInterval(this.interval);
        this.interval = null;
        this.stakeOpen = false;

        // Only host requests reveal from backend
        if (window.isHost && window.socket) {
          window.socket.emit("pot_reveal", { gameId: window.gameId });
        }
      }
    }, 1000);

    // Attach pot_reveal listener cleanly
    if (window.socket) {
      window.socket.off("pot_reveal");
      window.socket.once("pot_reveal", ({ amount }) => {
        if (onReveal) onReveal(amount);
      });
    }
  }

  // Safe pot reveal UI helper
  revealPot(amount) {
    const potEl = document.getElementById("potAmount");
    if (potEl) {
      potEl.style.display = "inline";
      potEl.textContent = `Pot: £${Number(amount || this.potBalance).toFixed(2)}`;
    }
  }

  // ✅ Reset round state (Keeps potBalance intact for rollovers!)
  resetRound() {
    this.stakes = {};
    for (let player in this.balances) {
      this.stakes[player] = 0;
    }
    this.stakeOpen = false;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  // Log active stake
  stake(player, amount, onUpdate) {
    if (this.balances[player] === undefined) {
      this.balances[player] = 100;
    }
    if (this.stakes[player] === undefined) {
      this.stakes[player] = 0;
    }

    if (this.balances[player] >= amount) {
      this.balances[player] -= amount;
      this.stakes[player] += amount;
      this.potBalance += amount;
      if (onUpdate) onUpdate(this.potBalance);
    }
  }

  // Cash-out refund calculation and pot adjustment
  cashout(player, percent = 0.5, onUpdate) {
    let originalStake = this.stakes[player] || 0;
    if (originalStake > 0) {
      let refund = originalStake * percent;

      this.balances[player] += refund;
      this.potBalance -= refund; // 50% refund paid out, 50% stays in pot for survivors
      this.stakes[player] = 0; // Reset active stake

      if (onUpdate) onUpdate(this.potBalance);
    }
  }

  // Resolve outcome at round end using full proportional pot distribution
  resolveOutcome(winners) {
    if (!winners || winners.length === 0) {
      console.log("❌ No winners, pot rolls over.");
      this.stakes = {}; // Clear round stakes, keep potBalance intact for rollover!
      return;
    }

    let totalWinningStakes = winners.reduce((sum, p) => sum + (this.stakes[p] || 0), 0);

    if (totalWinningStakes === 0) {
      console.log("❌ All winners cashed out, pot rolls over.");
      this.stakes = {}; // Clear round stakes, keep potBalance intact for rollover!
      return;
    }

    // Distribute FULL active pot proportionally based on relative stake size
    winners.forEach(p => {
      let stake = this.stakes[p] || 0;
      if (stake > 0) {
        let shareRatio = stake / totalWinningStakes;
        let totalPayout = this.potBalance * shareRatio;
        this.balances[p] += totalPayout;
      }
    });

    // Reset pot balance after payout
    this.potBalance = 0;
    this.stakes = {};
  }
}

export default Pot;
