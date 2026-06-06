import "dotenv/config";
import cors from "cors";
import express from "express";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = Number(process.env.BACKEND_PORT || 4000);
const HOST = process.env.BACKEND_HOST || "0.0.0.0";

type RobotState = {
  robot_id: string;
  position: {
    x: number;
    y: number;
  };
  battery_percentage: number;
  timestamp: string;
};

let latestRobotState: RobotState | null = null;
let pluginSocket: WebSocket | null = null;
let pluginConnected = false;

const telemetrySchema = z.object({
  type: z.literal("telemetry"),
  payload: z.object({
    robot_id: z.string(),
    position: z.object({
      x: z.number(),
      y: z.number()
    }),
    battery_percentage: z.number(),
    timestamp: z.string()
  })
});

const commandSchema = z.object({
  command: z.enum(["w", "a", "s", "d"])
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    plugin_connected: pluginConnected,
    last_telemetry_at: latestRobotState?.timestamp ?? null
  });
});

app.get("/api/robot/state", (_req, res) => {
  if (!latestRobotState) {
    return res.status(404).json({
      message: "Robot telemetry is not available yet"
    });
  }

  return res.json(latestRobotState);
});

app.post("/api/robot/command", (req, res) => {
  const parsed = commandSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid command. Allowed commands are w, a, s, d."
    });
  }

  if (!pluginSocket || pluginSocket.readyState !== WebSocket.OPEN) {
    return res.status(503).json({
      message: "ROS Plugin is not connected"
    });
  }

  const message = {
    type: "command",
    payload: {
      command: parsed.data.command
    }
  };

  pluginSocket.send(JSON.stringify(message));

  return res.json({
    status: "sent",
    command: parsed.data.command
  });
});

const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  path: "/ws/plugin"
});

wss.on("connection", (socket) => {
  console.log("[backend] ROS Plugin connected");

  pluginSocket = socket;
  pluginConnected = true;

  socket.on("message", (rawMessage) => {
    try {
      const json = JSON.parse(rawMessage.toString());
      const parsed = telemetrySchema.safeParse(json);

      if (!parsed.success) {
        console.warn("[backend] Ignored invalid plugin message", parsed.error.flatten());
        return;
      }

      latestRobotState = parsed.data.payload;

      console.log(
        `[backend] telemetry robot=${latestRobotState.robot_id} x=${latestRobotState.position.x} y=${latestRobotState.position.y} battery=${latestRobotState.battery_percentage}`
      );
    } catch (error) {
      console.error("[backend] Failed to parse plugin message", error);
    }
  });

  socket.on("close", () => {
    console.warn("[backend] ROS Plugin disconnected");

    if (pluginSocket === socket) {
      pluginSocket = null;
      pluginConnected = false;
    }
  });

  socket.on("error", (error) => {
    console.error("[backend] Plugin WebSocket error", error);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[backend] listening on http://${HOST}:${PORT}`);
  console.log(`[backend] plugin websocket path ws://${HOST}:${PORT}/ws/plugin`);
});
