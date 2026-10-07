import * as THREE from 'three';
import { CONFIG } from '../utils/config.js';
import Logger from '../utils/Logger.js';
import { CLEAR_COLOR, AMBIENT_INTENSITY, DIR_LIGHT_INTENSITY, DIR_LIGHT_POSITION } from '../constants/rendering.js';
import { DEFAULT_FOV, DEFAULT_NEAR, DEFAULT_FAR, REALWORLD_START_ALTITUDE } from '../constants/camera.js';

export async function createRenderer() {
  // iPad/Safari safety: WebGPU can be missing or unstable there. Try WebGPU
  // first; fall back to the WebGL backend (same TSL scene graph, no rewrite).
  // Override with ?renderer=webgl|webgpu.
  let forceWebGL = false;
  try {
    const param = new URLSearchParams(location.search).get('renderer');
    if (param === 'webgl') forceWebGL = true;
    else if (param === 'webgpu') forceWebGL = false;
    else if (typeof navigator !== 'undefined' && !navigator.gpu) forceWebGL = true;
  } catch {
    /* non-browser context — default to WebGPU attempt */
  }

  let renderer;
  if (!forceWebGL) {
    try {
      renderer = new THREE.WebGPURenderer({
        antialias: true,
        powerPreference: 'high-performance',
        trackTimestamp: true,
      });
      await renderer.init();
      Logger.info('Renderer', 'WebGPU backend');
    } catch (err) {
      Logger.warn('Renderer', 'WebGPU init failed, falling back to WebGL: ' + err.message);
      forceWebGL = true;
    }
  }
  if (forceWebGL) {
    renderer = new THREE.WebGPURenderer({ forceWebGL: true, antialias: true });
    await renderer.init();
    Logger.info('Renderer', 'WebGL backend (TSL fallback)');
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(CLEAR_COLOR);

  // --- Context-loss guard -------------------------------------------------
  // Pointer-lock engagement could reliably kill the engine after 2-3 cycles
  // (SUGGESTIONS/06-pointer-lock-guard.md). It is not yet known whether that
  // is synthetic input in a headless VM or a genuine device/context loss, so
  // handle the loss itself: surface a recoverable state instead of hanging
  // forever on the boot overlay with a dead canvas.
  attachContextLossHandlers(renderer);

  document.getElementById('canvas-container').appendChild(renderer.domElement);
  return renderer;
}

/**
 * Show a full-screen recoverable state when the GPU context is lost.
 * `webglcontextlost` fires for the WebGL backend; WebGPURenderer exposes
 * `renderer.backend.device.lost` (a promise) for the WebGPU backend. Both are
 * wired up. Recovery is a reload because rebuilding the whole scene graph
 * (terrain LOD, flight state) in place is not safe mid-flight.
 */
function showContextLostUI(reason) {
  const overlay = document.getElementById('boot-overlay');
  if (!overlay) return;
  const status = document.getElementById('boot-status');
  const errBox = document.getElementById('boot-error');
  overlay.classList.remove('hidden');
  if (status) status.textContent = 'The graphics engine stopped.';
  if (errBox) {
    errBox.style.display = 'block';
    errBox.textContent =
      `The GPU context was lost${reason ? ` (${reason})` : ''}.\n\n` +
      'This usually means the device reclaimed GPU memory, or the tab was ' +
      'backgrounded for a long time. Reload to fly again.\n\n' +
      'If it keeps happening, try ?renderer=webgl to use the WebGL fallback.';
    // Make recovery a single action.
    const btn = document.createElement('button');
    btn.textContent = 'RELOAD';
    btn.style.cssText =
      'display:block;margin-top:14px;padding:10px 22px;font:inherit;font-size:13px;' +
      'letter-spacing:2px;cursor:pointer;color:#0a0a1a;background:#00ff88;' +
      'border:none;border-radius:3px;';
    btn.addEventListener('click', () => location.reload());
    errBox.appendChild(btn);
  }
}

function attachContextLossHandlers(renderer) {
  const canvas = renderer.domElement;
  if (!canvas) return;
  let signalled = false;

  const signal = (reason) => {
    if (signalled) return;
    signalled = true;
    Logger.error('Renderer', `GPU context lost: ${reason}`);
    showContextLostUI(reason);
  };

  // WebGL backend
  canvas.addEventListener(
    'webglcontextlost',
    (e) => {
      e.preventDefault(); // allow a later restore
      signal('webglcontextlost');
    },
    false,
  );

  // WebGPU backend — device loss is a promise, not an event.
  const device = renderer?.backend?.device;
  if (device && typeof device.lost?.then === 'function') {
    device.lost
      .then((info) => signal(info?.reason || info?.message || 'device lost'))
      .catch(() => signal('device lost'));
  }
}

export function createScene() {
  const scene = new THREE.Scene();
  const ambientLight = new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, DIR_LIGHT_INTENSITY);
  dirLight.position.set(...DIR_LIGHT_POSITION);
  scene.add(dirLight);
  return { scene, ambientLight, dirLight };
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    DEFAULT_FOV,
    window.innerWidth / window.innerHeight,
    DEFAULT_NEAR,
    DEFAULT_FAR,
  );
  camera.position.set(0, REALWORLD_START_ALTITUDE, 0);
  return camera;
}

export function setupResizeHandler(camera, renderer, hud) {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    hud.resize(window.innerWidth, window.innerHeight);
  });
}
