// Slalom — alternating gates, low and fast.
//
// The inversion that makes this a different game from Ring Run: the gates sit
// low, near the ground, and are placed in a strict left-right alternation.
// Ring Run rewards an efficient line; Slalom punishes hesitating, because the
// next gate is always on the opposite side. The score is gates, not time, so
// speed is a tool rather than the objective.

import * as THREE from 'three';
import { runGame } from '../../../js/games/shell.js';
import { makeGate, makeGateTest, disposeTree } from '../../../js/games/marks.js';
import { buildPlane } from '../../../js/aircraft/planes/PlaneFactory.js';
import { showPopup } from '../../../js/ui/ScorePopups.js';
import { soundFX } from '../../../js/audio/SoundFX.js';

const GATES = 10;
const SPACING = 420;
const HALF_WIDTH = 210;

runGame({
  id: 'slalom',
  name: 'SLALOM',
  accent: '#ffd93d',
  tagline: 'Low and fast through an alternating gate course',
  bar: { label: 'GATE' },
  camera: { distance: 36, height: 12 },
  throttle: 0.62,

  start(ctx) {
    const { scene, terrain, flight } = ctx;
    flight.position.set(0, 420, 300);
    flight.yaw = 0;
    flight.pitch = 0;
    flight.speed = 74;

    const { group } = buildPlane('rafale');
    scene.add(group);
    ctx.plane = group;

    ctx.gates = [];
    ctx.tests = [];
    ctx.next = 0;
    ctx.z = -300;

    for (let i = 0; i < GATES; i++) {
      // Strict alternation — the whole game is that you are always turning.
      const side = i % 2 === 0 ? 1 : -1;
      const x = side * HALF_WIDTH;
      const ground = terrain.getGroundElevation(x, ctx.z);
      const y = Math.max(ground + 70, 200);
      const g = makeGate({ position: new THREE.Vector3(x, y, ctx.z), radius: 34, color: 0xffd93d });
      scene.add(g);
      ctx.gates.push(g);
      ctx.tests.push(makeGateTest(g, { radius: 34 }));
      ctx.z -= SPACING;
    }
    _paint(ctx);
    return () => {
      ctx.gates.forEach(disposeTree);
      disposeTree(ctx.plane);
      ctx.gates = [];
    };
  },

  update(dt, ctx) {
    const { flight, input, camera, terrain } = ctx;
    flight.update(dt, input.sample());
    ctx.plane.position.copy(flight.position);
    ctx.plane.quaternion.copy(flight.quaternion);
    const g = terrain.getGroundElevation(camera.position.x, camera.position.z);
    if (camera.position.y < g + 4) camera.position.y = g + 4;

    while (ctx.next < ctx.tests.length && ctx.tests[ctx.next].test(flight.position)) {
      ctx.gates[ctx.next].material.color.setHex(0x00ff88);
      ctx.next++;
      _paint(ctx);
      showPopup('+100');
      soundFX.pickup();
    }
  },

  render(ctx) {
    const bar = document.getElementById('prox-bar');
    const d = document.getElementById('hud-dist');
    if (ctx.next < ctx.tests.length) {
      const dist = ctx.tests[ctx.next].distance(ctx.flight.position);
      if (bar) bar.style.width = `${Math.max(0, 100 - Math.min(100, dist / 3))}%`;
      // Direction indicator: gates alternate right (even) / left (odd)
      const dir = ctx.next % 2 === 0 ? '▶' : '◀';
      if (d) d.textContent = `GATE ${ctx.next + 1}/${ctx.tests.length} ${dir} · ${Math.round(dist)} m`;
    } else if (bar) bar.style.width = '100%';
  },

  scoring(ctx) {
    return { score: ctx.next * 100 + Math.round(ctx.flight.speed), over: ctx.next >= ctx.tests.length };
  },
});

function _paint(ctx) {
  ctx.gates.forEach((g, i) => {
    g.material.opacity = i === ctx.next ? 1 : 0.28;
  });
}
