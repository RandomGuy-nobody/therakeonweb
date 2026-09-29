// src/player.js — PointerLock controls, movement, head bob, stamina,
// gun firing, HP, death overlay, respawn.
// Loads after monster.js.

// ============================================================
// CONTROLS
// ============================================================
var controls = new THREE.PointerLockControls(camera, document.body);

// ============================================================
// HP HUD / DEATH
// ============================================================
function updateHPHUD() {
  if (!hpBar) return;
  const pct = playerHP / PLAYER_MAX_HP;
  hpBar.style.width = (pct * 100) + '%';
  hpBar.style.background = pct > 0.6 ? '#c33' : (pct > 0.3 ? '#c63' : '#f33');
  if (hudHP) hudHP.textContent = playerHP;
}

function showDeathOverlay() {
  playerDead = true;
  if (deathStats) deathStats.textContent = `${t('survivedTime')} ${formatTime(gameTime)}`;
  if (deathPhase) deathPhase.textContent = nightNumber > 0 ? `${t('reached')} ${t('night')} ${nightNumber}` : t('diedBeforeNight');
  if (deathPoints) deathPoints.textContent = '+25 ' + t('pointsEarned') + ' ' + serverPoints + ')';
  if (deathOverlay) deathOverlay.style.display = 'flex';
  controls.unlock();
}

function requestRespawn() {
  if (!playerDead) return;
  if (socket && socket.connected) socket.emit('respawn');
}
if (deathOverlay) deathOverlay.addEventListener('click', requestRespawn);

// ============================================================
// GUN
// ============================================================
function fireGun() {
  if (gunCooldown > 0) return;
  if (!controls.isLocked || playerDead) return;
  gunCooldown = GUN_COOLDOWN;
  gunRecoilTimer = GUN_RECOIL_TIME;
  muzzleFlashTimer = 0.06;
  playSoundSafe(gunshotSound);
  recoilPitch += RECOIL_KICK_PITCH + Math.random() * 0.02;
  recoilYaw += (Math.random() - 0.5) * RECOIL_KICK_YAW * 2;
  if (socket && socket.connected) socket.emit('fired');
}
addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  if (!controls.isLocked || debugMode || playerDead || shopOpen) return;
  if (equippedSlot !== 2) return;
  fireGun();
});

// ============================================================
// KEYBOARD — raw key state
// ============================================================
var keys = { w: false, a: false, s: false, d: false, ' ': false, shift: false };
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = true;
  if (e.key === ' ') keys[' '] = true;
  if (e.key === 'Shift') keys.shift = true;
});
addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = false;
  if (e.key === ' ') keys[' '] = false;
  if (e.key === 'Shift') keys.shift = false;
});

// R to respawn while dead
addEventListener('keydown', e => { if (playerDead && e.key.toLowerCase() === 'r') requestRespawn(); });

// ============================================================
// LOCK / UNLOCK
// ============================================================
controls.addEventListener('lock', () => {
  if (instructions) instructions.style.display = 'none';
  if (clickHint) clickHint.style.display = 'none';
  if (crosshair) crosshair.style.display = 'block';
  if (phaseHud) phaseHud.style.display = 'block';
  if (pointsHud) pointsHud.style.display = 'block';
  if (hud) hud.style.display = 'block';
  if (staminaWrap) staminaWrap.style.display = 'block';
  if (staminaLabel) staminaLabel.style.display = 'block';
  if (hpWrap) hpWrap.style.display = 'block';
  if (hpLabel) hpLabel.style.display = 'block';
  if (typeof updateToolbar === 'function') updateToolbar();
  if (audioListener.context.state === 'suspended') {
    audioListener.context.resume().then(() => { if (isDay && !playerDead) startDaySoundtrack(); });
  } else if (isDay && !playerDead) {
    startDaySoundtrack();
  }
});

controls.addEventListener('unlock', () => {
  if (crosshair) crosshair.style.display = 'none';
  camera.position.x -= appliedBobX; camera.position.z -= appliedBobZ;
  camera.position.y = PLAYER_HEIGHT;
  appliedBobX = 0; appliedBobZ = 0;
  if (flashlight) flashlight.position.set(0, 0, 0);
  if (flashlightTarget) flashlightTarget.position.set(0, 0, -1);
  if (playerDead) return;
  if (shopOpen) return;
  if (debugMode) { if (clickHint) clickHint.style.display = 'flex'; }
  else { if (instructions) instructions.style.display = 'flex'; }
});

// ============================================================
// STAMINA
// ============================================================
function updateStamina(delta) {
  const wantsSprint = keys.shift && !debugMode;
  const canSprint = !staminaLocked && playerStamina > 0;
  sprinting = wantsSprint && canSprint;
  if (sprinting) {
    playerStamina -= STAMINA_DRAIN * delta;
    if (playerStamina <= 0) { playerStamina = 0; staminaLocked = true; }
  } else {
    playerStamina = Math.min(STAMINA_MAX, playerStamina + STAMINA_REGEN * delta);
    if (staminaLocked && playerStamina >= STAMINA_RECOVER) staminaLocked = false;
  }
  if (staminaBar) {
    const pct = playerStamina / STAMINA_MAX;
    staminaBar.style.width = (pct * 100) + '%';
    staminaBar.style.background = pct > 0.6 ? '#3f3' : (pct > 0.3 ? '#fc3' : '#f33');
  }
}

// ============================================================
// HEAD BOB
// ============================================================
const _rightVec = new THREE.Vector3();
function applyHeadBob(delta, moving) {
  const targetIntensity = moving ? (sprinting ? 1.7 : 1.0) : 0;
  bobIntensity += (targetIntensity - bobIntensity) * Math.min(1, delta * 10);
  if (moving) bobTime += delta * (sprinting ? BOB_RATE_SPRINT : BOB_RATE_WALK);
  const bobV = Math.sin(bobTime * 2) * BOB_AMOUNT_VERT * bobIntensity;
  const bobL = Math.cos(bobTime)     * BOB_AMOUNT_LAT  * bobIntensity;
  _rightVec.set(1, 0, 0).applyQuaternion(camera.quaternion);
  const bobX = _rightVec.x * bobL, bobZ = _rightVec.z * bobL;
  camera.position.x += bobX; camera.position.z += bobZ;
  camera.position.y = PLAYER_HEIGHT + bobV;
  appliedBobX = bobX; appliedBobZ = bobZ;

  const bobForModel = (m, basePos, baseRot) => {
    if (!m) return;
    m.position.x = basePos.x + bobL * BOB_MODEL_MULT_LAT * 0.4;
    m.position.y = basePos.y + bobV * BOB_MODEL_MULT_VERT;
    m.position.z = basePos.z;
    m.rotation.x = baseRot.x + bobV * 1.8;
    m.rotation.y = baseRot.y;
    m.rotation.z = baseRot.z + bobL * 2.2;
  };
  bobForModel(flashlightModel, FLASHLIGHT_BASE_POS, FLASHLIGHT_BASE_ROT);
  bobForModel(pistolModel,     PISTOL_BASE_POS,     PISTOL_BASE_ROT);

  const beamX = bobL * BOB_MODEL_MULT_LAT * 0.4 * BOB_BEAM_MULT;
  const beamY = bobV * BOB_MODEL_MULT_VERT * BOB_BEAM_MULT;
  if (flashlight) flashlight.position.set(beamX, beamY, 0);
  if (flashlightTarget) flashlightTarget.position.set(beamX, beamY, -1);
}
function removeHeadBob() {
  camera.position.x -= appliedBobX; camera.position.z -= appliedBobZ;
  camera.position.y = PLAYER_HEIGHT;
  appliedBobX = 0; appliedBobZ = 0;
}

// ============================================================
// FREE-FLY (debug only)
// ============================================================
const _forward = new THREE.Vector3(), _right = new THREE.Vector3();
function freeFly(step) {
  camera.getWorldDirection(_forward);
  _right.set(1, 0, 0).applyQuaternion(camera.quaternion);
  if (keys.w) camera.position.addScaledVector(_forward,  step);
  if (keys.s) camera.position.addScaledVector(_forward, -step);
  if (keys.d) camera.position.addScaledVector(_right,    step);
  if (keys.a) camera.position.addScaledVector(_right,   -step);
  if (keys[' '])  camera.position.y += step;
  if (keys.shift) camera.position.y -= step;
}

// ============================================================
// TOOLBAR / EQUIPPED
// ============================================================
function updateToolbar() {
  if (!toolbarEl) return;
  if (!gunUnlocked) { toolbarEl.style.display = 'none'; return; }
  toolbarEl.style.display = 'flex';
  if (slot1) slot1.classList.toggle('active', equippedSlot === 1);
  if (slot2) slot2.classList.toggle('active', equippedSlot === 2);
}
function updateEquippedView() {
  if (flashlightModel) flashlightModel.visible = (equippedSlot === 1);
  if (pistolModel)     pistolModel.visible     = (equippedSlot === 2) && gunUnlocked;
  if (flashlight)      flashlight.visible = (equippedSlot === 1);
  if (pocketLight)     pocketLight.visible = spotlightOwned;
  updateToolbar();
}
