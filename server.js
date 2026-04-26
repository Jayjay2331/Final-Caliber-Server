const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

let clients = new Set();

wss.on("connection", (ws) => {
    console.log("Player connected");
    clients.add(ws);

    ws.on("message", (message) => {
        // broadcast to all clients
        for (let client of clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message.toString());
            }
        }
    });

    ws.on("close", () => {
        console.log("Player disconnected");
        clients.delete(ws);
    });
});

console.log("Server running");
