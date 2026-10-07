// Frame telemetry.
//
// WHY THIS EXISTS
//
// The project's single biggest unknown is not a feature, it is a measurement.
// `CapabilityProbe` picks potato/balanced/performance from static signals
// (adapter limits, renderer string, DPR, pointer type) and every one of those
// tier boundaries is currently a guess fitted to a single headless software
// rasteriser. We cannot tell an iPad user their device is slow, and we cannot
// tell the RTX 4050 user that `performance` is worth its 1400-tile budget,
// because nobody has ever captured a real frame time on either.
//
// The other unknown is the engine-death bug: the renderer sometimes stops.
// The W3C WebGPU spec is explicit that a device is lost if "shader execution
// does not end in a reasonable amount of time" — that is the GPU watchdog
// (TDR), and it is the leading suspect for a browser flight sim that streams
// terrain. But a TDR is only observable *during* the offending frame. By the
// time `device.lost` resolves, the evidence is gone: `GPUDeviceLostInfo.reason`
// is only ever "destroyed" or "unknown", and its `message` is explicitly
// documented as implementation-defined and not to be parsed.
//
// So the only way to catch this class of bug is to record frame time BEFORE the
// loss, keep the worst frames rather than an average, and correlate. An average
// is useless here: a 60fps app that hangs for 9 seconds every 4 minutes has a
// perfectly respectable mean. This module therefore keeps the slowest N frames
// with timestamps, and never collapses the evidence into a single number.
//
// WHAT IT DELIBERATELY DOES NOT DO
//
// It does not upload anything. There is no endpoint, no beacon, no analytics.
// A report leaves the device only when the player copies or downloads it
// themselves. Extracting engagement telemetry from a simulator, and shipping
// player flight data off-box without consent, is not a thing this project does.

/** Frames retained for percentile maths. ~2 minutes at 60fps. */
const WINDOW = 2400;

/** Slowest frames kept verbatim. This is the actual diagnostic payload. */
const WORST_KEEP = 12;

/**
 * A frame at or above this is logged as a "long frame" event.
 *
 * 2s is chosen to sit far below the ~10s GPU-watchdog threshold, so we
 * capture the approach to a TDR rather than only the aftermath. It is
 * deliberately far above any plausible jank (a GC pause or a tile decode is
 * single-digit milliseconds) so the event log stays readable.
 */
export const LONG_FRAME_MS = 2000;

/** Below this the page is considered backgrounded, not stalled. */
const RAF_STALL_MS = 5000;

export class Telemetry {
  constructor() {
    this._frames = new Float32Array(WINDOW);
    this._count = 0;
    this._head = 0;

    this.worst = [];
    this.events = [];
    this.longFrames = 0;
    this.frameCount = 0;
    this.startedAt = Date.now();

    this._lastTick = 0;
    this._lastFrameAt = performance.now();

    this.renderer = null;
    this.rendererInfo = null;
    this.tier = null;
    this.tierReasons = null;
    this.backend = null;

    // Sampled at 1Hz, not per frame: renderer.info is a live mutable object
    // and reading draw calls every frame would itself perturb the frame time
    // we are trying to measure.
    this._lastInfoSample = 0;
    this._infoTimer = null;
    this._started = false;

    this._onError = (e) => this.event('error', { message: String(e.message || e).slice(0, 200) });
    this._onRejection = (e) =>
      this.event('unhandledrejection', { message: String(e.reason?.message || e.reason).slice(0, 200) });
  }

  /** Attach to a renderer and start sampling `renderer.info`. */
  attach(renderer) {
    this.renderer = renderer;
    this.backend = renderer?.isWebGPURenderer ? 'webgpu' : 'webgl';
    this.tier = window.__osfCapabilityTier ?? null;
    this.tierReasons = window.__osfCapabilityReasons ?? null;
    return this;
  }

  /** Begin collecting. Safe to call once; repeated calls are ignored. */
  start() {
    if (this._started) return this;
    this._started = true;
    window.addEventListener('error', this._onError);
    window.addEventListener('unhandledrejection', this._onRejection);
    this._infoTimer = setInterval(() => this._sampleRendererInfo(), 1000);
    this.event('telemetry-start', { backend: this.backend, tier: this.tier });
    return this;
  }

  stop() {
    if (!this._started) return;
    this._started = false;
    window.removeEventListener('error', this._onError);
    window.removeEventListener('unhandledrejection', this._onRejection);
    clearInterval(this._infoTimer);
  }

  /**
   * Call once per frame, as early in the frame as practical.
   *
   * @param {number} nowMs  performance.now() for this frame
   * @param {string} [label] coarse phase name, so a long frame can be
   *        attributed to "flight" or "render" rather than just "somewhere"
   */
  tick(nowMs, label = 'frame') {
    const dt = this._lastTick ? nowMs - this._lastTick : 0;
    this._lastTick = nowMs;
    this._lastFrameAt = nowMs;
    if (dt <= 0 || dt > 60000) return; // first frame, or came back from background

    this._frames[this._head] = dt;
    this._head = (this._head + 1) % WINDOW;
    if (this._count < WINDOW) this._count++;
    this.frameCount++;

    if (dt > LONG_FRAME_MS) {
      this.longFrames++;
      this.event('long-frame', { ms: Math.round(dt), label });
    }

    // Keep the slowest frames, not a rolling average. Sorted descending, capped.
    const worst = this.worst;
    worst.push({ ms: Math.round(dt), label, at: Date.now() });
    if (worst.length > WORST_KEEP * 4) {
      worst.sort((a, b) => b.ms - a.ms);
      worst.length = WORST_KEEP;
    }
    return dt;
  }

  _sampleRendererInfo() {
    const info = this.renderer?.info;
    if (!info) return;
    const g = info.geometry ?? {};
    const t = info.textures ?? {};
    const m = info.memory ?? {};
    this.rendererInfo = {
      drawCalls: info.render?.drawCalls ?? null,
      triangles: info.render?.triangles ?? null,
      geometries: m.geometries ?? g.count ?? null,
      textures: m.textures ?? t.count ?? null,
      at: Date.now(),
    };
  }

  /** Record a structured event. Bounded, oldest dropped first. */
  event(type, data = {}) {
    const e = { type, at: Date.now(), ...data };
    this.events.push(e);
    if (this.events.length > 200) this.events.splice(0, this.events.length - 200);
    return e;
  }

  /** Sorted copy of the frame window, ascending. Allocates; not per-frame. */
  _sorted() {
    const out = Array.from(this._frames.subarray(0, this._count)).sort((a, b) => a - b);
    return out;
  }

  _pct(sorted, p) {
    if (!sorted.length) return null;
    const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
    return Math.round(sorted[i] * 100) / 100;
  }

  /**
   * Summary stats.
   *
   * p99 matters more than the mean here. A user reports "it's janky" and the
   * mean frame time is 16ms; the 99th percentile is 340ms. The mean hides
   * exactly the thing players notice and exactly the thing that precedes a
   * GPU-watchdog kill.
   */
  stats() {
    const s = this._sorted();
    const n = s.length;
    const mean = n ? s.reduce((a, b) => a + b, 0) / n : 0;
    const worstSorted = [...this.worst].sort((a, b) => b.ms - a.ms).slice(0, WORST_KEEP);
    return {
      frames: this.frameCount,
      samples: n,
      meanMs: Math.round(mean * 100) / 100,
      p50Ms: this._pct(s, 50),
      p95Ms: this._pct(s, 95),
      p99Ms: this._pct(s, 99),
      // FPS from p95, not the mean: a number a player could actually feel.
      worstFps: this._pct(s, 95) ? Math.round(1000 / this._pct(s, 95)) : null,
      maxMs: n ? Math.round(s[n - 1] * 100) / 100 : null,
      longFrames: this.longFrames,
      worstFrames: worstSorted,
    };
  }

  /**
   * True if the render loop appears to have stopped.
   *
   * Distinct from "is slow": this is the engine-death signature. A frame can
   * be 400ms and fine; no frame for 5s while the tab is focused means the rAF
   * callback is not coming back at all.
   */
  isStalled() {
    return this._started && performance.now() - this._lastFrameAt > RAF_STALL_MS;
  }

  /** Everything a developer needs, as a plain serialisable object. */
  report() {
    return {
      generatedAt: new Date().toISOString(),
      sessionMs: Date.now() - this.startedAt,
      backend: this.backend,
      tier: this.tier,
      tierReasons: this.tierReasons,
      device: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        dpr: window.devicePixelRatio,
        cores: navigator.hardwareConcurrency,
        memoryGb: navigator.deviceMemory ?? null,
        touchPoints: navigator.maxTouchPoints ?? null,
        screen: `${window.screen.width}x${window.screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      },
      perf: this.stats(),
      renderer: this.rendererInfo,
      events: this.events,
    };
  }
}

/** Human-readable one-liner, for pasting into an issue. */
export function formatReport(report) {
  const p = report.perf;
  return [
    `backend: ${report.backend}  tier: ${report.tier}  samples: ${p.samples}`,
    `frame ms  p50 ${p.p50Ms} / p95 ${p.p95Ms} / p99 ${p.p99Ms} / max ${p.maxMs}`,
    `worst sustained ~${p.worstFps}fps  long frames: ${p.longFrames}`,
    `draw calls: ${report.renderer?.drawCalls ?? '-'}  tris: ${report.renderer?.triangles ?? '-'}`,
    `device: ${report.device.screen} dpr ${report.device.dpr} cores ${report.device.cores}`,
    `events: ${report.events.length}`,
  ].join('\n');
}
