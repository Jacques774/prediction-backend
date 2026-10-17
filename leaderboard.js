// ============================
// leaderboard.js (Arrow-Free & Clean)
// ============================

window.Leaderboard = {
  scores: {}, // { name: currentBalance }

  update(name, newBalance) {
    this.scores[name] = Number(newBalance || 0);
  },

  render() {
    const leaderboardList = document.getElementById("leaderboard-list");
    if (!leaderboardList) return;

    // Sort highest balance first
    const entries = Object.entries(this.scores)
      .sort((a, b) => b[1] - a[1]);

    leaderboardList.innerHTML = entries.map(([name, balance], index) => {
      const currentRank = index + 1;

      return `
        <div class="leaderboard-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; margin-bottom: 4px; background: rgba(255,255,255,0.05); border-radius: 6px;">
          <div class="left" style="display: flex; align-items: center; gap: 8px;">
            <div class="rank" style="font-weight: bold; color: #f1c40f;">#${currentRank}</div>
            <div class="name">${name}</div>
          </div>
          <div class="balance" style="font-weight: bold;">£${Number(balance).toFixed(2)}</div>
        </div>
      `;
    }).join("");
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
