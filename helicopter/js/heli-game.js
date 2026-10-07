// Jayhawk Rescue — standalone helicopter rescue game over Sitka Sound.
// Arcade helicopter controls, procedural distress calls, hover-to-rescue.
import * as THREE from 'three';
import { createRenderer, createScene, createCamera } from '../../js/scene/SceneSetup.js';
import GeoTerrainManager from '../../js/terrain/GeoTerrainManager.js';
import { buildPlane } from '../../js/aircraft/planes/PlaneFactory.js';
import { detectTileMode } from '../../js/geo/TileUrls.js';
import { CONFIG } from '../../js/utils/config.js';

const SITKA_LAT = 57.0472, SITKA_LON = -135.3619;
const WATER_LEVEL = 1.0;
const MAX_SPEED = 42;          // m/s horizontal
const MAX_ALT = 300;           // m, altitude slider range
const RESCUE_RADIUS = 30;      // m horizontal
const RESCUE_ALT_MIN = 4, RESCUE_ALT_MAX = 26;
const RESCUE_TIME = 8;         // seconds of hover

const $ = (id) => document.getElementById(id);

// ---------- game state ----------
const G = {
  booted: false, bootT: 0,
  pos: new THREE.Vector3(0, 60, 0), vel: new THREE.Vector3(),
  yaw: 0, targetAlt: 60,
  rescues: 0, score: 0, clock: 0, clockRunning: false,
  phase: 'ready',          // ready | waiting | active | done | crashed
  phaseT: 0, callAt: 0,
  boat: null, rescueT: 0,
  crashT: 0,
  input: { sx: 0, sy: 0, yawIn: 0, keys: {} },
};

const BOAT_NAMES = ['F/V Kittiwake', 'M/V Sea Star', 'F/V Northern Light', 'S/V Windward', 'M/V Halibut King', 'F/V Storm Petrel'];
const PROBLEMS = ['FIRE ON BOARD', 'TAKING ON WATER', 'MEDICAL EMERGENCY', 'ENGINE FAILURE', 'LOST IN FOG'];

let renderer, scene, camera, terrain, heli, rotor, winchLine;
const _fwd = new THREE.Vector3(), _camDes = new THREE.Vector3(), _look = new THREE.Vector3();

// ---------- helpers ----------
function fmtTime(s) {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
function compass(deg) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
}
function centerMsg(text, cls = '', ms = 0) {
  const el = $('center-msg');
  el.textContent = text; el.className = 'show ' + cls;
  if (ms > 0) setTimeout(() => { if (el.textContent === text) el.className = ''; }, ms);
}
function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2, ...opts });
}

// ---------- boat ----------
function makeLabelSprite(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(40,0,0,0.75)';
  if (x.roundRect) { x.beginPath(); x.roundRect(6, 6, 500, 116, 24); x.fill(); }
  else { x.fillRect(6, 6, 500, 116); }
  x.strokeStyle = '#ff5a5a'; x.lineWidth = 6; x.stroke();
  x.fillStyle = '#ffd9d9'; x.font = 'bold 52px sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(60, 15, 1);
  return sp;
}

function spawnBoat() {
  // Find water within 1.5–6 km of base
  let bx = 0, bz = 0, ok = false;
  for (let i = 0; i < 60 && !ok; i++) {
    const a = Math.random() * Math.PI * 2, d = 1500 + Math.random() * 4500;
    bx = Math.cos(a) * d; bz = Math.sin(a) * d;
    try { ok = terrain.getGroundElevation(bx, bz) <= 0; } catch { ok = false; }
  }
  if (!ok) { bx = 2500; bz = -1500; }
  const g = new THREE.Group();
  const hullColor = [0x7a1f1f, 0x1f4d7a, 0x2d6a2d, 0x555560][Math.floor(Math.random() * 4)];
  const hull = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 5), mat(hullColor));
  hull.position.y = 1; g.add(hull);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 4, 3, 1), mat(hullColor));
  bow.rotation.y = Math.PI; bow.position.set(8.2, 1, 0); bow.scale.z = 1; g.add(bow);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(5, 3.5, 4), mat(0xe8e4da));
  cabin.position.set(-2, 4.5, 0); g.add(cabin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7), mat(0x888888));
  mast.position.set(-2, 9, 0); g.add(mast);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), lampMat);
  lamp.position.set(-2, 12.8, 0); g.add(lamp);
  const name = BOAT_NAMES[Math.floor(Math.random() * BOAT_NAMES.length)];
  const problem = PROBLEMS[Math.floor(Math.random() * PROBLEMS.length)];
  const label = makeLabelSprite(problem);
  label.position.y = 24; g.add(label);
  g.position.set(bx, 0, bz);
  g.rotation.y = Math.random() * Math.PI * 2;
  scene.add(g);
  return { group: g, lampMat, label, name, problem, x: bx, z: bz, born: performance.now() };
}

function removeBoat(b) {
  if (!b) return;
  scene.remove(b.group);
  b.label.material.map.dispose(); b.label.material.dispose();
}

// ---------- distress state machine ----------
function issueCall() {
  G.boat = spawnBoat();
  G.phase = 'active'; G.phaseT = 0; G.rescueT = 0;
  G.clockRunning = true;
  const dx = G.boat.x - G.pos.x, dz = G.boat.z - G.pos.z;
  const km = Math.hypot(dx, dz) / 1000;
  $('distress-title').textContent = `\u{1F6A8} DISTRESS — ${G.boat.name}`;
  $('distress-sub').textContent = `${G.boat.problem} — ${km.toFixed(1)} km away`;
  $('distress-banner').classList.add('show');
  $('bearing-wrap').classList.add('show');
  centerMsg(`DISTRESS CALL\n${G.boat.problem}`, '', 2200);
}

function completeRescue() {
  const elapsed = (performance.now() - G.boat.born) / 1000;
  const bonus = Math.max(0, Math.round(200 - elapsed * 2));
  const pts = 100 + bonus;
  G.rescues++; G.score += pts;
  $('distress-banner').classList.remove('show');
  $('bearing-wrap').classList.remove('show');
  $('rescue-wrap').classList.remove('show');
  winchLine.visible = false;
  centerMsg(`RESCUED!\n+${pts} pts`, '', 2500);
  removeBoat(G.boat); G.boat = null;
  G.phase = 'waiting'; G.phaseT = 0;
}

function crash() {
  G.phase = 'crashed'; G.crashT = 0;
  $('rescue-wrap').classList.remove('show');
  winchLine.visible = false;
  centerMsg('CRASHED!', 'crash', 2200);
}

function respawn() {
  G.pos.set(0, 60, 0); G.vel.set(0, 0, 0);
  G.yaw = 0; G.targetAlt = 60;
  if (G.boat) { removeBoat(G.boat); G.boat = null; }
  $('distress-banner').classList.remove('show');
  $('bearing-wrap').classList.remove('show');
  G.phase = 'waiting'; G.phaseT = 0;
  centerMsg('BACK AT BASE\nStand by for distress calls', '', 2200);
}

// ---------- input: touch ----------
function setupTouch() {
  const base = $('tc-stick-base'), knob = $('tc-stick-knob');
  const slider = $('alt-slider'), altKnob = $('alt-knob');
  let stickId = null, ox = 0, oy = 0, yawId = null, lastYawX = 0, sliderId = null;
  const setKnob = (t) => {
    const h = slider.clientHeight - 44;
    altKnob.style.top = `${4 + (1 - t) * h}px`;
  };
  setKnob(G.targetAlt / MAX_ALT);

  const onStart = (e) => {
    for (const t of e.changedTouches) {
      const x = t.clientX, y = t.clientY;
      const sr = slider.getBoundingClientRect();
      if (x >= sr.left - 20 && x <= sr.right + 20 && y >= sr.top - 20 && y <= sr.bottom + 20) {
        sliderId = t.identifier; moveSlider(t); continue;
      }
      if (x < window.innerWidth * 0.45 && stickId === null) {
        stickId = t.identifier; ox = x; oy = y;
        base.style.display = 'block';
        base.style.left = `${x - 60}px`; base.style.top = `${y - 60}px`;
        knob.style.transform = 'translate(-50%,-50%)';
      } else if (yawId === null) {
        yawId = t.identifier; lastYawX = x;
      }
    }
    e.preventDefault();
  };
  const moveSlider = (t) => {
    const sr = slider.getBoundingClientRect();
    const tt = Math.min(1, Math.max(0, 1 - (t.clientY - sr.top) / sr.height));
    G.targetAlt = tt * MAX_ALT; setKnob(tt);
  };
  const onMove = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        let dx = (t.clientX - ox) / 50, dy = (t.clientY - oy) / 50;
        const m = Math.hypot(dx, dy);
        if (m > 1) { dx /= m; dy /= m; }
        G.input.sx = dx; G.input.sy = -dy;
        knob.style.transform = `translate(calc(-50% + ${dx * 34}px), calc(-50% + ${-dy * 34}px))`;
      } else if (t.identifier === sliderId) {
        moveSlider(t);
      } else if (t.identifier === yawId) {
        G.input.yawIn = Math.max(-1, Math.min(1, (t.clientX - lastYawX) / 60));
      }
    }
    e.preventDefault();
  };
  const onEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) { stickId = null; G.input.sx = 0; G.input.sy = 0; base.style.display = 'none'; }
      if (t.identifier === yawId) { yawId = null; G.input.yawIn = 0; }
      if (t.identifier === sliderId) { sliderId = null; }
    }
  };
  document.addEventListener('touchstart', onStart, { passive: false });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
  document.addEventListener('touchcancel', onEnd);
}

// ---------- input: keyboard ----------
function setupKeys() {
  const k = G.input.keys;
  addEventListener('keydown', (e) => { k[e.code] = true; });
  addEventListener('keyup', (e) => { k[e.code] = false; });
}

// ---------- init ----------
async function init() {
  try { await detectTileMode(); } catch { /* direct mode fallback */ }
  renderer = await Promise.race([
    createRenderer(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Renderer timed out (30s)')), 30000)),
  ]);
  const s = createScene();
  scene = s.scene;
  camera = createCamera();
  camera.position.set(0, 120, 60);

  terrain = new GeoTerrainManager(scene, renderer);
  CONFIG.lat = SITKA_LAT; CONFIG.lon = SITKA_LON;
  terrain.init(SITKA_LAT, SITKA_LON);

  const { group } = buildPlane('jayhawk');
  heli = group; rotor = group.userData.rotor;
  heli.position.copy(G.pos);
  scene.add(heli);

  // Winch line (hidden until rescue)
  const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  winchLine = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x7df9ff }));
  winchLine.visible = false; winchLine.frustumCulled = false;
  scene.add(winchLine);

  setupTouch(); setupKeys();
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  G.bootT = performance.now();
  G.phase = 'ready'; G.phaseT = 0;
  centerMsg('RESCUE READY\nAwaiting distress call\u2026');
  requestAnimationFrame(loop);
}

// ---------- per-frame ----------
let lastT = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;

  // Boot: dismiss once terrain tiles are in
  if (!G.booted) {
    const n = terrain.countVisibleTiles();
    const el = $('boot-status');
    if (el && n < 7) el.textContent = `Loading Sitka\u2026 (${n} terrain tiles)`;
    if (n >= 7 || performance.now() - G.bootT > 30000) {
      G.booted = true;
      $('boot-overlay').classList.add('hidden');
    }
  }
  terrain.update(camera.position);

  // Rotor always spins
  if (rotor) rotor.rotation.y += dt * 28;

  if (G.phase !== 'crashed') {
    stepHeli(dt);
    stepCamera(dt);
    stepMission(dt);
  } else {
    G.crashT += dt;
    if (G.crashT > 2.4) respawn();
  }

  // Boat bobbing + distress lamp
  if (G.boat) {
    const b = G.boat, tt = t / 1000;
    b.group.position.y = Math.sin(tt * 1.3) * 0.6;
    b.group.rotation.z = Math.sin(tt * 0.9) * 0.04;
    b.group.rotation.x = Math.cos(tt * 1.1) * 0.03;
    b.lampMat.color.setHex(Math.sin(tt * 8) > 0 ? 0xff2222 : 0x551111);
  }

  if (G.clockRunning) $('hud-time').textContent = fmtTime(G.clock += dt);
  renderer.render(scene, camera);
}

function stepHeli(dt) {
  const inp = G.input, k = inp.keys;
  // Keyboard merges into stick/yaw/alt
  let kx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
  let ky = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
  let kyaw = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0);
  if (k.KeyR || k.KeyE) G.targetAlt = Math.min(MAX_ALT, G.targetAlt + 120 * dt);
  if (k.KeyF || k.KeyQ) G.targetAlt = Math.max(0, G.targetAlt - 120 * dt);
  const sx = Math.max(-1, Math.min(1, inp.sx + kx));
  const sy = Math.max(-1, Math.min(1, inp.sy + ky));
  const yawIn = Math.max(-1, Math.min(1, inp.yawIn + kyaw));

  G.yaw -= yawIn * 1.6 * dt;
  const sin = Math.sin(G.yaw), cos = Math.cos(G.yaw);
  // Desired velocity in world space (stick relative to heading)
  _fwd.set(sx * cos - sy * sin, 0, -sx * sin - sy * cos);
  const des = _fwd.multiplyScalar(MAX_SPEED * Math.min(1, Math.hypot(sx, sy)));
  G.vel.x += (des.x - G.vel.x) * Math.min(1, dt * 2.2);
  G.vel.z += (des.z - G.vel.z) * Math.min(1, dt * 2.2);
  G.pos.x += G.vel.x * dt;
  G.pos.z += G.vel.z * dt;
  // Altitude eases toward slider target
  G.pos.y += (G.targetAlt - G.pos.y) * Math.min(1, dt * 1.6);

  // Pose: yaw + tilt into motion
  const fSpeed = G.vel.x * -sin + G.vel.z * -cos;   // forward component
  const sSpeed = G.vel.x * cos - G.vel.z * sin;     // strafe component
  heli.position.copy(G.pos);
  heli.rotation.set(0, G.yaw, 0);
  heli.rotateX(Math.max(-0.35, Math.min(0.35, fSpeed / MAX_SPEED * 0.4)));
  heli.rotateZ(Math.max(-0.35, Math.min(0.35, -sSpeed / MAX_SPEED * 0.4)));

  $('hud-alt').textContent = `ALT ${Math.round(G.pos.y)}m`;

  // Crash: below surface (terrain or sea)
  let ground = 0;
  try { ground = Math.max(terrain.getGroundElevation(G.pos.x, G.pos.z), 0); } catch { /* */ }
  if (G.pos.y < ground + 2) crash();
}

function stepCamera(dt) {
  const sin = Math.sin(G.yaw), cos = Math.cos(G.yaw);
  _camDes.set(G.pos.x + sin * 30, G.pos.y + 13, G.pos.z + cos * 30);
  camera.position.lerp(_camDes, Math.min(1, dt * 3.5));
  _look.set(G.pos.x, G.pos.y + 3, G.pos.z);
  camera.lookAt(_look);
}

function stepMission(dt) {
  if (G.phase === 'ready') {
    G.phaseT += dt;
    if (G.phaseT > 3) { G.phase = 'waiting'; G.phaseT = 0; }
  } else if (G.phase === 'waiting') {
    G.phaseT += dt;
    if (G.phaseT > 5) issueCall();
  } else if (G.phase === 'active' && G.boat) {
    const dx = G.boat.x - G.pos.x, dz = G.boat.z - G.pos.z;
    const hd = Math.hypot(dx, dz);
    // Bearing arrow: world bearing minus camera yaw
    const bearing = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
    const camYawDeg = ((-G.yaw) * 180 / Math.PI % 360 + 360) % 360;
    $('bearing-arrow').style.transform = `rotate(${bearing - camYawDeg - 90}deg)`;
    $('bearing-dist').textContent = `${(hd / 1000).toFixed(1)} km ${compass(bearing)}`;
    $('distress-sub').textContent = `${G.boat.problem} — ${(hd / 1000).toFixed(1)} km ${compass(bearing)}`;

    const inZone = hd < RESCUE_RADIUS && G.pos.y > RESCUE_ALT_MIN && G.pos.y < RESCUE_ALT_MAX;
    if (inZone) {
      G.rescueT += dt;
      $('rescue-wrap').classList.add('show');
      $('rescue-bar').style.width = `${(G.rescueT / RESCUE_TIME) * 100}%`;
      // Winch line from belly to boat
      const p = winchLine.geometry.attributes.position;
      p.setXYZ(0, G.pos.x, G.pos.y - 2, G.pos.z);
      p.setXYZ(1, G.boat.x, 2, G.boat.z);
      p.needsUpdate = true;
      winchLine.visible = true;
      if (G.rescueT >= RESCUE_TIME) completeRescue();
    } else {
      G.rescueT = 0;
      $('rescue-bar').style.width = '0%';
      $('rescue-wrap').classList.remove('show'); winchLine.visible = false;
    }
  }
  $('hud-rescues').textContent = `RESCUES ${G.rescues}`;
  $('hud-score').textContent = `SCORE ${G.score}`;
}

init().catch((err) => {
  console.error('Heli game failed to start:', err);
  const el = $('boot-status');
  if (el) el.textContent = 'Could not start: ' + (err && err.message ? err.message : err);
});
