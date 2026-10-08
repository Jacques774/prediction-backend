// pot.js
class Pot {
  constructor(players) {
    this.balances = {};
    this.stakes = {};
    this.potBalance = 0;
    this.profitPool = 0;
    this.stakeOpen = false;
    this.interval = null; // track the stake timer

    players.forEach(p => {
      this.balances[p] = 100; // starting balance
      this.stakes[p] = 0;
    });
  }

  // Start stake timer, reveal pot when it ends
  startStakeTimer(durationMs, onCountdown, onReveal) {
    // clear any previous interval
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.stakeOpen = true;
    let timeLeft = Math.floor(durationMs / 1000);

    this.interval = setInterval(() => {
      if (timeLeft >= 0) {
        if (onCountdown) onCountdown(timeLeft); // show countdown
        timeLeft--;
      } else {
        clearInterval(this.interval);
        this.interval = null;
        this.stakeOpen = false;
        if (onReveal) onReveal(this.potBalance); // reveal pot amount
      }
    }, 1000);
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

  // Cash‑out: refund part, remainder stays in pot as profit
  cashout(player, percent = 0.5, onUpdate) {
    if (this.stakes[player] > 0) {
      let refund = this.stakes[player] * percent;
      let remainder = this.stakes[player] - refund;
      this.balances[player] += refund;
      this.profitPool += remainder;
      this.potBalance -= this.stakes[player];
      this.potBalance += remainder;
      this.stakes[player] = 0; // player is out
      if (onUpdate) onUpdate(this.potBalance); // broadcast updated pot
    }
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
