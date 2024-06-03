const { getDb } = require("../dBConnection/index");
const util = require("util");

const {
  typeMapping,
  playerConstraints,
  getTeamWithHighestRuns,
} = require("./util");

const getPlayersService = async () => {
  const db = getDb();
  try {
    const players = await db.collection("players").find({}).toArray();
    const count = await db.collection("players").count();

    let data = {
      count: count,
      data: players,
    };

    return data;
  } catch (error) {
    throw error;
  }
};

const addTeamPlayerService = async (payload) => {
  if (!Array.isArray(payload?.players) || payload?.players?.length !== 11) {
    return {
      status: false,
      message: "You must provide a list of exactly 11 player names.",
    };
  }
  if (!payload?.teamName) {
    return {
      status: false,
      message: "You must provide a team name.",
    };
  }
  if (!payload?.captain) {
    return {
      status: false,
      message: "You must provide a captain.",
    };
  }
  if (!payload["vice-captain"]) {
    return {
      status: false,
      message: "You must provide a vice captain.",
    };
  }

  const uniquePlayerNames = new Set(payload.players);
  if (uniquePlayerNames.size !== payload.players.length) {
    return {
      status: false,
      message: "Duplicate player names are not allowed.",
    };
  }

  try {
    const db = getDb();
    const playersData = await db
      .collection("players")
      .find({ Player: { $in: payload.players } })
      .toArray();

    if (playersData.length !== 11) {
      return {
        status: false,
        message: "Some players were not found in the database.",
      };
    }

    const playerCounts = {
      WK: 0,
      BAT: 0,
      AR: 0,
      BWL: 0,
    };

    playersData.forEach((player) => {
      const mappedType = typeMapping[player.Role];
      if (mappedType in playerCounts) {
        playerCounts[mappedType]++;
      }
    });

    const errors = [];

    for (const type in playerCounts) {
      const count = playerCounts[type];
      const { min, max } = playerConstraints[type];

      if (count < min) {
        errors.push(`${type} count is below minimum: ${count} < ${min}`);
      }
      if (count > max) {
        errors.push(`${type} count is above maximum: ${count} > ${max}`);
      }
    }

    if (errors.length > 0) {
      return { status: false, message: "Validation failed", data: errors };
    }
    const playerInsertions = payload.players?.map(async (player) => {
      await db.collection("team").insertOne({
        teamName: payload["teamName"],
        player: player,
        captain: player === payload["captain"],
        viceCaptain: player === payload["vice-captain"],
      });
    });
    return { status: true, message: "Team Added Successfully" };
  } catch (error) {
    throw error;
  }
};

const processResultService = async () => {
  const db = getDb();
  try {
    const playersList = await db.collection("players").find({}).toArray();
    const matchData = await db.collection("match").find({}).toArray();
    const teamAgainst = await db
      .collection("match")
      .aggregate([{ $group: { _id: "$BattingTeam" } }], {
        maxTimeMS: 60000,
        allowDiskUse: true,
      })
      .toArray();

    let battingToBowlingMap = {};
    battingToBowlingMap[teamAgainst[0]["_id"]] = teamAgainst[1]["_id"];
    battingToBowlingMap[teamAgainst[1]["_id"]] = teamAgainst[0]["_id"];

    let teamRuns = {};
    teamRuns[teamAgainst[0]["_id"]] = 0;
    teamRuns[teamAgainst[1]["_id"]] = 0;

    let playerPointsData = {};
    playersList.forEach((player) => {
      if (!playerPointsData[player.Player]) {
        playerPointsData[player.Player] = {
          totalPoints: 0,
          totalRuns: 0,
          Team: player.Team,
          Role: player.Role,
          "30s": false,
          "50s": false,
          "100s": false,
          totalWickets: 0,
          "5Wickets": false,
          nofCatches: 0,
        };
      }
    });
    let overWiseBowlerRuns = {};

    matchData.forEach((match, index) => {
      const batter = match.batter;
      const bowler = match.bowler;
      const fielder = playerPointsData[match.fielders_involved];
      const batterPoints = playerPointsData[batter];
      const bowlerPoints = playerPointsData[bowler];

      let bowlingTeam = battingToBowlingMap[match.BattingTeam];

      // For team runs

      teamRuns[match.BattingTeam] += match.total_run;

      // For particular player points and total runs
      batterPoints.totalPoints += match.batsman_run;
      batterPoints.totalRuns += match.batsman_run;

      if (!overWiseBowlerRuns[bowlingTeam]) {
        overWiseBowlerRuns[bowlingTeam] = {};

        if (!overWiseBowlerRuns[bowlingTeam][match.overs]) {
          overWiseBowlerRuns[bowlingTeam][match.overs] = 0;
        }
        if (match.extra_type !== "legbyes") {
          overWiseBowlerRuns[bowlingTeam][match.overs] = match.total_run;
        }
      } else {
        if (!overWiseBowlerRuns[bowlingTeam][match.overs]) {
          overWiseBowlerRuns[bowlingTeam][match.overs] = 0;
          if (match.extra_type !== "legbyes") {
            overWiseBowlerRuns[bowlingTeam][match.overs] = match.total_run;
          }
        } else {
          overWiseBowlerRuns[bowlingTeam][match.overs] += match.total_run;
        }
      }

      if (match.batsman_run == 4) {
        batterPoints.totalPoints += 1;
      }
      if (match.batsman_run == 6) {
        batterPoints.totalPoints += 2;
      }
      if (
        batterPoints.totalRuns >= 30 &&
        batterPoints.totalRuns < 50 &&
        !batterPoints["30s"]
      ) {
        batterPoints["30s"] = true;
        batterPoints.totalPoints += 4;
      }
      if (
        batterPoints.totalRuns >= 50 &&
        batterPoints.totalRuns < 100 &&
        !batterPoints["50s"]
      ) {
        batterPoints["50s"] = true;
        batterPoints.totalPoints -= 4; // Subtract 4 points from 30s
        batterPoints.totalPoints += 8;
      }
      if (batterPoints.totalRuns >= 100 && !batterPoints["100s"]) {
        batterPoints["100s"] = true;
        batterPoints.totalPoints -= 8; // Subtract 8 points from 50s
        batterPoints.totalPoints += 16;
      }

      if (
        match.isWicketDelivery &&
        match.kind !== "NA" &&
        (batterPoints.Role === "WICKET kEEPER" ||
          batterPoints.Role === "BATTER" ||
          batterPoints.Role === "ALL-ROUNDER")
      ) {
        if (batterPoints.totalRuns == 0) {
          batterPoints.totalPoints -= 2;
        }
      }

      // Bowling Points
      if (
        match.isWicketDelivery &&
        match.kind !== "NA" &&
        match.kind !== "run out"
      ) {
        bowlerPoints.totalPoints += 25;
        bowlerPoints.totalWickets += 1;
        if (match.kind === "bowled" || match.kind === "lbw") {
          bowlerPoints.totalPoints += 8;
        }
        if (bowlerPoints.totalWickets == 3) {
          bowlerPoints.totalPoints += 4;
        }
        if (bowlerPoints.totalWickets == 4) {
          bowlerPoints.totalPoints += 8;
        }
        if (bowlerPoints.totalWickets == 5 && !bowlerPoints["5Wickets"]) {
          bowlerPoints["5Wickets"] = true;
          bowlerPoints.totalPoints += 16;
        }
      }
      if (match.ballnumber == 6) {
        if (overWiseBowlerRuns[bowlingTeam][match.overs] == 0) {
          bowlerPoints.totalPoints += 12;
        }
      }

      // Fielding Points
      if (match.isWicketDelivery && match.kind !== "NA") {
        if (match.kind == "caught") {
          fielder["nofCatches"] += 1;
          fielder.totalPoints += 8;
          if (fielder["nofCatches"] == 3) {
            fielder.totalPoints += 4;
          }
        }
        if (match.kind == "stumping") {
          fielder.totalPoints += 12;
        }
        if (match.kind == "run out") {
          fielder.totalPoints += 6;
        }
      }
    });

    const winner = await getTeamWithHighestRuns(teamRuns);
    const playersArray = Object.entries(playerPointsData).map(
      ([name, data]) => ({
        name,
        match: "CSKvRR 2022",
        winner,
        ...data,
      })
    );

    return {
      status: true,
      message: "Result Processed Successfully",
      data: playersArray,
    };
  } catch (error) {
    throw error;
  }
};

const teamResultService = async () => {
  const db = getDb();
  try {
    const data = await db
      .collection("team")
      .aggregate([
        {
          $lookup: {
            from: "result",
            localField: "player",
            foreignField: "name",
            as: "playerResult",
          },
        },
        {
          $unwind: {
            path: "$playerResult",
            preserveNullAndEmptyArrays: true,
          },
        },

        {
          $addFields: {
            totalPoints: {
              $ifNull: ["$playerResult.totalPoints", 0],
            },
            multiplier: {
              $switch: {
                branches: [
                  { case: { $eq: ["$captain", true] }, then: 2 },
                  { case: { $eq: ["$viceCaptain", true] }, then: 1.5 },
                ],
                default: 1,
              },
            },
            adjustedPoints: {
              $multiply: [
                { $ifNull: ["$playerResult.totalPoints", 0] },
                {
                  $switch: {
                    branches: [
                      { case: { $eq: ["$captain", true] }, then: 2 },
                      { case: { $eq: ["$viceCaptain", true] }, then: 1.5 },
                    ],
                    default: 1,
                  },
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: "$teamName",
            players: {
              $push: {
                player: "$player",
                captain: "$captain",
                viceCaptain: "$viceCaptain",
                totalPoints: "$totalPoints",
                adjustedPoints: "$adjustedPoints",
              },
            },

            teamTotalPoints: { $sum: "$adjustedPoints" },
            maxPoints: { $max: "$adjustedPoints" },
          },
        },
        {
          $addFields: {
            winningPlayer: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$players",
                    cond: { $eq: ["$maxPoints", "$$this.adjustedPoints"] },
                  },
                },
                0,
              ],
            },
          },
        },
        {
          $project: {
            _id: 0,
            teamName: "$_id",
            players: 1,
            teamTotalPoints: 1,
            winningPlayer: 1,
          },
        },
      ])
      .toArray();

    const teamResult = await db
      .collection("result")
      .findOne({ match: "CSKvRR 2022" });

    data.forEach((team) => {
      team.teamWin = teamResult.winner;
    });

    let datas = {
      status: true,
      count: "count",
      data: data,
    };

    return datas;
  } catch (error) {
    throw error;
  }
};
module.exports = {
  getPlayersService,
  addTeamPlayerService,
  processResultService,
  teamResultService,
};
