// src/net.js — socket connection, remote players, debug password gate, all network handlers.
// Loads after config.js, before audio/world/monster/player/ui/main.

// ============================================================
// DOM REFS — hoisted here so every other file can use them
// ============================================================
var phaseHud = document.getElementById('phaseHud');
var phaseName = document.getElementById('phaseName');
var phaseTimer = document.getElementById('phaseTimer');
var pointsHud = document.getElementById('pointsHud');
var pointsValue = document.getElementById('pointsValue');
var shopPrompt = document.getElementById('shopPrompt');
var shopOverlay = document.getElementById('shopOverlay');
var shopPointsEl = document.getElementById('shopPoints');
var shopGunItem = document.getElementById('shopGunItem');
var shopSpotlightItem = document.getElementById('shopSpotlightItem');
var shopGunCost = document.getElementById('shopGunCost');
var shopSpotlightCost = document.getElementById('shopSpotlightCost');
var shopCloseBtn = document.getElementById('shopClose');
var hud = document.getElementById('hud');
var hudHP = document.getElementById('hudHP');
var hudSurvival = document.getElementById('hudSurvival');
var hudState = document.getElementById('hudState');
var hudDist = document.getElementById('hudDist');
var hudWatch = document.getElementById('hudWatch');
var hudSniff = document.getElementById('hudSniff');
var vignette = document.getElementById('dangerVignette');
var hitFlash = document.getElementById('hitFlash');
var muzzleFlash = document.getElementById('muzzleFlash');
var hitMarker = document.getElementById('hitMarker');
var defeatBanner = document.getElementById('defeatBanner');
var bloodOverlay = document.getElementById('bloodOverlay');
var runForYourLifeBanner = document.getElementById('runForYourLifeBanner');
var deathOverlay = document.getElementById('deathOverlay');
var deathStats = document.getElementById('deathStats');
var deathPhase = document.getElementById('deathPhase');
var deathPoints = document.getElementById('deathPoints');
var crosshair = document.getElementById('crosshair');
var instructions = document.getElementById('instructions');
var clickHint = document.getElementById('clickHint');
var mpStatus = document.getElementById('mpStatus');
var loadingEl = document.getElementById('loading');
var rakeShieldWrap = document.getElementById('rakeShieldWrap');
var rakeShieldBar = document.getElementById('rakeShieldBar');
var rakeShieldLabel = document.getElementById('rakeShieldLabel');
var rakeHpWrap = document.getElementById('rakeHpWrap');
var rakeHpBar = document.getElementById('rakeHpBar');
var rakeHpLabel = document.getElementById('rakeHpLabel');
var hpWrap = document.getElementById('hpWrap');
var hpBar = document.getElementById('hpBar');
var hpLabel = document.getElementById('hpLabel');
var staminaWrap = document.getElementById('staminaWrap');
var staminaBar = document.getElementById('staminaBar');
var staminaLabel = document.getElementById('staminaLabel');
var toolbarEl = document.getElementById('toolbar');
var slot1 = document.getElementById('slot1');
var slot2 = document.getElementById('slot2');
var debugBadge = document.getElementById('debugBadge');
var debugAnimSpeed = document.getElementById('debugAnimSpeed');
var debugPingPong = document.getElementById('debugPingPong');
var debugMonScale = document.getElementById('debugMonScale');
var debugMonY = document.getElementById('debugMonY');
var debugShadowFar = document.getElementById('debugShadowFar');
var debugShadowRes = document.getElementById('debugShadowRes');
var debugBloodForce = document.getElementById('debugBloodForce');
var debugFlash = document.getElementById('debugFlash');
var debugBright = document.getElementById('debugBright');
var debugStamMax = document.getElementById('debugStamMax');
var debugSprintMult = document.getElementById('debugSprintMult');
var debugStamDrain = document.getElementById('debugStamDrain');

// ============================================================
// SOCKET INIT
// ============================================================
function sendIdentity() {
  if (!socket || !socket.connected) return;
  socket.emit('identity', { name: myName, color: myColor });
}

try {
  if (typeof io !== 'undefined') {
    socket = io();
    socket.on('connect', () => {
      mySocketId = socket.id;
      console.log('🌐 Connected:', socket.id);
      if (mpStatus) mpStatus.style.display = 'block';
      sendIdentity();
    });
    socket.on('disconnect', () => {
      console.log('🌐 Disconnected');
      mySocketId = null;
    });
  } else {
    console.warn('⚠️ Socket.IO not loaded');
  }
} catch (e) {
  console.warn('⚠️ Multiplayer init failed:', e);
  socket = null;
}

// ============================================================
// DEBUG PASSWORD GATE
// ============================================================
var debugPasswordOpen = false;
var pendingDebugAction = null;
var debugUnlockedThisSession = false;
var debugPasswordTimeout = null;

function showDebugPasswordModal() {
  const modal = document.getElementById('debugPasswordModal');
  const input = document.getElementById('debugPasswordInput');
  const err = document.getElementById('debugPasswordError');
  if (!modal) return;
  debugPasswordOpen = true;
  err.textContent = '';
  input.value = '';
  modal.style.display = 'flex';
  setTimeout(() => input.focus(), 30);
}
function hideDebugPasswordModal() {
  const modal = document.getElementById('debugPasswordModal');
  if (!modal) return;
  debugPasswordOpen = false;
  modal.style.display = 'none';
  pendingDebugAction = null;
  if (debugPasswordTimeout) { clearTimeout(debugPasswordTimeout); debugPasswordTimeout = null; }
}
function submitDebugPassword() {
  const input = document.getElementById('debugPasswordInput');
  const err = document.getElementById('debugPasswordError');
  const pw = input.value;
  if (!pw) { err.style.color = '#f55'; err.textContent = t('enterPw'); return; }
  const doLocalCheck = () => {
    if (pw === 'auras67') {
      debugUnlockedThisSession = true;
      err.style.color = '#8fd88f';
      err.textContent = t('verified');
      const fn = pendingDebugAction;
      setTimeout(() => { hideDebugPasswordModal(); if (fn) fn(); }, 200);
    } else {
      err.style.color = '#f55';
      err.textContent = t('wrongPw');
    }
  };
  if (socket && socket.connected) {
    err.style.color = '#8b93a3';
    err.textContent = t('checking');
    if (debugPasswordTimeout) clearTimeout(debugPasswordTimeout);
    debugPasswordTimeout = setTimeout(doLocalCheck, 2000);
    socket.emit('verify-debug', { password: pw });
  } else {
    doLocalCheck();
  }
}
function requestDebugAccess(actionFn) {
  if (debugUnlockedThisSession) { actionFn(); return; }
  pendingDebugAction = actionFn;
  showDebugPasswordModal();
}
function sendDebugAction(action, extra) {
  if (!socket || !socket.connected) return;
  socket.emit('debug-action', Object.assign({ action }, extra || {}));
}

// ============================================================
// REMOTE PLAYERS
// ============================================================
var remotePlayers = {};

function makeNameCanvas(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d');
  const draw = (tx) => {
    ctx.clearRect(0, 0, 512, 96);
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(tx).width + 40;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect((512 - w) / 2, 12, w, 72);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeText(tx, 256, 48);
    ctx.fillText(tx, 256, 48);
  };
  draw(text);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  return { canvas, ctx, tex, draw };
}
function makeHPCanvas(hp) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 24;
  const ctx = canvas.getContext('2d');
  const draw = (h) => {
    ctx.clearRect(0, 0, 256, 24);
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, 256, 24);
    ctx.fillStyle = '#333'; ctx.fillRect(3, 3, 250, 18);
    const pct = Math.max(0, Math.min(1, h / 100));
    ctx.fillStyle = pct > 0.6 ? '#4a4' : (pct > 0.3 ? '#cb4' : '#c44');
    ctx.fillRect(3, 3, 250 * pct, 18);
  };
  draw(hp);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  return { canvas, ctx, tex, draw };
}
function makeRemotePlayer(id) {
  if (remotePlayers[id] || id === mySocketId) return;
  if (typeof scene === 'undefined' || !scene) return;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4488ff, emissive: 0x112244, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.4, 8), bodyMat);
  body.position.y = 0.7; body.castShadow = true; group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xffddbb, emissive: 0x221111, roughness: 1.0 }));
  head.position.y = 1.65; head.castShadow = true; group.add(head);
  const flash = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.30),
    new THREE.MeshStandardMaterial({ color: 0x555555, emissive: 0x222222, roughness: 0.6 }));
  flash.position.set(-0.42, 1.15, 0.18); flash.rotation.set(0, 0, -0.15); flash.castShadow = true; group.add(flash);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.32),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 }));
  gun.position.set(-0.42, 1.15, 0.18); gun.rotation.set(0, 0, -0.15); gun.castShadow = true; gun.visible = false; group.add(gun);
  const nameCanvas = makeNameCanvas('Player');
  const nameMat = new THREE.SpriteMaterial({ map: nameCanvas.tex, transparent: true, depthTest: false });
  const nameSprite = new THREE.Sprite(nameMat);
  nameSprite.scale.set(2.0, 0.375, 1); nameSprite.position.y = 2.35; group.add(nameSprite);
  const hpCanvas = makeHPCanvas(100);
  const hpMat = new THREE.SpriteMaterial({ map: hpCanvas.tex, transparent: true, depthTest: false });
  const hpSprite = new THREE.Sprite(hpMat);
  hpSprite.scale.set(1.2, 0.11, 1); hpSprite.position.y = 2.05; group.add(hpSprite);
  group.position.set(0, 0, 0); group.visible = false; scene.add(group);
  remotePlayers[id] = {
    group, body, bodyMat, head, gun, flash, nameSprite, nameCanvas, hpSprite, hpCanvas,
    target: new THREE.Vector3(0, 0, 0), targetRY: 0, lastPacket: performance.now(),
    name: 'Player', color: '#4488ff', equipped: 1, hp: 100, damageFlash: 0, dead: false,
  };
  console.log('👤 remote joined:', id.slice(0, 6));
  updateMpCount();
}
function applyRemoteIdentity(id, name, color) {
  const rp = remotePlayers[id];
  if (!rp) return;
  if (name && name !== rp.name) { rp.name = name; rp.nameCanvas.draw(name); rp.nameCanvas.tex.needsUpdate = true; }
  if (color && color !== rp.color) {
    rp.color = color;
    rp.bodyMat.color.set(color);
    rp.bodyMat.emissive.set(new THREE.Color(color).multiplyScalar(0.18));
  }
}
function applyRemoteState(id, data) {
  const rp = remotePlayers[id];
  if (!rp) return;
  if (data.hp !== undefined && data.hp !== rp.hp) {
    rp.hp = data.hp;
    rp.hpCanvas.draw(data.hp);
    rp.hpCanvas.tex.needsUpdate = true;
  }
  if (data.equipped !== undefined) {
    rp.equipped = data.equipped;
    rp.flash.visible = (data.equipped === 1);
    rp.gun.visible = (data.equipped === 2);
  }
}
function removeRemotePlayer(id) {
  if (!remotePlayers[id]) return;
  if (typeof scene !== 'undefined' && scene) scene.remove(remotePlayers[id].group);
  delete remotePlayers[id];
  console.log('👋 remote left:', id.slice(0, 6));
  updateMpCount();
}
function updateMpCount() {
  if (mpStatus) mpStatus.textContent = `👥 ${1 + Object.keys(remotePlayers).length}`;
}

// ============================================================
// SOCKET HANDLERS
// ============================================================
if (socket) {
  socket.on('players', (list) => {
    for (const id in list) {
      if (id === mySocketId) continue;
      makeRemotePlayer(id);
      const rp = remotePlayers[id]; if (!rp) continue;
      const p = list[id];
      rp.target.set(p.x, p.y - PLAYER_HEIGHT, p.z);
      rp.targetRY = p.ry || 0; rp.lastPacket = performance.now();
      rp.dead = !!p.dead;
      applyRemoteIdentity(id, p.name, p.color);
      applyRemoteState(id, p);
    }
    updateMpCount();
  });
  socket.on('player-joined', (p) => {
    makeRemotePlayer(p.id);
    const rp = remotePlayers[p.id];
    if (rp) {
      rp.target.set(p.x, p.y - PLAYER_HEIGHT, p.z);
      rp.targetRY = p.ry || 0; rp.lastPacket = performance.now();
      applyRemoteIdentity(p.id, p.name, p.color);
      applyRemoteState(p.id, p);
    }
    updateMpCount();
  });
  socket.on('player-moved', (p) => {
    const rp = remotePlayers[p.id]; if (!rp) return;
    rp.target.set(p.x, p.y - PLAYER_HEIGHT, p.z);
    rp.targetRY = p.ry || 0; rp.lastPacket = performance.now();
    applyRemoteState(p.id, p);
  });
  socket.on('player-identity', (d) => applyRemoteIdentity(d.id, d.name, d.color));
  socket.on('player-damaged', (d) => {
    const rp = remotePlayers[d.id];
    if (rp) rp.damageFlash = 0.35;
    if (d.id === mySocketId) {
      playerHP = d.hp;
      hitFlashTimer = 0.4;
      if (typeof updateHPHUD === 'function') updateHPHUD();
    }
  });
  socket.on('player-died', (d) => {
    const rp = remotePlayers[d.id];
    if (rp) { rp.dead = true; rp.group.visible = false; }
    if (d.id === mySocketId && typeof showDeathOverlay === 'function') showDeathOverlay();
  });
  socket.on('player-respawned', (d) => {
    const rp = remotePlayers[d.id];
    if (rp) { rp.dead = false; rp.group.visible = true; }
    if (d.id === mySocketId) {
      if (typeof camera !== 'undefined' && camera) camera.position.set(d.x, d.y, d.z);
      if (deathOverlay) deathOverlay.style.display = 'none';
      playerDead = false;
      playerHP = PLAYER_MAX_HP;
      if (typeof updateHPHUD === 'function') updateHPHUD();
    }
  });
  socket.on('player-left', (id) => removeRemotePlayer(id));

  socket.on('shop-updated', (d) => {
    if (d.gunUnlocked !== undefined) gunUnlocked = d.gunUnlocked;
    if (d.spotlightOwned !== undefined) spotlightOwned = d.spotlightOwned;
    if (d.points !== undefined) serverPoints = d.points;
    if (spotlightOwned && typeof pocketLight !== 'undefined' && pocketLight) pocketLight.visible = true;
    if (typeof updateShopUI === 'function') updateShopUI();
    if (typeof updateToolbar === 'function') updateToolbar();
    if (typeof updateEquippedView === 'function') updateEquippedView();
    console.log(`🛒 Shop: gun=${gunUnlocked} spot=${spotlightOwned} pts=${serverPoints}`);
  });

  socket.on('state', (s) => {
    gameState = s;
    gameTime = s.phase.gameTime;
    isDay = s.phase.isDay;
    nightNumber = s.phase.nightNumber;
    serverPhaseTime = s.phase.phaseTime;
    serverPoints = s.points;
    gunUnlocked = s.gunUnlocked;
    spotlightOwned = s.spotlightOwned;
    if (spotlightOwned && typeof pocketLight !== 'undefined' && pocketLight) pocketLight.visible = true;

    monsterTargetX = s.monster.x;
    monsterTargetZ = s.monster.z;
    monsterTargetRY = s.monster.ry;

    if (typeof routeMonsterAnimation === 'function') routeMonsterAnimation(s.monster.state);

    bloodHourTransform = s.monster.state === 'BLOOD_TRANSFORM';
    bloodHourActive = s.monster.state === 'BLOOD_HOUR';

    if (s.monster.state === 'BLOOD_TRANSFORM' && !bloodHourTextShown) {
      const elapsed = BLOOD_HOUR_TRANSFORM_TIME - s.monster.bloodHourTransformT;
      if (elapsed >= BLOOD_HOUR_WARN_AT && currentLang !== 'pt') {
        bloodHourTextShown = true;
        if (runForYourLifeBanner) runForYourLifeBanner.classList.add('visible');
        if (typeof actions !== 'undefined' && actions[CLIP.retreat]) {
          const a = actions[CLIP.retreat];
          a.paused = false;
          a.time = 0;
        }
      }
    }

    if (gunUnlocked && s.monster.active && !bloodHourTransform && !bloodHourActive) {
      if (rakeHpWrap) rakeHpWrap.style.display = 'block';
      if (rakeHpLabel) rakeHpLabel.style.display = 'block';
      const pct = s.monster.hp / 400;
      if (rakeHpBar) {
        rakeHpBar.style.width = (pct * 100) + '%';
        rakeHpBar.style.background = pct > 0.5 ? '#c33' : (pct > 0.15 ? '#c63' : '#f55');
      }
      if (s.monster.shield > 0) {
        if (rakeShieldWrap) rakeShieldWrap.style.display = 'block';
        if (rakeShieldLabel) rakeShieldLabel.style.display = 'block';
        const maxRef = Math.max(1, s.monster.shieldMax || 1);
        const pctS = Math.max(0, (s.monster.shield - s.monster.shieldHitCounter / 2) / maxRef);
        if (rakeShieldBar) rakeShieldBar.style.width = (pctS * 100) + '%';
      } else {
        if (rakeShieldWrap) rakeShieldWrap.style.display = 'none';
        if (rakeShieldLabel) rakeShieldLabel.style.display = 'none';
      }
    } else {
      if (rakeHpWrap) rakeHpWrap.style.display = 'none';
      if (rakeHpLabel) rakeHpLabel.style.display = 'none';
      if (rakeShieldWrap) rakeShieldWrap.style.display = 'none';
      if (rakeShieldLabel) rakeShieldLabel.style.display = 'none';
    }
    if (pointsValue) pointsValue.textContent = serverPoints;
    if (typeof updateShopUI === 'function') updateShopUI();
  });

  socket.on('phase-changed', (d) => {
    console.log(`📅 Phase: ${d.isDay ? 'DAY ' + (d.nightNumber + 1) : 'NIGHT ' + d.nightNumber}`);
    if (d.isDay) {
      if (typeof startDaySoundtrack === 'function') startDaySoundtrack();
      rakeDefeated = false;
    } else {
      if (typeof stopDaySoundtrack === 'function') stopDaySoundtrack();
    }
  });

  socket.on('blood-hour-trigger', () => {
    console.log('🩸 Client: blood hour transform');
    if (runForYourLifeBanner) runForYourLifeBanner.classList.remove('visible');
    if (bloodOverlay) {
      bloodOverlay.style.display = 'block';
      void bloodOverlay.offsetWidth;
      bloodOverlay.classList.add('on');
    }
    if (typeof playSoundSafe === 'function' && typeof bloodRageSound !== 'undefined') {
      playSoundSafe(bloodRageSound);
    }
  });

  socket.on('blood-hour-begin', () => {
socket.on('blood-hour-trigger', () => {
  console.log('🩸 BH TRIGGER');
  console.log('  audioContext state:', audioListener.context.state);
  console.log('  bloodRage buffer?', !!bloodRageSound.buffer);
  console.log('  bloodAmbience buffer?', !!bloodAmbienceSound.buffer);
  console.log('  bloodRunScream buffer?', !!bloodRunScreamSound.buffer);
  console.log('  transformEnd buffer?', !!rakeBloodTransformEndSound.buffer);
  // ... rest of the handler
    bloodHourTransform = false;
    bloodHourActive = true;
    if (typeof stopBloodGlitch === 'function') stopBloodGlitch();
    if (phaseHud) phaseHud.style.display = 'none';
    if (runForYourLifeBanner) runForYourLifeBanner.classList.remove('visible');
    if (typeof playSoundSafe === 'function') {
      if (typeof rakeBloodTransformEndSound !== 'undefined') playSoundSafe(rakeBloodTransformEndSound);
      if (typeof bloodAmbienceSound !== 'undefined') playSoundSafe(bloodAmbienceSound);
      if (typeof bloodRunScreamSound !== 'undefined') playSoundSafe(bloodRunScreamSound);
    }
  });

  socket.on('blood-hour-end', () => {
socket.on('blood-hour-trigger', () => {
  console.log('🩸 BH TRIGGER');
  console.log('  audioContext state:', audioListener.context.state);
  console.log('  bloodRage buffer?', !!bloodRageSound.buffer);
  console.log('  bloodAmbience buffer?', !!bloodAmbienceSound.buffer);
  console.log('  bloodRunScream buffer?', !!bloodRunScreamSound.buffer);
  console.log('  transformEnd buffer?', !!rakeBloodTransformEndSound.buffer);
  // ... rest of the handler
    bloodHourActive = false;
    bloodHourTransform = false;
    if (typeof stopBloodGlitch === 'function') stopBloodGlitch();
    if (phaseHud) { phaseHud.style.display = 'block'; phaseHud.classList.remove('blood'); }
    if (runForYourLifeBanner) runForYourLifeBanner.classList.remove('visible');
    if (bloodOverlay) {
      bloodOverlay.classList.remove('on');
      setTimeout(() => { bloodOverlay.style.display = 'none'; }, 3200);
    }
    if (typeof bloodRageSound !== 'undefined' && bloodRageSound.isPlaying) bloodRageSound.stop();
    if (typeof bloodAmbienceSound !== 'undefined' && bloodAmbienceSound.isPlaying) bloodAmbienceSound.stop();
    if (typeof bloodRunScreamSound !== 'undefined' && bloodRunScreamSound.isPlaying) bloodRunScreamSound.stop();
  });

  socket.on('rake-hurt', () => {
    if (typeof playRandomHurtSound === 'function') playRandomHurtSound();
    hitMarkerTimer = 0.18;
  });
  socket.on('rake-defeated', () => {
    rakeDefeated = true;
    if (defeatBanner) defeatBanner.style.display = 'block';
    defeatBannerTimer = 3.0;
  });
  socket.on('rake-step', (d) => { if (typeof playRakeFootstep === 'function') playRakeFootstep(d.speed || 3); });
  socket.on('gun-fired', (d) => {
    if (d.id === mySocketId) return;
    if (typeof gunshotSound === 'undefined' || !gunshotSound.buffer) return;
    if (typeof audioListener === 'undefined' || audioListener.context.state !== 'running') return;
    const clone = gunshotSound.clone();
    clone.setVolume(0.35);
    clone.play();
  });

  socket.on('debug-verified', () => {
    if (debugPasswordTimeout) { clearTimeout(debugPasswordTimeout); debugPasswordTimeout = null; }
    debugUnlockedThisSession = true;
    const err = document.getElementById('debugPasswordError');
    if (err) { err.style.color = '#8fd88f'; err.textContent = t('verified'); }
    const fn = pendingDebugAction;
    setTimeout(() => { hideDebugPasswordModal(); if (fn) fn(); }, 200);
  });
  socket.on('debug-denied', () => {
    if (debugPasswordTimeout) { clearTimeout(debugPasswordTimeout); debugPasswordTimeout = null; }
    const err = document.getElementById('debugPasswordError');
    if (err) { err.style.color = '#f55'; err.textContent = t('wrongPw'); }
  });
}
