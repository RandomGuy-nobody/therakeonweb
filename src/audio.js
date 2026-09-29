// src/audio.js — every sound, the audio listener, and the loader.
// Loads after net.js. Creates the listener as a standalone object;
// world.js / index.html attaches it to the camera via camera.add(audioListener).

// ============================================================
// LISTENER + SOUND OBJECTS
// ============================================================
var audioListener = new THREE.AudioListener();

// Non-positional (play "in your head")
var daySound = new THREE.Audio(audioListener);
daySound.setLoop(true);
daySound.setVolume(0.5);

var gunshotSound = new THREE.Audio(audioListener);
gunshotSound.setVolume(0.7);

var bloodRageSound = new THREE.Audio(audioListener);
bloodRageSound.setVolume(1.0);

var bloodAmbienceSound = new THREE.Audio(audioListener);
bloodAmbienceSound.setLoop(true);
bloodAmbienceSound.setVolume(0.75);

// Positional (from the rake's mouth / feet)
var screechSound = new THREE.PositionalAudio(audioListener);
screechSound.setRefDistance(5); screechSound.setMaxDistance(60);
screechSound.setRolloffFactor(1.0); screechSound.setVolume(1.0);

var sniffSound = new THREE.PositionalAudio(audioListener);
sniffSound.setRefDistance(2); sniffSound.setMaxDistance(45);
sniffSound.setRolloffFactor(2.0); sniffSound.setVolume(2.0);

var enragedSound = new THREE.PositionalAudio(audioListener);
enragedSound.setRefDistance(5); enragedSound.setMaxDistance(90);
enragedSound.setRolloffFactor(0.8); enragedSound.setVolume(1.5);

var bloodRunScreamSound = new THREE.PositionalAudio(audioListener);
bloodRunScreamSound.setRefDistance(5); bloodRunScreamSound.setMaxDistance(70);
bloodRunScreamSound.setRolloffFactor(0.8); bloodRunScreamSound.setVolume(1.6);
bloodRunScreamSound.setLoop(true);

var rakeBloodTransformEndSound = new THREE.PositionalAudio(audioListener);
rakeBloodTransformEndSound.setRefDistance(5); rakeBloodTransformEndSound.setMaxDistance(60);
rakeBloodTransformEndSound.setRolloffFactor(1.0); rakeBloodTransformEndSound.setVolume(1.4);

// Pools of one-shots
var retreatSounds = RETREAT_SOUND_PATHS.map(() => {
  const s = new THREE.PositionalAudio(audioListener);
  s.setRefDistance(5); s.setMaxDistance(60);
  s.setRolloffFactor(1.0); s.setVolume(1.2);
  return s;
});
var hurtSounds = RAKE_HURT_PATHS.map(() => {
  const s = new THREE.PositionalAudio(audioListener);
  s.setRefDistance(5); s.setMaxDistance(60);
  s.setRolloffFactor(1.0); s.setVolume(1.4);
  return s;
});

var playerFootstepPool = [];
for (let i = 0; i < PLAYER_STEP_POOL_SIZE; i++) {
  const a = new THREE.Audio(audioListener);
  a.setVolume(PLAYER_STEP_VOL_WALK);
  playerFootstepPool.push(a);
}
var rakeFootstepPool = [];
for (let i = 0; i < RAKE_STEP_POOL_SIZE; i++) {
  const a = new THREE.PositionalAudio(audioListener);
  a.setRefDistance(RAKE_STEP_REF_DIST);
  a.setMaxDistance(RAKE_STEP_MAX_DIST);
  a.setRolloffFactor(RAKE_STEP_ROLLOFF);
  a.setVolume(RAKE_STEP_VOL_BASE);
  rakeFootstepPool.push(a);
}

var playerFootstepIdxRef = { value: 0 };
var rakeFootstepIdxRef = { value: 0 };

// ============================================================
// LOADERS
// ============================================================
var audioLoader = new THREE.AudioLoader();

audioLoader.load(DAY_SOUND_PATH,    (b) => { daySound.setBuffer(b); console.log('🔊 day'); }, undefined, () => {});
audioLoader.load(SCREECH_SOUND_PATH,(b) => { screechSound.setBuffer(b); console.log('🔊 screech'); }, undefined, () => {});
audioLoader.load(SNIFF_SOUND_PATH,  (b) => { sniffSound.setBuffer(b); console.log('🔊 sniff'); }, undefined, () => {});
audioLoader.load(GUNSHOT_SOUND_PATH,(b) => { gunshotSound.setBuffer(b); console.log('🔊 gunshot'); }, undefined, () => {});
audioLoader.load(ENRAGED_SOUND_PATH,(b) => { enragedSound.setBuffer(b); console.log('🔊 enraged'); }, undefined, () => {});

audioLoader.load(FOOTSTEP_SOUND_PATH, (b) => {
  for (const a of playerFootstepPool) a.setBuffer(b);
  for (const a of rakeFootstepPool)   a.setBuffer(b);
  console.log('🔊 footsteps');
}, undefined, () => {});

RETREAT_SOUND_PATHS.forEach((p, i) => audioLoader.load(p, (b) => { retreatSounds[i].setBuffer(b); }, undefined, () => {}));
RAKE_HURT_PATHS.forEach((p, i) => audioLoader.load(p, (b) => { hurtSounds[i].setBuffer(b); }, undefined, () => {}));

audioLoader.load(BLOOD_RAGE_PATH, (b) => { bloodRageSound.setBuffer(b); }, undefined, () => {});
audioLoader.load(BLOOD_AMBIENCE_PATH, (b) => { bloodAmbienceSound.setBuffer(b); }, undefined, () => {});
audioLoader.load(BLOOD_RUN_SCREAM_PATH, (b) => { bloodRunScreamSound.setBuffer(b); }, undefined, () => {});
audioLoader.load(RAKE_BLOOD_TRANSFORM_END_PATH, (b) => { rakeBloodTransformEndSound.setBuffer(b); }, undefined, () => {});

// ============================================================
// HELPERS
// ============================================================
function playSoundSafe(audio) {
  if (!audio || !audio.buffer) return;
  if (audioListener.context.state !== 'running') return;
  if (audio.isPlaying) audio.stop();
  audio.play();
}
function playRandomRetreatSound() {
  const ready = retreatSounds.filter(s => s.buffer);
  if (ready.length === 0) return;
  for (const s of retreatSounds) if (s.isPlaying) s.stop();
  playSoundSafe(ready[Math.floor(Math.random() * ready.length)]);
}
function playRandomHurtSound() {
  const ready = hurtSounds.filter(s => s.buffer);
  if (ready.length === 0) return;
  for (const s of hurtSounds) if (s.isPlaying) s.stop();
  playSoundSafe(ready[Math.floor(Math.random() * ready.length)]);
}
function startDaySoundtrack() {
  if (!daySound.buffer) return;
  if (audioListener.context.state !== 'running') return;
  if (daySound.isPlaying) return;
  daySound.play();
}
function stopDaySoundtrack() {
  if (daySound.isPlaying) daySound.stop();
}

function playFootstepFromPool(pool, idxRef, opts) {
  const ready = pool.filter(a => a.buffer);
  if (ready.length === 0) return;
  let tries = 0;
  let a = pool[idxRef.value % pool.length];
  while ((!a.buffer || a.isPlaying) && tries < pool.length) {
    idxRef.value++;
    a = pool[idxRef.value % pool.length];
    tries++;
  }
  if (!a.buffer) return;
  if (a.isPlaying) a.stop();
  a.setVolume(opts.volume);
  a.setPlaybackRate(opts.rate);
  a.play();
  idxRef.value++;
}

function playPlayerFootstep() {
  const isSprint = sprinting;
  const volume = isSprint ? PLAYER_STEP_VOL_SPRINT : PLAYER_STEP_VOL_WALK;
  const baseRate = isSprint ? 1.08 : 0.98;
  const rate = baseRate + (Math.random() * 0.06 - 0.03);
  playFootstepFromPool(playerFootstepPool, playerFootstepIdxRef, { volume, rate });
}

function playRakeFootstep(speed) {
  const rate = 0.7 + (speed / 12) + (Math.random() * 0.04 - 0.02);
  let volMult = 1.0;
  if (typeof gameState !== 'undefined' && gameState) {
    const st = gameState.monster.state;
    if (st === 'STALK')          volMult = RAKE_STEP_VOL_STALK;
    else if (st === 'ENRAGED')   volMult = RAKE_STEP_VOL_ENRAGED;
    else if (st === 'BLOOD_HOUR' || st === 'BLOOD_TRANSFORM') volMult = 1.5;
  }
  playFootstepFromPool(rakeFootstepPool, rakeFootstepIdxRef, {
    volume: RAKE_STEP_VOL_BASE * volMult,
    rate,
  });
}
