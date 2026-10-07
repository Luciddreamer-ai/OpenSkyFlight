// Reusable goal geometry.
//
// Half a dozen games need "a thing to fly through" and they were each going to
// build their own torus. These are the shapes that recur, with the pass/fail
// rule factored out, so a game says where the gate is and what it is worth
// rather than rebuilding the collision test each time.

import * as THREE from 'three';

/**
 * A torus the player must fly through, facing along `yaw`.
 * Returned object is disposable so a restart can free the geometry.
 */
export function makeGate({ position, yaw = 0, radius = 26, tube = 2.4, color = 0x7df9ff }) {
  const geo = new THREE.TorusGeometry(radius, tube, 12, 40);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  mesh.rotation.y = yaw;
  // A torus is built in the XY plane; stand it up so its hole faces along the
  // flight direction implied by `yaw`.
  mesh.rotation.x = 0;
  return mesh;
}

/** A vertical column of light, used for waypoints you approach rather than pass. */
export function makeBeacon({ position, height = 120, radius = 6, color = 0x00ff88 }) {
  const geo = new THREE.CylinderGeometry(radius, radius * 0.4, height, 12, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(position.x, position.y + height / 2, position.z);
  return mesh;
}

/** A ground marker: a flat disc laid on the terrain. */
export function makeGroundMark({ position, radius = 30, color = 0x00ff88, opacity = 0.4 }) {
  const geo = new THREE.RingGeometry(radius * 0.82, radius, 48);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(position.x, position.y + 1.5, position.z);
  return mesh;
}

/** Disposes a subtree's geometries and materials. Safe on a partial tree. */
export function disposeTree(root) {
  if (!root) return;
  root.traverse?.((o) => {
    o.geometry?.dispose?.();
    const m = o.material;
    if (Array.isArray(m)) m.forEach((x) => x?.dispose?.());
    else m?.dispose?.();
  });
  root.parent?.remove(root);
}

/**
 * Pass detection for a gate.
 *
 * The test is a plane crossing, not a proximity radius: the player must go
 * THROUGH the hole, so we track the sign of the player's offset along the
 * gate's normal and fire when it flips. A proximity-only test would fire for
 * someone who flew past the outside of the ring, which is the single most
 * common way this kind of game feels unfair.
 */
export function makeGateTest(gate, { radius = 26 } = {}) {
  const normal = new THREE.Vector3(0, 0, 1).applyEuler(gate.rotation);
  let lastSign = null;
  return {
    normal,
    reset() {
      lastSign = null;
    },
    /** @returns {boolean} true on the frame the player crosses the plane inside the hole */
    test(pos) {
      const offset = new THREE.Vector3().subVectors(pos, gate.position).dot(normal);
      const sign = Math.sign(offset);
      if (lastSign === null) {
        lastSign = sign;
        return false;
      }
      const crossed = sign !== 0 && lastSign !== 0 && sign !== lastSign;
      lastSign = sign;
      if (!crossed) return false;
      // Inside the hole?
      const d = new THREE.Vector3().subVectors(pos, gate.position);
      d.addScaledVector(normal, -d.dot(normal)); // remove the normal component
      return d.length() <= radius;
    },
    /** How close the player is to the plane, signed. Used for HUD proximity. */
    distance(pos) {
      return Math.abs(new THREE.Vector3().subVectors(pos, gate.position).dot(normal));
    },
  };
}
