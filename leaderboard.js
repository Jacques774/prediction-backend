// leaderboard.js
const leaderboardList = document.getElementById("leaderboard-list");

window.Leaderboard = {
  scores: {},        // { name: balance }
  lastScores: {},    // track previous values for arrows

  update(name, newBalance) {
    // store previous balance correctly
    if (this.scores[name] !== undefined) {
      this.lastScores[name] = this.scores[name];
    } else {
      this.lastScores[name] = newBalance;
    }

    // update to current balance
    this.scores[name] = newBalance;
  },

  movement(name) {
    const oldVal = this.lastScores[name];
    const newVal = this.scores[name];

    if (newVal > oldVal) return "up";
    if (newVal < oldVal) return "down";
    return "same";
  },

  render() {
    const entries = Object.entries(this.scores)
      .sort((a, b) => b[1] - a[1]); // highest balance first

    leaderboardList.innerHTML = entries.map(([name, balance], index) => {
      const movement = this.movement(name);
      const arrow =
        movement === "up" ? "↑" :
        movement === "down" ? "↓" : "→";

      return `
        <div class="leaderboard-item">
          <div class="left">
            <div class="rank">${index + 1}</div>
            <div class="name">${name}</div>
            <div class="arrow ${movement}">${arrow}</div>
          </div>
          <div class="balance">${balance.toFixed(2)}</div>
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
