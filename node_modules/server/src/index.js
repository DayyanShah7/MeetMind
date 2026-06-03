import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import WebSocket from "ws";

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173"
  })
);

app.get("/", (req, res) => {
  res.json({
    status: "MeetMind AI server running"
  });
});

const wss = new WebSocketServer({ server });

let dashboardClients = new Set();

wss.on("connection", (ws) => {
  console.log("Client connected");

  let dgSocket = null;

  ws.on("message", (message, isBinary) => {
    try {
      // 🎤 Send audio to Deepgram
      if (isBinary) {
        if (dgSocket && dgSocket.readyState === 1) {
          dgSocket.send(message);
        }
        return;
      }

      const data = JSON.parse(message.toString());

      if (data.type === "DASHBOARD_CONNECTED") {
        dashboardClients.add(ws);
        console.log("Dashboard connected");
        return;
      }

      if (data.type === "START_STREAM") {
        console.log("Connecting to Deepgram...");

        dgSocket = new WebSocket(
          "wss://api.deepgram.com/v1/listen?model=nova-2&language=en&punctuate=true",
          {
            headers: {
              Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`
            }
          }
        );

        dgSocket.on("open", () => {
          console.log("Deepgram connected");
        });

        dgSocket.on("message", (msg) => {
          const data = JSON.parse(msg.toString());

          const transcript =
            data.channel?.alternatives?.[0]?.transcript;

          if (transcript && transcript.trim().length > 0) {
            broadcastToDashboards({
              type: "TRANSCRIPT_UPDATE",
              payload: {
                text: transcript,
                timestamp: new Date().toISOString()
              }
            });
          }
        });

        dgSocket.on("error", (err) => {
          console.error("Deepgram error:", err);
        });

        dgSocket.on("close", () => {
          console.log("Deepgram connection closed");
        });

        return;
      }

      if (data.type === "STOP_MEETING") {
        console.log("Stopping meeting...");

        if (dgSocket) {
          dgSocket.close();
          dgSocket = null;
        }

        broadcastToDashboards({
          type: "FINAL_NOTES",
          payload: {
            summary: "Meeting ended.",
            actionItems: [
              "Integrate AI notes",
              "Improve transcript quality"
            ]
          }
        });

        return;
      }
    } catch (error) {
      console.error("WebSocket error:", error);
    }
  });

  ws.on("close", () => {
    dashboardClients.delete(ws);
    console.log("Client disconnected");
  });
});

function broadcastToDashboards(data) {
  for (const client of dashboardClients) {
    if (client.readyState === 1) {
      client.send(JSON.stringify(data));
    }
  }
}

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});