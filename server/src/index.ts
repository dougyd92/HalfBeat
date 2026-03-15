import http from "http";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import authRoutes from "./routes/auth.js";
import spotifyRoutes from "./routes/spotify.js";
import gameRoutes from "./routes/game.js";
import * as wsServer from "./services/wsServer.js";

const app = express();

app.use(cors({ origin: config.frontendUrl }));
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/spotify", spotifyRoutes);
app.use("/game", gameRoutes);

const server = http.createServer(app);
wsServer.setup(server);

server.listen(config.port, () => {
  console.log(`Halfbeat server running on http://localhost:${config.port}`);
});
