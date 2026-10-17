// leaderboard.js
const leaderboardList = document.getElementById("leaderboard-list");

window.Leaderboard = {
  scores: {},     // { name: currentBalance }
  lastScores: {}, // { name: previousRoundBalance }
  lastRanks: {},  // { name: previousRoundRank }

  update(name, newBalance) {
    // If a player is completely new, initialize their previous balance baseline to £100
    if (this.lastScores[name] === undefined) {
      this.lastScores[name] = 100;
    }
    // Update to current balance
    this.scores[name] = newBalance;
  },

  movement(name, currentRank) {
    const prevVal = this.lastScores[name] !== undefined ? this.lastScores[name] : 100;
    const newVal = this.scores[name] !== undefined ? this.scores[name] : 100;
    const prevRank = this.lastRanks[name];

    // 1. Balance movement check
    if (newVal > prevVal) return "up";
    if (newVal < prevVal) return "down";

    // 2. Rank position movement check (tie-breaker)
    if (prevRank !== undefined) {
      if (currentRank < prevRank) return "up";
      if (currentRank > prevRank) return "down";
    }

    return "same";
  },

  render() {
    if (!leaderboardList) return;

    // Sort players from highest balance to lowest balance
    const entries = Object.entries(this.scores)
      .sort((a, b) => b[1] - a[1]);

    const newRanks = {};

    leaderboardList.innerHTML = entries.map(([name, balance], index) => {
      const currentRank = index + 1;
      newRanks[name] = currentRank;

      const movement = this.movement(name, currentRank);
      const arrow =
        movement === "up" ? "↑" :
        movement === "down" ? "↓" : "→";

      return `
        <div class="leaderboard-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; margin-bottom: 4px; background: rgba(255,255,255,0.05); border-radius: 6px;">
          <div class="left" style="display: flex; align-items: center; gap: 8px;">
            <div class="rank" style="font-weight: bold; color: #f1c40f;">#${currentRank}</div>
            <div class="name" style="font-weight: 600;">${name}</div>
            <div class="arrow ${movement}" style="font-weight: bold; color: ${
              movement === "up" ? "#2ecc71" : movement === "down" ? "#e74c3c" : "#888"
            };">${arrow}</div>
          </div>
          <div class="balance" style="font-weight: bold;">£${Number(balance).toFixed(2)}</div>
        </div>
      `;
    }).join("");

    // 🔑 AFTER rendering, save current state into 'last' state for the NEXT round
    entries.forEach(([name, balance]) => {
      this.lastScores[name] = balance;
    });
    this.lastRanks = newRanks;
  }
};

window.openLeaderboard = function () {
  const panel = document.getElementById("leaderboardPanel");
  if (panel) {
    panel.style.display = "block";
  }
};

window.closeLeaderboard = function () {
  const panel = document.getElementById("leaderboardPanel");
  if (panel) {
    panel.style.display = "none";
  }
};
