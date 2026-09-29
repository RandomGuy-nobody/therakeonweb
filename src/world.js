// src/world.js — scene, camera, renderer, lights, floor, trees, bushes,
// cave, waypoints, shop cube, viewmodels, shadow quality, day/night lighting.
// Loads after audio.js. Everything else reads from these globals.

// ============================================================
// SCENE / CAMERA / RENDERER
// ============================================================
var scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(NIGHT_FOG_COLOR.getHex(), NIGHT_FOG_DENSITY);
scene.background = new THREE.Color(NIGHT_FOG_COLOR.getHex());

var camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, TREE_VIEW_DIST + 30);
var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, PIXEL_RATIO_CAP));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Attach the audio listener created in audio.js
camera.add(audioListener);

// ============================================================
// LIGHTS
// ============================================================
var ambient = new THREE.AmbientLight(0x0a0a12, NIGHT_AMBIENT_INTENSITY);
scene.add(ambient);

var hemiLight = new THREE.HemisphereLight(0xb8ccdf, 0x3a3028, 0);
scene.add(hemiLight);

var sunLight = new THREE.DirectionalLight(0xfff0d8, 0);
sunLight.position.set(40, 90, 25);
scene.add(sunLight);

var sunTarget = new THREE.Object3D();
sunTarget.position.set(0, 0, 0);
scene.add(sunTarget);
sunLight.target = sunTarget;

// ============================================================
// FLOOR
// ============================================================
var floor = new THREE.Mesh(
  new THREE.PlaneGeometry(MAP_HALF * 2 + 40, MAP_HALF * 2 + 40),
  new THREE.MeshStandardMaterial({ color: 0x0e1a0e, roughness: 1.0 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// ============================================================
// DAY / NIGHT LIGHTING
// ============================================================
function applyDayNightLighting() {
  const dayT = dayNightFactor;
  const baseAmbient = NIGHT_AMBIENT_INTENSITY + (DAY_AMBIENT_INTENSITY - NIGHT_AMBIENT_INTENSITY) * dayT;
  const spotBoost = spotlightOwned ? SPOTLIGHT_AMBIENT_BOOST : 0;
  ambient.intensity = (baseAmbient + spotBoost) * debugBrightness;
  const baseHemi = NIGHT_HEMI_INTENSITY + (DAY_HEMI_INTENSITY - NIGHT_HEMI_INTENSITY) * dayT;
  hemiLight.intensity = (baseHemi + spotBoost * 0.5) * debugBrightness;
  sunLight.intensity = DAY_SUN_INTENSITY * dayT * debugBrightness;
  _fogColor.copy(NIGHT_FOG_COLOR).lerp(DAY_FOG_COLOR, dayT);
  scene.fog.color.copy(_fogColor);
  if (scene.background) scene.background.copy(_fogColor);
  scene.fog.density = NIGHT_FOG_DENSITY + (DAY_FOG_DENSITY - NIGHT_FOG_DENSITY) * dayT;
  if (bloodHourBlend > 0.001) {
    const b = bloodHourBlend;
    ambient.intensity *= (1 - 0.5 * b);
    hemiLight.intensity *= (1 - 0.65 * b);
    sunLight.intensity *= (1 - b);
    const redTarget = new THREE.Color(0x220000);
    scene.fog.color.lerp(redTarget, b);
    if (scene.background) scene.background.lerp(redTarget, b);
    scene.fog.density = Math.min(0.13, scene.fog.density + 0.07 * b);
  }
}

// ============================================================
// SHOP CUBE
// ============================================================
var shopCube = new THREE.Mesh(
  new THREE.BoxGeometry(2, 2, 2),
  new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0x881111, emissiveIntensity: 0.9, roughness: 0.35 })
);
shopCube.position.set(SHOP_POSITION.x, SHOP_POSITION.y, SHOP_POSITION.z);
scene.add(shopCube);

var shopLight = new THREE.PointLight(0xff3333, 1.6, 9, 1.5);
shopLight.position.set(SHOP_POSITION.x, SHOP_POSITION.y + 1.2, SHOP_POSITION.z);
scene.add(shopLight);

// ============================================================
// FLASHLIGHT + POCKET LIGHT
// ============================================================
var flashlight = new THREE.SpotLight(0xffffff, 4, 60, Math.PI / 6, 0.55, 1.5);
flashlight.castShadow = true;
flashlight.shadow.mapSize.set(FLASHLIGHT_SHADOW_RES, FLASHLIGHT_SHADOW_RES);
flashlight.shadow.camera.near = 0.5;
flashlight.shadow.camera.far = FLASHLIGHT_SHADOW_FAR;
camera.add(flashlight);

var flashlightTarget = new THREE.Object3D();
flashlightTarget.position.set(0, 0, -1);
camera.add(flashlightTarget);
flashlight.target = flashlightTarget;

var pocketLight = new THREE.SpotLight(0x88aaff, 2.6, 30, Math.PI / 2.2, 0.85, 1.2);
pocketLight.castShadow = false;
camera.add(pocketLight);
var pocketTarget = new THREE.Object3D();
pocketTarget.position.set(0, 0, -1);
camera.add(pocketTarget);
pocketLight.target = pocketTarget;
pocketLight.visible = false;

scene.add(camera);
camera.position.set(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z);

// ============================================================
// VIEWMODELS
// ============================================================
var flashlightModel = null;
new THREE.GLTFLoader().load(FLASHLIGHT_PATH, (gltf) => {
  flashlightModel = gltf.scene;
  const box = new THREE.Box3().setFromObject(flashlightModel);
  const size = new THREE.Vector3(); box.getSize(size);
  const autoScale = FLASHLIGHT_TARGET_SIZE / Math.max(size.x, size.y, size.z);
  flashlightModel.scale.setScalar(autoScale);
  flashlightModel.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of mats) {
      if (!mat) continue;
      if (mat.transparent) { mat.transparent = false; mat.depthWrite = true; mat.needsUpdate = true; }
    }
  });
  flashlightModel.position.set(FLASHLIGHT_BASE_POS.x, FLASHLIGHT_BASE_POS.y, FLASHLIGHT_BASE_POS.z);
  flashlightModel.rotation.set(FLASHLIGHT_BASE_ROT.x, FLASHLIGHT_BASE_ROT.y, FLASHLIGHT_BASE_ROT.z);
  camera.add(flashlightModel);
  if (typeof updateEquippedView === 'function') updateEquippedView();
}, undefined, (e) => console.error('flashlight:', e));

var pistolModel = null;
new THREE.GLTFLoader().load(PISTOL_PATH, (gltf) => {
  pistolModel = gltf.scene;
  const box = new THREE.Box3().setFromObject(pistolModel);
  const size = new THREE.Vector3(); box.getSize(size);
  const autoScale = PISTOL_TARGET_SIZE / Math.max(size.x, size.y, size.z);
  pistolModel.scale.setScalar(autoScale);
  pistolModel.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of mats) {
      if (!mat) continue;
      if (mat.transparent) { mat.transparent = false; mat.depthWrite = true; mat.needsUpdate = true; }
    }
  });
  pistolModel.position.set(PISTOL_BASE_POS.x, PISTOL_BASE_POS.y, PISTOL_BASE_POS.z);
  pistolModel.rotation.set(PISTOL_BASE_ROT.x, PISTOL_BASE_ROT.y, PISTOL_BASE_ROT.z);
  pistolModel.visible = false;
  camera.add(pistolModel);
  if (typeof updateEquippedView === 'function') updateEquippedView();
}, undefined, (e) => console.error('pistol:', e));

// ============================================================
// SHADOW QUALITY
// ============================================================
function applyShadowQuality() {
  if (REALISTIC_SHADOWS) {
    FLASHLIGHT_SHADOW_RES = 1024;
    FLASHLIGHT_SHADOW_FAR = 40;
    flashlight.shadow.mapSize.set(1024, 1024);
    if (flashlight.shadow.map) { flashlight.shadow.map.dispose(); flashlight.shadow.map = null; }
    flashlight.shadow.camera.far = 40;
    flashlight.shadow.camera.updateProjectionMatrix();
    flashlight.shadow.bias = -0.0008;
    if ('normalBias' in flashlight.shadow) flashlight.shadow.normalBias = 0.02;
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; }
    const S = 55;
    sunLight.shadow.camera.left = -S;
    sunLight.shadow.camera.right = S;
    sunLight.shadow.camera.top = S;
    sunLight.shadow.camera.bottom = -S;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 220;
    sunLight.shadow.camera.updateProjectionMatrix();
    sunLight.shadow.bias = -0.0008;
    if ('normalBias' in sunLight.shadow) sunLight.shadow.normalBias = 0.04;
  } else {
    FLASHLIGHT_SHADOW_RES = 512;
    FLASHLIGHT_SHADOW_FAR = 22;
    flashlight.shadow.mapSize.set(512, 512);
    if (flashlight.shadow.map) { flashlight.shadow.map.dispose(); flashlight.shadow.map = null; }
    flashlight.shadow.camera.far = 22;
    flashlight.shadow.camera.updateProjectionMatrix();
    flashlight.shadow.bias = 0;
    if ('normalBias' in flashlight.shadow) flashlight.shadow.normalBias = 0;
    sunLight.castShadow = false;
  }
}
applyShadowQuality();

// ============================================================
// TREES
// ============================================================
var TREES = [];
const CHUNK_SIZE = (MAP_HALF * 2) / CHUNK_GRID;
var treeChunks = [];
for (let cx = 0; cx < CHUNK_GRID; cx++) {
  treeChunks[cx] = [];
  for (let cz = 0; cz < CHUNK_GRID; cz++) {
    treeChunks[cx][cz] = {
      instMeshes: [],
      centerX: -MAP_HALF + (cx + 0.5) * CHUNK_SIZE,
      centerZ: -MAP_HALF + (cz + 0.5) * CHUNK_SIZE,
    };
  }
}
function chunkIndexForCoord(v) {
  const idx = Math.floor((v + MAP_HALF) / CHUNK_SIZE);
  return Math.max(0, Math.min(CHUNK_GRID - 1, idx));
}
function treeTooCloseToCave(x, z) {
  const dx = x - CAVE_POSITION.x, dz = z - CAVE_POSITION.z;
  return dx * dx + dz * dz < 64;
}
function treeTooCloseToSpawn(x, z) {
  const dx = x - PLAYER_SPAWN.x, dz = z - PLAYER_SPAWN.z;
  if (dx * dx + dz * dz < SPAWN_CLEAR_RADIUS * SPAWN_CLEAR_RADIUS) return true;
  const sdx = x - SHOP_POSITION.x, sdz = z - SHOP_POSITION.z;
  if (sdx * sdx + sdz * sdz < 36) return true;
  return false;
}
function tryPlaceTree() {
  for (let a = 0; a < TREE_PLACEMENT_TRIES; a++) {
    const x = (Math.random() - 0.5) * 2 * MAP_HALF;
    const z = (Math.random() - 0.5) * 2 * MAP_HALF;
    if (treeTooCloseToSpawn(x, z)) continue;
    if (treeTooCloseToCave(x, z)) continue;
    let blocked = false;
    for (let i = 0; i < TREES.length; i++) {
      const tt = TREES[i];
      const dx = x - tt.x, dz = z - tt.z;
      if (dx * dx + dz * dz < MIN_TREE_DIST * MIN_TREE_DIST) { blocked = true; break; }
    }
    if (blocked) continue;
    return { x, z };
  }
  return null;
}
function buildSimpleTreeTemplate() {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.55, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 1.0, flatShading: true })
  );
  trunk.position.y = 3; trunk.castShadow = true; trunk.receiveShadow = true;
  group.add(trunk);
  const top = new THREE.Mesh(
    new THREE.ConeGeometry(2.4, 5.5, 7),
    new THREE.MeshStandardMaterial({ color: 0x2d5a2d, roughness: 1.0, flatShading: true })
  );
  top.position.y = 8.5; top.castShadow = true; top.receiveShadow = true;
  group.add(top);
  group.updateMatrixWorld(true);
  return group;
}
function processTemplate(template) {
  const rawBox = new THREE.Box3().setFromObject(template);
  const rawSize = new THREE.Vector3(); rawBox.getSize(rawSize);
  const baseScale = PINE_TARGET_HEIGHT / rawSize.y;
  const rawMinY = rawBox.min.y;
  const subMeshes = [];
  template.traverse(o => {
    if (o.isMesh) subMeshes.push({ geometry: o.geometry, material: o.material, localMatrix: o.matrixWorld.clone() });
  });
  const chunkPlacements = [];
  for (let cx = 0; cx < CHUNK_GRID; cx++) {
    chunkPlacements[cx] = [];
    for (let cz = 0; cz < CHUNK_GRID; cz++) chunkPlacements[cx][cz] = [];
  }
  let placed = 0;
  for (let i = 0; i < TREE_COUNT; i++) {
    const pos = tryPlaceTree(); if (!pos) continue;
    const sizeMul = 1 + (Math.random() * 2 - 1) * PINE_HEIGHT_VARIANCE;
    const scale = baseScale * sizeMul;
    const height = PINE_TARGET_HEIGHT * sizeMul;
    const rotY = Math.random() * Math.PI * 2;
    const yPos = PINE_Y_OFFSET - rawMinY * scale;
    const cx = chunkIndexForCoord(pos.x), cz = chunkIndexForCoord(pos.z);
    chunkPlacements[cx][cz].push({ x: pos.x, y: yPos, z: pos.z, scale, rotY });
    TREES.push({ x: pos.x, z: pos.z, radius: height * TREE_COLLIDER_MULT });
    placed++;
  }
  const dummy = new THREE.Object3D();
  const tmpMat = new THREE.Matrix4();
  for (let cx = 0; cx < CHUNK_GRID; cx++) {
    for (let cz = 0; cz < CHUNK_GRID; cz++) {
      const placements = chunkPlacements[cx][cz];
      if (placements.length === 0) continue;
      for (const sm of subMeshes) {
        const inst = new THREE.InstancedMesh(sm.geometry, sm.material, placements.length);
        inst.castShadow = true; inst.receiveShadow = true;
        inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        inst.frustumCulled = false;
        for (let i = 0; i < placements.length; i++) {
          const p = placements[i];
          dummy.position.set(p.x, p.y, p.z);
          dummy.rotation.set(0, p.rotY, 0);
          dummy.scale.setScalar(p.scale);
          dummy.updateMatrix();
          tmpMat.multiplyMatrices(dummy.matrix, sm.localMatrix);
          inst.setMatrixAt(i, tmpMat);
        }
        inst.instanceMatrix.needsUpdate = true;
        treeChunks[cx][cz].instMeshes.push(inst);
        scene.add(inst);
      }
    }
  }
  console.log(`Planted ${placed} pines`);
}

if (LOW_DETAIL) {
  processTemplate(buildSimpleTreeTemplate());
} else {
  new THREE.GLTFLoader().load(PINE_PATH, (gltf) => {
    gltf.scene.updateMatrixWorld(true);
    processTemplate(gltf.scene);
  }, undefined, (e) => console.error('pine:', e));
}

// ============================================================
// BUSHES
// ============================================================
var BUSHES = [];
if (LOW_DETAIL) {
  console.log('🌿 Bushes skipped (low detail)');
} else if (!BUSHES_ENABLED) {
  console.log('🌿 Bushes skipped (user disabled)');
} else {
  function tryPlaceBush() {
    for (let a = 0; a < BUSH_PLACEMENT_TRIES; a++) {
      const x = (Math.random() - 0.5) * 2 * MAP_HALF;
      const z = (Math.random() - 0.5) * 2 * MAP_HALF;
      if (treeTooCloseToSpawn(x, z)) continue;
      if (treeTooCloseToCave(x, z)) continue;
      let blocked = false;
      for (let i = 0; i < BUSHES.length; i++) {
        const b = BUSHES[i];
        const dx = x - b.x, dz = z - b.z;
        if (dx * dx + dz * dz < MIN_BUSH_DIST * MIN_BUSH_DIST) { blocked = true; break; }
      }
      if (blocked) continue;
      return { x, z };
    }
    return null;
  }
  new THREE.GLTFLoader().load(BUSH_PATH, (gltf) => {
    const template = gltf.scene;
    template.updateMatrixWorld(true);
    const rawBox = new THREE.Box3().setFromObject(template);
    const rawSize = new THREE.Vector3(); rawBox.getSize(rawSize);
    const baseScale = BUSH_TARGET_HEIGHT / rawSize.y;
    const rawMinY = rawBox.min.y;
    const subMeshes = [];
    template.traverse(o => { if (o.isMesh) subMeshes.push({ geometry: o.geometry, material: o.material, localMatrix: o.matrixWorld.clone() }); });
    const placements = [];
    for (let i = 0; i < BUSH_COUNT; i++) {
      const pos = tryPlaceBush(); if (!pos) continue;
      const sizeMul = 1 + (Math.random() * 2 - 1) * BUSH_HEIGHT_VARIANCE;
      const scale = baseScale * sizeMul;
      const rotY = Math.random() * Math.PI * 2;
      const yPos = -rawMinY * scale;
      placements.push({ x: pos.x, y: yPos, z: pos.z, scale, rotY });
      BUSHES.push({ x: pos.x, z: pos.z });
    }
    const dummy = new THREE.Object3D();
    const tmpMat = new THREE.Matrix4();
    for (const sm of subMeshes) {
      const inst = new THREE.InstancedMesh(sm.geometry, sm.material, placements.length);
      inst.castShadow = false; inst.receiveShadow = false;
      inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      inst.frustumCulled = false;
      for (let i = 0; i < placements.length; i++) {
        const p = placements[i];
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, p.rotY, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        tmpMat.multiplyMatrices(dummy.matrix, sm.localMatrix);
        inst.setMatrixAt(i, tmpMat);
      }
      inst.instanceMatrix.needsUpdate = true;
      scene.add(inst);
    }
    console.log(`Planted ${placements.length} bushes`);
  }, undefined, (e) => console.error('bush:', e));
}

// ============================================================
// CULLING
// ============================================================
var cullFrameCounter = 0;
var TREE_VIEW_DIST_SQ = TREE_VIEW_DIST * TREE_VIEW_DIST;
var TREE_SHADOW_DIST_SQ = TREE_SHADOW_DIST * TREE_SHADOW_DIST;
const _cullFrustum = new THREE.Frustum();
const _cullProjMatrix = new THREE.Matrix4();
const _cullSphere = new THREE.Sphere(new THREE.Vector3(), 0);
const CHUNK_BOUND_RADIUS = Math.sqrt(CHUNK_SIZE * CHUNK_SIZE * 2) * 0.5 + 8;

function cullScenery() {
  cullFrameCounter++;
  if (cullFrameCounter % CULL_INTERVAL !== 0) return;
  _cullProjMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _cullFrustum.setFromProjectionMatrix(_cullProjMatrix);
  const px = camera.position.x, pz = camera.position.z;
  for (let cx = 0; cx < CHUNK_GRID; cx++) {
    for (let cz = 0; cz < CHUNK_GRID; cz++) {
      const chunk = treeChunks[cx][cz];
      if (chunk.instMeshes.length === 0) continue;
      const dx = chunk.centerX - px, dz = chunk.centerZ - pz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= TREE_VIEW_DIST_SQ) {
        for (const m of chunk.instMeshes) m.visible = false;
        continue;
      }
      _cullSphere.center.set(chunk.centerX, 4, chunk.centerZ);
      _cullSphere.radius = CHUNK_BOUND_RADIUS;
      const inFrustum = _cullFrustum.intersectsSphere(_cullSphere);
      const castsShadow = d2 < TREE_SHADOW_DIST_SQ;
      for (const m of chunk.instMeshes) {
        m.visible = inFrustum;
        m.castShadow = castsShadow && inFrustum;
      }
    }
  }
}

// ============================================================
// COLLISION
// ============================================================
var caveBlockBox = null;
function isBlocked(newX, newZ, oldX, oldZ) {
  for (let i = 0; i < TREES.length; i++) {
    const tt = TREES[i];
    const dx = newX - tt.x, dz = newZ - tt.z;
    const minDist = tt.radius + PLAYER_RADIUS;
    if (dx * dx + dz * dz < minDist * minDist) return true;
  }
  if (caveBlockBox) {
    const insideNew = newX > caveBlockBox.min.x && newX < caveBlockBox.max.x && newZ > caveBlockBox.min.z && newZ < caveBlockBox.max.z;
    if (insideNew) {
      const insideOld = oldX > caveBlockBox.min.x && oldX < caveBlockBox.max.x && oldZ > caveBlockBox.min.z && oldZ < caveBlockBox.max.z;
      if (!insideOld) return true;
    }
  }
  return false;
}

// ============================================================
// CAVE + WAYPOINTS
// ============================================================
var caveGroup = new THREE.Group();
caveGroup.position.set(CAVE_POSITION.x, CAVE_POSITION.y, CAVE_POSITION.z);
caveGroup.rotation.y = CAVE_ROTATION_Y;
scene.add(caveGroup);

var entranceMarker = new THREE.Mesh(
  new THREE.BoxGeometry(3, 3, 3),
  new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.35, depthWrite: false })
);
entranceMarker.position.set(ENTRANCE_OFFSET.x, ENTRANCE_OFFSET.y, ENTRANCE_OFFSET.z);
caveGroup.add(entranceMarker);

var entranceOutline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(3, 3, 3)),
  new THREE.LineBasicMaterial({ color: 0x00ff00 })
);
entranceOutline.position.copy(entranceMarker.position);
caveGroup.add(entranceOutline);

var entranceWaypoint = new THREE.Vector3(CAVE_POSITION.x, 0, CAVE_POSITION.z + 10);
var insideWaypoint = new THREE.Vector3(CAVE_POSITION.x, 0, CAVE_POSITION.z);
try {
  const e = localStorage.getItem('rake_entrance_wp');
  const i = localStorage.getItem('rake_inside_wp');
  if (e) { const p = JSON.parse(e); entranceWaypoint.set(p.x, p.y, p.z); }
  if (i) { const p = JSON.parse(i); insideWaypoint.set(p.x, p.y, p.z); }
} catch (err) {}

var entranceWpMarker = new THREE.Mesh(
  new THREE.BoxGeometry(2, 2, 2),
  new THREE.MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.4, depthWrite: false })
);
entranceWpMarker.position.copy(entranceWaypoint);
entranceWpMarker.visible = false;
scene.add(entranceWpMarker);

var insideWpMarker = new THREE.Mesh(
  new THREE.BoxGeometry(2, 2, 2),
  new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.4, depthWrite: false })
);
insideWpMarker.position.copy(insideWaypoint);
insideWpMarker.visible = false;
scene.add(insideWpMarker);

function saveWaypoints() {
  try {
    localStorage.setItem('rake_entrance_wp', JSON.stringify({ x: entranceWaypoint.x, y: entranceWaypoint.y, z: entranceWaypoint.z }));
    localStorage.setItem('rake_inside_wp', JSON.stringify({ x: insideWaypoint.x, y: insideWaypoint.y, z: insideWaypoint.z }));
  } catch (err) {}
}
function setEntranceWaypoint(x, y, z) {
  entranceWaypoint.set(x, y, z);
  entranceWpMarker.position.copy(entranceWaypoint);
  saveWaypoints();
  console.log(`🔵 Entrance wp (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
}
function setInsideWaypoint(x, y, z) {
  insideWaypoint.set(x, y, z);
  insideWpMarker.position.copy(insideWaypoint);
  saveWaypoints();
  console.log(`🟣 Inside wp (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
}

new THREE.GLTFLoader().load(CAVE_PATH, (gltf) => {
  const cave = gltf.scene;
  cave.scale.setScalar(CAVE_SCALE);
  cave.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  caveGroup.add(cave);
  caveGroup.updateMatrixWorld(true);
  caveBlockBox = new THREE.Box3().setFromObject(cave);
  console.log('=== CAVE loaded ===');
}, undefined, (e) => console.error('cave:', e));
