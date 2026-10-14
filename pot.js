// pot.js
class Pot {
  constructor(players = []) {
    this.potBalance = 0;
    this.stakeOpen = false;
    this.interval = null; // track the stake timer
  }

  // Start stake timer
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

        // ✅ Only host tells server to reveal/end staking
        if (window.isHost && window.socket) {
          window.socket.emit("pot_reveal", { gameId: window.gameId });
        }
      }
    }, 1000);

    // ✅ All clients listen for broadcast once per round
    window.socket.once("pot_reveal", ({ amount }) => {
      this.potBalance = amount;
      if (onReveal) onReveal(amount);
    });
  }

  // Reset pot state locally after a round ends
  resetRound() {
    this.potBalance = 0;
    this.stakeOpen = false;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  // ✅ Client-side action: Emits stake to the server
  stake(amount) {
    if (!this.stakeOpen) {
      console.log("Stake window closed, cannot stake");
      return;
    }
    
    if (window.socket && window.gameId && window.currentPlayerName) {
      window.socket.emit("stake_placed", {
        gameId: window.gameId,
        playerName: window.currentPlayerName,
        amount: amount
      });
    }
  }

  // ✅ Client-side action: Emits cashout to the server
  cashout(amount) {
    if (window.socket && window.gameId && window.currentPlayerName) {
      window.socket.emit("cashout", {
        gameId: window.gameId,
        playerName: window.currentPlayerName,
        amount: amount
      });
    }
  }
}

export default Pot;
