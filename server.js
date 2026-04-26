const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

let clients = new Set();

// simple in-memory “game state”
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

    ws.on("message", (raw) => {
        let text = raw.toString();

        // --- COMMAND SYSTEM ---
        if (text.startsWith("/")) {
            const args = text.slice(1).split(" ");
            const cmd = args[0];

            // /ping
            if (cmd === "ping") {
                ws.send(JSON.stringify({ type: "system", msg: "pong" }));
            }

            // /players
            if (cmd === "players") {
                ws.send(JSON.stringify({
                    type: "system",
                    msg: `Players online: ${clients.size}`
                }));
            }

            // /tp x y z
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

        // --- NORMAL GAME DATA ---
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

console.log("Server running");
