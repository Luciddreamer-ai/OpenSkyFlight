// The game shell.
//
// WHY
//
// Three games existed and each one cost 213-546 lines, of which the majority
// was the same scaffolding: a boot overlay, a HUD, a touch stick, a throttle
// slider, a pause card, a back link, a frame loop, score persistence and a
// crash handler. The three index.html files were ~95% byte-identical. That is
// a "copy this file and edit the middle" tax on every game, and it is the
// reason "add another game" stays expensive no matter how good the catalogue
// looks.
//
// This module owns all of it. A game supplies only what is actually its own:
// a `start` that sets the world up, an `update` that advances the gameplay, an
// optional `render` for per-frame visuals, and a HUD spec. Everything else —
// the DOM, the loop, input, camera, pause, best score, crash, restart and
// telemetry — is here, once.
//
// The result is that a new game is roughly 100-150 lines of real gameplay
// rather than 300 lines of half-copied plumbing. The index.html for a game is
// the import map and a script tag, because the body is built from the spec.
//
// WHAT A GAME CANNOT DO
//
// It cannot add DOM outside the shell without doing so in `render`, because the
// shell clears and rebuilds the overlay on restart. That is deliberate: a
// restart that leaves orphaned meshes behind is a leak that only shows up after
// the player has failed four times, which is exactly when nobody is watching.

import * as THREE from 'three';
import { soundFX } from '../audio/SoundFX.js';
import {
  bootWorld,
  GameInput,
  SimpleFlight,
  chaseCamera,
  scoreStore,
  waitForTerrain,
  tickTelemetry,
} from './GameRuntime.js';
import Logger from '../utils/Logger.js';

const $ = (id) => document.getElementById(id);

/** Build the whole page body for a game. Replaces the per-game HTML shell. */
function buildDom(spec) {
  const hud = spec.hud ?? [];
  const accent = spec.accent ?? '#7df9ff';
  const bar = spec.bar ?? null;

  document.documentElement.style.setProperty('--accent', accent);
  document.title = `${spec.name} — Sitka Skies`;

  const el = document.createElement('div');
  el.innerHTML = `
    <div id="canvas-container"></div>

    <div id="boot-overlay">
      <div class="boot-inner">
        <div class="boot-title">${spec.name}</div>
        <div class="boot-status" id="boot-status">Loading…</div>
      </div>
    </div>

    <div id="hud-top">
      <span id="hud-score">SCORE 0</span>
      ${hud.map((h) => `<span id="${h.id}">${h.initial ?? ''}</span>`).join('\n      ')}
      <span id="hud-best"></span>
    </div>
    ${spec.showAlt === false ? '' : '<div id="hud-alt"><span id="hud-agl">AGL —</span></div>'}
    <div id="hud-speed">0 kt</div>

    ${bar ? `<div id="prox-wrap"><div id="prox-bar"></div><div id="prox-label">${bar.label}</div></div>` : ''}
    ${spec.extra ?? ''}

    <div id="center-msg"></div>

    <div id="stick-zone"><div id="stick-knob"></div></div>
    <div id="throttle-zone">
      <div id="throttle-readout">60%</div>
      <div id="throttle-track"><div id="throttle-fill"></div></div>
    </div>

    <div id="top-right">
      <button id="btn-pause" type="button" aria-label="Pause">II</button>
      <button id="btn-mute" type="button" aria-label="Mute sounds">♪</button>
    </div>
    <a id="back-link" href="../" aria-label="Back to games">&#8592;</a>
    <button id="btn-restart" type="button" aria-label="Restart" hidden>R</button>

    <div id="pause-overlay" class="hidden">
      <div class="pause-card">
        <h2>PAUSED</h2>
        <p>Tap PAUSE to resume &middot; &#8592; for the game list</p>
      </div>
    </div>`;
  document.body.appendChild(el);

  // Per-game link preview so a shared URL renders with the game's own name and
  // description instead of a generic fallback.
  const base = document.baseURI;
  const og = [
    ['og:title', spec.name],
    ['og:description', spec.tagline ?? spec.blurb ?? 'A mini-game over real Sitka terrain'],
    ['og:url', base],
    ['og:type', 'website'],
  ];
  if (spec.ogImage) og.push(['og:image', new URL(spec.ogImage, base).href]);
  for (const [k, v] of og) {
    const m = document.createElement('meta');
    m.setAttribute('property', k);
    m.content = v;
    document.head.appendChild(m);
  }
  const desc = document.createElement('meta');
  desc.name = 'description';
  desc.content = spec.tagline ?? spec.blurb ?? 'A mini-game over real Sitka terrain';
  document.head.appendChild(desc);
}

/**
 * Boot a game. Everything a game author needs to write is in `spec`.
 *
 * @param {object} spec
 * @param {string} spec.id        stable id; also the localStorage key for bests
 * @param {string} spec.name      shown on the boot card and used in <title>
 * @param {number} [spec.lat]     start latitude  (default Sitka)
 * @param {number} [spec.lon]
 * @param {Array}  [spec.hud]     extra [{id, initial}] for the top HUD row.
 *        The score readout is always present because every game scored
 *        through this shell has a score; a game only lists what is its own.
 * @param {object} [spec.bar]     {label} to show the progress bar
 * @param {string} [spec.extra]   extra HTML for game-specific overlays
 * @param {boolean}[spec.showAlt] false to hide the AGL readout
 * @param {(w:object)=>void} spec.start   build the world, return cleanup
 * @param {(dt:number,w:object,t:number)=>void} spec.update
 * @param {(w:object)=>void} [spec.render]
 * @param {(w:object,dt:number)=>void} [spec.postCamera]  runs after the chase
 *        camera each frame; a game can re-aim the camera here (e.g. to track
 *        a falling object) without fighting the chase logic.
 * @param {(w:object)=>({score:number,over:boolean,text?:string})} [spec.scoring]
 *        returns the current score and whether the run has ended
 * @param {(w:object, result:object)=>void} [spec.onEnd]
 */
export async function runGame(spec) {
  buildDom(spec);

  const world = await bootWorld({ lat: spec.lat ?? 57.0472, lon: spec.lon ?? -135.3619 });
  const { renderer, scene, camera, terrain, input, flight, telemetry } = world;

  const bootOverlay = $('boot-overlay');
  const say = (m) => {
    if ($('boot-status')) $('boot-status').textContent = m;
  };

  say('Finding terrain…');
  await waitForTerrain(terrain, 0, 0, 12000);

  // A per-game context object. Games read and write this; the shell only needs
  // `cleanup` back so a restart can tear the scene down.
  const ctx = {
    THREE,
    renderer,
    scene,
    camera,
    terrain,
    input,
    flight,
    telemetry,
    spec,
    score: 0,
    over: false,
    paused: false,
    t: 0,
    msg: '',
    msgUntil: 0,
  };

  const dispose = spec.start?.(ctx) ?? (() => {});
  const best = scoreStore.read(spec.id);
  if (best !== null) $('hud-best').textContent = `BEST ${best}`;

  input.attachTouch?.($('stick-zone'), $('throttle-zone'));
  if (spec.throttle !== undefined) input.throttle = spec.throttle;

  // --- messaging -----------------------------------------------------------
  const center = (text, cls = '', ms = 0) => {
    const m = $('center-msg');
    if (!m) return;
    m.textContent = text;
    m.className = cls;
    m.style.display = text ? 'block' : 'none';
    if (ms) setTimeout(() => m && (m.style.display = 'none'), ms);
  };

  // --- input keys ----------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') togglePause();
    if (e.key === 'r' || e.key === 'R') restart();
  });

  const pauseOverlay = $('pause-overlay');
  const togglePause = () => {
    ctx.paused = !ctx.paused;
    pauseOverlay?.classList.toggle('hidden', !ctx.paused);
  };
  $('btn-pause')?.addEventListener('click', togglePause);
  $('btn-mute')?.addEventListener('click', () => {
    const muted = soundFX.toggleMute();
    $('btn-mute').textContent = muted ? '✕' : '♪';
    if (!muted) soundFX.click();
  });
  $('btn-restart')?.addEventListener('click', restart);

  function restart() {
    // Tear the previous run down completely. Leaving meshes attached here is
    // the leak that only shows up after the fourth failure.
    try {
      dispose();
    } catch (e) {
      Logger.warn('Shell', 'cleanup threw during restart', { error: String(e) });
    }
    ctx.score = 0;
    ctx.over = false;
    ctx.paused = false;
    ctx.t = 0;
    ctx.msg = '';
    pauseOverlay?.classList.add('hidden');
    $('btn-restart')?.setAttribute('hidden', '');
    const cm = $('center-msg');
    if (cm) {
      cm.textContent = '';
      cm.style.display = 'none';
      delete cm.dataset.shell;
    }
    spec.start?.(ctx);
  }

  // --- loop ----------------------------------------------------------------
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    tickTelemetry(telemetry, now);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (ctx.paused) return;

    ctx.t += dt;
    if (!ctx.over) spec.update?.(dt, ctx, ctx.t);

    // Crash is a shared rule, not a per-game one: hitting terrain at speed
    // ends the run, and a gentle touchdown does not. Games can override with
    // `crashTest`.
    if (!ctx.over && spec.crashTest?.(ctx) !== false) {
      const g = terrain.getGroundElevation(flight.position.x, flight.position.z);
      const agl = flight.position.y - g;
      const vy = flight.velocity?.y ?? 0;
      if (agl < 2.5 && vy < -9) {
        ctx.over = true;
        ctx.msg = '';
        soundFX.crash();
        const cm = $('center-msg');
        if (cm) {
          cm.dataset.shell = 'crash';
          cm.textContent = 'CRASHED';
          cm.className = 'big';
          cm.style.display = 'block';
        }
        $('btn-restart')?.removeAttribute('hidden');
      }
    }

    // Scoring is a single interface so best-score persistence and the end
    // screen cannot disagree between games.
    if (spec.scoring) {
      const r = spec.scoring(ctx);
      if (r && typeof r.score === 'number') ctx.score = r.score;
      if (r?.over && !ctx.over) {
        ctx.over = true;
        const isBest = scoreStore.write(spec.id, Math.round(ctx.score));
        center(
          r.text ?? (isBest ? `DONE — NEW BEST ${Math.round(ctx.score)}` : `DONE — ${Math.round(ctx.score)}`),
          'big',
          0,
        );
        $('btn-restart')?.removeAttribute('hidden');
        spec.onEnd?.(ctx, { ...r, isBest });
      }
    }

    // HUD
    if ($('hud-score')) $('hud-score').textContent = `SCORE ${Math.round(ctx.score)}`;
    if ($('hud-agl')) {
      const g = terrain.getGroundElevation(flight.position.x, flight.position.z);
      $('hud-agl').textContent = `AGL ${Math.max(0, Math.round(flight.position.y - g))} m`;
    }
    if ($('hud-speed')) {
      $('hud-speed').textContent = `${Math.round((flight.speed ?? 0) * 1.94384)} kt`;
    }
    if ($('throttle-fill')) $('throttle-fill').style.height = `${input.throttle * 100}%`;
    if ($('throttle-readout')) $('throttle-readout').textContent = `${Math.round(input.throttle * 100)}%`;

    // Games announce things by setting ctx.msg / ctx.msgUntil. Rendering it
    // here means a game never has to touch the DOM for a message, and the
    // timeout is handled in one place instead of per game.
    if (ctx.msg && ctx.t >= ctx.msgUntil) ctx.msg = '';
    if (ctx.msg) {
      const m = $('center-msg');
      if (m) {
        m.textContent = ctx.msg;
        m.style.display = 'block';
      }
    } else if (!ctx.over) {
      const m = $('center-msg');
      if (m && m.dataset.shell !== 'crash') m.style.display = 'none';
    }

    spec.render?.(ctx);
    chaseCamera(camera, flight, dt, spec.camera);
    spec.postCamera?.(ctx, dt);
    terrain.update(camera.position);
    renderer.render(scene, camera);

    if (!ctx.over && bootOverlay && !bootOverlay.classList.contains('hidden')) {
      bootOverlay.classList.add('hidden');
    }
  }

  Logger.info('Shell', `game ${spec.id} booted`);
  requestAnimationFrame(frame);

  return ctx;
}
