// src/monster.js — client-side animation router.

var monster = null;
var mixer = null;
var actions = {};
var currentAction = null;
var currentClipName = null;

function recomputeMonsterRestY() {
  if (!monster) return;
  const savedY = monster.position.y;
  monster.position.y = 0;
  monster.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(monster);
  const lowestOffset = box.min.y;
  monster.position.y = savedY;
  monsterRestY = RAKE_GROUND_Y - lowestOffset + MONSTER_Y_OFFSET;
}

function playAnimation(name, fade = 0.1, timeScale) {
  if (!actions[name]) return;
  const ts = (timeScale !== undefined) ? timeScale : (CLIP_SPEEDS[name] || 1.0);
  const next = actions[name];
  if (currentAction === next) {
    if (Math.abs(next.timeScale - ts) > 0.001) next.timeScale = ts;
    return;
  }
  next.reset();
  next.timeScale = ts;
  next.setEffectiveWeight(1);
  next.fadeIn(fade);
  next.play();
  if (currentAction) currentAction.fadeOut(fade);
  currentAction = next;
  currentClipName = name;
}

function routeMonsterAnimation(serverState_) {
  if (!mixer || !monster) return;
  if (serverState_ === lastMonsterState) return;
  lastMonsterState = serverState_;
  console.log('🎬 Monster →', serverState_);

  switch (serverState_) {
    case 'DESPAWNED':
      monster.visible = false;
      break;

    case 'IDLE':
      monster.visible = true;
      playAnimation(CLIP.idle, 0.2, CLIP_SPEEDS['Idle']);
      break;

    case 'WANDER':
      monster.visible = true;
      playAnimation(CLIP.walk, 0.2, CLIP_SPEEDS['Walk']);
      break;

    case 'STALK':
      monster.visible = true;
      playAnimation(CLIP.walk, 0.15, CLIP_SPEEDS['Walk'] * 0.85);
      break;

    case 'SCREECH':
      monster.visible = true;
      playAnimation(CLIP.screech, 0.08, CLIP_SPEEDS['Scream']);
      playSoundSafe(screechSound);
      break;

    case 'HUNT':
      monster.visible = true;
      playAnimation(CLIP.run, 0.08, CLIP_SPEEDS['Run']);
      break;

    case 'ATTACK':
      monster.visible = true;
      playAnimation(actions[CLIP.attack] ? CLIP.attack : CLIP.screech, 0.1, CLIP_SPEEDS['Attack1']);
      break;

    case 'HURT':
      monster.visible = true;
      playAnimation(CLIP.hurt, 0.05, CLIP_SPEEDS['Hurt1']);
      playRandomHurtSound();
      break;

    case 'ENRAGED_TRANSFORM': {
      monster.visible = true;
      const a = actions[CLIP.retreat];
      if (a) {
        const dur = a.getClip().duration;
        a.reset();
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
        a.timeScale = dur / RAKE_ENRAGE_TRANSFORM_TIME;
        a.setEffectiveWeight(1);
        a.play();
        if (currentAction && currentAction !== a) currentAction.fadeOut(0.1);
        currentAction = a;
        currentClipName = CLIP.retreat;
        console.log(`  transform: dur=${dur.toFixed(2)} ts=${a.timeScale.toFixed(3)}`);
      }
      playSoundSafe(enragedSound);
      break;
    }

    case 'ENRAGED':
      monster.visible = true;
      playAnimation(CLIP.run, 0.1, CLIP_SPEEDS['Run'] * 1.3);
      break;

    case 'ENRAGED_END': {
      monster.visible = true;
      const a = actions[CLIP.retreat];
      if (a) {
        const dur = a.getClip().duration;
        a.reset();
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
        a.timeScale = dur / RAKE_ENRAGE_END_TIME;
        a.setEffectiveWeight(1);
        a.play();
        if (currentAction && currentAction !== a) currentAction.fadeOut(0.1);
        currentAction = a;
        currentClipName = CLIP.retreat;
        console.log(`  end: dur=${dur.toFixed(2)} ts=${a.timeScale.toFixed(3)}`);
      }
      playRandomHurtSound();
      break;
    }

    case 'BLOOD_TRANSFORM': {
      monster.visible = true;
      const a = actions[CLIP.retreat];
      if (a) {
        a.reset();
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
        a.timeScale = 1.0;
        a.setEffectiveWeight(1);
        a.play();
        a.time = Math.min(BLOOD_HOUR_FREEZE_TIME, a.getClip().duration - 0.0001);
        a.paused = true;
        if (currentAction && currentAction !== a) currentAction.fadeOut(0.05);
        currentAction = a;
        currentClipName = CLIP.retreat;
      }
      break;
    }

    case 'BLOOD_HOUR':
      monster.visible = true;
      playAnimation(CLIP.run, 0.15, CLIP_SPEEDS['Run'] * 1.35);
      break;

    case 'RETREAT_SCREAM':
      monster.visible = true;
      playAnimation(CLIP.retreat, 0.08, CLIP_SPEEDS['RetreatScream']);
      playRandomRetreatSound();
      break;

    case 'RETREAT_RUN':
      monster.visible = true;
      playAnimation(CLIP.run, 0.15, CLIP_SPEEDS['Run']);
      break;

    case 'RETREAT_ENTER':
      monster.visible = true;
      playAnimation(CLIP.run, 0.15, CLIP_SPEEDS['Run']);
      break;
  }
}

new THREE.GLTFLoader().load(MONSTER_PATH, (gltf) => {
  monster = gltf.scene;
  let meshCount = 0, boneCount = 0;
  monster.traverse(o => { if (o.isMesh) meshCount++; if (o.isBone) boneCount++; });
  console.log(`=== MONSTER === meshes ${meshCount} bones ${boneCount}`);
  monster.scale.setScalar(MONSTER_SCALE);
  monster.position.set(RAKE_SPAWN_WORLD.x, 0, RAKE_SPAWN_WORLD.z);
  monster.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  monster.add(screechSound);
  monster.add(sniffSound);
  monster.add(enragedSound);
  monster.add(bloodRunScreamSound);
  monster.add(rakeBloodTransformEndSound);
  screechSound.position.set(0, 3.0, 0);
  sniffSound.position.set(0, 2.0, 0);
  enragedSound.position.set(0, 3.0, 0);
  bloodRunScreamSound.position.set(0, 2.0, 0);
  rakeBloodTransformEndSound.position.set(0, 3.0, 0);
  for (const s of retreatSounds) { monster.add(s); s.position.set(0, 3.0, 0); }
  for (const s of hurtSounds)    { monster.add(s); s.position.set(0, 3.0, 0); }
  for (const s of rakeFootstepPool) { monster.add(s); s.position.set(0, 0.05, 0); }
  scene.add(monster);
  recomputeMonsterRestY();

  if (gltf.animations && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(monster);
    console.log('=== CLIPS ===');
    gltf.animations.forEach((c, i) => console.log(`  [${i}] "${c.name}" ${c.duration.toFixed(2)}s`));
    gltf.animations.forEach(clip => {
      const action = mixer.clipAction(clip);
      if ([CLIP.screech, CLIP.attack, CLIP.retreat, CLIP.hurt].includes(clip.name)) {
        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;
      }
      actions[clip.name] = action;
    });
  }

  monster.visible = false;
  if (loadingEl) {
    loadingEl.textContent = '✅ ' + t('worldLoaded');
    setTimeout(() => { loadingEl.style.display = 'none'; }, 2000);
  }
  if (typeof updateHPHUD === 'function') updateHPHUD();
  if (typeof updateToolbar === 'function') updateToolbar();
  if (typeof updateEquippedView === 'function') updateEquippedView();
}, (xhr) => {
  if (xhr.total && loadingEl) {
    const pct = Math.round((xhr.loaded / xhr.total) * 100);
    loadingEl.textContent = `${t('loadingMonster')} ${pct}%`;
  }
}, (err) => {
  console.error('❌ monster load failed:', err);
  if (loadingEl) {
    loadingEl.textContent = '❌ ' + t('monsterFailed');
    loadingEl.style.color = '#f55';
  }
});
