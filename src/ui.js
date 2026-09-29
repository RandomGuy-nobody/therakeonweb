// src/ui.js — menu controls, shop UI, debug mode, cheat codes, hotkeys.
// Loads after player.js.

// ============================================================
// RENDER DISTANCE
// ============================================================
function applyRenderDistance(newDist) {
  TREE_VIEW_DIST = newDist;
  TREE_VIEW_DIST_SQ = newDist * newDist;
  TREE_SHADOW_DIST = Math.max(18, Math.min(40, newDist * 0.55));
  TREE_SHADOW_DIST_SQ = TREE_SHADOW_DIST * TREE_SHADOW_DIST;
  camera.far = newDist + 30;
  camera.updateProjectionMatrix();
  const valEl = document.getElementById('renderDistVal');
  if (valEl) valEl.textContent = newDist;
  try { localStorage.setItem('render_dist', String(newDist)); } catch (e) {}
}
function stopBloodGlitch() {
  // no-op — the glitch is now drawn every frame inside updatePhaseHud
}

// ============================================================
// SHOP UI
// ============================================================
function isNearShop() {
  const dx = camera.position.x - SHOP_POSITION.x, dz = camera.position.z - SHOP_POSITION.z;
  return (dx * dx + dz * dz) < SHOP_RANGE * SHOP_RANGE;
}
function openShop() {
  if (shopOpen || playerDead) return;
  shopOpen = true;
  controls.unlock();
  if (shopOverlay) shopOverlay.style.display = 'flex';
  updateShopUI();
}
function closeShop() {
  if (!shopOpen) return;
  shopOpen = false;
  if (shopOverlay) shopOverlay.style.display = 'none';
  if (shopPrompt) shopPrompt.style.display = 'none';
  if (!playerDead && !debugMode) controls.lock();
}
function updateShopUI() {
  if (pointsValue) pointsValue.textContent = serverPoints;
  if (shopPointsEl) shopPointsEl.textContent = `${t('points')}: ${serverPoints}`;
  if (!shopGunItem) return;
  shopGunItem.classList.remove('owned', 'broke');
  if (gunUnlocked) {
    shopGunItem.classList.add('owned');
    shopGunCost.textContent = t('owned');
  } else if (serverPoints < SHOP_GUN_COST) {
    shopGunItem.classList.add('broke');
    shopGunCost.textContent = `${SHOP_GUN_COST} ${t('pts')}`;
  } else {
    shopGunCost.textContent = `${SHOP_GUN_COST} ${t('pts')}`;
  }
  shopSpotlightItem.classList.remove('owned', 'broke');
  if (spotlightOwned) {
    shopSpotlightItem.classList.add('owned');
    shopSpotlightCost.textContent = t('owned');
  } else if (serverPoints < SHOP_SPOTLIGHT_COST) {
    shopSpotlightItem.classList.add('broke');
    shopSpotlightCost.textContent = `${SHOP_SPOTLIGHT_COST} ${t('pts')}`;
  } else {
    shopSpotlightCost.textContent = `${SHOP_SPOTLIGHT_COST} ${t('pts')}`;
  }
}
function buyGun() {
  if (gunUnlocked || serverPoints < SHOP_GUN_COST) return;
  // Optimistic local update
  gunUnlocked = true;
  serverPoints -= SHOP_GUN_COST;
  updateShopUI();
  if (typeof updateToolbar === 'function') updateToolbar();
  if (typeof updateEquippedView === 'function') updateEquippedView();
  // Tell server
  if (socket && socket.connected) socket.emit('buy-gun');
}
function buySpotlight() {
  if (spotlightOwned || serverPoints < SHOP_SPOTLIGHT_COST) return;
  spotlightOwned = true;
  serverPoints -= SHOP_SPOTLIGHT_COST;
  if (pocketLight) pocketLight.visible = true;
  updateShopUI();
  if (socket && socket.connected) socket.emit('buy-spotlight');
}

// ============================================================
// DEBUG MODE
// ============================================================
var konamiProgress = 0;
var gunCodeProgress = 0;
var bloodCodeProgress = 0;
const KONAMI = ['f', 'f', 'g', 'r'];
const GUN_CODE = ['g', 'u', 'n'];
const BLOOD_CODE = ['b', 'l', 'o', 'o', 'd', 'o', 'a', 't', 'h'];

function applyShadowFar() {
  if (!flashlight) return;
  flashlight.shadow.camera.far = FLASHLIGHT_SHADOW_FAR;
  flashlight.shadow.camera.updateProjectionMatrix();
  if (debugShadowFar) debugShadowFar.textContent = FLASHLIGHT_SHADOW_FAR;
}
function cycleShadowRes() {
  if (!flashlight) return;
  const sizes = [256, 512, 1024, 2048];
  const idx = sizes.indexOf(FLASHLIGHT_SHADOW_RES);
  const next = sizes[(idx + 1) % sizes.length];
  FLASHLIGHT_SHADOW_RES = next;
  flashlight.shadow.mapSize.set(next, next);
  if (flashlight.shadow.map) { flashlight.shadow.map.dispose(); flashlight.shadow.map = null; }
  if (debugShadowRes) debugShadowRes.textContent = next;
}
function applyMonsterScale() {
  if (monster) { monster.scale.setScalar(MONSTER_SCALE); recomputeMonsterRestY(); }
  if (debugMonScale) debugMonScale.textContent = MONSTER_SCALE.toFixed(2);
}
function applyMonsterYOffset() {
  recomputeMonsterRestY();
  if (debugMonY) debugMonY.textContent = MONSTER_Y_OFFSET.toFixed(3);
}
function applyBrightness() {
  if (debugBright) debugBright.textContent = debugBrightness.toFixed(2);
  applyDayNightLighting();
}
function refreshSprintDebug() {
  if (debugStamMax) debugStamMax.textContent = STAMINA_MAX;
  if (debugSprintMult) debugSprintMult.textContent = SPRINT_MULT.toFixed(2);
  if (debugStamDrain) debugStamDrain.textContent = STAMINA_DRAIN;
}

function enterDebugMode() {
  debugMode = true;
  entranceWpMarker.visible = true;
  insideWpMarker.visible = true;
  if (instructions) instructions.style.display = 'none';
  if (controls.isLocked) {
    if (clickHint) clickHint.style.display = 'none';
    if (crosshair) crosshair.style.display = 'block';
    if (phaseHud) phaseHud.style.display = 'block';
    if (pointsHud) pointsHud.style.display = 'block';
    if (hud) hud.style.display = 'block';
  } else {
    if (clickHint) clickHint.style.display = 'flex';
  }
  if (debugBadge) debugBadge.style.display = 'block';
  applyBrightness();
  refreshSprintDebug();
  if (debugMonScale) debugMonScale.textContent = MONSTER_SCALE.toFixed(2);
  if (debugMonY) debugMonY.textContent = MONSTER_Y_OFFSET.toFixed(3);
  if (debugAnimSpeed) debugAnimSpeed.textContent = ANIM_SPEED.toFixed(2);
  if (debugPingPong) debugPingPong.textContent = USE_PINGPONG ? 'PINGPONG' : 'REPEAT';
  if (debugShadowFar) debugShadowFar.textContent = FLASHLIGHT_SHADOW_FAR;
  if (debugShadowRes) debugShadowRes.textContent = FLASHLIGHT_SHADOW_RES;
  console.log('🐛 Debug mode ON');
}
function exitDebugMode() {
  debugMode = false;
  entranceWpMarker.visible = false;
  insideWpMarker.visible = false;
  if (debugBadge) debugBadge.style.display = 'none';
  if (clickHint) clickHint.style.display = 'none';
  debugBrightness = 1.0;
  applyBrightness();
  if (controls.isLocked) {
    if (crosshair) crosshair.style.display = 'block';
    if (phaseHud) phaseHud.style.display = 'block';
    if (pointsHud) pointsHud.style.display = 'block';
    if (hud) hud.style.display = 'block';
  } else {
    if (instructions) instructions.style.display = 'flex';
    if (crosshair) crosshair.style.display = 'none';
    if (phaseHud) phaseHud.style.display = 'none';
    if (pointsHud) pointsHud.style.display = 'none';
    if (hud) hud.style.display = 'none';
  }
  console.log('🐛 Debug mode OFF');
}

// ============================================================
// KEYBOARD HANDLERS (cheat codes + gameplay hotkeys)
// ============================================================
addEventListener('keydown', e => {
  if (debugPasswordOpen) return;
  const onMenu = instructions && instructions.style.display !== 'none' && !playerDead && !shopOpen;

  // Gun code
  if (!gunUnlocked && onMenu) {
    const k = e.key.toLowerCase();
    if (k === GUN_CODE[gunCodeProgress]) {
      gunCodeProgress++;
      if (gunCodeProgress === GUN_CODE.length) {
        gunCodeProgress = 0;
        requestDebugAccess(() => {
          gunUnlocked = true;
          console.log('🔫 GUN UNLOCKED');
          updateToolbar(); updateEquippedView();
        });
      }
    } else { gunCodeProgress = (k === GUN_CODE[0]) ? 1 : 0; }
  }

  // Konami → debug
  if (!debugMode && onMenu) {
    const k = e.key.toLowerCase();
    if (k === KONAMI[konamiProgress]) {
      konamiProgress++;
      if (konamiProgress === KONAMI.length) {
        konamiProgress = 0;
        requestDebugAccess(enterDebugMode);
      }
    } else { konamiProgress = (k === KONAMI[0]) ? 1 : 0; }
  }

  // BLOODOATH → Blood Hour
  if (!debugMode && !playerDead) {
    const k = e.key.toLowerCase();
    if (k === BLOOD_CODE[bloodCodeProgress]) {
      bloodCodeProgress++;
      if (bloodCodeProgress === BLOOD_CODE.length) {
        bloodCodeProgress = 0;
        requestDebugAccess(() => sendDebugAction('trigger-blood-hour'));
      }
    } else { bloodCodeProgress = (k === BLOOD_CODE[0]) ? 1 : 0; }
  }

  // Exit debug
  if (debugMode && e.key.toLowerCase() === 'f') exitDebugMode();

  // Gameplay keys
  if (!debugMode && !playerDead) {
    if (e.key === '1') { equippedSlot = 1; updateEquippedView(); }
    if (e.key === '2' && gunUnlocked) { equippedSlot = 2; updateEquippedView(); }
    if (e.key.toLowerCase() === 'e') {
      if (shopOpen) closeShop();
      else if (isNearShop() && controls.isLocked) openShop();
    }
  }

  // Debug hotkeys
  if (debugMode) {
    if (e.code === 'Minus') { debugBrightness = Math.max(0.05, debugBrightness - 0.2); applyBrightness(); }
    if (e.code === 'Equal') { debugBrightness = Math.min(5, debugBrightness + 0.2); applyBrightness(); }
    if (e.key === '[') { STAMINA_MAX = Math.max(10, STAMINA_MAX - 10); refreshSprintDebug(); }
    if (e.key === ']') { STAMINA_MAX = Math.min(1000, STAMINA_MAX + 10); refreshSprintDebug(); }
    if (e.key === ',') { SPRINT_MULT = Math.max(0.5, +(SPRINT_MULT - 0.1).toFixed(2)); refreshSprintDebug(); }
    if (e.key === '.') { SPRINT_MULT = Math.min(10, +(SPRINT_MULT + 0.1).toFixed(2)); refreshSprintDebug(); }
    if (e.key === ';') { STAMINA_DRAIN = Math.max(2, STAMINA_DRAIN - 2); refreshSprintDebug(); }
    if (e.key === "'") { STAMINA_DRAIN = Math.min(200, STAMINA_DRAIN + 2); refreshSprintDebug(); }
    if (e.key === '9') { MONSTER_SCALE = Math.max(0.2, +(MONSTER_SCALE - 0.1).toFixed(2)); applyMonsterScale(); }
    if (e.key === '0') { MONSTER_SCALE = Math.min(20, +(MONSTER_SCALE + 0.1).toFixed(2)); applyMonsterScale(); }
    if (e.key === '7') { MONSTER_Y_OFFSET = +(MONSTER_Y_OFFSET - 0.05).toFixed(3); applyMonsterYOffset(); }
    if (e.key === '8') { MONSTER_Y_OFFSET = +(MONSTER_Y_OFFSET + 0.05).toFixed(3); applyMonsterYOffset(); }
    if (e.key === '1') {
      ANIM_SPEED = Math.max(0.1, +(ANIM_SPEED - 0.05).toFixed(2));
      for (const k in CLIP_SPEEDS) CLIP_SPEEDS[k] = ANIM_SPEED;
      if (debugAnimSpeed) debugAnimSpeed.textContent = ANIM_SPEED.toFixed(2);
    }
    if (e.key === '2') {
      ANIM_SPEED = Math.min(3.0, +(ANIM_SPEED + 0.05).toFixed(2));
      for (const k in CLIP_SPEEDS) CLIP_SPEEDS[k] = ANIM_SPEED;
      if (debugAnimSpeed) debugAnimSpeed.textContent = ANIM_SPEED.toFixed(2);
    }
    if (e.key === '3') { USE_PINGPONG = !USE_PINGPONG; applyPingPong(); }
    if (e.key === '4') { sendDebugAction('skip-phase'); }
    if (e.key === '5') { FLASHLIGHT_SHADOW_FAR = Math.max(8, FLASHLIGHT_SHADOW_FAR - 4); applyShadowFar(); }
    if (e.key === '6') { FLASHLIGHT_SHADOW_FAR = Math.min(80, FLASHLIGHT_SHADOW_FAR + 4); applyShadowFar(); }
    if (e.key.toLowerCase() === 'z') { cycleShadowRes(); }
    if (e.key.toLowerCase() === 'e') setEntranceWaypoint(camera.position.x, 0, camera.position.z);
    if (e.key.toLowerCase() === 'q') setInsideWaypoint(camera.position.x, 0, camera.position.z);
    if (e.key.toLowerCase() === 'h') { sendDebugAction('heal-all'); }
    if (e.key.toLowerCase() === 'b') {
      sendDebugAction('arm-blood-hour');
      if (debugBloodForce) debugBloodForce.textContent = 'ARMED';
    }
    if (e.key.toLowerCase() === 'v') { sendDebugAction('trigger-blood-hour'); }
  }
});

// ============================================================
// MENU CONTROLS
// ============================================================
function setupMenuControls() {
  const slider = document.getElementById('renderDistSlider');
  const valEl = document.getElementById('renderDistVal');
  const lowSwitch = document.getElementById('lowDetailSwitch');
  const shadowSwitch = document.getElementById('shadowSwitch');
  const langSelect = document.getElementById('langSelect');
  const nameInput = document.getElementById('playerNameInput');
  const colorInput = document.getElementById('playerColorInput');
  const bushesSwitch = document.getElementById('bushesSwitch');

  if (slider) {
    slider.value = TREE_VIEW_DIST;
    if (valEl) valEl.textContent = TREE_VIEW_DIST;
    const onChange = (e) => applyRenderDistance(parseFloat(e.target.value));
    slider.addEventListener('input', onChange);
    slider.addEventListener('change', onChange);
    slider.addEventListener('mousedown', (e) => e.stopPropagation());
    slider.addEventListener('click', (e) => e.stopPropagation());
    slider.addEventListener('touchstart', (e) => e.stopPropagation());
    applyRenderDistance(TREE_VIEW_DIST);
  }

  if (lowSwitch) {
    if (LOW_DETAIL) lowSwitch.classList.add('on'); else lowSwitch.classList.remove('on');
    const toggleLowDetail = (e) => {
      e.stopPropagation(); e.preventDefault();
      try { localStorage.setItem('low_detail', String(!LOW_DETAIL)); } catch (err) {}
      location.reload();
    };
    lowSwitch.addEventListener('click', toggleLowDetail);
    lowSwitch.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  if (shadowSwitch) {
    if (REALISTIC_SHADOWS) shadowSwitch.classList.add('on'); else shadowSwitch.classList.remove('on');
    const toggleShadows = (e) => {
      e.stopPropagation(); e.preventDefault();
      REALISTIC_SHADOWS = !REALISTIC_SHADOWS;
      try { localStorage.setItem('realistic_shadows', String(REALISTIC_SHADOWS)); } catch (err) {}
      shadowSwitch.classList.toggle('on', REALISTIC_SHADOWS);
      applyShadowQuality();
    };
    shadowSwitch.addEventListener('click', toggleShadows);
    shadowSwitch.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  if (langSelect) {
    langSelect.value = currentLang;
    langSelect.addEventListener('change', (e) => {
      currentLang = e.target.value;
      try { localStorage.setItem('lang', currentLang); } catch (err) {}
      applyTranslations();
      try { updateShopUI(); } catch (err) {}
    });
  }

  if (nameInput) {
    nameInput.value = myName;
    nameInput.addEventListener('input', (e) => {
      myName = e.target.value.slice(0, 16) || 'Player';
      try { localStorage.setItem('player_name', myName); } catch (err) {}
      sendIdentity();
    });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') e.target.blur();
      e.stopPropagation();
    });
  }

  if (colorInput) {
    colorInput.value = myColor;
    colorInput.addEventListener('input', (e) => {
      myColor = e.target.value;
      try { localStorage.setItem('player_color', myColor); } catch (err) {}
      sendIdentity();
    });
  }

  if (bushesSwitch) {
    if (BUSHES_ENABLED) bushesSwitch.classList.add('on'); else bushesSwitch.classList.remove('on');
    const toggleBushes = (e) => {
      e.stopPropagation(); e.preventDefault();
      BUSHES_ENABLED = !BUSHES_ENABLED;
      try { localStorage.setItem('bushes_enabled', String(BUSHES_ENABLED)); } catch (err) {}
      location.reload();
    };
    bushesSwitch.addEventListener('click', toggleBushes);
    bushesSwitch.addEventListener('mousedown', (e) => e.stopPropagation());
    bushesSwitch.addEventListener('touchstart', (e) => { e.stopPropagation(); toggleBushes(e); });
  }

  // Password modal
  const pwInput = document.getElementById('debugPasswordInput');
  if (pwInput) {
    pwInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') submitDebugPassword();
      if (e.key === 'Escape') hideDebugPasswordModal();
    });
  }
  const pwSubmit = document.getElementById('debugPasswordSubmit');
  if (pwSubmit) pwSubmit.addEventListener('click', submitDebugPassword);
  const pwCancel = document.getElementById('debugPasswordCancel');
  if (pwCancel) pwCancel.addEventListener('click', hideDebugPasswordModal);

  // Shop buttons
  if (shopGunItem) shopGunItem.addEventListener('click', buyGun);
  if (shopSpotlightItem) shopSpotlightItem.addEventListener('click', buySpotlight);
  if (shopCloseBtn) shopCloseBtn.addEventListener('click', closeShop);

  // Start / debug click hints
  if (instructions) instructions.addEventListener('click', () => { if (!debugMode) controls.lock(); });
  if (clickHint) clickHint.addEventListener('click', () => { if (debugMode && !controls.isLocked) controls.lock(); });
}

// ============================================================
// SHOP PROMPT (checked each frame from main loop)
// ============================================================
function updateShopPrompt() {
  if (!shopPrompt) return;
  if (!shopOpen && !debugMode && !playerDead && controls.isLocked) {
    shopPrompt.style.display = isNearShop() ? 'block' : 'none';
  } else {
    shopPrompt.style.display = 'none';
  }
}

// ============================================================
// BLOOD HOUR GLITCH (client-side timer text)
// ============================================================
function stopBloodGlitch() {
  if (bloodHourGlitchInt) {
    clearInterval(bloodHourGlitchInt);
    bloodHourGlitchInt = null;
  }
  if (phaseTimer) phaseTimer.classList.remove('glitch');
}

// ============================================================
// PHASE HUD UPDATE (called from main loop)
// ============================================================
function updatePhaseHud() {
  const mState = (gameState && gameState.monster) ? gameState.monster.state : null;

  // ---------- BLOOD HOUR: glitch phase ----------
  if (mState === 'BLOOD_TRANSFORM') {
    if (phaseHud) {
      phaseHud.style.display = 'block';
      phaseHud.classList.add('blood');
      phaseHud.classList.remove('night', 'day');
    }
    if (phaseName) phaseName.textContent = '';
    if (phaseTimer) {
      phaseTimer.classList.add('glitch');
      const chars = '0123456789!@#$%^&*(){}[]<>?/\\|+=_-~';
      let s = '';
      for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
      phaseTimer.textContent = s;
    }
    if (hudSurvival) hudSurvival.textContent = formatTime(gameTime);
    return;
  }

  // ---------- BLOOD HOUR: rage phase ----------
  if (mState === 'BLOOD_HOUR') {
    if (phaseHud) {
      phaseHud.style.display = 'block';
      phaseHud.classList.add('blood');
      phaseHud.classList.remove('night', 'day');
    }
    if (phaseName) phaseName.textContent = '';
    if (phaseTimer) {
      phaseTimer.classList.remove('glitch');
      const t = (gameState && gameState.monster && gameState.monster.bloodHourT) || 0;
      phaseTimer.textContent = formatTime(t);
    }
    if (hudSurvival) hudSurvival.textContent = formatTime(gameTime);
    return;
  }

  // ---------- NORMAL ----------
  if (phaseTimer) phaseTimer.classList.remove('glitch');
  if (phaseHud) {
    phaseHud.classList.remove('blood');
    phaseHud.style.display = 'block';
  }
  if (!phaseHud) return;

  const phaseDuration = isDay ? DAY_DURATION : NIGHT_DURATION;
  const remaining = Math.max(0, phaseDuration - serverPhaseTime);
  if (phaseName) phaseName.textContent = isDay ? `${t('day')} ${nightNumber + 1}` : `${t('night')} ${nightNumber}`;
  if (phaseTimer) phaseTimer.textContent = formatTime(remaining);
  phaseHud.classList.toggle('night', !isDay);
  phaseHud.classList.toggle('day', isDay);
  if (phaseTimer) {
    if (remaining < PHASE_WARN_TIME) phaseTimer.classList.add('warning');
    else phaseTimer.classList.remove('warning');
  }
  if (hudSurvival) hudSurvival.textContent = formatTime(gameTime);
}
