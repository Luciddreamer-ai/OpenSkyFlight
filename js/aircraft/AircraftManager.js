import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Logger from '../utils/Logger.js';
import { buildPlane, PLANES } from './planes/PlaneFactory.js';
import {
  AIRCRAFT_TARGET_LENGTH,
  VISUAL_ROLL_FACTOR,
  VISUAL_ROLL_MAX,
  VISUAL_PITCH_FACTOR,
  VISUAL_PITCH_MAX,
  VISUAL_SMOOTH,
} from '../constants/aircraft.js';

export default class AircraftManager {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.ready = false;
    this.planeType = 'rafale';
    this.planeDef = PLANES.rafale;

    this._visualRoll = 0;
    this._visualPitch = 0;

    this._qVisualRoll = new THREE.Quaternion();
    this._qVisualPitch = new THREE.Quaternion();
    this._qRoll = new THREE.Quaternion();
    this._axisZ = new THREE.Vector3(0, 0, 1);
    this._axisX = new THREE.Vector3(1, 0, 0);
  }

  // Load a plane by type: 'rafale' uses the GLTF, others use procedural models.
  // The GLTF path is guarded: THREE's loadAsync has no built-in timeout, and
  // a stalled asset download used to hang boot on "Loading…" forever (seen on
  // iOS, where a slow/hung fetch never settles). On timeout or failure we fall
  // back to the procedural Rafale — same flight model, simpler visuals — so
  // boot always proceeds. A late-arriving GLTF can never clobber the fallback
  // (generation guard).
  async loadPlane(type = 'rafale', { assetTimeoutMs = 20000 } = {}) {
    const gen = (this._loadGen = (this._loadGen || 0) + 1);
    this.planeType = type;
    // Clear previous
    if (this.group) {
      this.scene.remove(this.group);
      this.group = null;
      this.mesh = null;
    }
    if (type === 'rafale') {
      try {
        await this._withTimeout(this.load('assets/models/rafale/Rafale.gltf', gen), assetTimeoutMs, 'Rafale glTF');
      } catch (err) {
        // Invalidate the in-flight GLTF load so its late completion cannot
        // clobber the fallback scene graph.
        this._loadGen++;
        Logger.warn('Aircraft', `Rafale GLTF unavailable (${err.message}) — procedural fallback`);
        this._useProcedural('rafale');
      }
    } else {
      this._useProcedural(type);
    }
    return this.planeDef;
  }

  _useProcedural(type) {
    const { group, def } = buildPlane(type);
    this.planeDef = def;
    this.group = new THREE.Group();
    this.group.add(group);
    this.mesh = group;
    // Procedural models point nose along -Z already; match Rafale orientation
    this.scene.add(this.group);
    this.ready = true;
    Logger.info('Aircraft', `Procedural plane loaded: ${def.name}`);
  }

  _withTimeout(promise, ms, label) {
    let t;
    const timeout = new Promise((_, reject) => {
      t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
  }

  async load(url, gen) {
    const alive = () => gen === undefined || gen === this._loadGen;
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    if (!alive()) return; // timed out or superseded — leave the fallback alone
    this.mesh = gltf.scene;

    const box = new THREE.Box3().setFromObject(this.mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scaleFactor = AIRCRAFT_TARGET_LENGTH / maxDim;
    this.mesh.scale.setScalar(scaleFactor);

    const center = new THREE.Vector3();
    box.getCenter(center);
    center.multiplyScalar(scaleFactor);
    this.mesh.position.sub(center);

    this.group = new THREE.Group();
    this.group.add(this.mesh);

    this.mesh.rotation.y = Math.PI;

    // The glTF ships no embedded texture (the 972KB one it used to carry was
    // dead weight — it was decoded, then immediately replaced by the PNG
    // below). The plane's single source of texture is Rafale_texture.png.
    const texture = await new THREE.TextureLoader().loadAsync('assets/models/rafale/Rafale_texture.png');
    if (!alive()) return; // timed out or superseded — leave the fallback alone
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    // Apply to every mesh that uses a *texturable* material. Do NOT gate on
    // `child.material.map` being truthy: now that the glTF embeds no texture,
    // that guard is always false and the plane would render untextured.
    // Target the 'Paint' material by name instead — the other material in the
    // file is 'Glass', which is deliberately untextured (baseColorFactor black).
    this.mesh.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of materials) {
        if (mat.name === 'Glass') continue;
        mat.map = texture;
        mat.needsUpdate = true;
      }
    });

    const hiddenGearParts = new Set([
      'GearBoxRear',
      'GearBoxFront',
      'WheelL',
      'WheelR',
      'NoseWheelL',
      'NoseWheelR',
      'UpperStrutL',
      'UpperStrutR',
      'MainStrutL',
      'MainStrutR',
      'SideStrutL',
      'SideStrutR',
      'Strut1L',
      'Strut1R',
      'Strut2L',
      'Strut2R',
      'Strut3L',
      'Strut3R',
      'FrontMainStrut',
      'FrontLowerStrut',
      'FrontStrut1',
      'FrontStrut2',
      'FrontLights',
    ]);
    this.mesh.traverse((child) => {
      if (hiddenGearParts.has(child.name)) child.visible = false;
    });

    this.group.traverse((child) => {
      child.frustumCulled = false;
    });

    this.scene.add(this.group);
    this.ready = true;
    Logger.info(
      'Aircraft',
      `Rafale loaded — scaled ${scaleFactor.toFixed(2)}x (${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)} → ${AIRCRAFT_TARGET_LENGTH}m)`,
    );
  }

  update(state, dt) {
    if (!this.ready) return;

    const { position, roll, yawRate, pitchRate, quaternion } = state;

    // Spin helicopter rotor
    if (this.mesh && this.mesh.userData.rotor) {
      this.mesh.userData.rotor.rotation.y += dt * 18;
    }

    // Smooth visual roll and pitch (cosmetic tilt on the mesh)
    const targetRoll = Math.max(-VISUAL_ROLL_MAX, Math.min(VISUAL_ROLL_MAX, yawRate * VISUAL_ROLL_FACTOR));
    const targetPitch = Math.max(-VISUAL_PITCH_MAX, Math.min(VISUAL_PITCH_MAX, pitchRate * VISUAL_PITCH_FACTOR));
    const t = Math.min(1, VISUAL_SMOOTH * dt);
    this._visualRoll += (targetRoll - this._visualRoll) * t;
    this._visualPitch += (targetPitch - this._visualPitch) * t;

    // Start from base quaternion orientation
    this.group.position.copy(position);
    this.group.quaternion.copy(quaternion);

    // Apply roll + visual roll around local Z axis
    this._qRoll.setFromAxisAngle(this._axisZ, roll + this._visualRoll);
    this.group.quaternion.multiply(this._qRoll);

    // Apply visual pitch around local X axis
    this._qVisualPitch.setFromAxisAngle(this._axisX, this._visualPitch);
    this.group.quaternion.multiply(this._qVisualPitch);
  }

  setVisible(visible) {
    if (this.ready) this.group.visible = visible;
  }
}
