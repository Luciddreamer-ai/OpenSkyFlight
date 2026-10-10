/**
 * VoiceCommander — voice control surface for the OpenSkyFlight sim.
 *
 * This is a *bridge*, not a flight model: every command drives the sim's own
 * control APIs and nothing else.
 *
 *  - Manual flight:  FlightController (throttle, setOrientation, enabled)
 *  - "fly to X":     FlightPlanRecorder public API — 3 waypoints are added,
 *                    a FlightPlan (Catmull-Rom spline) is built, and the
 *                    autopilot is engaged exactly the way the G key does it
 *                    (flightPlanRecorder.autopilotActive = true,
 *                     flightController.enabled = false). The sim's own
 *                    animate loop flies the spline and hands control back.
 *  - Destinations:   lat/lon → world via the terrain tileMap's geo2world()
 *                    (same projection the renderer uses — no parallel math).
 *
 * Honest limitations, documented where they bite:
 *  - The sim has no landing-gear state: any terrain contact runs the crash
 *    system. "land" therefore flies a real final approach + flare to the
 *    runway; touchdown resolves as the gentle 'bump'/'ditch' crash flavor.
 *  - The autopilot flies a constant-speed spline (CONFIG.cameraSpeed);
 *    throttle changes only apply to manual flight.
 */
import * as THREE from 'three';
import { showNotification } from '../ui/Notification.js';
import Logger from '../utils/Logger.js';

/** Named destinations: real lat/lon, cruise offset above terrain (m). */
export const VOICE_PLACES = [
  { key: 'cape edgecumbe', name: 'Cape Edgecumbe', lat: 57.044, lon: -135.7763, alt: 900 },
  { key: 'mount edgecumbe', name: 'Mount Edgecumbe', lat: 57.0507, lon: -135.752, alt: 1300 },
  { key: 'edgecumbe', name: 'Mount Edgecumbe', lat: 57.0507, lon: -135.752, alt: 1300, alias: true },
  { key: 'the volcano', name: 'Mount Edgecumbe', lat: 57.0507, lon: -135.752, alt: 1300, alias: true },
  { key: 'biorka', name: 'Biorka Island', lat: 56.8306, lon: -135.5397, alt: 700 },
  { key: 'biorka island', name: 'Biorka Island', lat: 56.8306, lon: -135.5397, alt: 700, alias: true },
  { key: 'sitka airport', name: 'Sitka Airport', lat: 57.0472, lon: -135.3619, alt: 500 },
  { key: 'the airport', name: 'Sitka Airport', lat: 57.0472, lon: -135.3619, alt: 500, alias: true },
  { key: 'the runway', name: 'Sitka Airport', lat: 57.0472, lon: -135.3619, alt: 500, alias: true },
  { key: 'sitka', name: 'Sitka', lat: 57.053, lon: -135.3399, alt: 800 },
  { key: 'kruzof', name: 'Kruzof Island', lat: 57.1, lon: -135.7, alt: 1000 },
  { key: 'kruzof island', name: 'Kruzof Island', lat: 57.1, lon: -135.7, alt: 1000, alias: true },
];

const _v = new THREE.Vector3();

export default class VoiceCommander {
  /**
   * @param {object} deps
   * @param {FlightController} deps.flightController
   * @param {FlightPlanRecorder} deps.flightPlanRecorder
   * @param {GeoTerrainManager} deps.geoTerrainManager
   * @param {object} deps.config - CONFIG
   * @param {function} [deps.onManualTakeover] - called when a voice command
   *   takes manual control (lets app.js cancel the scripted takeoff intro).
   */
  constructor({ flightController, flightPlanRecorder, geoTerrainManager, config, onManualTakeover }) {
    this.fc = flightController;
    this.rec = flightPlanRecorder;
    this.tm = geoTerrainManager;
    this.config = config;
    this.onManualTakeover = onManualTakeover || (() => {});
    this._flyingTo = null; // {name} while an autopilot leg is expected
    this._landing = null; // {phase} while a landing sequence is running
    this._lastResult = null;
  }

  get ready() {
    return !!(this.tm && this.tm.tileMap);
  }

  // --- coordinate helpers -------------------------------------------------
  latLonToWorld(lat, lon, out) {
    // Same projection the renderer uses: Mercator via three-tile, then the
    // tileMap's own local→world transform (rotation + centering offset).
    const w = this.tm.tileMap.geo2world(_v.set(lon, lat, 0));
    if (out) return out.set(w.x, w.y, w.z);
    return new THREE.Vector3(w.x, w.y, w.z);
  }

  worldToLatLon(x, z) {
    try {
      const g = this.tm.tileMap.world2geo(new THREE.Vector3(x, 0, z));
      return { lat: g.y, lon: g.x };
    } catch {
      return null;
    }
  }

  groundAt(x, z) {
    try {
      return this.tm.getGroundElevation(x, z) || 0;
    } catch {
      return 0;
    }
  }

  findPlace(text) {
    const t = text.toLowerCase();
    // longest key first so "cape edgecumbe" beats "edgecumbe"
    const sorted = [...VOICE_PLACES].sort((a, b) => b.key.length - a.key.length);
    return sorted.find((p) => t.includes(p.key)) || null;
  }

  // --- autopilot plumbing (mirrors the G-key handler in app.js) ------------
  disengageAutopilot() {
    if (this.rec.autopilotActive) {
      this.rec.autopilotActive = false;
      const plan = this.rec.getPlan();
      if (plan) {
        this.fc.position.copy(plan.position);
        this.fc.setOrientation(plan.yaw, plan.pitch);
      }
      this.fc.enabled = true;
      Logger.info('Voice', 'Autopilot disengaged (voice takeover)');
    }
    this._flyingTo = null;
  }

  _engagePlan(waypoints) {
    this.rec.clear();
    for (const wp of waypoints) {
      // addWaypoint takes a source with .position/.yaw — plain objects do.
      this.rec.addWaypoint({ position: wp.position, yaw: wp.yaw });
    }
    const plan = this.rec.buildPlan(this.fc);
    if (!plan) return false;
    this.rec.autopilotActive = true;
    this.fc.enabled = false;
    return true;
  }

  _bearingTo(from, to) {
    // yaw convention: forward = (-sin yaw, ·, -cos yaw); yaw 0 = north (-Z).
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    return Math.atan2(-dx, -dz);
  }

  // --- commands ------------------------------------------------------------
  /** Take manual control back from any automation. Call first in every command. */
  takeControl() {
    this.disengageAutopilot();
    this._landing = null;
    if (!this.fc.enabled) this.fc.enabled = true;
    this.onManualTakeover();
  }

  takeoff() {
    this.takeControl();
    const gnd = this.groundAt(this.fc.position.x, this.fc.position.z);
    const agl = this.fc.position.y - Math.max(gnd, 1);
    if (agl < 80) {
      // On/near the ground: full throttle, rotate — same shape as the intro.
      this.fc.throttle = 1;
      this.fc.setOrientation(this.fc.yaw, 0.12);
      this._done('takeoff', 'Rotate — full throttle, climbing out.');
    } else {
      this.fc.throttle = Math.min(1, this.fc.throttle + 0.35);
      this.fc.setOrientation(this.fc.yaw, Math.max(this.fc.pitch, 0.08));
      this._done('takeoff', 'Already airborne — throttle up, climbing.');
    }
    return this._lastResult;
  }

  flyTo(place) {
    if (!place) return this._fail('flyto', 'I need a destination — try "fly to cape edgecumbe".');
    this.takeControl();
    const dest = this.latLonToWorld(place.lat, place.lon);
    const destGnd = this.groundAt(dest.x, dest.z);
    dest.y = Math.max(destGnd, 1) + place.alt;
    const cur = this.fc.position.clone();
    const mid = cur.clone().lerp(dest, 0.5);
    mid.y = Math.max(cur.y, dest.y) + 250;
    const wps = [
      { position: cur, yaw: this.fc.yaw },
      { position: mid, yaw: this._bearingTo(cur, mid) },
      { position: dest, yaw: this._bearingTo(mid, dest) },
    ];
    if (!this._engagePlan(wps)) return this._fail('flyto', 'Could not build a flight plan.');
    this._flyingTo = { name: place.name };
    Logger.info('Voice', `Autopilot engaged → ${place.name}`);
    return this._done('flyto', `Autopilot set — flying to ${place.name}.`, { place });
  }

  land() {
    const apt = VOICE_PLACES.find((p) => p.key === 'sitka airport');
    this.takeControl();
    // Phase 1: autopilot to a point over the runway at pattern altitude.
    const dest = this.latLonToWorld(apt.lat, apt.lon);
    const destGnd = this.groundAt(dest.x, dest.z);
    dest.y = Math.max(destGnd, 1) + 220;
    const cur = this.fc.position.clone();
    const mid = cur.clone().lerp(dest, 0.5);
    mid.y = Math.max(cur.y, dest.y) + 200;
    const wps = [
      { position: cur, yaw: this.fc.yaw },
      { position: mid, yaw: this._bearingTo(cur, mid) },
      { position: dest, yaw: this._bearingTo(mid, dest) },
    ];
    if (!this._engagePlan(wps)) return this._fail('land', 'Could not build an approach.');
    this._landing = { phase: 'approach', apt, destGnd };
    Logger.info('Voice', 'Landing: approach leg engaged');
    return this._done('land', 'On approach to Sitka Airport — I will fly the final.');
  }

  /** Polled by the overlay (500 ms). Advances the landing state machine. */
  update() {
    // Arrival chatter for "fly to X".
    if (this._flyingTo && !this.rec.autopilotActive) {
      const name = this._flyingTo.name;
      this._flyingTo = null;
      showNotification(`Arrived at ${name} — you have the controls`);
      Logger.info('Voice', `Arrived at ${name}`);
      if (this._onEvent) this._onEvent({ type: 'arrived', name });
    }
    // Landing phases after the approach spline finishes.
    if (this._landing && !this.rec.autopilotActive) {
      const L = this._landing;
      const aptW = this.latLonToWorld(L.apt.lat, L.apt.lon);
      const surf = Math.max(L.destGnd, 1);
      const agl = this.fc.position.y - surf;
      if (L.phase === 'approach') {
        // Take manual control on short final, nose slightly down.
        this.fc.enabled = true;
        this.fc.throttle = 0.22;
        this.fc.setOrientation(this._bearingTo(this.fc.position, aptW), -0.06);
        L.phase = 'final';
        Logger.info('Voice', 'Landing: short final, manual');
      } else if (L.phase === 'final' && agl < 45) {
        this.fc.throttle = 0.1;
        this.fc.setOrientation(this.fc.yaw, -0.025); // flare
        L.phase = 'flare';
        Logger.info('Voice', 'Landing: flare');
      } else if (L.phase === 'flare' && agl < 14) {
        this.fc.throttle = 0.02;
        L.phase = 'done';
        Logger.info('Voice', 'Landing: touchdown (sim resolves as gentle bump)');
        showNotification('Touchdown at Sitka Airport');
        if (this._onEvent) this._onEvent({ type: 'landed' });
        this._landing = null;
      }
    }
  }

  onEvent(cb) {
    this._onEvent = cb;
  }

  turn(dir) {
    // dir: -1 = left, +1 = right
    this.takeControl();
    this.fc.setOrientation(this.fc.yaw + dir * 0.5, this.fc.pitch);
    return this._done('turn', dir < 0 ? 'Banking left.' : 'Banking right.');
  }

  speed(d) {
    // d: +1 faster, -1 slower. Autopilot flies constant spline speed, so
    // a speed command always means manual flight.
    this.takeControl();
    this.fc.throttle = Math.min(1, Math.max(0.02, this.fc.throttle + d * 0.25));
    const pct = Math.round(this.fc.throttle * 100);
    return this._done('speed', d > 0 ? `Throttle up — ${pct}%.` : `Easing off — ${pct}%.`);
  }

  hold() {
    this.takeControl();
    this.fc.throttle = 0.05;
    return this._done('stop', 'Holding — nearly stopped.');
  }

  status() {
    const p = this.fc.position;
    const ll = this.worldToLatLon(p.x, p.z);
    const altFt = Math.round(p.y * 3.28084);
    const spdKt = Math.round(this.fc.throttle * this.config.cameraSpeed * 1.94384);
    const hdg = Math.round(((Math.atan2(-Math.sin(this.fc.yaw), -Math.cos(this.fc.yaw)) * 180) / Math.PI + 360) % 360);
    const auto = this.rec.autopilotActive
      ? `autopilot to ${this._flyingTo ? this._flyingTo.name : 'waypoint'}`
      : 'manual';
    const where = ll
      ? `${Math.abs(ll.lat).toFixed(2)}°${ll.lat >= 0 ? 'N' : 'S'} ${Math.abs(ll.lon).toFixed(2)}°${ll.lon >= 0 ? 'E' : 'W'}`
      : '—';
    const text = `${altFt.toLocaleString()} ft · ${spdKt} kt · heading ${hdg}° · ${where} · ${auto}`;
    return this._done('status', text);
  }

  where() {
    const p = this.fc.position;
    let best = null;
    for (const pl of VOICE_PLACES) {
      if (pl.alias) continue;
      const w = this.latLonToWorld(pl.lat, pl.lon);
      const d = Math.hypot(w.x - p.x, w.z - p.z);
      if (!best || d < best.d) best = { p: pl, d };
    }
    const mi = (best.d / 1609.34).toFixed(1);
    return this._done('where', `${mi} miles from ${best.p.name}.`);
  }

  // --- result plumbing ------------------------------------------------------
  _done(action, reply, extra) {
    this._lastResult = { ok: true, action, reply, ...(extra || {}) };
    return this._lastResult;
  }

  _fail(action, reply) {
    this._lastResult = { ok: false, action, reply };
    return this._lastResult;
  }
}
