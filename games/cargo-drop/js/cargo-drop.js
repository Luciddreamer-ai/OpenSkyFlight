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

const PICKUP = { x: 0, z: -1500 };
const DROP_ZONE = { x: 1500, z: -3400, radius: 90 };
const RELEASE_ALTITUDE = 320; // above the zone's ground: the best score window
const MAX_ALTITUDE = 1600;

runGame({
  id: 'cargo-drop',
  name: 'CARGO DROP',
  accent: '#7df9ff',
  tagline: 'Collect the load, then release it into the zone',
  bar: { label: 'CARGO' },
  camera: { distance: 42, height: 14 },

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

    // Drop zone, laid on the terrain under it
    const dzGround = terrain.getGroundElevation(DROP_ZONE.x, DROP_ZONE.z);
    const zone = makeGroundMark({
      position: new THREE.Vector3(DROP_ZONE.x, dzGround, DROP_ZONE.z),
      radius: DROP_ZONE.radius,
      color: 0x00ff88,
    });
    scene.add(zone);
    ctx.zone = zone;
    ctx.zoneGround = dzGround;

    // The pod itself: a small mesh that rides with the plane until released.
    const pod = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffd93d }));
    pod.visible = false;
    scene.add(pod);
    ctx.pod = pod;

    ctx.phase = 'to-pickup';
    ctx.dropped = null;
    ctx.result = 0;
    return () => {
      disposeTree(ctx.plane);
      disposeTree(ctx.pickup);
      disposeTree(ctx.zone);
      disposeTree(ctx.pod);
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
        ctx.msg = 'LOAD SECURED — HEAD FOR THE ZONE';
        ctx.msgUntil = ctx.t + 2.5;
      }
    } else if (ctx.phase === 'to-drop') {
      ctx.pod.position.copy(flight.position);
      ctx.pod.position.y -= 6;
      // Release: press the stick fully forward, or the S key.
      const s = input.sample();
      if (s.pitch > 0.9 || input.keys.KeyS) _release(ctx);
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
  },

  scoring(ctx) {
    if (ctx.phase === 'done') {
      return { score: ctx.result, over: true, text: `DELIVERED — ${ctx.result}` };
    }
    return { score: 0, over: false };
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
  return Math.round(1000 * accuracy);
}
