const WebSocket = require("ws");
const crypto = require("crypto");

// ===================== SERVER SETUP =====================
const wss = new WebSocket.Server({ port: 8080 });

console.log("Server running on port 8080");

// ===================== DATA =====================
const players = new Map(); // id -> player object

// simple roles
const ROLES = {
  OWNER: "owner",
  COOWNER: "coowner",
  ADMIN: "admin",
  MOD: "mod",
  PLAYER: "player",
};

// basic banned storage
const bans = new Map(); // id -> { until, reason }

// ⚠️ small placeholder filter (don’t hardcode full lists)
const badWords = ["badword1", "badword2"];

// ===================== DISCORD WEBHOOK =====================
const DISCORD_WEBHOOK = "YOUR_WEBHOOK_HERE";

function sendWebhook(msg) {
  if (!DISCORD_WEBHOOK) return;

  fetch(DISCORD_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: msg }),
  }).catch(() => {});
}

// ===================== UTIL =====================
function genId() {
  return crypto.randomBytes(4).toString("hex");
}

function isBanned(id) {
  const ban = bans.get(id);
  if (!ban) return false;
  if (Date.now() > ban.until) {
    bans.delete(id);
    return false;
  }
  return true;
}

function formatTime(ms) {
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h ${mins % 60}m`;
}

// ===================== AUTOMOD =====================
function checkAutomod(player, msg) {
  const text = msg.toLowerCase();

  if (badWords.some(w => text.includes(w))) {
    player.strikes = (player.strikes || 0) + 1;

    let duration =
      player.strikes === 1 ? 5 * 60 * 1000 :
      player.strikes === 2 ? 40 * 60 * 1000 :
      player.strikes === 3 ? 6 * 60 * 60 * 1000 :
      player.strikes >= 4 ? null : null;

    if (duration === null && player.strikes >= 4) {
      bans.set(player.id, { until: Infinity, reason: "AutoMod: repeated toxicity" });
      player.ws.close();
      return;
    }

    if (duration) {
      bans.set(player.id, {
        until: Date.now() + duration,
        reason: "AutoMod: profanity/toxicity",
      });

      player.ws.send(`You are banned for ${formatTime(duration)} (Strike ${player.strikes})`);
      player.ws.close();
    }
  }
}

// ===================== COMMANDS =====================
function handleCommand(player, raw) {
  const args = raw.trim().split(" ");
  const cmd = args[0].toLowerCase();

  // remove slash system
  // commands are like: kick id

  if (cmd === "kick") {
    if (![ROLES.ADMIN, ROLES.MOD, ROLES.OWNER].includes(player.role)) return;

    const targetId = args[1];
    const target = players.get(targetId);
    if (!target) return;

    target.ws.close();
    sendWebhook(`KICK: ${targetId} by ${player.id}`);
  }

  if (cmd === "ban") {
    if (![ROLES.ADMIN, ROLES.MOD, ROLES.OWNER].includes(player.role)) return;

    const targetId = args[1];
    const durationStr = args.slice(2).join(" ");

    let ms = 0;
    if (durationStr.includes("d")) ms += parseInt(durationStr) * 86400000;
    if (durationStr.includes("h")) ms += parseInt(durationStr) * 3600000;
    if (durationStr.includes("m")) ms += parseInt(durationStr) * 60000;

    bans.set(targetId, {
      until: Date.now() + ms,
      reason: "Manual ban",
    });

    const target = players.get(targetId);
    if (target) target.ws.close();

    sendWebhook(`BAN: ${targetId} for ${durationStr}`);
  }

  if (cmd === "unban") {
    bans.delete(args[1]);
  }

  if (cmd === "playerinfo") {
    const target = players.get(args[1]);
    if (!target) return;

    const ban = bans.get(target.id);

    player.ws.send(
      `ID: ${target.id} | Name: ${target.name} | Banned: ${ban ? "Yes" : "No"}`
    );
  }

  if (cmd === "role") {
    if (player.role !== ROLES.OWNER) return;

    const id = args[1];
    const role = args[2];

    const target = players.get(id);
    if (target) target.role = role;
  }

  if (cmd === "testplayer") {
    const name = args.slice(1).join(" ");
    const id = genId();

    players.set(id, {
      id,
      name,
      ws: null,
      role: ROLES.PLAYER,
      strikes: 0,
    });

    console.log(`Test player created: ${name} (${id})`);
  }
}

// ===================== CONNECTION =====================
wss.on("connection", (ws) => {
  const id = genId();

  if (isBanned(id)) {
    ws.close();
    return;
  }

  const player = {
    id,
    name: `player_${id}`,
    ws,
    role: ROLES.PLAYER,
    strikes: 0,
  };

  players.set(id, player);

  ws.send(`[SYSTEM] Welcome! Your ID is ${id}`);

  broadcast(`${player.name} joined (${id})`);

  ws.on("message", (msg) => {
    const text = msg.toString();

    checkAutomod(player, text);

    if (text.startsWith("kick") || text.startsWith("ban") || text.startsWith("unban") ||
        text.startsWith("playerinfo") || text.startsWith("role") || text.startsWith("testplayer")) {
      handleCommand(player, text);
    }
  });

  ws.on("close", () => {
    players.delete(id);
    broadcast(`${player.name} left (${id})`);
  });
});

// ===================== BROADCAST =====================
function broadcast(msg) {
  for (const p of players.values()) {
    if (p.ws) p.ws.send(`[SYSTEM] ${msg}`);
  }
}
