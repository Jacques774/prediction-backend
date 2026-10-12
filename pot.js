class Pot {
  constructor(players) {
    this.balances = {};
    this.stakes = {};
    this.potBalance = 0;
    this.profitPool = 0;
    this.stakeOpen = false;
    this.interval = null; // track the stake timer

    // ✅ Match server starting balance (£120)
    players.forEach(p => {
      this.balances[p] = 120;
      this.stakes[p] = 0;
    });
  }

  // Start stake timer, reveal pot when it ends
  startStakeTimer(durationMs, onCountdown, onReveal) {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.stakeOpen = true;
    let timeLeft = Math.floor(durationMs / 1000);

    this.interval = setInterval(() => {
      if (timeLeft >= 0) {
        if (onCountdown) onCountdown(timeLeft);   // countdown updates
        timeLeft--;
      } else {
        clearInterval(this.interval);
        this.interval = null;
        this.stakeOpen = false;

        // ✅ Only host tells server to reveal
        if (window.isHost && window.socket) {
          window.socket.emit("pot_reveal", { gameId: window.gameId });
        }
      }
    }, 1000);

    // ✅ Clean up any old pot_reveal listeners before attaching a new one to prevent stacking
    if (window.socket) {
      window.socket.off("pot_reveal");
      window.socket.once("pot_reveal", ({ amount }) => {
        if (onReveal) onReveal(amount);
      });
    }
  }

  // Reset pot state after a round ends
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

  // Players can only stake while stake timer is open
  stake(player, amount, onUpdate) {
    if (!this.stakeOpen) {
      console.log("Stake window closed, cannot stake");
      return;
    }
    if (this.balances[player] >= amount) {
      this.balances[player] -= amount;
      this.stakes[player] += amount;
      this.potBalance += amount;
      if (onUpdate) onUpdate(this.potBalance); // live update
    }
  }

  // Cash‑out: player withdraws an absolute amount from their stake.
  // The remainder stays in the pot as profit.
  cashout(player, cashoutAmount, onUpdate) {
    const currentStake = this.stakes[player] || 0;

    if (currentStake <= 0) {
      console.log(`${player} has no active stake to cash out.`);
      return this.potBalance;
    }

    let refund = Math.min(cashoutAmount, currentStake);
    let remainder = currentStake - refund;

    this.balances[player] += refund;
    this.profitPool += remainder;
    this.potBalance -= refund; 
    this.stakes[player] -= refund; 

    console.log(`💰 ${player} cashed out £${refund}. £${remainder} left in pot as profit.`);

    if (onUpdate) {
      onUpdate(this.potBalance); 
    }

    return this.potBalance;
  }

  // Resolve round: winners get stake + proportional share of profit pool
  resolveOutcome(winners) {
    if (winners.length === 0) {
      return "No winners, pot rolls over.";
    }

    let totalStake = winners.reduce((sum, p) => sum + this.stakes[p], 0);

    winners.forEach(p => {
      let stakeReturn = this.stakes[p];
      let share = (stakeReturn / totalStake) * this.profitPool;
      this.balances[p] += stakeReturn + share;
      this.stakes[p] = 0;
    });

    this.potBalance = 0;
    this.profitPool = 0;
  }
}

export default Pot;
