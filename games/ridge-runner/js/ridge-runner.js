/**
 * RIDGE RUNNER — the flagship game.
 *
 * The idea: the sim's best feature is that the terrain is REAL, with real
 * elevation from the AWS Terrarium DEM. So make proximity to that real terrain
 * the skill. Score accrues for being close to the ground, and touching it ends
 * the run. Difficulty is a speed dial, and the terrain is the level design —
 * infinitely, because Earth is infinitely detailed.
 *
 * Why this scales to a "system-agnostic" build better than any other game here:
 * the scoring is a pure function of `getGroundElevation(x, z)`, which is
 * already GPU-decoded and cached. No extra assets, no per-device tuning, and it
 * works anywhere on Earth without a hand-authored level.
 */

import * as THREE from 'three';
import {
  bootWorld,
  tickTelemetry,
  chaseCamera,
  centerMsg,
  hideMsg,
  setHud,
  scoreStore,
  waitForTerrain,
  wireChrome,
} from '../../../js/games/GameRuntime.js';
import { buildPlane } from '../../../js/aircraft/planes/PlaneFactory.js';

// Sitka's Kruzof Island / Mount Edgecumbe area: dramatic, real ridgelines.
const LAT = 57.0472;
const LON = -135.3619;

// --- Rules ------------------------------------------------------------------
const SCORE = {
  // Proximity band, metres AGL. Closer than NEAR is a big multiplier — the
  // game should reward nerve, not timid hovering.
  NEAR: 30, //     sweet spot
  FAR: 220, //      beyond this you are "high and boring": no credit
  CRASH: 6, //      touching the rock ends the run
  MAX_MULT: 6, //   cap so a single frame can't be worth a whole run
};
const SPEED = { start: 0.42, max: 0.95, perSecond: 0.012 };

const $ = (id) => document.getElementById(id);

async function main() {
  const world = await bootWorld({ lat: LAT, lon: LON, altitude: 1400 });
  const { renderer, scene, camera, terrain, input, flight, telemetry } = world;

  input.attachTouch($('stick-zone'), $('throttle-zone'));

  // --- The plane -------------------------------------------------------------
  // buildPlane returns { group, def } — the group is the model, def is metadata.
  const { group: planeModel } = buildPlane('extra'); // stunt plane suits a knife-edge run
  const planeGroup = new THREE.Group();
  planeGroup.add(planeModel);
  scene.add(planeGroup);

  // --- Game state ------------------------------------------------------------
  const G = {
    score: 0,
    dist: 0,
    speed01: SPEED.start,
    best: scoreStore.read('ridge-runner'),
    agl: 0,
    prox: 0, // 0..1 closeness meter for the HUD bar
    dead: false,
    paused: false,
    credit: 0, // smoothed credit multiplier, so the bar doesn't flicker
  };

  // Spawn high above the terrain and pointing along a ridge.
  // Spawn INSIDE the scoring band, not above it. The game is proximity, so
  // starting high just meant minutes of holding a key before it began.
  //
  // getGroundElevation returns 0 until the DEM tile for this cell has arrived,
  // so sampling once at t=0 would put us underground. Wait for the terrain to
  // actually report a plausible height (Sitka ranges ~0-1500m) before choosing
  // a spawn, and fall back to a safe altitude if it never does.
  // Await, don't busy-wait: blocking here would freeze the render loop and
  // stall the very tile request we are waiting for. Keep the player informed —
  // this wait is visible, so say what is happening.
  setHud('boot-status', 'Finding the ridge…');
  const ground = await waitForTerrain(terrain);
  const overlay = $('boot-overlay');
  if (overlay) overlay.classList.add('hidden');
  flight.position.set(0, Math.max(ground + SCORE.FAR * 0.8, SCORE.FAR), 0);
  flight.yaw = 0.6;
  flight.pitch = 0;

  wireChrome({
    gameId: 'ridge-runner',
    best: G.best,
    onPause: () => (G.paused = true),
    onResume: () => {
      G.paused = false;
      hideMsg();
    },
  });

  setHud('hud-best', G.best === null || G.best === undefined ? 'BEST —' : `BEST ${G.best}`);

  // --- Ground sampling -------------------------------------------------------
  // Sample the ground under the plane and slightly ahead, so we react to a
  // rising ridge instead of flying into the side of it.
  const probeOffsets = [0, -60, -120];

  function groundClearance() {
    let lowest = Infinity;
    for (const dz of probeOffsets) {
      const x = flight.position.x;
      const z = flight.position.z + dz;
      const g = terrain.getGroundElevation(x, z);
      if (g < lowest) lowest = g;
    }
    return flight.position.y - lowest;
  }

  // --- Main loop -------------------------------------------------------------
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    tickTelemetry(telemetry, now);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (G.paused) return;

    if (!G.dead) {
      // Difficulty ramps with score; a run that lasts longer gets faster.
      G.speed01 = Math.min(SPEED.max, SPEED.start + G.score / 9000);
      input.throttle = G.speed01;

      const ctl = input.sample();
      flight.update(dt, ctl, { allowBank: true });

      const agl = groundClearance();
      G.agl = agl;

      // --- Scoring -----------------------------------------------------------
      // A smooth "credit" that rises as you descend into the band and falls as
      // you climb out. The smoothing is what makes the run feel like a
      // continuum instead of a series of binary judgements.
      if (agl < SCORE.FAR) {
        const closeness = 1 - Math.max(0, (agl - SCORE.NEAR) / (SCORE.FAR - SCORE.NEAR));
        const target = Math.min(SCORE.MAX_MULT, 1 + closeness * (SCORE.MAX_MULT - 1));
        G.credit += (target - G.credit) * Math.min(1, dt * 3);
      } else {
        G.credit += (0 - G.credit) * Math.min(1, dt * 1.5);
      }

      G.score += G.credit * dt * 12;
      G.dist += flight.speed * dt;

      // --- Crash -------------------------------------------------------------
      if (agl <= SCORE.CRASH) {
        G.dead = true;
        flight.crash();
        // Losing the plane is the story, so lead with the crash. A new personal
        // best is a postscript, not the headline — on a first run the old code
        // showed "NEW BEST" instead of "CRASHED", which reads backwards.
        const isBest = scoreStore.write('ridge-runner', Math.floor(G.score));
        const headline = 'CRASHED';
        const postscript = isBest ? `\nNEW BEST ${Math.floor(G.score)}` : '';
        centerMsg(headline + postscript, 'danger');
        setHud('hud-best', `BEST ${isBest ? Math.floor(G.score) : (G.best ?? '—')}`);
        setTimeout(() => location.reload(), 2200);
      } else if (agl < SCORE.NEAR && G.credit > 3) {
        centerMsg('CLOSE', 'danger', 0); // persistent warning while skimming
      } else {
        hideMsg();
      }
    } else {
      // After death, let the plane coast and sink for a beat before reload.
      flight.position.y -= 6 * dt;
    }

    // --- Present -------------------------------------------------------------
    planeGroup.position.copy(flight.position);
    planeGroup.quaternion.copy(flight.quaternion);
    planeGroup.traverse((c) => {
      c.frustumCulled = false;
    });

    chaseCamera(camera, flight, dt, { distance: 30, height: 9 });

    // --- HUD -----------------------------------------------------------------
    setHud('hud-score', `SCORE ${Math.floor(G.score)}`);
    setHud('hud-dist', `${Math.round(G.dist)} m`);
    setHud('hud-agl', `AGL ${Math.round(G.agl)} m`);
    setHud('hud-speed', `${Math.round(flight.speed * 1.94)} kt`);
    const prox = Math.max(0, Math.min(1, 1 - G.agl / SCORE.FAR));
    G.prox = prox;
    const bar = $('prox-bar');
    if (bar) bar.style.height = `${prox * 100}%`;

    const ro = $('throttle-readout');
    if (ro) ro.textContent = `${Math.round(G.speed01 * 100)}%`;
    const fill = $('throttle-fill');
    if (fill) fill.style.height = `${G.speed01 * 100}%`;

    renderer.render(scene, camera);
  }

  requestAnimationFrame(frame);
}

main().catch((err) => {
  console.error('Ridge Runner failed to start:', err);
  const el = $('boot-status');
  if (el) el.textContent = 'Could not start: ' + (err && err.message ? err.message : err);
});
