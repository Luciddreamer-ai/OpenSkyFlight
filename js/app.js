import * as THREE from 'three';
import { CONFIG, onChange, update } from './utils/config.js';
import {
  CLOUD_RENDER_ORDER,
  REALWORLD_FAR_PLANE,
  CLIP_PLANE_EPSILON,
} from './constants/rendering.js';
import { REALWORLD_START_ALTITUDE, DEFAULT_NEAR, MAX_ROLL, ROLL_SENSITIVITY, ROLL_DAMP_SPEED } from './constants/camera.js';
import { MAX_DELTA_TIME } from './constants/physics.js';
import { createRenderer, createScene, createCamera, setupResizeHandler } from './scene/SceneSetup.js';
import AdaptiveQualityManager from './rendering/AdaptiveQualityManager.js';
import InputManager from './input/InputManager.js';
import TouchControls from './input/TouchControls.js';
import GeoTerrainManager from './terrain/GeoTerrainManager.js';
import FlightController from './camera/FlightController.js';
import ControlPanel from './ui/ControlPanel.js';
import HUD from './ui/HUD.js';
import Minimap from './ui/Minimap.js';
import Logger from './utils/Logger.js';
import { showNotification } from './ui/Notification.js';
import AtmosphericSky from './atmosphere/AtmosphericSky.js';
import CloudLayer from './atmosphere/CloudLayer.js';
import BenchmarkRunner from './benchmark/BenchmarkRunner.js';
import BenchmarkComparator from './benchmark/BenchmarkComparator.js';
import GPUTimer from './benchmark/GPUTimer.js';
import AircraftManager from './aircraft/AircraftManager.js';
import ChaseCameraController from './camera/ChaseCameraController.js';
import FlightPlanRecorder from './flightplan/FlightPlanRecorder.js';
import Stats from 'stats.js';
import { detectTileMode, getTileMode } from './geo/TileUrls.js';

async function initApp() {
  // --- Core scene ---
  // Guard against a hung GPU backend: surface a visible error instead of
  // leaving the boot overlay on "Initializing…" forever.
  const renderer = await Promise.race([
    createRenderer(),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Renderer init timed out after 30s — this browser did not provide a usable GPU context.')),
        30000,
      ),
    ),
  ]);
  const { scene, dirLight, ambientLight } = createScene();
  const camera = createCamera();

  // --- Atmosphere ---
  // Side-effect: registers itself with scene, dirLight, and ambientLight
  new AtmosphericSky(scene, dirLight, ambientLight);
  const cloudLayer = new CloudLayer(scene);
  cloudLayer.mesh.renderOrder = CLOUD_RENDER_ORDER;

  // --- Terrain ---
  // Resolve tile serving mode first: local caching proxy vs direct upstream
  // fetches (direct mode is what makes GitHub Pages / iPad work).
  await detectTileMode();
  Logger.info('App', `Tile mode: ${getTileMode()}`);
  const geoTerrainManager = new GeoTerrainManager(scene, renderer);
  geoTerrainManager.init(CONFIG.lat, CONFIG.lon);

  // --- Controllers ---
  const flightController = new FlightController(camera, renderer.domElement);
  const chaseCameraController = new ChaseCameraController();
  const _qRoll = new THREE.Quaternion();
  const _axisZ = new THREE.Vector3(0, 0, 1);
  const _autopilotEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const _autopilotQuat = new THREE.Quaternion();
  const _terrainFwd = new THREE.Vector3();
  const TERRAIN_CLEARANCE_M = 60; // minimum AGL the terrain floor enforces
  const TERRAIN_LOOKAHEAD_M = 600; // sample ground this far ahead of the nose
  const aircraftManager = new AircraftManager(scene);
  aircraftManager.load('assets/models/rafale/Rafale.gltf').catch((err) => {
    Logger.warn('App', 'Failed to load Rafale model: ' + err.message);
  });

  // --- Systems ---
  const benchmarkRunner = new BenchmarkRunner();
  const gpuTimer = new GPUTimer(renderer);
  const flightPlanRecorder = new FlightPlanRecorder();
  const adaptiveQuality = new AdaptiveQualityManager(renderer);

  // --- Ground elevation ---
  let groundElevation = 0;

  // --- Stats.js ---
  const stats = new Stats();
  const gpuPanel = new Stats.Panel('GPU', '#ff9933', '#331100');
  stats.addPanel(gpuPanel);
  stats.showPanel(0);
  stats.dom.style.position = 'fixed';
  stats.dom.style.top = '0px';
  stats.dom.style.left = '0px';
  stats.dom.style.zIndex = '30';
  stats.dom.style.display = 'none';
  document.body.appendChild(stats.dom);

  // --- UI ---
  const hud = new HUD(document.getElementById('hud'));
  const minimap = new Minimap(document.getElementById('minimap'), geoTerrainManager);
  minimap.setFlightPlanRecorder(flightPlanRecorder);
  const hudCanvas = document.getElementById('hud');

  // --- Control Panel ---
  function regenerate() {
    geoTerrainManager.reinit();
    flightController.position.set(0, REALWORLD_START_ALTITUDE, 0);
  }
  // Side-effect: binds DOM controls to CONFIG
  new ControlPanel(regenerate);

  // --- Logger panel ---
  Logger.bindPanel(document.getElementById('log-panel'));
  document.getElementById('log-panel-clear').addEventListener('click', () => Logger.clear());
  Logger.info('App', 'Application started');

  // --- Resize ---
  setupResizeHandler(camera, renderer, hud);

  // --- Config listeners ---
  onChange((key, value) => {
    if (key === 'showHud') hudCanvas.style.display = value ? 'block' : 'none';
  });

  // --- Input bindings ---
  const input = new InputManager();

  input.onKey('x', () => {
    const active = geoTerrainManager.toggleDebug();
    Logger.info('App', `Debug tiles ${active ? 'enabled' : 'disabled'}`);
  });

  input.onKey('h', () => {
    update('showHud', !CONFIG.showHud);
  });

  input.onKey('m', () => {
    update('showMinimap', !CONFIG.showMinimap);
  });

  const hiresBadge = document.getElementById('hires-badge');
  input.onKey('r', () => {
    const active = geoTerrainManager.toggleHiRes();
    hiresBadge.style.display = active ? 'block' : 'none';
    Logger.info('App', `Hi-res mode (zoom 18) ${active ? 'enabled' : 'disabled'}`);
  });

  input.onKey('t', () => {
    const modes = ['satellite', 'osm', 'sar', 'elevation'];
    const idx = modes.indexOf(CONFIG.textureMode);
    update('textureMode', modes[(idx + 1) % modes.length]);
    showNotification(`Texture: ${CONFIG.textureMode}`);
  });

  input.onKey('v', () => {
    const next = CONFIG.cameraMode === 'chase' ? 'cockpit' : 'chase';
    update('cameraMode', next);
    chaseCameraController.reset();
    Logger.info('App', `Camera mode: ${next}`);
  });

  input.onKey('i', () => {
    const active = hud.toggleStats();
    document.getElementById('help').style.display = active ? 'block' : 'none';
    stats.dom.style.display = active ? 'block' : 'none';
    Logger.info('App', `Info ${active ? 'enabled' : 'disabled'}`);
  });

  input.onKey('l', async () => {
    if (hud.isFlightPlanMenuOpen()) {
      hud.closeFlightPlanMenu();
    } else {
      try {
        const r = await fetch('/api/flightplans');
        const files = await r.json();
        hud.openFlightPlanMenu(files);
      } catch {
        Logger.warn('App', 'No flight plans available');
      }
    }
  });

  input.onPrefix('Digit', async (e) => {
    if (!hud.isFlightPlanMenuOpen()) return;
    const idx = parseInt(e.code.charAt(5)) - 1;
    const file = hud.selectFlightPlan(idx);
    if (file) {
      try {
        const r = await fetch(`/assets/flightplans/${file}`);
        const data = await r.json();
        flightPlanRecorder.loadFromJSON(data);
        hud.closeFlightPlanMenu();
      } catch {
        Logger.warn('App', `Failed to load ${file}`);
      }
    }
  });

  input.on('Escape', () => {
    if (hud.isFlightPlanMenuOpen()) hud.closeFlightPlanMenu();
  });

  input.onKey('n', (e) => {
    if (e.shiftKey) {
      flightPlanRecorder.clear();
    } else if (flightPlanRecorder.isRecording()) {
      flightPlanRecorder.stopRecording();
    } else {
      flightPlanRecorder.startRecording();
    }
  });

  input.onKey('p', () => {
    if (flightPlanRecorder.isRecording()) flightPlanRecorder.addWaypoint(flightController);
  });

  input.onKey('g', () => {
    if (flightPlanRecorder.autopilotActive) {
      flightPlanRecorder.autopilotActive = false;
      flightController.enabled = true;
      const plan = flightPlanRecorder.getPlan();
      flightController.position.copy(plan.position);
      flightController.setOrientation(plan.yaw, plan.pitch);
      Logger.info('App', 'Autopilot disengaged');
    } else {
      if (!flightPlanRecorder.hasValidPlan()) {
        Logger.warn('App', 'Need at least 2 waypoints to engage autopilot');
        return;
      }
      const plan = flightPlanRecorder.buildPlan(flightController);
      if (plan) {
        flightPlanRecorder.autopilotActive = true;
        flightController.enabled = false;
        Logger.info('App', 'Autopilot engaged');
      }
    }
  });

  input.onKey('b', (e) => {
    if (e.shiftKey) {
      if (!benchmarkRunner._lastReport) {
        Logger.warn('App', 'No completed benchmark — run one first before storing baseline');
        return;
      }
      BenchmarkComparator.storeBaseline(benchmarkRunner._lastReport);
      return;
    }
    if (benchmarkRunner.isRunning()) {
      benchmarkRunner.stop(flightController, renderer);
    } else {
      const userPlan = flightPlanRecorder.hasValidPlan() ? flightPlanRecorder.buildPlan(flightController) : null;
      benchmarkRunner.start(flightController, camera, gpuTimer, userPlan);
    }
  });

  // --- Touch controls (iPad / mobile) ---
  // Virtual joystick + drag-to-look. Desktop keyboard/mouse path is untouched.
  if (TouchControls.isTouchDevice()) {
    new TouchControls(flightController);
    Logger.info('App', 'Touch controls enabled');
  }

  // --- Render loop ---
  let prevTime = performance.now();
  let _bankRoll = 0;
  let _booted = false; // boot overlay dismissed after first rendered frame
  // Velocity-lookahead state: project the LOD focal point ahead of motion so
  // terrain tiles along the flight path subdivide/download before arrival.
  const _prevCamPos = new THREE.Vector3();
  let _prevCamPosInit = false;
  const _lookaheadPoint = new THREE.Vector3();
  const LOOKAHEAD_TIME = 8; // seconds of flight to project ahead
  const LOOKAHEAD_MIN_SPEED = 25; // m/s — below this, no lookahead

  function animate() {
    requestAnimationFrame(animate);
    stats.begin();

    const now = performance.now();
    const dt = Math.min((now - prevTime) / 1000, MAX_DELTA_TIME);
    const frameTimeMs = now - prevTime;
    prevTime = now;

    // --- Input phase ---
    flightController.update(dt);
    benchmarkRunner.tickPath(dt, flightController, renderer);

    // --- Aircraft state ---
    let aircraftState = null;

    if (flightPlanRecorder.autopilotActive && flightPlanRecorder.getPlan()) {
      const plan = flightPlanRecorder.getPlan();
      const ok = plan.update(dt);
      if (!ok) {
        flightPlanRecorder.autopilotActive = false;
        flightController.enabled = true;
        flightController.position.copy(plan.position);
        flightController.setOrientation(plan.yaw, plan.pitch);
        Logger.info('App', 'Autopilot: flight plan completed');
      } else {
        _autopilotEuler.set(plan.pitch, plan.yaw, 0, 'YXZ');
        _autopilotQuat.setFromEuler(_autopilotEuler);
        aircraftState = {
          position: plan.position,
          yaw: plan.yaw,
          pitch: plan.pitch,
          yawRate: plan.yawRate,
          pitchRate: plan.pitchRate,
          quaternion: _autopilotQuat,
        };
      }
    } else if (benchmarkRunner.isRunning() && !benchmarkRunner.isWarmup() && benchmarkRunner.cameraPath) {
      const path = benchmarkRunner.cameraPath;
      _autopilotEuler.set(path.pitch, path.yaw, 0, 'YXZ');
      _autopilotQuat.setFromEuler(_autopilotEuler);
      aircraftState = {
        position: path.position,
        yaw: path.yaw,
        pitch: path.pitch,
        yawRate: path.yawRate,
        pitchRate: path.pitchRate,
        quaternion: _autopilotQuat,
      };
    } else if (!benchmarkRunner.isRunning()) {
      aircraftState = {
        position: flightController.position,
        yaw: flightController.yaw,
        pitch: flightController.pitch,
        yawRate: flightController.yawRate,
        pitchRate: flightController.pitchRate,
        quaternion: flightController.quaternion,
      };
    }

    // --- Bank roll (derived from yawRate, single source of truth) ---
    if (aircraftState) {
      const targetRoll = Math.max(-MAX_ROLL, Math.min(MAX_ROLL,
        aircraftState.yawRate * ROLL_SENSITIVITY));
      _bankRoll += (targetRoll - _bankRoll) * ROLL_DAMP_SPEED * dt;
      aircraftState.roll = _bankRoll;
    }

    // --- Terrain clearance (manual flight only) ---
    // Sample ground elevation below and ahead of the nose; hold the aircraft
    // above a minimum clearance so unattended cruise can't fly into a mountainside.
    const manualFlight = aircraftState && !flightPlanRecorder.autopilotActive && !benchmarkRunner.isRunning();
    if (manualFlight) {
      _terrainFwd.set(0, 0, -1).applyQuaternion(flightController.quaternion);
      const gndBelow = geoTerrainManager.getGroundElevation(
        flightController.position.x, flightController.position.z);
      const gndAhead = geoTerrainManager.getGroundElevation(
        flightController.position.x + _terrainFwd.x * TERRAIN_LOOKAHEAD_M,
        flightController.position.z + _terrainFwd.z * TERRAIN_LOOKAHEAD_M);
      const floorY = Math.max(gndBelow, gndAhead) + TERRAIN_CLEARANCE_M;
      if (flightController.position.y < floorY) {
        flightController.position.y = floorY;
        // Climbing away: don't let the nose stay buried in the slope
        if (flightController.pitch < 0.03) flightController.pitch = 0.03;
      }
    }

    // --- Camera phase ---
    if (aircraftState) {
      aircraftManager.update(aircraftState, dt);
      if (CONFIG.cameraMode === 'cockpit') {
        aircraftManager.setVisible(false);
        camera.position.copy(aircraftState.position);
        camera.quaternion.copy(aircraftState.quaternion);
        _qRoll.setFromAxisAngle(_axisZ, aircraftState.roll);
        camera.quaternion.multiply(_qRoll);
        chaseCameraController.reset();
      } else {
        aircraftManager.setVisible(true);
        chaseCameraController.update(aircraftState, camera, dt);
      }
    }

    // --- Environment phase ---
    cloudLayer.update(dt, camera.position, aircraftState ? aircraftState.pitch : 0);

    const timer = benchmarkRunner.getSubsystemTimer();

    // --- Terrain phase ---
    if (timer) timer.begin('terrain');
    // Velocity lookahead: feed the tile LOD system a focal point ahead of the
    // aircraft so high-detail tiles stream in along the flight path early.
    if (dt > 0) {
      if (!_prevCamPosInit) {
        _prevCamPos.copy(camera.position);
        _prevCamPosInit = true;
      }
      const speed = _prevCamPos.distanceTo(camera.position) / dt;
      const tileMap = geoTerrainManager.tileMap;
      if (tileMap && speed > LOOKAHEAD_MIN_SPEED) {
        _lookaheadPoint
          .copy(camera.position)
          .sub(_prevCamPos)
          .multiplyScalar(LOOKAHEAD_TIME / dt)
          .add(camera.position);
        _lookaheadPoint.y = Math.max(_lookaheadPoint.y, 0);
        tileMap.userData.lookahead = {
          point: _lookaheadPoint,
          radius: Math.min(Math.max(speed * 6, 1500), 20000),
        };
      } else if (tileMap) {
        tileMap.userData.lookahead = null;
      }
      _prevCamPos.copy(camera.position);
    }
    geoTerrainManager.update(camera.position);
    if (timer) timer.end('terrain');

    const farNeeded = REALWORLD_FAR_PLANE;
    if (Math.abs(camera.far - farNeeded) > CLIP_PLANE_EPSILON) {
      camera.far = farNeeded;
      camera.near = DEFAULT_NEAR;
      camera.updateProjectionMatrix();
      Logger.debug('App', 'Realworld clip planes updated', { near: DEFAULT_NEAR, far: farNeeded });
    }
    groundElevation = geoTerrainManager.getGroundElevation(camera.position.x, camera.position.z);

    // --- Render phase ---
    if (timer) timer.begin('render');
    gpuTimer.beginFrame();
    renderer.info.reset();
    renderer.render(scene, camera);
    gpuTimer.endFrame();
    if (timer) timer.end('render');

    // Dismiss the boot overlay once the first frame is on screen
    if (!_booted) {
      _booted = true;
      document.getElementById('boot-overlay')?.classList.add('hidden');
    }

    // --- Overlay phase ---
    if (timer) timer.begin('hud');
    hud.update(camera, groundElevation, benchmarkRunner, dt, flightPlanRecorder, aircraftState);
    if (timer) timer.end('hud');

    if (timer) timer.begin('minimap');
    minimap.update(camera, aircraftState);
    if (timer) timer.end('minimap');

    // --- Post-render phase ---
    benchmarkRunner.recordMetrics(renderer);
    adaptiveQuality.update(frameTimeMs);
    gpuPanel.update(gpuTimer.getLastGPUTimeMs(), 30);

    stats.end();
  }

  animate();
}

initApp().catch((err) => {
  console.error('Failed to initialize application:', err);
  // Never leave the user staring at a black screen: surface the failure.
  const overlay = document.getElementById('boot-overlay');
  const status = document.getElementById('boot-status');
  const errBox = document.getElementById('boot-error');
  if (overlay && status && errBox) {
    overlay.classList.remove('hidden');
    status.textContent = 'Could not start the 3D engine on this device.';
    errBox.style.display = 'block';
    errBox.textContent =
      'Details: ' + String((err && err.message) || err) +
      '\n\nTry ?renderer=webgl for the WebGL fallback, or a browser with WebGPU support.';
  }
});
