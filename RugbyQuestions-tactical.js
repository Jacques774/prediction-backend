// RugbyQuestions-tactical.js
export const RugbyTacticalQuestions = [
  {
    id: "q_tact_score_any",
    text: "Will any points (Try, Penalty Kick, or Drop Goal) be scored by either team in the next 5 minutes?",
    timer: 300 // 5 minutes
  },
  {
    id: "q_tact_first_try",
    text: "Will a try be scored in the next 7 minutes of match play?",
    timer: 420 // 7 minutes
  },
  {
    id: "q_tact_card_discipline",
    text: "Will the referee issue a Yellow or Red card to any player in the next 10 minutes?",
    timer: 600 // 10 minutes
  },
  {
    id: "q_tact_penalty_shot",
    text: "Will either team attempt a direct shot at goal from a penalty in the next 5 minutes?",
    timer: 300 // 5 minutes
  },
  {
    id: "q_tact_territory_22m",
    text: "Will the attacking side enter the opposing team's 22m area in the next 4 minutes?",
    timer: 240 // 4 minutes
  },
  {
    id: "q_tact_multiple_scrums",
    text: "Will there be 2 or more scrums awarded in the next 6 minutes?",
    timer: 360 // 6 minutes
  },
  {
    id: "q_tact_substitution",
    text: "Will either coach make a tactical player substitution in the next 8 minutes?",
    timer: 480 // 8 minutes
  },
  {
    id: "q_tact_drop_goal",
    text: "Will a drop goal be attempted by either team in the next 10 minutes?",
    timer: 600 // 10 minutes
  },
  {
    id: "q_tact_try_converted",
    text: "If a try is scored in the next 6 minutes, will the conversion kick be successful?",
    timer: 360 // 6 minutes
  },
  {
    id: "q_tact_lead_change",
    text: "Will there be a score change that alters the match leader in the next 8 minutes?",
    timer: 480 // 8 minutes
  }
];

export default RugbyTacticalQuestions;
