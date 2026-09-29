// src/config.js — constants + shared runtime state.

// ---- Modes ----
var LOW_DETAIL = false;
try { LOW_DETAIL = localStorage.getItem('low_detail') === 'true'; } catch (e) {}
var REALISTIC_SHADOWS = false;
try { REALISTIC_SHADOWS = localStorage.getItem('realistic_shadows') === 'true'; } catch (e) {}

// ---- Timing ----
const DAY_DURATION = 150;
const NIGHT_DURATION = 480;
const START_WITH_DAY = true;
const PHASE_WARN_TIME = 20;

// ---- Assets ----
const MONSTER_PATH = 'models/the_rake.glb';
const CAVE_PATH = 'models/cave.glb';
const PINE_PATH = 'models/pine_tree.glb';
const BUSH_PATH = 'models/bush.glb';
const FLASHLIGHT_PATH = 'models/flashlight.glb';
const PISTOL_PATH = 'models/pistol.glb';

const DAY_SOUND_PATH = 'sounds/Horizon.mp3';
const SCREECH_SOUND_PATH = 'sounds/RakeSpottedScreech.mp3';
const SNIFF_SOUND_PATH = 'sounds/RakeSniff.mp3';
const GUNSHOT_SOUND_PATH = 'sounds/GunShot.mp3';
const ENRAGED_SOUND_PATH = 'sounds/Enraged.mp3';
const FOOTSTEP_SOUND_PATH = 'sounds/Footstep.mp3';
const RETREAT_SOUND_PATHS = ['sounds/RakeRetreat1.mp3','sounds/RakeRetreat2.mp3','sounds/RakeRetreat3.mp3'];
const RAKE_HURT_PATHS = ['sounds/RakeHurt1.mp3','sounds/RakeHurt2.mp3','sounds/RakeHurt3.mp3'];
const BLOOD_RAGE_PATH = 'sounds/BloodRage.mp3';
const BLOOD_AMBIENCE_PATH = 'sounds/BloodAmbience.mp3';
const BLOOD_RUN_SCREAM_PATH = 'sounds/BloodRunScream.mp3';
const RAKE_BLOOD_TRANSFORM_END_PATH = 'sounds/RakeBloodTransformationEnd.mp3';

// ---- Lighting ----
const DAY_AMBIENT_INTENSITY = 0.42;
const NIGHT_AMBIENT_INTENSITY = 0.06;
const DAY_HEMI_INTENSITY = 0.55;
const NIGHT_HEMI_INTENSITY = 0.02;
const DAY_SUN_INTENSITY = 0.85;
const DAY_FOG_DENSITY = 0.015;
const NIGHT_FOG_DENSITY = 0.06;
const DAY_FOG_COLOR = new THREE.Color(0x9eb2c7);
const NIGHT_FOG_COLOR = new THREE.Color(0x000511);
const SPOTLIGHT_AMBIENT_BOOST = 0.14;

// ---- Player ----
const PLAYER_MAX_HP = 100;
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.4;
const MOVE_SPEED = 4.5;
const MAP_HALF = 80;
const PLAYER_SPAWN = { x: 0, y: 1.7, z: 30 };

var SPRINT_MULT = 2.10;
var STAMINA_MAX = 150;
var STAMINA_DRAIN = 22;
const STAMINA_REGEN = 18;
const STAMINA_RECOVER = 12;

const BOB_RATE_WALK = 8.5;
const BOB_RATE_SPRINT = 13.5;
const BOB_AMOUNT_VERT = 0.040;
const BOB_AMOUNT_LAT = 0.028;
const BOB_MODEL_MULT_VERT = 1.4;
const BOB_MODEL_MULT_LAT = 1.2;
const BOB_BEAM_MULT = 0.9;

// ---- Viewmodels ----
const FLASHLIGHT_TARGET_SIZE = 0.45;
const FLASHLIGHT_BASE_POS = { x: 0.32, y: -0.26, z: -0.55 };
const FLASHLIGHT_BASE_ROT = { x: 0, y: -4.4, z: 0 };
const PISTOL_TARGET_SIZE = 0.35;
const PISTOL_BASE_POS = { x: 0.28, y: -0.24, z: -0.55 };
const PISTOL_BASE_ROT = { x: 0, y: 4.6508, z: 0 };

const GUN_COOLDOWN = 0.5;
const GUN_RECOIL_TIME = 0.15;
const RECOIL_KICK_PITCH = 0.075;
const RECOIL_KICK_YAW = 0.030;
const RECOIL_DAMPING = 9.0;

// ---- Monster ----
const RAKE_SPAWN_WORLD = { x: 0, y: 0, z: -33 };
const RAKE_GROUND_Y = 0;
const GRAVITY = 20;
var MONSTER_SCALE = 1.0;
var MONSTER_Y_OFFSET = 0.0;

// ---- Blood Hour ----
const BLOOD_HOUR_FREEZE_TIME = 0.418;
const BLOOD_HOUR_TRANSFORM_TIME = 30.0;
const BLOOD_HOUR_WARN_AT = 28.0;
const BLOOD_HOUR_FADE_IN_TIME = 3.0;
const BLOOD_HOUR_FADE_OUT_TIME = 4.0;

// ---- Enrage (client mirror of server timings) ----
const RAKE_ENRAGE_TRANSFORM_TIME = 5.0;
const RAKE_ENRAGE_END_TIME = 2.0;

// ---- Cave ----
const CAVE_POSITION = { x: 0, y: 3.0, z: -39 };
const CAVE_SCALE = 6.5;
const CAVE_ROTATION_Y = Math.PI;
const ENTRANCE_OFFSET = { x: 0, y: 1.0, z: 6 };
const ENTRANCE_WP = { x: CAVE_POSITION.x, y: 0, z: CAVE_POSITION.z + 10 };
const INSIDE_WP = { x: CAVE_POSITION.x, y: 0, z: CAVE_POSITION.z };

// ---- Trees / bushes ----
const PINE_TARGET_HEIGHT = 8.0;
const PINE_HEIGHT_VARIANCE = 0.3;
const PINE_Y_OFFSET = 0;
const TREE_COUNT = 220;
const SPAWN_CLEAR_RADIUS = 8.5;
const MIN_TREE_DIST = 10;
const TREE_PLACEMENT_TRIES = 40;
var TREE_VIEW_DIST = 42;
var TREE_SHADOW_DIST = 24;
const PIXEL_RATIO_CAP = 1.5;
const CHUNK_GRID = 5;
const CULL_INTERVAL = 4;
const TREE_COLLIDER_MULT_NORMAL = 0.20;
const TREE_COLLIDER_MULT_LOWDET = 0.10;
const TREE_COLLIDER_MULT = LOW_DETAIL ? TREE_COLLIDER_MULT_LOWDET : TREE_COLLIDER_MULT_NORMAL;
try {
  const saved = parseFloat(localStorage.getItem('render_dist'));
  if (!isNaN(saved) && saved >= 15 && saved <= 90) TREE_VIEW_DIST = saved;
} catch (e) {}
const BUSH_TARGET_HEIGHT = 1.2;
const BUSH_HEIGHT_VARIANCE = 0.35;
const BUSH_COUNT = 40;
const MIN_BUSH_DIST = 3.5;
const BUSH_PLACEMENT_TRIES = 20;

// ---- Audio pools ----
const PLAYER_STEP_VOL_WALK = 0.32;
const PLAYER_STEP_VOL_SPRINT = 0.55;
const PLAYER_STEP_PHASE_RATE = 1.4;
const PLAYER_STEP_POOL_SIZE = 3;
const RAKE_STEP_VOL_BASE = 0.45;
const RAKE_STEP_REF_DIST = 15;
const RAKE_STEP_MAX_DIST = 45;
const RAKE_STEP_ROLLOFF = 0.8;
const RAKE_STEP_POOL_SIZE = 4;

// ---- Shop ----
const SHOP_GUN_COST = 100;
const SHOP_SPOTLIGHT_COST = 10;
const SHOP_POSITION = { x: -3, y: 1.5, z: 25 };
const SHOP_RANGE = 4.0;

// ---- Shadow quality ----
var FLASHLIGHT_SHADOW_FAR = 22;
var FLASHLIGHT_SHADOW_RES = 512;

// ---- Animation speeds ----
var ANIM_SPEED = 1.0;
var CLIP_SPEEDS = {
  'Idle':          1.0,
  'Walk':          1.5,
  'Run':           1.7,
  'Scream':        1.0,
  'RetreatScream': 1.0,
  'Hurt1':         1.0,
  'Attack1':       1.2,
};
var USE_PINGPONG = false;

// ---- Clip / state enums ----
const CLIP = {
  idle: 'Idle', walk: 'Walk', run: 'Run',
  screech: 'Scream', retreat: 'RetreatScream',
  hurt: 'Hurt1', attack: 'Attack1',
};
const STATE = {
  IDLE: 'IDLE', WANDER: 'WANDER', STALK: 'STALK', SCREECH: 'SCREECH',
  HUNT: 'HUNT', ATTACK: 'ATTACK', HURT: 'HURT',
  ENRAGED_TRANSFORM: 'ENRAGED_TRANSFORM', ENRAGED: 'ENRAGED', ENRAGED_END: 'ENRAGED_END',
  RETREAT_SCREAM: 'RETREAT_SCREAM', RETREAT_RUN: 'RETREAT_RUN', RETREAT_ENTER: 'RETREAT_ENTER',
  DESPAWNED: 'DESPAWNED', DEAD: 'PLAYER_DEAD',
  BLOOD_TRANSFORM: 'BLOOD_TRANSFORM', BLOOD_HOUR: 'BLOOD_HOUR',
};

// ---- Shared runtime state ----
var socket = null;
var mySocketId = null;
var gameState = null;

var myName = 'Player';
var myColor = '#4488ff';
var BUSHES_ENABLED = true;
try {
  myName = localStorage.getItem('player_name') || 'Player';
  myColor = localStorage.getItem('player_color') || '#4488ff';
  BUSHES_ENABLED = localStorage.getItem('bushes_enabled') !== 'false';
} catch (e) {}

var gunUnlocked = false;
var spotlightOwned = false;
var equippedSlot = 1;
var serverPoints = 0;

var playerHP = PLAYER_MAX_HP;
var playerDead = false;
var hitFlashTimer = 0;
var gunCooldown = 0;
var gunRecoilTimer = 0;
var muzzleFlashTimer = 0;
var hitMarkerTimer = 0;
var playerStamina = 150;
var sprinting = false;
var staminaLocked = false;
var playerStepPhase = 0;
var playerLastX = 0;
var playerLastZ = 0;
var bobTime = 0, bobIntensity = 0, appliedBobX = 0, appliedBobZ = 0;
var recoilPitch = 0, recoilYaw = 0;
var lastAppliedRecoilPitch = 0, lastAppliedRecoilYaw = 0;

var monsterRestY = 0;
var monsterTargetX = RAKE_SPAWN_WORLD.x;
var monsterTargetZ = RAKE_SPAWN_WORLD.z;
var monsterTargetRY = 0;
var lastMonsterState = null;

var gameTime = 0;
var isDay = true;
var nightNumber = 0;
var serverPhaseTime = 0;
var dayNightFactor = 1.0;

var bloodHourTransform = false;
var bloodHourActive = false;
var bloodHourBlend = 0;
var bloodHourTextShown = false;

var rakeDefeated = false;
var defeatBannerTimer = 0;
var debugMode = false;
var debugBrightness = 1.0;
var shopOpen = false;

// ---- Helpers ----
const _fogColor = new THREE.Color();
function formatTime(s) { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; }
function randRange([min, max]) { return min + Math.random() * (max - min); }
function distance2D(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); }
