const express = require("express");
const routes = require("./routes/index");
const { connectToDatabase } = require("./dBConnection/index");
const app = express();
app.use(express.json());
const port = 3000;

app.use("/api", routes);

// Test Endpoint

app.get("/", async (req, res) => {
  res.send("Hello World!");
});

// Start the database connection and the server
connectToDatabase().then(() => {
  app.listen(port, () => {
    console.log(`App listening on port ${port}`);
  });
});
