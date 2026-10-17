// ============================
// leaderboard.js (Mobile-Safe)
// ============================
(function () {
  window.Leaderboard = window.Leaderboard || {
    scores: {},
    lastScores: {},
    lastRanks: {},

    update(playerName, balance) {
      if (!playerName) return;
      this.scores[playerName] = Number(balance || 0);
    },

    getSortedPlayers() {
      return Object.keys(this.scores)
        .map((name) => ({
          name,
          score: this.scores[name]
        }))
        .sort((a, b) => b.score - a.score);
    },

    render() {
      const listEl = document.getElementById("leaderboard-list");
      if (!listEl) return;

      const currentSorted = this.getSortedPlayers();
      const currentRanks = {};
      currentSorted.forEach((player, index) => {
        currentRanks[player.name] = index + 1;
      });

      listEl.innerHTML = "";

      currentSorted.forEach((player) => {
        const name = player.name;
        const currentScore = player.score;
        const currentRank = currentRanks[name];

        const prevRank = this.lastRanks[name];
        const prevScore = this.lastScores[name];

        let arrow = "➔";
        let arrowClass = "same";

        if (prevRank !== undefined) {
          if (currentRank < prevRank) {
            arrow = "▲";
            arrowClass = "up";
          } else if (currentRank > prevRank) {
            arrow = "▼";
            arrowClass = "down";
          } else if (prevScore !== undefined && currentScore > prevScore) {
            arrow = "▲";
            arrowClass = "up";
          } else if (prevScore !== undefined && currentScore < prevScore) {
            arrow = "▼";
            arrowClass = "down";
          }
        }

        const li = document.createElement("li");
        li.className = "leaderboard-item";
        li.innerHTML = `
          <div class="left">
            <span class="rank">#${currentRank}</span>
            <span class="name">${name}</span>
            <span class="arrow ${arrowClass}">${arrow}</span>
          </div>
          <span class="balance">£${currentScore.toFixed(2)}</span>
        `;

        listEl.appendChild(li);
      });

      currentSorted.forEach((player) => {
        this.lastRanks[player.name] = currentRanks[player.name];
        this.lastScores[player.name] = player.score;
      });
    }
  };
})();
