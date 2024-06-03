const {
  getPlayersService,
  addTeamPlayerService,
  processResultService,
  teamResultService,
} = require("../service/index");

const getPlayersController = async (req, res) => {
  try {
    const players = await getPlayersService();
    res.status(200).json(players);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addTeamController = async (req, res) => {
  try {
    const payload = req.body;
    const players = await addTeamPlayerService(payload);
    if (players.status) {
      res.status(200).json({ message: players?.message });
    } else {
      res
        .status(400)
        .json({ message: players?.message, data: players?.data || "" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const processResultController = async (req, res) => {
  try {
    const players = await processResultService();
    if (players.status) {
      res.status(200).json({ message: players?.message, data: players?.data });
    } else {
      res
        .status(400)
        .json({ message: players?.message, data: players?.data || "" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const teamResultController = async (req, res) => {
  try {
    const teamResult = await teamResultService();
    if (teamResult.status) {
      res
        .status(200)
        .json({ message: teamResult?.message, data: teamResult?.data });
    } else {
      res
        .status(400)
        .json({ message: teamResult?.message, data: teamResult?.data || "" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getPlayersController,
  addTeamController,
  processResultController,
  teamResultController,
};
