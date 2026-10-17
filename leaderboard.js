// ============================
// leaderboard.js (Your Working Version + Safe DOM Lookup)
// ============================

window.Leaderboard = {
  scores: {},        // { name: currentBalance }
  lastScores: {},    // { name: previousRoundBalance }
  lastRanks: {},     // { name: previousRoundRank }

  update(name, newBalance) {
    // If we don't have a record yet, set starting baseline to £100
    if (this.lastScores[name] === undefined) {
      this.lastScores[name] = 100;
    } else {
      // Store current balance as last balance before updating
      this.lastScores[name] = this.scores[name] !== undefined ? this.scores[name] : newBalance;
    }

    // Update to current balance
    this.scores[name] = newBalance;
  },

  movement(name, currentRank) {
    const oldVal = this.lastScores[name] !== undefined ? this.lastScores[name] : 100;
    const newVal = this.scores[name] !== undefined ? this.scores[name] : 100;
    const oldRank = this.lastRanks[name];

    // Priority 1: Balance change
    if (newVal > oldVal) return "up";
    if (newVal < oldVal) return "down";

    // Priority 2: Rank position shift (if balances are tied)
    if (oldRank !== undefined) {
      if (currentRank < oldRank) return "up";
      if (currentRank > oldRank) return "down";
    }

    return "same";
  },

  render() {
    // 🔑 Safe lookup inside render so it never returns null if called early
    const leaderboardList = document.getElementById("leaderboard-list");
    if (!leaderboardList) return;

    // Sort highest balance first
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
            <div class="name">${name}</div>
            <div class="arrow ${movement}" style="font-weight: bold; color: ${movement === 'up' ? '#2ecc71' : movement === 'down' ? '#e74c3c' : '#888'};">${arrow}</div>
          </div>
          <div class="balance" style="font-weight: bold;">£${Number(balance).toFixed(2)}</div>
        </div>
      `;
    }).join("");

    // Save current ranks for next round comparison
    this.lastRanks = newRanks;
  }
};

window.openLeaderboard = function () {
  const panel = document.getElementById("leaderboardPanel");
  if (panel) {
    panel.style.display = "block"; // show panel
  }
};

window.closeLeaderboard = function () {
  const panel = document.getElementById("leaderboardPanel");
  if (panel) {
    panel.style.display = "none"; // hide panel
  }
};
