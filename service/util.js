const playerConstraints = {
  WK: { min: 1, max: 8 },
  BAT: { min: 1, max: 8 },
  AR: { min: 1, max: 8 },
  BWL: { min: 1, max: 8 },
};

const typeMapping = {
  WICKETKEEPER: "WK",
  BATTER: "BAT",
  "ALL-ROUNDER": "AR",
  BOWLER: "BWL",
};

async function getTeamWithHighestRuns(runs) {
  let highestTeam = null;
  let highestRuns = -Infinity;

  for (const team in runs) {
    if (runs[team] > highestRuns) {
      highestRuns = runs[team];
      highestTeam = team;
    }
  }

  return highestTeam;
}

module.exports = {
  playerConstraints,
  typeMapping,
  getTeamWithHighestRuns,
};
