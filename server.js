const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static("public"));
app.use(express.json());

let clients = [];

// WebSocket connections
wss.on("connection", (ws) => {
    clients.push(ws);
    console.log("Admin connected");

    ws.on("message", (msg) => {
        const message = msg.toString();
        console.log("CMD:", message);

        // broadcast logs back to admin panel
        clients.forEach(c => {
            if (c.readyState === WebSocket.OPEN) {
                c.send(`[SERVER] received: ${message}`);
            }
        });
    });

    ws.on("close", () => {
        clients = clients.filter(c => c !== ws);
        console.log("Admin disconnected");
    });

    ws.send("✔ Connected to game server");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("Server running on", PORT);
});
