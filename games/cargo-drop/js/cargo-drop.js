// Cargo Drop — deliver supplies to a marked zone.
//
// The only two-phase game in the catalogue: you must first reach a pickup,
// load, then reach a drop zone and release at the right height. Scoring is on
// the release, not the flight, which means the interesting decision is when to
// let go — too high and it overshoots, too low and it never reaches.

import * as THREE from 'three';
import { runGame } from '../../../js/games/shell.js';
import { makeBeacon, makeGroundMark, disposeTree } from '../../../js/games/marks.js';
import { buildPlane } from '../../../js/aircraft/planes/PlaneFactory.js';
import { showPopup } from '../../../js/ui/ScorePopups.js';
import { soundFX } from '../../../js/audio/SoundFX.js';

const PICKUP = { x: 0, z: -1500 };
const DROP_ZONE = { x: 1500, z: -3400, radius: 90 };
const RELEASE_ALTITUDE = 320; // above the zone's ground: the best score window
const MAX_ALTITUDE = 1600;

// Scratch objects for the pod-tracking camera so the frame loop allocates nothing.
const _trackM = new THREE.Matrix4();
const _trackQ = new THREE.Quaternion();
const _trackUp = new THREE.Vector3(0, 1, 0);

runGame({
  id: 'cargo-drop',
  name: 'CARGO DROP',
  accent: '#7df9ff',
  tagline: 'Collect the load, then release it into the zone',
  bar: { label: 'CARGO' },
  camera: { distance: 42, height: 14 },
  extra: `<button id="btn-drop" type="button" title="Release the load (Space)" style="
      position: fixed; left: 50%; bottom: calc(22px + env(safe-area-inset-bottom));
      transform: translateX(-50%); z-index: 15; display: none;
      min-width: 132px; min-height: 64px; padding: 14px 28px;
      background: rgba(60, 38, 2, 0.85); color: #ffd24d;
      border: 2px solid #ffd24d; border-radius: 14px;
      font-family: var(--mono); font-size: 17px; font-weight: 700; letter-spacing: 3px;
      cursor: pointer; touch-action: manipulation;">DROP</button>`,

  start(ctx) {
    const { scene, terrain, flight } = ctx;
    const ground = terrain.getGroundElevation(PICKUP.x, PICKUP.z);
    flight.position.set(PICKUP.x, ground + 260, PICKUP.z + 320);
    flight.yaw = 0;
    flight.pitch = 0;
    flight.speed = 58;
    ctx.input.throttle = 0.5;

    const { group } = buildPlane('otter');
    scene.add(group);
    ctx.plane = group;

    // Pickup beacon
    const pk = makeBeacon({
      position: new THREE.Vector3(PICKUP.x, ground + 40, PICKUP.z),
      height: 220,
      color: 0x7df9ff,
    });
    scene.add(pk);
    ctx.pickup = pk;

    // Drop zone, laid on the terrain under it, plus a tall beacon pillar so the
    // zone is visible from release altitude (the pickup gets one too).
    const dzGround = terrain.getGroundElevation(DROP_ZONE.x, DROP_ZONE.z);
    const zone = makeGroundMark({
      position: new THREE.Vector3(DROP_ZONE.x, dzGround, DROP_ZONE.z),
      radius: DROP_ZONE.radius,
      color: 0x00ff88,
    });
    scene.add(zone);
    ctx.zone = zone;
    ctx.zoneGround = dzGround;
    const dzBeacon = makeBeacon({
      position: new THREE.Vector3(DROP_ZONE.x, dzGround + 40, DROP_ZONE.z),
      height: 260,
      color: 0x00ff88,
    });
    scene.add(dzBeacon);
    ctx.zoneBeacon = dzBeacon;

    // The pod itself: a small mesh that rides with the plane until released.
    const pod = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffd93d }));
    pod.visible = false;
    scene.add(pod);
    ctx.pod = pod;

    ctx.phase = 'to-pickup';
    ctx.dropped = null;
    ctx.result = 0;
    // Pod-tracking camera blend and input edge state (reset every run).
    ctx.trackPod = 0;
    ctx.impactT = -10;
    ctx._spaceWasDown = false;
    // Wire the DROP button. Property assignment is idempotent across restarts.
    const dropBtn = document.getElementById('btn-drop');
    if (dropBtn) {
      dropBtn.style.display = 'none';
      dropBtn.onclick = () => {
        if (ctx.phase === 'to-drop') _release(ctx);
      };
    }
    return () => {
      disposeTree(ctx.plane);
      disposeTree(ctx.pickup);
      disposeTree(ctx.zone);
      disposeTree(ctx.zoneBeacon);
      disposeTree(ctx.pod);
      const b = document.getElementById('btn-drop');
      if (b) b.style.display = 'none';
    };
  },

  update(dt, ctx) {
    const { flight, input, terrain } = ctx;
    flight.update(dt, input.sample());
    ctx.plane.position.copy(flight.position);
    ctx.plane.quaternion.copy(flight.quaternion);

    // Soft ceiling, so "how high can I go to get a better release" is bounded.
    if (flight.position.y > MAX_ALTITUDE) flight.position.y = MAX_ALTITUDE;

    const dx = ctx.phase === 'to-pickup' ? PICKUP.x - flight.position.x : DROP_ZONE.x - flight.position.x;
    const dz = ctx.phase === 'to-pickup' ? PICKUP.z - flight.position.z : DROP_ZONE.z - flight.position.z;
    ctx.range = Math.hypot(dx, dz);

    if (ctx.phase === 'to-pickup') {
      ctx.pod.visible = false;
      if (ctx.range < 90) {
        ctx.phase = 'to-drop';
        ctx.pod.visible = true;
        ctx.pickup.visible = false;
        ctx.msg = 'LOAD SECURED — DROP WITH THE BUTTON OR SPACE';
        ctx.msgUntil = ctx.t + 2.5;
        soundFX.pickup();
      }
    } else if (ctx.phase === 'to-drop') {
      ctx.pod.position.copy(flight.position);
      ctx.pod.position.y -= 6;
      // Release: the on-screen DROP button (touch) or the Space key (desktop).
      // Edge-detected so holding Space during pickup can't auto-release.
      const spaceDown = !!input.keys.Space;
      if (spaceDown && !ctx._spaceWasDown) _release(ctx);
      ctx._spaceWasDown = spaceDown;
    } else if (ctx.phase === 'falling' && ctx.dropped) {
      // Ballistic fall, integrated explicitly so it is frame-rate independent.
      const g = terrain.getGroundElevation(ctx.dropped.x, ctx.dropped.z);
      ctx.dropped.vy -= 9.8 * dt;
      ctx.dropped.x += ctx.dropped.vx * dt;
      ctx.dropped.y += ctx.dropped.vy * dt;
      ctx.dropped.z += ctx.dropped.vz * dt;
      ctx.pod.position.copy(ctx.dropped);
      if (ctx.dropped.y <= g + 2) {
        ctx.pod.position.y = g + 2;
        ctx.impactT = ctx.t; // the tracking camera holds on the pod a beat longer
        const miss = Math.hypot(ctx.dropped.x - DROP_ZONE.x, ctx.dropped.z - DROP_ZONE.z);
        ctx.result = _score(ctx, miss);
        ctx.phase = 'done';
      }
    }
  },

  render(ctx) {
    const bar = document.getElementById('prox-bar');
    const d = document.getElementById('hud-dist');
    if (bar) {
      const alt = Math.max(0, Math.round(ctx.flight.position.y - ctx.zoneGround));
      // The bar reads as "how good is my current release altitude", so full
      // bar means ideal, not "close". Deliberately not a distance bar.
      const off = Math.min(1, Math.abs(alt - RELEASE_ALTITUDE) / 900);
      bar.style.width = `${(1 - off) * 100}%`;
    }
    if (d)
      d.textContent =
        ctx.phase === 'to-pickup'
          ? `${Math.round(ctx.range ?? 0)} m to load`
          : `${Math.round(ctx.range ?? 0)} m to zone`;
    // The DROP button only exists while there is something to drop.
    const dropBtn = document.getElementById('btn-drop');
    if (dropBtn) dropBtn.style.display = ctx.phase === 'to-drop' ? 'block' : 'none';
  },

  scoring(ctx) {
    if (ctx.phase === 'done') {
      return { score: ctx.result, over: true, text: `DELIVERED — ${ctx.result}` };
    }
    return { score: 0, over: false };
  },

  // Runs in the shell after the chase camera. While the pod is falling — and
  // for a beat after impact — swing the camera to watch it instead of staring
  // at the back of the plane. The blend ramps so the cut is never jarring.
  postCamera(ctx, dt) {
    let target = 0;
    if (ctx.phase === 'falling') target = 1;
    else if (ctx.phase === 'done' && ctx.t - ctx.impactT < 1.4) target = 1;
    const prev = ctx.trackPod ?? 0;
    const blend = prev + (target - prev) * Math.min(1, dt * 3);
    ctx.trackPod = blend;
    if (blend > 0.02 && ctx.pod && ctx.pod.visible) {
      _trackM.lookAt(ctx.camera.position, ctx.pod.position, _trackUp);
      _trackQ.setFromRotationMatrix(_trackM);
      ctx.camera.quaternion.slerp(_trackQ, Math.min(1, blend));
    }
  },
});

function _release(ctx) {
  ctx.phase = 'falling';
  ctx.dropped = {
    x: ctx.flight.position.x,
    y: ctx.flight.position.y - 6,
    z: ctx.flight.position.z,
    // Inherit the aircraft's own velocity, so the line is something you fly.
    vx: ctx.flight.velocity.x,
    vy: ctx.flight.velocity.y,
    vz: ctx.flight.velocity.z,
  };
  ctx.pod.visible = true;
  ctx.msg = 'RELEASED';
  ctx.msgUntil = ctx.t + 1.5;
}

function _score(ctx, miss) {
  if (miss > DROP_ZONE.radius) {
    ctx.msg = `MISSED BY ${Math.round(miss - DROP_ZONE.radius)} m`;
    ctx.msgUntil = ctx.t + 3;
    return 0;
  }
  const accuracy = 1 - miss / DROP_ZONE.radius;
  ctx.msg = `HIT — ${Math.round(accuracy * 100)}% ACCURACY`;
  ctx.msgUntil = ctx.t + 3;
  const pts = Math.round(1000 * accuracy);
  showPopup(`+${pts}`, '50%', '35%', '#7cfc00');
  soundFX.score(accuracy);
  return pts;
}
