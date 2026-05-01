const MAX_SPEED = 12;
const MAX_ACCEL = 40;

const STRIKE_LIMIT = 5;
const DECAY_PER_SEC = 0.25;
const BASE_TOLERANCE = 1.2;

function createPlayerState() {
    return {
        id: null,

        pos: null,
        vel: { x: 0, y: 0 },

        targetPos: null, // last client-sent position

        strikes: 0,

        burstTicks: 0,

        lastTick: Date.now()
    };
}

// ---------------- CORE TICK ----------------

function tick(players) {
    const now = Date.now();

    for (const player of players.values()) {
        const dt = Math.max(0.016, (now - player.lastTick) / 1000);
        player.lastTick = now;

        if (!player.pos || !player.targetPos) continue;

        validatePlayer(player, dt);
    }
}

// ---------------- VALIDATION ----------------

function validatePlayer(player, dt) {
    const dx = player.targetPos.x - player.pos.x;
    const dy = player.targetPos.y - player.pos.y;

    const distance = Math.hypot(dx, dy);

    const tolerance = BASE_TOLERANCE;

    const maxMove = MAX_SPEED * dt * tolerance;

    // HARD LIMIT CHECK
    if (distance > maxMove * 1.5) {
        return strike(player, 2.5, "Impossible movement");
    }

    const velocity = {
        x: dx / dt,
        y: dy / dt
    };

    const speed = Math.hypot(velocity.x, velocity.y);

    const accel = Math.hypot(
        velocity.x - player.vel.x,
        velocity.y - player.vel.y
    );

    player.vel = velocity;

    // BURST (dash/ability support)
    if (player.burstTicks > 0) {
        player.burstTicks--;
        player.pos = player.targetPos;
        decay(player, dt);
        return;
    }

    // SPEED CHECK
    if (speed > MAX_SPEED * tolerance) {
        return strike(player, 2, "Speed hack");
    }

    // ACCEL CHECK
    if (accel > MAX_ACCEL) {
        return strike(player, 1.5, "Acceleration hack");
    }

    // COLLISION CHECK (IMPORTANT)
    if (!checkCollision(player.pos, player.targetPos)) {
        return strike(player, 3, "Wall clipping");
    }

    // APPLY MOVE (server authoritative correction point)
    player.pos = player.targetPos;

    decay(player, dt);
}

// ---------------- STRIKES ----------------

function strike(player, amount, reason) {
    player.strikes += amount;

    console.log(`[AC] ${reason} | ${player.strikes.toFixed(2)}`);

    if (player.strikes >= STRIKE_LIMIT) {
        ban(player);
        return true;
    }

    return false;
}

function decay(player, dt) {
    player.strikes = Math.max(0, player.strikes - DECAY_PER_SEC * dt);
}

// ---------------- COLLISION HOOK ----------------

function checkCollision(from, to) {
    // replace with real world collision / raycast
    return true;
}

// ---------------- ACTIONS ----------------

function ban(player) {
    console.log(`[BAN] Player ${player.id} banned for cheating`);
    player.banned = true;
}

function allowBurst(player, ticks = 5) {
    player.burstTicks = ticks;
}

module.exports = {
    createPlayerState,
    tick,
    allowBurst
};
