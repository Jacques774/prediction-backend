class Pot {
  constructor(players = []) {
    this.balances = {};
    this.stakes = {};
    this.potBalance = 0;
    this.profitPool = 0;
    this.stakeOpen = false;
    this.interval = null;

    // Default player initializations
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

    // ✅ Attach pot_reveal listener cleanly (remove old one first)
    if (window.socket) {
      window.socket.off("pot_reveal");
      window.socket.once("pot_reveal", ({ amount }) => {
        if (onReveal) onReveal(amount);
      });
    }
  }

  // Reset pot state after round ends
  resetRound() {
    this.stakes = {};
    for (let player in this.balances) {
      this.stakes[player] = 0;
    }
    this.potBalance = 0;
    this.profitPool = 0;
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
    if (this.stakes[player] > 0) {
      let refund = this.stakes[player] * percent;
      let remainder = this.stakes[player] - refund;

      this.balances[player] += refund;
      this.profitPool += remainder;
      this.potBalance -= this.stakes[player];
      this.potBalance += remainder;
      this.stakes[player] = 0; // Reset active stake

      if (onUpdate) onUpdate(this.potBalance);
    }
  }

  // Resolve outcome at round end
  resolveOutcome(winners) {
    if (winners.length === 0) {
      return "No winners, pot rolls over.";
    }

    let totalStake = winners.reduce((sum, p) => sum + (this.stakes[p] || 0), 0);

    winners.forEach(p => {
      let stakeReturn = this.stakes[p] || 0;
      let share = totalStake > 0 ? (stakeReturn / totalStake) * this.profitPool : 0;
      this.balances[p] += stakeReturn + share;
      this.stakes[p] = 0;
    });

    this.potBalance = 0;
    this.profitPool = 0;
  }
}

export default Pot;
