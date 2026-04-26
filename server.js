const http = require('http');
const WebSocket = require('ws');

// Create HTTP server
const server = http.createServer();

// Create WebSocket server attached to HTTP server
const wss = new WebSocket.Server({ server });

let clients = new Set();
let players = new Map();

function broadcast(obj) {
    const msg = JSON.stringify(obj);
    for (let client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    }
}

wss.on("connection", (ws) => {
    console.log("Client connected");
    clients.add(ws);

    ws.id = Math.random().toString(36).substr(2, 9);
    players.set(ws.id, { x: 0, y: 0, z: 0 });

    ws.send(JSON.stringify({ type: "system", msg: "Connected to server" }));

    ws.on("message", (raw) => {
        let text = raw.toString();

        if (text.startsWith("/")) {
            const args = text.slice(1).split(" ");
            const cmd = args[0];

            if (cmd === "ping") {
                ws.send(JSON.stringify({ type: "system", msg: "pong" }));
            }

            if (cmd === "players") {
                ws.send(JSON.stringify({
                    type: "system",
                    msg: `Players online: ${clients.size}`
                }));
            }

            if (cmd === "tp") {
                let x = parseFloat(args[1]);
                let y = parseFloat(args[2]);
                let z = parseFloat(args[3]);

                players.set(ws.id, { x, y, z });

                ws.send(JSON.stringify({
                    type: "system",
                    msg: `Teleported to ${x}, ${y}, ${z}`
                }));
            }

            return;
        }

        try {
            const data = JSON.parse(text);
            players.set(ws.id, data);

            broadcast({
                type: "update",
                id: ws.id,
                data
            });

        } catch (e) {
            ws.send(JSON.stringify({
                type: "error",
                msg: "Invalid JSON or command"
            }));
        }
    });

    ws.on("close", () => {
        clients.delete(ws);
        players.delete(ws.id);
    });
});

// Listen on both HTTP and WebSocket via same port
const port = process.env.PORT || 8080;
server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
});Copied!   
