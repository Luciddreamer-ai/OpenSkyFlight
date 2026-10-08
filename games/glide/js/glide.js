// Glide — how far can you get with the engine off.
//
// The only energy-management game here. Throttle is not a speed control, it is
// a spend: pulling power converts altitude into speed and speed back into
// glide, and every second at full throttle is altitude you cannot have later.
// There is no fail state until you land, so the tension is entirely self-imposed
// — which is the point.

import * as THREE from 'three';
import { runGame } from '../../../js/games/shell.js';
import { makeGroundMark, disposeTree } from '../../../js/games/marks.js';
import { buildPlane } from '../../../js/aircraft/planes/PlaneFactory.js';
import { showPopup } from '../../../js/ui/ScorePopups.js';
import { soundFX } from '../../../js/audio/SoundFX.js';

const STRIP_Z = -2600;
const STRIP_X = 2600;

runGame({
  id: 'glide',
  name: 'GLIDE',
  accent: '#9ee37d',
  tagline: 'Engine out. Every metre of altitude is fuel you already spent.',
  bar: { label: 'ENERGY' },
  // The shared crash rule would preempt this game's own end condition:
  // landing is the goal, handled by `landed`.
  crashTest: () => false,
  camera: { distance: 40, height: 13 },

  start(ctx) {
    const { scene, terrain, flight } = ctx;
    const ground = terrain.getGroundElevation(0, 0);
    flight.position.set(0, ground + 900, 400);
    flight.yaw = 0;
    flight.pitch = 0;
    flight.speed = 52;
    ctx.input.throttle = 0;

    const { group } = buildPlane('beaver');
    scene.add(group);
    ctx.plane = group;

    // A visible target: the airstrip is the goal, and it is a real place.
    const destGround = terrain.getGroundElevation(2600, -2600);
    const mark = makeGroundMark({
      position: new THREE.Vector3(STRIP_X, destGround, STRIP_Z),
      radius: 120,
      color: 0x9ee37d,
    });
    scene.add(mark);
    ctx.mark = mark;
    ctx.startX = 0;
    ctx.startZ = 400;
    ctx.landed = false;

    return () => {
      disposeTree(ctx.plane);
      disposeTree(ctx.mark);
    };
  },

  update(dt, ctx) {
    const { flight, input, terrain } = ctx;
    const throttle = input.throttle;

    // Power is spent, not set. The aircraft converts it to speed like any
    // glider, so the player is always trading one quantity for the other.
    const target = 30 + throttle * 150;
    flight.speed += (target - flight.speed) * Math.min(1, dt * (0.5 + throttle * 2.2));

    const s = input.sample();
    // Throttle does not also drive pitch here, or the two would fight.
    flight.update(dt, { steer: s.steer, pitch: s.pitch, throttle: 0 });

    // A glider sinks unless it is trading speed for lift. Sink is worst when
    // slow and best near the best-glide speed, which gives a real rhythm to
    // the throttle: push when low, ease off when high.
    const glideEfficiency = 1 - Math.abs(flight.speed - 78) / 150;
    const sink = 4.5 + throttle * 14 - Math.max(0, glideEfficiency) * 0.9;
    flight.position.y -= sink * dt;

    ctx.plane.position.copy(flight.position);
    ctx.plane.quaternion.copy(flight.quaternion);

    const g = terrain.getGroundElevation(flight.position.x, flight.position.z);
    ctx.agl = flight.position.y - g;
    // Strip is at z = -2600; subtracting a negative is how this read wrong once.
    ctx.range = Math.hypot(flight.position.x - STRIP_X, flight.position.z - STRIP_Z);

    if (ctx.agl <= 2 && !ctx.landed) {
      ctx.landed = true;
      const travelled = Math.hypot(flight.position.x - ctx.startX, flight.position.z - ctx.startZ);
      ctx.finalDistance = travelled;
      showPopup(`${Math.round(travelled)} m FLOWN`, '50%', '35%', '#7cfc00');
      soundFX.win();
    }
  },

  render(ctx) {
    const bar = document.getElementById('prox-bar');
    const d = document.getElementById('hud-dist');
    if (bar) {
      // Energy: altitude above glide ratio, the quantity you are actually
      // managing. Going up fills it, going up on full throttle does not.
      const e = Math.max(0, Math.min(1, (ctx.agl ?? 0) / 1800));
      bar.style.width = `${e * 100}%`;
    }
    if (d) {
      d.textContent = ctx.landed
        ? `${Math.round(ctx.finalDistance ?? 0)} m flown`
        : `${Math.round(ctx.range ?? 0)} m to the strip`;
    }
  },

  scoring(ctx) {
    if (ctx.landed) {
      const dist = Math.round(ctx.finalDistance ?? 0);
      // Strip landing bonus: land within 120m of the strip for +1500 pts
      const stripDist = Math.hypot(ctx.flight.position.x - STRIP_X, ctx.flight.position.z - STRIP_Z);
      const bonus = stripDist <= 120 ? 1500 : 0;
      const bonusText = bonus > 0 ? ` · ON THE STRIP +${bonus}` : '';
      return { score: dist + bonus, over: true, text: `LANDED — ${dist} m FROM START${bonusText}` };
    }
    // Live score is distance so far, so the number climbs as you fly.
    return {
      score: Math.hypot(ctx.flight.position.x - 0, ctx.flight.position.z - 400),
      over: false,
    };
  },
});
