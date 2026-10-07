/**
 * Shared runtime for standalone mini-games.
 *
 * Every game in games/ is a separate page that reuses the real terrain engine,
 * the real renderer, and the real plane models. What it does NOT reuse is the
 * main app's loop, HUD, or state — a game owns a clean room and runs its own
 * rules. This module is the small amount of scaffolding they all share:
 * boot, an input model that works with touch AND keyboard, a DOM HUD, a pause
 * overlay, and a persistent best score.
 *
 * The design rule, same as CapabilityProbe: games describe themselves as DATA
 * (see games.js) and this file turns that into pages. Adding a game should be a
 * new folder, not a new branch in a launcher.
 */

import * as THREE from 'three';
import { createRenderer, createScene, createCamera } from '../scene/SceneSetup.js';
import GeoTerrainManager from '../terrain/GeoTerrainManager.js';
import { detectTileMode } from '../geo/TileUrls.js';
import Logger from '../utils/Logger.js';
import { attachDiagnostics, tickDiagnostics } from '../diagnostics/attach.js';

const $ = (id) => document.getElementById(id);

/** Best-score storage, namespaced per game so scores never collide. */
const scoreStore = {
  read(gameId) {
    try {
      const raw = localStorage.getItem(`osf.game.${gameId}.best`);
      return raw === null || raw === undefined ? null : Number(raw);
    } catch {
      return null;
    }
  },
  write(gameId, value) {
    try {
      const prev = this.read(gameId);
      if (prev === null || value > prev) {
        localStorage.setItem(`osf.game.${gameId}.best`, String(value));
        return true;
      }
    } catch {
      /* private mode */
    }
    return false;
  },
};

/**
 * Input shared by every game.
 *
 * Games are played on an iPad, so touch is the primary path and the keyboard is
 * a convenience. Throttle is a vertical drag on the right edge; a virtual stick
 * on the left steers — the same layout TouchControls already established, so
 * muscle memory carries over from free flight.
 */
export class GameInput {
  constructor(canvas) {
    this.keys = Object.create(null);
    this.throttle = 0.6;
    this.steer = 0; // -1..1
    this.pitch = 0; // -1..1 (drag to look)
    this._steerTouch = null;
    this._throttleTouch = null;
    this._throttleStart = null;
    this._throttleBase = 0.6;
    this._listeners = [];
    this.canvas = canvas;

    const onKey = (e) => {
      if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      this.keys[e.code] = e.type === 'keydown';
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._on(window, 'keydown', onKey);
    this._on(window, 'keyup', onKey);

    // Keyboard throttle
    this._on(window, 'keydown', (e) => {
      if (e.code === 'KeyW') this.throttle = Math.min(1, this.throttle + 0.05);
      if (e.code === 'KeyS') this.throttle = Math.max(0, this.throttle - 0.05);
    });
  }

  _on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this._listeners.push([target, type, fn, opts]);
  }

  /** Attach touch zones. Call after the game's DOM exists. */
  attachTouch(stickEl, throttleEl) {
    if (stickEl) {
      this._on(
        stickEl,
        'touchstart',
        (e) => {
          const t = e.changedTouches[0];
          this._steerTouch = { id: t.identifier, x0: t.clientX, y0: t.clientY };
          e.preventDefault();
        },
        { passive: false },
      );
      this._on(
        stickEl,
        'touchmove',
        (e) => {
          if (!this._steerTouch) return;
          for (const t of e.changedTouches) {
            if (t.identifier !== this._steerTouch.id) continue;
            const dx = (t.clientX - this._steerTouch.x0) / 70;
            const dy = (t.clientY - this._steerTouch.y0) / 70;
            this.steer = Math.max(-1, Math.min(1, dx));
            this.pitch = Math.max(-1, Math.min(1, dy));
          }
          e.preventDefault();
        },
        { passive: false },
      );
      const end = (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === this._steerTouch?.id) {
            this._steerTouch = null;
            this.steer = 0;
            this.pitch = 0;
          }
        }
      };
      this._on(stickEl, 'touchend', end);
      this._on(stickEl, 'touchcancel', end);
    }

    if (throttleEl) {
      this._on(
        throttleEl,
        'touchstart',
        (e) => {
          const t = e.changedTouches[0];
          this._throttleTouch = t.identifier;
          this._throttleStart = { y: t.clientY, base: this.throttle };
          e.preventDefault();
        },
        { passive: false },
      );
      this._on(
        throttleEl,
        'touchmove',
        (e) => {
          for (const t of e.changedTouches) {
            if (t.identifier !== this._throttleTouch) continue;
            const dy = (this._throttleStart.y - t.clientY) / 160;
            this.throttle = Math.max(0, Math.min(1, this._throttleStart.base + dy));
          }
          e.preventDefault();
        },
        { passive: false },
      );
      const end = (e) => {
        for (const t of e.changedTouches) if (t.identifier === this._throttleTouch) this._throttleTouch = null;
      };
      this._on(throttleEl, 'touchend', end);
      this._on(throttleEl, 'touchcancel', end);
    }
  }

  /** Per-frame: fold keyboard into the same axes touch produces. */
  sample() {
    if (this.keys.ArrowLeft || this.keys.KeyA) this.steer = -1;
    else if (this.keys.ArrowRight || this.keys.KeyD) this.steer = 1;
    else if (!this._steerTouch) this.steer = 0;

    if (this.keys.ArrowUp) this.pitch = -1;
    else if (this.keys.ArrowDown) this.pitch = 1;
    else if (!this._steerTouch) this.pitch = 0;

    return { steer: this.steer, pitch: this.pitch, throttle: this.throttle };
  }

  dispose() {
    for (const [t, type, fn, opts] of this._listeners) t.removeEventListener(type, fn, opts);
    this._listeners = [];
  }
}

/**
 * Wait until getGroundElevation returns real data for a world position.
 *
 * This is NOT an optimisation — it is a correctness requirement. The DEM is
 * fetched asynchronously, and until a tile arrives `getGroundElevation` returns
 * 0. A game that samples terrain at t=0 therefore believes the whole world is
 * at sea level and will happily pick a "clearing" that is open water, or spawn
 * the aircraft underground. Await this before designing a level.
 *
 * @param terrain  a GeoTerrainManager
 * @param x,z      world position to probe
 * @param timeoutMs give up and return 0 (caller should handle a sea-level world)
 */
export async function waitForTerrain(terrain, x = 0, z = 0, timeoutMs = 8000) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  while (now() - t0 < timeoutMs) {
    const g = terrain.getGroundElevation(x, z);
    if (g !== 0) return g;
    await new Promise((r) => setTimeout(r, 120));
  }
  return 0;
}

/** A minimal flight model shared by the flying games. */
export class SimpleFlight {
  constructor(opts = {}) {
    this.position = new THREE.Vector3(0, 1200, 0);
    this.velocity = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.crashed = false;
    this.minSpeed = opts.minSpeed ?? 18;
    this.maxSpeed = opts.maxSpeed ?? 140;
    this.baseSpeed = opts.baseSpeed ?? 55;
    this.speed = this.baseSpeed;
    this.accel = opts.accel ?? 26;
    this.turnRate = opts.turnRate ?? 1.5;
    this.pitchRate = opts.pitchRate ?? 1.6;
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
  }

  update(dt, input, { allowBank = true } = {}) {
    if (this.crashed) return;
    // Throttle maps to a target speed; steering bleeds a little off it.
    const target = this.minSpeed + (this.maxSpeed - this.minSpeed) * input.throttle;
    const bleed = 1 - Math.abs(input.steer) * 0.25;
    this.speed += (target * bleed - this.speed) * Math.min(1, dt * 1.6);

    this.yaw -= input.steer * this.turnRate * dt;
    // Wider pitch authority + a faster return to the trimmed attitude. The
    // narrow clamp (and slow 0.8 ease) made altitude changes take minutes,
    // which is fine for a cruise sim and unplayable for a proximity game.
    this.pitch = Math.max(-0.95, Math.min(0.95, this.pitch + input.pitch * this.pitchRate * dt));
    // Gravity-ish sink when not pulling up, so you must actually fly.
    this.pitch += (-0.12 - this.pitch) * Math.min(1, dt * 1.6);

    const targetRoll = allowBank ? input.steer * 0.55 : 0;
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 4);

    this._euler.set(this.pitch, this.yaw, this.roll, 'YXZ');
    this.quaternion.setFromEuler(this._euler);

    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quaternion);
    this.velocity.copy(fwd).multiplyScalar(this.speed);
    this.position.addScaledVector(this.velocity, dt);
  }

  crash() {
    this.crashed = true;
  }
}

/** Boot the shared world: renderer, scene, camera, terrain. */
export async function bootWorld({ lat, lon, onProgress } = {}) {
  const say = (m) => {
    if (onProgress) onProgress(m);
    const el = $('boot-status');
    if (el) el.textContent = m;
  };

  say('Starting 3D engine…');
  await detectTileMode();

  say('Detecting hardware…');
  const renderer = await createRenderer();

  const { scene, dirLight, ambientLight } = createScene();
  const camera = createCamera();
  camera.far = 400000;
  camera.updateProjectionMatrix();

  const terrain = new GeoTerrainManager(scene, renderer);
  terrain.init(lat, lon);

  const input = new GameInput(renderer.domElement);
  const flight = new SimpleFlight();

  // Same diagnostics as the sim, so a bug report from a game carries the same
  // evidence as one from free flight. A player who loses a run in Bush Pilot is
  // exactly the player we need a frame trace from.
  const { telemetry, watchdog } = attachDiagnostics({
    renderer,
    readState: () => {
      const p = flight.position;
      return p ? { x: p.x, y: p.y, z: p.z } : null;
    },
  });

  say('Loading terrain…');
  return {
    renderer,
    scene,
    camera,
    terrain,
    input,
    flight,
    dirLight,
    ambientLight,
    telemetry,
    watchdog,
  };
}

/** Feed one frame of telemetry. Call once per frame from a game's loop. */
export const tickTelemetry = tickDiagnostics;

/** Chase camera that reads better in a game than the sim's default. */
export function chaseCamera(camera, flight, dt, { distance = 34, height = 11 } = {}) {
  const back = new THREE.Vector3(0, 0, distance).applyQuaternion(flight.quaternion);
  const want = flight.position.clone().add(back);
  want.y += height;
  camera.position.lerp(want, Math.min(1, dt * 6));
  camera.quaternion.slerp(flight.quaternion, Math.min(1, dt * 7));
}

/** Centre-screen transient message, used for "GO!", "CRASHED", "NEW BEST". */
export function centerMsg(text, cls = '', ms = 0) {
  const el = $('center-msg');
  if (!el) return;
  el.textContent = text;
  el.className = cls;
  el.style.opacity = '1';
  if (ms > 0) setTimeout(() => (el.style.opacity = '0'), ms);
}

export function hideMsg() {
  const el = $('center-msg');
  if (el) el.style.opacity = '0';
}

export function setHud(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

export { scoreStore, $ };

/** Shared page furniture: pause, best score, and a link back to the menu. */
export function wireChrome({ gameId, best, onPause, onResume }) {
  const pauseBtn = $('btn-pause');
  const overlay = $('pause-overlay');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      const showing = overlay && overlay.classList.contains('hidden') === false;
      if (showing) {
        overlay.classList.add('hidden');
        onResume && onResume();
      } else {
        overlay && overlay.classList.remove('hidden');
        onPause && onPause();
      }
    });
  }
  if (best !== null && best !== undefined) setHud('hud-best', `BEST ${best}`);
  const back = $('back-link');
  if (back) back.href = '../';
  Logger.info('Game', `chrome wired for ${gameId}`);
}
