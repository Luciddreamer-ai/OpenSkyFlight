// Diagnostics wiring, in one place.
//
// Three call sites need the same three things — a Telemetry bound to a
// renderer, a HealthWatchdog watching a piece of flight state, and a lazily
// loaded overlay behind the D key. Copying that wiring into app.js, the game
// runtime, and the standalone helicopter game would be three places to forget
// to update and three places to get subtly wrong, so it lives here once.
//
// The overlay is a DYNAMIC import on purpose. It is ~6KB of DOM-building code
// that most sessions never open; making it static would tax every boot to
// serve a diagnostic panel that is usually never shown.

import { Telemetry } from './Telemetry.js';
import { HealthWatchdog } from './HealthWatchdog.js';

/**
 * @param {object} opts
 * @param {THREE.Renderer} opts.renderer
 * @param {() => object|null} [opts.readState] flight/camera numbers to NaN-check
 * @returns {{telemetry: Telemetry, watchdog: HealthWatchdog, loadOverlay: () => Promise<any>}}
 */
export function attachDiagnostics({ renderer, readState }) {
  const telemetry = new Telemetry().attach(renderer).start();
  const watchdog = new HealthWatchdog(telemetry, { readState });
  watchdog.start();

  // Memoised. Without this, mashing the D key during the import — which on a
  // cold cache over a slow connection is a very easy thing to do — resolves
  // several concurrent imports and builds several overlays, each toggled once
  // and therefore all left on screen stacked on top of each other.
  let overlayPromise = null;
  const loadOverlay = () => {
    if (window.__osfOverlay) return Promise.resolve(window.__osfOverlay);
    overlayPromise ??= import('./DiagnosticsOverlay.js').then(({ DiagnosticsOverlay }) => {
      const overlay = new DiagnosticsOverlay(telemetry, watchdog);
      // The overlay owns the notice element so the watchdog and the panel
      // cannot disagree about whether the player was actually warned.
      watchdog.noticeEl = overlay.getNoticeElement();
      window.__osfOverlay = overlay;
      overlayPromise = null;
      return overlay;
    });
    return overlayPromise;
  };

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'd' && e.key !== 'D') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (window.__osfOverlay) {
      window.__osfOverlay.toggle();
      return;
    }
    // Presses arriving while the import is in flight are DROPPED, not queued.
    // Memoising the import alone is not enough: every queued press would still
    // run a toggle when it resolved, and six presses would leave the panel
    // closed. Exactly one press produces exactly one open.
    if (overlayPromise) return;
    // Immediate acknowledgement. A keypress with no response reads as a broken
    // game, and the import is slow enough on a cold cache to be noticeable.
    showLoadingHint();
    loadOverlay().then((o) => {
      hideLoadingHint();
      o.toggle();
    });
  });

  const HINT_ID = 'osf-diag-loading';
  function showLoadingHint() {
    if (document.getElementById(HINT_ID)) return;
    const n = document.createElement('div');
    n.id = HINT_ID;
    n.textContent = 'Loading diagnostics…';
    n.style.cssText =
      'position:fixed;top:8px;left:8px;z-index:2147483000;background:rgba(8,12,18,.93);' +
      'color:#7df9ff;border:1px solid #1d3b4d;border-radius:8px;padding:7px 12px;' +
      'font:12px ui-monospace,Menlo,monospace';
    document.body.appendChild(n);
  }
  function hideLoadingHint() {
    document.getElementById(HINT_ID)?.remove();
  }

  // Read-only triage surface. No behaviour is attached to these, so there is
  // nothing here for a third-party script to drive.
  window.__osfTelemetry = telemetry;
  window.__osfReport = () => telemetry.report();

  return { telemetry, watchdog, loadOverlay };
}

/**
 * Record one frame and feed the overlay if it happens to be open.
 * Safe to call every frame; the no-overlay path is a property read.
 */
export function tickDiagnostics(telemetry, nowMs = performance.now()) {
  if (!telemetry) return;
  const dt = telemetry.tick(nowMs);
  window.__osfOverlay?.push(dt);
  return dt;
}
