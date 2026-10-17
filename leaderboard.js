// ============================
// leaderboard.js
// ============================

const Leaderboard = {
  scores: {},
  lastScores: {},
  lastRanks: {},

  /**
   * Update a player's current balance
   */
  update(playerName, balance) {
    if (!playerName) return;
    this.scores[playerName] = Number(balance || 0);
  },

  /**
   * Get sorted array of players based on current scores
   */
  getSortedPlayers() {
    return Object.keys(this.scores)
      .map((name) => ({
        name,
        score: this.scores[name]
      }))
      .sort((a, b) => b.score - a.score);
  },

  /**
   * Render the leaderboard into the DOM matching your CSS structure
   */
  render() {
    const listEl = document.getElementById("leaderboard-list");
    if (!listEl) return;

    const currentSorted = this.getSortedPlayers();
    
    // Determine current rank for each player (1-indexed)
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

      // Calculate movement direction if previous rank exists
      if (prevRank !== undefined) {
        if (currentRank < prevRank) {
          // Moved UP in position
          arrow = "▲";
          arrowClass = "up";
        } else if (currentRank > prevRank) {
          // Moved DOWN in position
          arrow = "▼";
          arrowClass = "down";
        } else if (prevScore !== undefined && currentScore > prevScore) {
          // Rank stayed same, but balance increased
          arrow = "▲";
          arrowClass = "up";
        } else if (prevScore !== undefined && currentScore < prevScore) {
          // Rank stayed same, but balance decreased
          arrow = "▼";
          arrowClass = "down";
        }
      }

      // Build DOM Row matching your CSS classes (.left, .rank, .name, .arrow, .balance)
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

    // Save current state as previous state ONLY AFTER render completes
    currentSorted.forEach((player) => {
      this.lastRanks[player.name] = currentRanks[player.name];
      this.lastScores[player.name] = player.score;
    });
  }
};

// Expose globally
window.Leaderboard = Leaderboard;
