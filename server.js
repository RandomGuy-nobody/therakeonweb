'use strict';

/* ============================================================
   Node.js multiplayer horror game server
   Serves static files + Socket.IO game server on port 3000
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');

let SocketServer;
try {
  const si = require('socket.io');
  SocketServer = si.Server || si;
} catch (e) {
  console.error('socket.io is required: npm install socket.io');
  process.exit(1);
}

/* ---------------- Constants ---------------- */

const PORT = 3000;
const TICK_RATE = 20;
const DEBUG_PASSWORD = 'auras67';

const DAY_DURATION = 150;
const NIGHT_DURATION = 480;
const START_WITH_DAY = true;

const PLAYER_MAX_HP = 100;
const DAMAGE_PER_HIT = 40;
const DAMAGE_ENRAGED_MULT = 1.5;

const RAKE_MAX_HP = 800
const RAKE_DEFEAT_HP = 10;
const RAKE_ENRAGE_HP_THRESHOLD = 0.55;
const RAKE_ENRAGE_TRANSFORM_TIME = 5.0;
const RAKE_ENRAGE_DURATION = 20.0;
const RAKE_ENRAGE_END_TIME = 2.0;
const RAKE_ENRAGE_SPEED_MULT = 1.4;
const RAKE_ENRAGE_SHIELD_INITIAL = 3;
const RAKE_ENRAGE_SHIELD_MAX = 8;
const RAKE_SHIELD_HITS_PER_POINT = 1;

const BLOOD_HOUR_CHANCE = 0.20;
const BLOOD_HOUR_TRANSFORM_TIME = 30.0;
const BLOOD_HOUR_WARN_AT = 28.0;
const BLOOD_HOUR_DURATION = 60.0;
const BLOOD_HOUR_SPEED_MULT = 2.5;
const BLOOD_HOUR_RUN_TIME = 2.0;
const BLOOD_HOUR_STOP_TIME = 1.0;
const BLOOD_HOUR_NO_PAUSE_RANGE = 45.0;

const HURT_STUN_TIME = 0.4;
const ATTACK_TAIL_TIME = 0.15;
const ATTACK_COOLDOWN = 0.9;
const SCREECH_TIME = 1.6;
const RETREAT_SCREAM_TIME = 2.0;
const ATTACK_DURATION = 1.0;

const MONSTER = {
  wanderSpeed: 2.5,
  stalkSpeed: 3.5,
  huntSpeed: 4.6,
  retreatSpeed: 10.0,

  sightRange: 24,
  loseSightRange: 26,
  loseSightTime: 1.2,
  killRange: 2.4,
  playerFacingDot: 0.4,
  idleDuration: [0.6, 1.5],
  wanderDuration: [3.0, 6.0],
  stalkDuration: 20.0
};

const MAP_HALF = 80;
const RAKE_SPAWN = { x: 0, z: -33 };
const CAVE_POSITION = { x: 0, z: -39 };
const ENTRANCE_WP = { x: 0, z: CAVE_POSITION.z + 10 };
const INSIDE_WP = { x: 0, z: CAVE_POSITION.z };

const PLAYER_SPAWN_POINTS = [
  { x: 0, y: 1.7, z: 30 },
  { x: 3, y: 1.7, z: 30 },
  { x: -3, y: 1.7, z: 30 },
  { x: 6, y: 1.7, z: 30 },
  { x: -6, y: 1.7, z: 30 },
  { x: 9, y: 1.7, z: 30 }
];

const POINTS_PER_NIGHT = 100;
const POINTS_PER_DEATH = 25;
const SHOP_GUN_COST = 100;
const SHOP_SPOTLIGHT_COST = 10;
const GUN_DAMAGE = 40;
const GUN_RANGE = 60;
const GUN_AIM_DOT = 0.92;

/* ---------------- Static file server ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.fbx': 'application/octet-stream',
  '.obj': 'text/plain; charset=utf-8',
  '.mtl': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm'
};

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch (e) {
    urlPath = '/';
  }
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  const filePath = path.normalize(path.join(__dirname, urlPath));

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mimeFor(filePath),
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache'
    });
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => { try { res.end(); } catch (e) {} });
    stream.pipe(res);
  });
});

const io = new SocketServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 10000,
  pingTimeout: 20000
});

/* ---------------- Game state ---------------- */

const game = {
  phase: {
    isDay: START_WITH_DAY,
    phaseTime: 0,
    nightNumber: 0,
    gameTime: 0
  },
  points: 0,
  gunUnlocked: false,
  spotlightOwned: false,
  rakeDefeated: false
};

const players = {};
const verifiedSockets = new Set();

const monster = {
  x: RAKE_SPAWN.x,
  y: 0,
  z: RAKE_SPAWN.z,
  ry: 0,

  hp: RAKE_MAX_HP,
  shield: 0,
  shieldMax: 0,
  shieldHitCounter: 0,

  active: false,
  visible: false,
  state: 'DESPAWNED',

  stateTimer: 0,
  stateDuration: 0,

  wanderTarget: { x: 0, z: 0 },
  stepTimer: 0,
  sniffTimer: 0,

  attackTimer: 0,
  attackDuration: ATTACK_DURATION,
  attackCooldown: 0,
  attackApplied: false,
missSlowTimer: 0,

  outOfRangeTimer: 0,

  enraged: false,
  enrageTriggered: false,
  enragedTimer: 0,
  enragedTransformDone: false,

  bloodHourArmed: false,
  bloodHourActive: false,
  bloodHourT: 0,
  bloodHourTransformT: 0,
  bloodHourWarned: false,
  bloodHourPhase: 'run',
  runTimer: 0,
  pauseTimer: 0,

  prevState: 'IDLE'
};

/* ---------------- Small helpers ---------------- */

function randRange(range) {
  const a = range[0];
  const b = range[1];
  return a + Math.random() * (b - a);
}

function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

function clampToMap() {
  if (monster.x > MAP_HALF) monster.x = MAP_HALF;
  if (monster.x < -MAP_HALF) monster.x = -MAP_HALF;
  if (monster.z > MAP_HALF) monster.z = MAP_HALF;
  if (monster.z < -MAP_HALF) monster.z = -MAP_HALF;
}

function pickWanderTarget() {
  monster.wanderTarget.x = (Math.random() * 2 - 1) * (MAP_HALF - 6);
  monster.wanderTarget.z = (Math.random() * 2 - 1) * (MAP_HALF - 6);
}

/* ---------------- Player helpers ---------------- */

function pickSpawnPoint() {
  const count = Object.keys(players).length;
  return PLAYER_SPAWN_POINTS[count % PLAYER_SPAWN_POINTS.length];
}

function buildPlayersPayload() {
  const out = {};
  for (const id in players) {
    const p = players[id];
    out[id] = {
      x: p.x,
      y: p.y,
      z: p.z,
      ry: p.ry,
      hp: p.hp,
      dead: p.dead,
      name: p.name,
      color: p.color,
      equipped: p.equipped
    };
  }
  return out;
}

function emitShop() {
  io.emit('shop-updated', {
    points: game.points,
    gunUnlocked: game.gunUnlocked,
    spotlightOwned: game.spotlightOwned
  });
}

function damagePlayer(p, amount) {
  if (!p || p.dead) return;
  p.hp -= amount;
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    io.emit('player-damaged', { id: p.id, amount: amount, hp: p.hp });
    io.emit('player-died', { id: p.id });
  } else {
    io.emit('player-damaged', { id: p.id, amount: amount, hp: p.hp });
  }
}

function getNearestPlayer() {
  let best = null;
  let bestDist = Infinity;
  for (const id in players) {
    const p = players[id];
    if (p.dead) continue;
    const d = dist2D(p.x, p.z, monster.x, monster.z);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  if (!best) return null;
  return { player: best, dist: bestDist };
}

/* ---------------- Facing math (CRITICAL) ---------------- */

function playerForwardDotTo(p, tx, tz) {
  const fx = -Math.sin(p.ry);
  const fz = -Math.cos(p.ry);
  const dx = tx - p.x;
  const dz = tz - p.z;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.0001) return 1;
  return (fx * dx + fz * dz) / len;
}

function isPlayerLookingAt(p, m) {
  return playerForwardDotTo(p, m.x, m.z) > MONSTER.playerFacingDot;
}

/* ---------------- Movement helpers ---------------- */

function moveToward(tx, tz, speed, dt) {
  const dx = tx - monster.x;
  const dz = tz - monster.z;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.0001) return;
  const step = Math.min(speed * dt, len);
  monster.x += (dx / len) * step;
  monster.z += (dz / len) * step;
  clampToMap();
  monster.ry = Math.atan2(dx, dz);
}

function rotateToward(tx, tz, dt, speed) {
  const dx = tx - monster.x;
  const dz = tz - monster.z;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.0001) return;
  const targetRy = Math.atan2(dx, dz);
  let diff = targetRy - monster.ry;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const maxStep = speed * dt;
  if (Math.abs(diff) <= maxStep) monster.ry = targetRy;
  else monster.ry += Math.sign(diff) * maxStep;
}

function emitRakeStep(speed, dt) {
  monster.stepTimer += dt;
  const interval = Math.max(0.18, 2.2 / Math.max(speed, 0.1));
  if (monster.stepTimer >= interval) {
    monster.stepTimer = 0;
    io.emit('rake-step', {
      speed: speed,
      x: monster.x,
      y: monster.y,
      z: monster.z
    });
  }
}

/* ---------------- Monster state machine ---------------- */

function setMonsterState(s, keepEnrageTimer) {
  monster.state = s;
  monster.stateTimer = 0;
  monster.attackApplied = false;

  switch (s) {
    case 'DESPAWNED':
      monster.stateDuration = 0;
      break;
    case 'IDLE':
      monster.stateDuration = randRange(MONSTER.idleDuration);
      break;
    case 'WANDER':
      monster.stateDuration = randRange(MONSTER.wanderDuration);
      monster.sniffTimer = 0;
      pickWanderTarget();
      break;
    case 'STALK':
      monster.stateDuration = MONSTER.stalkDuration;
      break;
    case 'SCREECH':
      monster.stateDuration = SCREECH_TIME;
      io.emit('rake-screech');
      break;
    case 'HUNT':
      monster.stateDuration = Infinity;
      monster.outOfRangeTimer = 0;
      break;
    case 'ATTACK':
      monster.stateDuration = monster.attackDuration;
      monster.attackTimer = 0;
      break;
    case 'HURT':
      monster.stateDuration = HURT_STUN_TIME;
      break;
    case 'ENRAGED_TRANSFORM':
      monster.stateDuration = RAKE_ENRAGE_TRANSFORM_TIME;
      break;
    case 'ENRAGED':
      monster.stateDuration = RAKE_ENRAGE_DURATION;
      if (!keepEnrageTimer) monster.enragedTimer = RAKE_ENRAGE_DURATION;
      break;
    case 'ENRAGED_END':
      monster.stateDuration = RAKE_ENRAGE_END_TIME;
      break;
    case 'RETREAT_SCREAM':
      monster.stateDuration = RETREAT_SCREAM_TIME;
      break;
    case 'RETREAT_RUN':
      monster.stateDuration = Infinity;
      break;
    case 'RETREAT_ENTER':
      monster.stateDuration = Infinity;
      break;
    case 'BLOOD_TRANSFORM':
      monster.stateDuration = BLOOD_HOUR_TRANSFORM_TIME;
      monster.bloodHourWarned = false;
      monster.bloodHourTransformT = 0;
      break;
    case 'BLOOD_HOUR':
      monster.stateDuration = BLOOD_HOUR_DURATION;
      monster.bloodHourT = 0;
      monster.bloodHourPhase = 'run';
      monster.runTimer = 0;
      monster.pauseTimer = 0;
      break;
    default:
      monster.stateDuration = 1.0;
      break;
  }
}

function spawnRake() {
  monster.x = RAKE_SPAWN.x;
  monster.y = 0;
  monster.z = RAKE_SPAWN.z;
  monster.ry = 0;

  monster.hp = RAKE_MAX_HP;
  monster.shield = 0;
  monster.shieldMax = 0;
  monster.shieldHitCounter = 0;

  monster.enraged = false;
  monster.enrageTriggered = false;
  monster.enragedTimer = 0;
  monster.enragedTransformDone = false;

  monster.bloodHourActive = false;
  monster.bloodHourT = 0;
  monster.bloodHourTransformT = 0;
  monster.bloodHourWarned = false;

  monster.attackCooldown = 0;
  monster.attackTimer = 0;
  monster.outOfRangeTimer = 0;
  monster.stepTimer = 0;
  monster.sniffTimer = 0;

  game.rakeDefeated = false;

  monster.active = true;
  monster.visible = true;
  setMonsterState('IDLE');
}

function startBloodHour() {
  monster.bloodHourActive = true;
  monster.bloodHourArmed = false;
  monster.bloodHourT = 0;
  monster.bloodHourTransformT = 0;
  monster.enraged = false;
  monster.enragedTransformDone = false;
  monster.shield = 0;
  monster.shieldMax = 0;
  monster.shieldHitCounter = 0;
  monster.hp = RAKE_MAX_HP;
  game.rakeDefeated = false;
  monster.active = true;
  monster.visible = true;
  setMonsterState('BLOOD_TRANSFORM');
  io.emit('blood-hour-trigger');
}

function defeatRake() {
  if (game.rakeDefeated) return;
  game.rakeDefeated = true;
  monster.hp = RAKE_DEFEAT_HP;
  monster.shield = 0;
  monster.shieldMax = 0;
  monster.shieldHitCounter = 0;
  monster.enraged = false;
  monster.enragedTransformDone = false;

  // Skip night to its last 15 seconds — day arrives shortly after.
  if (!game.phase.isDay && game.phase.phaseTime < NIGHT_DURATION - 15) {
    game.phase.phaseTime = NIGHT_DURATION - 15;
  }

  io.emit('rake-defeated');
  setMonsterState('RETREAT_SCREAM');
}

function endBloodHourImmediate() {
  io.emit('blood-hour-end');
  monster.bloodHourActive = false;
  monster.bloodHourT = 0;
  monster.enraged = false;
  monster.enragedTransformDone = false;

  // Immediate transition to day — skip the rest of the night.
  game.phase.isDay = true;
  game.phase.phaseTime = 0;
  game.points += POINTS_PER_NIGHT;
  io.emit('phase-changed', { isDay: true, nightNumber: game.phase.nightNumber });
  game.rakeDefeated = true;
  setMonsterState('RETREAT_SCREAM');
  emitShop();
}

function damageMonster(amount) {
  if (!monster.active) return;
  if (game.rakeDefeated) return;
  if (monster.state === 'BLOOD_TRANSFORM' || monster.state === 'BLOOD_HOUR') return;
  if (monster.state === 'DESPAWNED') return;

  if (monster.state === 'ENRAGED_TRANSFORM') {
    // Shots during transform are ignored — they no longer grow the shield.
    // Growing it here made him practically unkillable if you kept shooting
    // during the 5s transform, since the shield would balloon to 8.
    return;
  }

  // NOTE: shots during the rake's ATTACK swing bypass the shield and hit hp.
  // This is a deliberate mechanic — reward for timing your shots mid-swing.
  // Do not "fix" by broadening this check.
  if (monster.state === 'ENRAGED' && monster.shield > 0) {
    monster.shieldHitCounter++;
    if (monster.shieldHitCounter >= RAKE_SHIELD_HITS_PER_POINT) {
      monster.shieldHitCounter = 0;
      monster.shield--;
      if (monster.shield <= 0) {
        monster.shield = 0;
        setMonsterState('ENRAGED_END');
      }
    }
    // Instead of a full stun, brief slow. Uses the same miss timer that
    // a whiffed ATTACK uses. 0.4s of half-speed on every shield hit.
    monster.missSlowTimer = Math.max(monster.missSlowTimer, 0.4);
    return;
  }

  monster.hp -= amount;
  io.emit('rake-hurt');

  if (monster.hp <= RAKE_DEFEAT_HP) {
    const forced = monster.bloodHourArmed;
    const roll = Math.random();
    monster.bloodHourArmed = false;
    const triggers = forced || roll < BLOOD_HOUR_CHANCE;
    console.log(`[defeat] hp=${monster.hp} armed=${forced} roll=${roll.toFixed(3)} / ${BLOOD_HOUR_CHANCE} → ${triggers ? 'BLOOD HOUR' : 'normal defeat'}`);
    if (triggers) {
      startBloodHour();
    } else {
      defeatRake();
    }
    return;
  }

  if (!monster.enrageTriggered && monster.hp <= RAKE_MAX_HP * RAKE_ENRAGE_HP_THRESHOLD) {
    monster.enrageTriggered = true;
    monster.shield = RAKE_ENRAGE_SHIELD_INITIAL;
    monster.shieldMax = RAKE_ENRAGE_SHIELD_INITIAL;
    monster.shieldHitCounter = 0;
    setMonsterState('ENRAGED_TRANSFORM');
    return;
  }

  monster.prevState = monster.state;
  setMonsterState('HURT');
}

function updateMonster(dt) {
  if (!monster.active) return;

  monster.stateTimer += dt;
  if (monster.attackCooldown > 0) monster.attackCooldown -= dt;
if (monster.missSlowTimer > 0) monster.missSlowTimer -= dt;

  const nearest = getNearestPlayer();
  const target = nearest ? nearest.player : null;
  const dist = nearest ? nearest.dist : Infinity;

  switch (monster.state) {
    case 'DESPAWNED': {
      monster.active = false;
      monster.visible = false;
      break;
    }

    case 'IDLE': {
      if (target) rotateToward(target.x, target.z, dt, 2.0);
      if (target && dist < MONSTER.sightRange) {
        if (isPlayerLookingAt(target, monster)) setMonsterState('SCREECH');
        else setMonsterState('STALK');
        break;
      }
      if (monster.stateTimer >= monster.stateDuration) setMonsterState('WANDER');
      break;
    }

    case 'WANDER': {
      moveToward(monster.wanderTarget.x, monster.wanderTarget.z, MONSTER.wanderSpeed, dt);
      emitRakeStep(MONSTER.wanderSpeed, dt);

      monster.sniffTimer += dt;
      if (monster.sniffTimer >= 4.0) {
        monster.sniffTimer = 0;
        io.emit('rake-sniff');
      }

      if (target && dist < MONSTER.sightRange) {
        if (isPlayerLookingAt(target, monster)) setMonsterState('SCREECH');
        else setMonsterState('STALK');
        break;
      }

      const d = dist2D(monster.x, monster.z, monster.wanderTarget.x, monster.wanderTarget.z);
      if (d < 1.5 || monster.stateTimer >= monster.stateDuration) setMonsterState('IDLE');
      break;
    }

    case 'STALK': {
      if (!target) {
        setMonsterState('IDLE');
        break;
      }
      rotateToward(target.x, target.z, dt, 3.0);

      if (isPlayerLookingAt(target, monster)) {
        setMonsterState('SCREECH');
        break;
      }
      if (dist < MONSTER.killRange) {
        setMonsterState('ATTACK');
        break;
      }

      moveToward(target.x, target.z, MONSTER.stalkSpeed, dt);
      emitRakeStep(MONSTER.stalkSpeed, dt);

      if (monster.stateTimer >= monster.stateDuration) setMonsterState('IDLE');
      break;
    }

    case 'SCREECH': {
      if (target) rotateToward(target.x, target.z, dt, 4.0);
      if (monster.stateTimer >= monster.stateDuration) setMonsterState('HUNT');
      break;
    }

    case 'HUNT': {
      if (!target) {
        setMonsterState('WANDER');
        break;
      }
      rotateToward(target.x, target.z, dt, 5.0);

      if (dist < MONSTER.killRange && monster.attackCooldown <= 0) {
        setMonsterState('ATTACK');
        break;
      }

      if (dist > MONSTER.loseSightRange) {
        monster.outOfRangeTimer += dt;
        if (monster.outOfRangeTimer >= MONSTER.loseSightTime) {
          monster.outOfRangeTimer = 0;
          setMonsterState('WANDER');
          break;
        }
      } else {
        monster.outOfRangeTimer = 0;
      }

      moveToward(target.x, target.z, MONSTER.huntSpeed, dt);
      emitRakeStep(MONSTER.huntSpeed, dt);
      break;
    }

    case 'ATTACK': {
      monster.attackTimer += dt;

      // Movement is decoupled from the attack cooldown.
      // The rake never stands still during the swing — he keeps stalking forward
      // at reduced speed. A missed hit slows him further for 0.2s.
      const baseMove = MONSTER.huntSpeed * 0.45;
      const moveSpeed = monster.missSlowTimer > 0 ? baseMove * 0.5 : baseMove;
      if (target) {
        rotateToward(target.x, target.z, dt, 8.0);
        moveToward(target.x, target.z, moveSpeed, dt);
        emitRakeStep(moveSpeed, dt);
      }

      if (!monster.attackApplied && monster.attackTimer >= monster.attackDuration * 0.4) {
        monster.attackApplied = true;
        const n2 = getNearestPlayer();
        let hit = false;
        if (n2 && n2.dist < MONSTER.killRange + 1.2) {
          const dmg = monster.enraged
            ? DAMAGE_PER_HIT * DAMAGE_ENRAGED_MULT
            : DAMAGE_PER_HIT;
          damagePlayer(n2.player, dmg);
          hit = true;
        }
        if (!hit) monster.missSlowTimer = 0.2;
      }

      if (monster.attackTimer >= monster.attackDuration + ATTACK_TAIL_TIME) {
        monster.attackCooldown = ATTACK_COOLDOWN;
        if (monster.enraged) setMonsterState('ENRAGED', true);
        else setMonsterState('HUNT');
      }
      break;
    }

    case 'HURT': {
      if (target) rotateToward(target.x, target.z, dt, 3.0);
      if (monster.stateTimer >= monster.stateDuration) {
        if (monster.enraged) setMonsterState('ENRAGED', true);
        else setMonsterState('HUNT');
      }
      break;
    }

    case 'ENRAGED_TRANSFORM': {
      if (target) rotateToward(target.x, target.z, dt, 1.5);
      if (monster.stateTimer >= monster.stateDuration) {
        monster.enraged = true;
        monster.enragedTransformDone = true;
        monster.enragedTimer = RAKE_ENRAGE_DURATION;
        setMonsterState('ENRAGED', true);
      }
      break;
    }

    case 'ENRAGED': {
      monster.enragedTimer -= dt;

      if (monster.enragedTimer <= 0) {
        setMonsterState('ENRAGED_END');
        break;
      }
      if (!target) {
        setMonsterState('ENRAGED_END');
        break;
      }

      rotateToward(target.x, target.z, dt, 5.0);

      if (dist < MONSTER.killRange && monster.attackCooldown <= 0) {
        setMonsterState('ATTACK');
        break;
      }

      const baseSpeed = MONSTER.huntSpeed * RAKE_ENRAGE_SPEED_MULT;
      const spd = monster.missSlowTimer > 0 ? baseSpeed * 0.5 : baseSpeed;
      moveToward(target.x, target.z, spd, dt);
      emitRakeStep(spd, dt);
      break;
    }

    case 'ENRAGED_END': {
      monster.enraged = false;
      monster.enragedTransformDone = false;
      monster.shield = 0;
      monster.shieldMax = 0;
      monster.shieldHitCounter = 0;
      if (target) rotateToward(target.x, target.z, dt, 2.0);
      if (monster.stateTimer >= monster.stateDuration) setMonsterState('HUNT');
      break;
    }

    case 'RETREAT_SCREAM': {
      rotateToward(ENTRANCE_WP.x, ENTRANCE_WP.z, dt, 4.0);
      if (monster.stateTimer >= monster.stateDuration) setMonsterState('RETREAT_RUN');
      break;
    }

    case 'RETREAT_RUN': {
      moveToward(ENTRANCE_WP.x, ENTRANCE_WP.z, MONSTER.retreatSpeed, dt);
      emitRakeStep(MONSTER.retreatSpeed, dt);
      const d = dist2D(monster.x, monster.z, ENTRANCE_WP.x, ENTRANCE_WP.z);
      if (d < 2.0) setMonsterState('RETREAT_ENTER');
      break;
    }

    case 'RETREAT_ENTER': {
      moveToward(INSIDE_WP.x, INSIDE_WP.z, MONSTER.retreatSpeed, dt);
      const d = dist2D(monster.x, monster.z, INSIDE_WP.x, INSIDE_WP.z);
      if (d < 1.5) {
        monster.active = false;
        monster.visible = false;
        setMonsterState('DESPAWNED');
      }
      break;
    }

    case 'BLOOD_TRANSFORM': {
      monster.bloodHourTransformT = monster.stateDuration - monster.stateTimer;

      if (target) rotateToward(target.x, target.z, dt, 0.6);

      if (!monster.bloodHourWarned && monster.stateTimer >= BLOOD_HOUR_WARN_AT) {
        monster.bloodHourWarned = true;
      }

      if (monster.stateTimer >= monster.stateDuration) {
        setMonsterState('BLOOD_HOUR');
        io.emit('blood-hour-begin');
      }
      break;
    }

    case 'BLOOD_HOUR': {
      monster.bloodHourT = monster.stateDuration - monster.stateTimer;

      if (monster.stateTimer >= monster.stateDuration) {
        endBloodHourImmediate();
        break;
      }

      const bhSpeed = MONSTER.huntSpeed * BLOOD_HOUR_SPEED_MULT;
      const wanderSpeed = bhSpeed * 0.8;

      // He is NOT omniscient during Blood Hour anymore. He has to see you
      // to chase you. Sight range is extended a bit so he's still very
      // dangerous, but breaking line of sight in the trees genuinely
      // makes him lose you.
      const sightRange = MONSTER.sightRange * 1.4;
      const canSee = target && dist < sightRange;

      if (canSee) {
        rotateToward(target.x, target.z, dt, 10.0);

        if (dist < MONSTER.killRange) {
          damagePlayer(target, PLAYER_MAX_HP);
          monster.attackCooldown = ATTACK_COOLDOWN;
        } else {
          moveToward(target.x, target.z, bhSpeed, dt);
          emitRakeStep(bhSpeed, dt);
        }

        // Remember the last position he saw the player at, so when he
        // loses line of sight he charges that direction.
        monster.wanderTarget.x = target.x;
        monster.wanderTarget.z = target.z;
        monster.outOfRangeTimer = 0;
      } else {
        // Blind. Sprint toward the last known position at high speed,
        // then sweep the area nearby looking for the player.
        monster.outOfRangeTimer += dt;

        const arrived = moveToward(monster.wanderTarget.x, monster.wanderTarget.z, wanderSpeed, dt);
        emitRakeStep(wanderSpeed, dt);

        if (arrived || monster.outOfRangeTimer > 3.0) {
          // Pick a nearby point to sweep. Biased so he keeps hunting
          // around the last known location, not full-map random.
          const a = Math.random() * Math.PI * 2;
          const d = 8 + Math.random() * 16;
          monster.wanderTarget.x = Math.max(-MAP_HALF + 4, Math.min(MAP_HALF - 4, monster.wanderTarget.x + Math.cos(a) * d));
          monster.wanderTarget.z = Math.max(-MAP_HALF + 4, Math.min(MAP_HALF - 4, monster.wanderTarget.z + Math.sin(a) * d));
          monster.outOfRangeTimer = 0;
        }
      }
      break;
    }

    default: {
      setMonsterState('IDLE');
      break;
    }
  }
}

/* ---------------- Day / night cycle ---------------- */

function updatePhase(dt) {
  game.phase.gameTime += dt;
  game.phase.phaseTime += dt;

  if (game.phase.isDay) {
    if (game.phase.phaseTime >= DAY_DURATION) {
      game.phase.isDay = false;
      game.phase.phaseTime = 0;
      game.phase.nightNumber++;
      io.emit('phase-changed', {
        isDay: false,
        nightNumber: game.phase.nightNumber
      });
      spawnRake();
    }
  } else {
    if (game.phase.phaseTime >= NIGHT_DURATION) {
      game.phase.isDay = true;
      game.phase.phaseTime = 0;
      game.points += POINTS_PER_NIGHT;
      io.emit('phase-changed', {
        isDay: true,
        nightNumber: game.phase.nightNumber
      });
      if (monster.active && monster.state !== 'DESPAWNED') {
        game.rakeDefeated = true;
        monster.enraged = false;
        monster.bloodHourActive = false;
        setMonsterState('RETREAT_SCREAM');
      }
      emitShop();
    }
  }
}

/* ---------------- Main tick ---------------- */

function buildStatePayload() {
  return {
    phase: {
      isDay: game.phase.isDay,
      phaseTime: game.phase.phaseTime,
      nightNumber: game.phase.nightNumber,
      gameTime: game.phase.gameTime
    },
    monster: {
      x: monster.x,
      y: monster.y,
      z: monster.z,
      ry: monster.ry,
      visible: monster.visible,
      active: monster.active,
      state: monster.state,
      hp: monster.hp,
      shield: monster.shield,
      shieldMax: monster.shieldMax,
      shieldHitCounter: monster.shieldHitCounter,
      bloodHourTransformT: monster.bloodHourTransformT,
      bloodHourT: monster.bloodHourT,
      enraged: monster.enraged,
      enragedTransformDone: monster.enragedTransformDone
    },
    points: game.points,
    gunUnlocked: game.gunUnlocked,
    spotlightOwned: game.spotlightOwned
  };
}

function tick(dt) {
  updatePhase(dt);
  updateMonster(dt);
  io.emit('state', buildStatePayload());
}

let lastTickTime = Date.now();

setInterval(() => {
  const now = Date.now();
  let dt = (now - lastTickTime) / 1000;
  lastTickTime = now;
  if (dt < 0) dt = 0;
  if (dt > 0.25) dt = 0.25;
  tick(dt);
}, Math.round(1000 / TICK_RATE));

setInterval(() => {
  io.emit('players', buildPlayersPayload());
}, 2000);

/* ---------------- Socket handling ---------------- */

io.on('connection', (socket) => {
  const spawn = pickSpawnPoint();

  const p = {
    id: socket.id,
    name: 'Survivor',
    color: '#ffffff',
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    ry: 0,
    rx: 0,
    hp: PLAYER_MAX_HP,
    dead: false,
    equipped: 'none'
  };
  players[socket.id] = p;

  socket.emit('players', buildPlayersPayload());
  socket.emit('shop-updated', {
    points: game.points,
    gunUnlocked: game.gunUnlocked,
    spotlightOwned: game.spotlightOwned
  });

  socket.broadcast.emit('player-joined', {
    id: p.id,
    x: p.x,
    y: p.y,
    z: p.z,
    ry: p.ry,
    hp: p.hp,
    dead: p.dead,
    name: p.name,
    color: p.color,
    equipped: p.equipped
  });

  /* ---- identity ---- */
  socket.on('identity', (data) => {
    const me = players[socket.id];
    if (!me || !data) return;
    if (typeof data.name === 'string') me.name = data.name.slice(0, 32);
    if (typeof data.color === 'string') me.color = data.color.slice(0, 32);
    io.emit('player-identity', {
      id: me.id,
      name: me.name,
      color: me.color
    });
  });

  /* ---- move ---- */
  socket.on('move', (data) => {
    const me = players[socket.id];
    if (!me || !data) return;

    if (typeof data.x === 'number' && isFinite(data.x)) me.x = data.x;
    if (typeof data.y === 'number' && isFinite(data.y)) me.y = data.y;
    if (typeof data.z === 'number' && isFinite(data.z)) me.z = data.z;
    if (typeof data.ry === 'number' && isFinite(data.ry)) me.ry = data.ry;
    if (typeof data.rx === 'number' && isFinite(data.rx)) me.rx = data.rx;
    if (typeof data.equipped === 'string') me.equipped = data.equipped;

    socket.broadcast.emit('player-moved', {
      id: me.id,
      x: me.x,
      y: me.y,
      z: me.z,
      ry: me.ry,
      hp: me.hp,
      equipped: me.equipped
    });
  });

  /* ---- fired ---- */
  socket.on('fired', () => {
    const me = players[socket.id];
    if (!me || me.dead) return;
    if (!game.gunUnlocked) return;

    io.emit('gun-fired', { id: me.id });

    if (!monster.active || !monster.visible) return;
    if (game.rakeDefeated) return;

    // Full 3D forward from camera pitch (rx) + yaw (ry).
    // three.js camera default looks down -Z; euler XYZ applies yaw then pitch.
    const rx = typeof me.rx === 'number' ? me.rx : 0;
    const ry = me.ry;
    const crx = Math.cos(rx);
    const fx = -Math.sin(ry) * crx;
    const fy = Math.sin(rx);
    const fz = -Math.cos(ry) * crx;

    // Aim at rake's chest, ~1.5 units above feet
    const toX = monster.x - me.x;
    const toY = (monster.y + 1.5) - me.y;
    const toZ = monster.z - me.z;

    // Distance along the ray where the rake's center is projected
    const t = fx * toX + fy * toY + fz * toZ;
    if (t < 0) return;                    // rake is behind the player
    if (t > GUN_RANGE) return;            // beyond range

    // Perpendicular distance from the ray to the rake's chest
    const perpX = fx * t - toX;
    const perpY = fy * t - toY;
    const perpZ = fz * t - toZ;
    const perpDist = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);

    // Treat the rake's body as a ~1.0 radius capsule
    if (perpDist > 1.0) return;

    damageMonster(GUN_DAMAGE);
  });

  /* ---- respawn ---- */
  socket.on('respawn', () => {
    const me = players[socket.id];
    if (!me) return;

    const sp = pickSpawnPoint();
    me.x = sp.x;
    me.y = sp.y;
    me.z = sp.z;
    me.ry = 0;
    me.hp = PLAYER_MAX_HP;
    me.dead = false;

    io.emit('player-respawned', {
      id: me.id,
      x: me.x,
      y: me.y,
      z: me.z
    });

    io.emit('players', buildPlayersPayload());
  });

  /* ---- shop ---- */
  socket.on('buy-gun', () => {
    const me = players[socket.id];
    if (!me) return;
    if (game.gunUnlocked) return;
    if (game.points < SHOP_GUN_COST) return;
    game.points -= SHOP_GUN_COST;
    game.gunUnlocked = true;
    emitShop();
  });

  socket.on('buy-spotlight', () => {
    const me = players[socket.id];
    if (!me) return;
    if (game.spotlightOwned) return;
    if (game.points < SHOP_SPOTLIGHT_COST) return;
    game.points -= SHOP_SPOTLIGHT_COST;
    game.spotlightOwned = true;
    emitShop();
  });

  /* ---- debug ---- */
  socket.on('verify-debug', (data) => {
    const pw = data && typeof data.password === 'string' ? data.password : '';
    if (pw === DEBUG_PASSWORD) {
      verifiedSockets.add(socket.id);
      socket.emit('debug-verified');
    } else {
      socket.emit('debug-denied');
    }
  });

  socket.on('debug-action', (data) => {
    if (!verifiedSockets.has(socket.id)) {
      console.log(`[debug] ${socket.id.slice(0,6)} rejected — not verified`);
      return;
    }
    if (!data || typeof data.action !== 'string') return;
    console.log(`[debug] ${socket.id.slice(0,6)} → ${data.action}`);

    switch (data.action) {
      case 'skip-phase': {
        if (game.phase.isDay) game.phase.phaseTime = DAY_DURATION;
        else game.phase.phaseTime = NIGHT_DURATION;
        break;
      }

      case 'trigger-blood-hour': {
        if (!monster.active) {
          monster.active = true;
          monster.visible = true;
        }
        startBloodHour();
        break;
      }

      case 'arm-blood-hour': {
        monster.bloodHourArmed = true;
        break;
      }

      case 'heal-all': {
        for (const id in players) {
          const pl = players[id];
          pl.hp = PLAYER_MAX_HP;
          pl.dead = false;
        }
        io.emit('players', buildPlayersPayload());
        break;
      }

      case 'damage-monster': {
        const amount = typeof data.amount === 'number' && isFinite(data.amount)
          ? data.amount
          : GUN_DAMAGE;
        damageMonster(amount);
        break;
      }

      default:
        break;
    }
  });

  /* ---- disconnect ---- */
  socket.on('disconnect', () => {
    verifiedSockets.delete(socket.id);
    delete players[socket.id];
    io.emit('player-left', { id: socket.id });
    io.emit('players', buildPlayersPayload());
  });
});

/* ---------------- Boot ---------------- */

server.listen(PORT, () => {
  console.log('Horror server listening on port ' + PORT);
  console.log('Tick rate: ' + TICK_RATE + ' Hz');
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
