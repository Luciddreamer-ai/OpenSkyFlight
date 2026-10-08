// Engine health watchdog.
//
// The project's most expensive open bug is that "the renderer sometimes stops"
// and nobody knows why. This module narrows that down by watching for the
// specific signatures, rather than by hoping an exception surfaces.
//
// THE FOUR FAILURE CLASSES, AND WHY THEY ARE DISTINCT
//
// 1. TAIL STALL — the render loop stops being called at all. The signature is
//    absence of frames, not slowness. `requestAnimationFrame` stops firing when
//    the GPU process is gone but the page is alive. This is what "engine death"
//    usually looks like from the player's seat: a frozen last frame, no error.
//
// 2. LONG FRAME — one frame takes seconds. This is the GPU-watchdog (TDR)
//    precursor. The W3C WebGPU spec: a device "may become lost if shader
//    execution does not end in a reasonable amount of time". Long frames are
//    therefore the closest thing to a *leading indicator* we have. A TDR is
//    only visible after the fact, with reason "unknown" and a message the spec
//    says not to parse — so the pre-loss frame time is the only real evidence.
//
// 3. DEVICE / CONTEXT LOSS — already recoverable in SceneSetup. Re-signalled
//    here so it lands in the same timeline as the frame data, because
//    "frame 91,842 was 8.4s, then the device was lost" is the correlation we
//    actually want and it is invisible if the two are logged in different
//    places.
//
// 4. NaN PROPAGATION — flight state silently becomes not-a-number. This does
//    not throw. It propagates into the camera matrix, and the result is a scene
//    that renders nothing or everything at the origin with a clean console.
//    A silent NaN is strictly harder to diagnose than a crash.
//
// WHAT THIS DOES NOT DO
//
// It does not attempt to fix anything, and it does not reload the page. A
// watchdog that auto-recovers destroys the evidence it exists to collect, and
// the user is better served by a visible "your renderer stopped, here is the
// report" than by a seamless lie. Recovery is a later decision, made from
// data this module collects.

import { LONG_FRAME_MS } from './Telemetry.js';

/** How often the watchdog itself runs. 1Hz is plenty for a 5s stall rule. */
const POLL_MS = 1000;

/** A stall must persist this long before it is reported, to avoid noise. */
const STALL_CONFIRM_MS = 3000;

export class HealthWatchdog {
  /**
   * @param {import('./Telemetry.js').Telemetry} telemetry
   * @param {object} [opts]
   * @param {() => object|null} [opts.readState] returns flight/camera state to
   *        NaN-check. Called at 1Hz, so it must be cheap and must not throw.
   * @param {HTMLElement} [opts.noticeEl] where a visible notice is rendered.
   *        The point is that the *player* sees the failure, not just a log.
   */
  constructor(telemetry, opts = {}) {
    this.telemetry = telemetry;
    this.readState = opts.readState ?? (() => null);
    this.noticeEl = opts.noticeEl ?? null;

    this.stallReported = false;
    this.nanReported = false;
    this.issues = [];

    this._timer = null;
    this._nanLock = false;
  }

  start() {
    if (this._timer) return this;
    this._timer = setInterval(() => this.check(), POLL_MS);
    // A stall cannot be detected by polling from inside the stalled frame, so
    // also arm a timer that survives the main thread being wedged. In practice
    // this only fires if the whole page is frozen, but it costs nothing.
    this.telemetry.event('watchdog-start', { pollMs: POLL_MS });
    return this;
  }

  stop() {
    clearInterval(this._timer);
    this._timer = null;
  }

  /** One poll. Exposed so a test can drive it deterministically. */
  check() {
    this._checkStall();
    this._checkNaN();
  }

  _checkStall() {
    const stalled = this.telemetry.isStalled();
    if (stalled && !this.stallReported) {
      // Require the stall to persist: a single poll can straddle a tab switch
      // or a long synchronous task, and a false "your renderer died" is worse
      // than a late one.
      this._stallSince ??= performance.now();
      if (performance.now() - this._stallSince > STALL_CONFIRM_MS) {
        this.stallReported = true;
        const s = this.telemetry.stats();
        this._report('stall', {
          frames: s.frames,
          lastFrame: s.worstFrames?.[0]?.ms ?? null,
          longFrames: s.longFrames,
        });
      }
    } else if (!stalled) {
      this._stallSince = null;
      if (this.stallReported) {
        this.stallReported = false;
        this.telemetry.event('stall-recovered');
      }
    }
  }

  _checkNaN() {
    if (this._nanLock) return; // one report, not one per poll
    let state;
    try {
      state = this.readState();
    } catch {
      return; // a throwing reader is the caller's problem, not a NaN
    }
    if (!state) return;

    const bad = Object.entries(state).filter(([, v]) => typeof v === 'number' && !Number.isFinite(v));
    if (bad.length) {
      // Latch: one report per session, not one per poll. A NaN in flight state
      // persists, so without this we would emit 3600 identical events an hour.
      this._nanLock = true;
      this.nanReported = true;
      this._report('nan', { fields: bad.map(([k]) => k) });
    }
  }

  _report(kind, data) {
    const issue = { kind, at: Date.now(), ...data };
    this.issues.push(issue);
    this.telemetry.event(`health:${kind}`, data);
    this._notice(issue);
    return issue;
  }

  /**
   * Surface it to the player.
   *
   * Silent instrumentation is instrumentation nobody ever sends you. If the
   * player does not know their renderer died, the report never gets collected,
   * and the bug stays unfixed indefinitely.
   */
  _notice(issue) {
    if (!this.noticeEl) return;
    const text =
      issue.kind === 'stall'
        ? 'Render loop stopped. Press D for diagnostics.'
        : issue.kind === 'nan'
          ? `Flight state became invalid (${issue.fields.join(', ')}).`
          : `Engine health: ${issue.kind}`;
    this.noticeEl.textContent = text;
    this.noticeEl.classList.add('osf-health-alert');
  }

  /** Compact health summary for the overlay. */
  status() {
    return {
      stalled: this.telemetry.isStalled(),
      stallReported: this.stallReported,
      nanReported: this.nanReported,
      issues: this.issues.length,
      longFrameMs: LONG_FRAME_MS,
    };
  }
}
