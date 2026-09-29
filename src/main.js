// src/main.js — the animation loop, resize handler, and boot.
// Loads LAST. Everything before it must be ready.

// ============================================================
// LOOP STATE (local to this file)
// ============================================================
var clock = new THREE.Clock();
var pulseTime = 0;
var lastNetSend = 0;

// Initialize position trackers so first-frame footstep maths is sane
playerLastX = PLAYER_SPAWN.x;
playerLastZ = PLAYER_SPAWN.z;

// ============================================================
// ANIMATION LOOP
// ============================================================
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);
  pulseTime += delta;

  // ---------- Entrance marker + shop cube pulse ----------
  if (entranceMarker) {
    const pulse = 0.85 + Math.sin(pulseTime * 3) * 0.15;
    entranceMarker.scale.setScalar(pulse);
    entranceMarker.material.opacity = 0.25 + Math.sin(pulseTime * 3) * 0.15;
  }
  if (shopCube) {
    shopCube.position.y = SHOP_POSITION.y + Math.sin(pulseTime * 2) * 0.15;
    shopCube.rotation.y = pulseTime * 0.5;
  }

  // ---------- Sun follows player (realistic shadows) ----------
  if (REALISTIC_SHADOWS && sunLight && sunTarget) {
    sunLight.position.set(camera.position.x + 40, 90, camera.position.z + 25);
    sunTarget.position.set(camera.position.x, 0, camera.position.z);
    sunTarget.updateMatrixWorld();
  }

  // ---------- Blood Hour red blend ----------
  const blendTarget = (bloodHourTransform || bloodHourActive) ? 1 : 0;
  const rampTime = blendTarget > bloodHourBlend ? BLOOD_HOUR_FADE_IN_TIME : BLOOD_HOUR_FADE_OUT_TIME;
  bloodHourBlend += (blendTarget - bloodHourBlend) * Math.min(1, delta / rampTime);
  if (Math.abs(bloodHourBlend - blendTarget) < 0.005) bloodHourBlend = blendTarget;

  // ---------- Day/night sky blend ----------
  const dnTarget = isDay ? 1.0 : 0.0;
  dayNightFactor += (dnTarget - dayNightFactor) * Math.min(1, delta * 0.45);

  applyDayNightLighting();
  if (typeof updatePhaseHud === 'function') updatePhaseHud();

  // ---------- Screen flash effects ----------
  if (hitFlash) {
    if (hitFlashTimer > 0) {
      hitFlashTimer -= delta;
      const a = Math.max(0, hitFlashTimer / 0.4);
      hitFlash.style.background = `rgba(200, 0, 0, ${(a * 0.55).toFixed(2)})`;
    } else {
      hitFlash.style.background = 'rgba(200, 0, 0, 0)';
    }
  }
  if (muzzleFlash) {
    if (muzzleFlashTimer > 0) {
      muzzleFlashTimer -= delta;
      const a = Math.max(0, muzzleFlashTimer / 0.06);
      muzzleFlash.style.background = `rgba(255,220,120, ${(a * 0.4).toFixed(2)})`;
    } else {
      muzzleFlash.style.background = 'rgba(255,220,120, 0)';
    }
  }
  if (hitMarker) {
    if (hitMarkerTimer > 0) {
      hitMarkerTimer -= delta;
      hitMarker.style.display = 'block';
      hitMarker.style.opacity = Math.max(0, hitMarkerTimer / 0.18);
    } else {
      hitMarker.style.display = 'none';
    }
  }
  if (defeatBanner) {
    if (defeatBannerTimer > 0) {
      defeatBannerTimer -= delta;
      defeatBanner.style.display = 'block';
      defeatBanner.style.opacity = Math.min(1, defeatBannerTimer / 1.0);
    } else {
      defeatBanner.style.display = 'none';
    }
  }

  // ---------- Gun cooldown + recoil ----------
  if (gunCooldown > 0) gunCooldown -= delta;
  if (!debugMode && pistolModel && gunRecoilTimer > 0) {
    gunRecoilTimer -= delta;
    const k = Math.max(0, gunRecoilTimer / GUN_RECOIL_TIME);
    pistolModel.position.z = PISTOL_BASE_POS.z + k * 0.06;
    pistolModel.rotation.x = PISTOL_BASE_ROT.x - k * 0.28;
  }

  // Apply recoil to camera
  camera.rotation.x -= lastAppliedRecoilPitch;
  camera.rotation.y -= lastAppliedRecoilYaw;
  const recoilDecay = Math.exp(-RECOIL_DAMPING * delta);
  recoilPitch *= recoilDecay;
  recoilYaw   *= recoilDecay;
  if (recoilPitch < 0.0005) recoilPitch = 0;
  if (Math.abs(recoilYaw) < 0.0005) recoilYaw = 0;
  camera.rotation.x += recoilPitch;
  camera.rotation.y += recoilYaw;
  lastAppliedRecoilPitch = recoilPitch;
  lastAppliedRecoilYaw   = recoilYaw;

  // ---------- Shop proximity hint ----------
  if (typeof updateShopPrompt === 'function') updateShopPrompt();

  // ---------- Tree culling ----------
  if (typeof cullScenery === 'function') cullScenery();

  // ---------- Player movement ----------
  if (debugMode) {
    if (controls.isLocked) freeFly(16 * delta);
  } else if (controls.isLocked && !playerDead && !shopOpen) {
    removeHeadBob();
    updateStamina(delta);
    const speed = MOVE_SPEED * (sprinting ? SPRINT_MULT : 1);
    const step = speed * delta;
    const oldX = camera.position.x, oldZ = camera.position.z;
    const moving = keys.w || keys.a || keys.s || keys.d;
    if (keys.w) controls.moveForward(step);
    if (keys.s) controls.moveForward(-step);
    if (keys.a) controls.moveRight(-step);
    if (keys.d) controls.moveRight(step);
    if (isBlocked(camera.position.x, camera.position.z, oldX, oldZ)) {
      camera.position.x = oldX;
      camera.position.z = oldZ;
    }
    camera.position.x = Math.max(-MAP_HALF, Math.min(MAP_HALF, camera.position.x));
    camera.position.z = Math.max(-MAP_HALF, Math.min(MAP_HALF, camera.position.z));
    applyHeadBob(delta, moving);

    const curSpeed = MOVE_SPEED * (sprinting ? SPRINT_MULT : 1);
    const dxP = camera.position.x - playerLastX;
    const dzP = camera.position.z - playerLastZ;
    const movedP = Math.sqrt(dxP * dxP + dzP * dzP);
    playerLastX = camera.position.x;
    playerLastZ = camera.position.z;
    if (moving && movedP > 0.001) {
      playerStepPhase += delta * curSpeed * PLAYER_STEP_PHASE_RATE;
      if (playerStepPhase >= Math.PI) {
        playerStepPhase -= Math.PI;
        playPlayerFootstep();
      }
    } else {
      playerStepPhase *= 0.7;
    }
  }

  // ---------- Send our position to the server ----------
  if (socket && socket.connected && !debugMode) {
    const now = performance.now();
    if (now - lastNetSend > 50) {
      lastNetSend = now;
      socket.emit('move', {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        ry: camera.rotation.y,
        equipped: equippedSlot,
      });
    }
  }

  // ---------- Interpolate monster from server ----------
  if (monster && gameState && gameState.monster.active) {
    monster.position.x += (monsterTargetX - monster.position.x) * Math.min(1, delta * 12);
    monster.position.z += (monsterTargetZ - monster.position.z) * Math.min(1, delta * 12);
    monster.position.y = monsterRestY;

    let rDiff = monsterTargetRY - monster.rotation.y;
    while (rDiff >  Math.PI) rDiff -= Math.PI * 2;
    while (rDiff < -Math.PI) rDiff += Math.PI * 2;
    monster.rotation.y += rDiff * Math.min(1, delta * 12);

    monster.visible = true;

    // Blood Hour transform: unfreeze the retreat clip once the server has
    // passed the warn time and told us to restart it from zero.
    if (gameState.monster.state === 'BLOOD_TRANSFORM' && bloodHourTextShown) {
      const a = actions[CLIP.retreat];
      if (a && a.paused) { a.paused = false; a.time = 0; }
    }

    // HUD
    if (hudDist) {
      const dxM = monster.position.x - camera.position.x;
      const dzM = monster.position.z - camera.position.z;
      hudDist.textContent = Math.sqrt(dxM * dxM + dzM * dzM).toFixed(1);
    }
    if (hudState) {
      hudState.textContent = gameState.monster.state;
      const isEnraged = gameState.monster.state === 'ENRAGED' || gameState.monster.state === 'ENRAGED_TRANSFORM';
      const isBlood   = gameState.monster.state === 'BLOOD_HOUR' || gameState.monster.state === 'BLOOD_TRANSFORM';
      hudState.className = isBlood ? 'state blood' : (isEnraged ? 'state enraged' : 'state');
    }

    // Danger vignette
    if (vignette) {
      const dxM = monster.position.x - camera.position.x;
      const dzM = monster.position.z - camera.position.z;
      const d = Math.sqrt(dxM * dxM + dzM * dzM);
      let danger = 0;
      const st = gameState.monster.state;
      if (st === 'HUNT') danger = Math.max(0, 1 - d / 32);
      else if (st === 'SCREECH') danger = 0.55;
      else if (st === 'ATTACK') danger = 1.0;
      else if (st === 'HURT') danger = 0.4;
      else if (st === 'ENRAGED') danger = 1.0;
      else if (st === 'ENRAGED_TRANSFORM') danger = 1.0;
      else if (st === 'BLOOD_HOUR') danger = 1.0;
      else if (st === 'BLOOD_TRANSFORM') danger = 0.9;
      vignette.style.boxShadow = `inset 0 0 200px 40px rgba(150, 0, 0, ${(danger * 0.8).toFixed(2)})`;
    }
  } else if (monster) {
    monster.visible = false;
    if (hudState) hudState.textContent = 'GONE';
    if (hudDist) hudDist.textContent = '—';
    if (vignette) vignette.style.boxShadow = 'inset 0 0 200px 40px rgba(150, 0, 0, 0)';
  }

  // ---------- Remote players ----------
  for (const id in remotePlayers) {
    const rp = remotePlayers[id];
    rp.group.visible = !rp.dead;
    if (rp.dead) continue;
    rp.group.position.lerp(rp.target, Math.min(1, delta * 15));
    let diff = rp.targetRY - rp.group.rotation.y;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    rp.group.rotation.y += diff * Math.min(1, delta * 10);
    if (rp.damageFlash > 0) {
      rp.damageFlash -= delta;
      const k = Math.max(0, rp.damageFlash / 0.35);
      rp.bodyMat.emissive.setRGB(k, 0, 0);
    } else if (rp.color) {
      rp.bodyMat.emissive.copy(new THREE.Color(rp.color).multiplyScalar(0.18));
    }
  }

  // ---------- Animate + render ----------
  if (mixer) mixer.update(delta);
  renderer.render(scene, camera);
}

// ============================================================
// RESIZE
// ============================================================
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ============================================================
// BOOT
// ============================================================
applyTranslations();
if (typeof setupMenuControls === 'function') setupMenuControls();
updateShopUI();
updateEquippedView();
updateHPHUD();

// Start the loop
animate();
