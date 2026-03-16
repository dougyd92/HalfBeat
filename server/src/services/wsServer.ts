import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { Player } from "../types/game.js";
import * as gameEngine from "./gameEngine.js";

interface PlayerConnection {
  ws: WebSocket;
  player: Player;
}

const allSockets = new Set<WebSocket>();
const connections: PlayerConnection[] = [];
let nextId = 1;

function broadcast(message: object): void {
  const data = JSON.stringify(message);
  for (const ws of allSockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

function broadcastPlayers(): void {
  broadcast({
    type: "players",
    players: gameEngine.getPlayers(),
  });
}

function broadcastGameState(): void {
  try {
    broadcast({
      type: "gameState",
      state: gameEngine.getState(),
    });
  } catch {
    // No game in progress — that's fine
  }
}

export function setup(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  // Register broadcast callback so game engine pushes state on changes
  gameEngine.setBroadcast(() => {
    broadcastPlayers();
    broadcastGameState();
  });

  wss.on("connection", (ws) => {
    allSockets.add(ws);

    // Send current player list immediately
    ws.send(
      JSON.stringify({
        type: "players",
        players: gameEngine.getPlayers(),
      })
    );

    // Send current game state if a game exists
    if (gameEngine.hasGame()) {
      try {
        ws.send(
          JSON.stringify({
            type: "gameState",
            state: gameEngine.getState(),
          })
        );
      } catch {
        // No game — fine
      }
    }

    ws.on("message", async (raw) => {
      let msg: { type: string; name?: string; guess?: string };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === "join" && msg.name) {
        const player: Player = {
          id: String(nextId++),
          name: msg.name.trim().slice(0, 20),
        };

        connections.push({ ws, player });
        gameEngine.addPlayer(player);

        // Confirm join to this client
        ws.send(JSON.stringify({ type: "joined", player }));
      }

      if (msg.type === "buzz") {
        const conn = connections.find((c) => c.ws === ws);
        if (!conn) return;

        const success = await gameEngine.handleBuzz(conn.player.id);
        broadcast({
          type: "buzzResult",
          player: conn.player,
          success,
        });
      }

      if (msg.type === "lastChanceGuess" && msg.guess) {
        const conn = connections.find((c) => c.ws === ws);
        if (!conn) return;
        try {
          gameEngine.submitLastChanceGuess(conn.player.name, msg.guess.trim());
        } catch {
          // Phase not lastChance, etc.
        }
      }

      if (msg.type === "guess" && msg.guess) {
        const conn = connections.find((c) => c.ws === ws);
        if (!conn) return;

        // Only the player who buzzed can guess
        try {
          const state = gameEngine.getState();
          if (state.round?.buzzedBy !== conn.player.name) return;
        } catch {
          return;
        }

        try {
          gameEngine.submitGuess(msg.guess);
          // broadcast() is called inside submitGuess via the callback
        } catch {
          // Round not in guessing phase, etc.
        }
      }
    });

    ws.on("close", () => {
      allSockets.delete(ws);
      const idx = connections.findIndex((c) => c.ws === ws);
      if (idx !== -1) {
        const conn = connections[idx];
        connections.splice(idx, 1);
        gameEngine.removePlayer(conn.player.id);
      }
    });
  });
}
