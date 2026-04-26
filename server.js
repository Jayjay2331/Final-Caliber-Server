const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store rooms: Map<roomId, Set<WebSocket>>
const rooms = new Map();

wss.on('connection', (ws) => {
    let currentRoom = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // 1. Join Room Logic
            if (data.type === 'join_room') {
                const roomId = data.roomId;
                if (!rooms.has(roomId)) rooms.set(roomId, new Set());
                
                const room = rooms.get(roomId);
                room.add(ws);
                currentRoom = roomId;

                // Tell client they are in
                ws.send(JSON.stringify({ type: 'joined', roomId: roomId }));
                
                // Notify others
                broadcast(room, JSON.stringify({ type: 'player_joined' }));
                return;
            }

            // 2. Relay Game Data
            if (currentRoom && rooms.has(currentRoom)) {
                const room = rooms.get(currentRoom);
                // Relay to everyone else in the room
                room.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(message);
                    }
                });
            }
        } catch (e) {
            // If it's binary (Godot packets), just relay it blindly
            if (currentRoom && rooms.has(currentRoom)) {
                const room = rooms.get(currentRoom);
                room.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(message);
                    }
                });
            }
        }
    });

    ws.on('close', () => {
        if (currentRoom && rooms.has(currentRoom)) {
            const room = rooms.get(currentRoom);
            room.delete(ws);
            if (room.size === 0) rooms.delete(currentRoom);
            broadcast(room, JSON.stringify({ type: 'player_left' }));
        }
    });
});

function broadcast(room, message) {
    room.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(message);
    });
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Relay running on port ${PORT}`));
