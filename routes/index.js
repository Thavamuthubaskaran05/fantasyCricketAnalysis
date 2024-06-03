const express = require("express");
const router = express.Router();
const {
  getPlayersController,
  addTeamController,
  processResultController,
  teamResultController,
} = require("../controller/index");

router.get("/players", getPlayersController);
router.post("/add-team", addTeamController);
router.get("/process-result", processResultController);
router.get("/team-result", teamResultController);

module.exports = router;
