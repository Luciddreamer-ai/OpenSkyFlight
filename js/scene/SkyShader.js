/**
 * SkyShader — procedural sky dome with atmospheric scattering for Sitka Skies.
 *
 * A cheap, iPad-friendly replacement for a static skybox: one inverted sphere
 * with a single-pass GLSL shader (no textures, no compute, WebGL2-safe).
 *
 * Features:
 *  - Rayleigh-style zenith→horizon gradient (single-scatter approximation)
 *  - Time-of-day palettes: dawn (orange/pink), noon (blue), dusk (red/purple),
 *    night (dark navy)
 *  - Sun disk + glow, horizon glow that intensifies near sunrise/sunset
 *  - Procedural hash-based stars, visible only at night
 *  - Optional directional/ambient light sync so the sun position drives
 *    scene lighting
 *
 * Usage:
 *   import { createSky } from './js/scene/SkyShader.js';
 *   const sky = createSky({ dirLight, ambientLight }); // lights optional
 *   scene.add(sky);
 *   // per frame:
 *   sky.update(camera.position);
 *   // to change time:
 *   sky.setTimeOfDay(18.5); // 0–24
 *
 * Performance notes:
 *  - 32x16 sphere segments, BackSide, depthWrite off, rendered first at the
 *    far plane (gl_Position.z = gl_Position.w), so it never overdraws terrain.
 *  - All palette work is a handful of mixes; stars are one hash per pixel.
 */
import * as THREE from 'three';

const DEG2RAD = Math.PI / 180;

// Sun elevation (sine of) at which we consider it "day" vs "low sun" vs "night".
const DAY_ELEV = 0.45; // sin(elev) above this → full noon palette
const NIGHT_ELEV = -0.08; // sin(elev) below this → full night palette

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  // Sphere is centered on the camera, so object-space position IS the view dir.
  vDir = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // Push to the far plane: sky always behind everything, zero overdraw cost.
  gl_Position.z = gl_Position.w;
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;

uniform vec3 sunDirection; // normalized, world space
uniform float sunElev;     // sin(sun elevation), -1..1
uniform float duskMix;     // 0 = dawn side, 1 = dusk side
uniform float uTime;       // seconds, for star twinkle

// ---- palettes ----
const vec3 ZEN_NIGHT = vec3(0.008, 0.012, 0.045);
const vec3 HOR_NIGHT = vec3(0.020, 0.030, 0.090);
const vec3 ZEN_DAWN  = vec3(0.250, 0.350, 0.620);
const vec3 HOR_DAWN  = vec3(1.000, 0.550, 0.350);
const vec3 ZEN_NOON  = vec3(0.120, 0.320, 0.800);
const vec3 HOR_NOON  = vec3(0.620, 0.760, 0.900);
const vec3 ZEN_DUSK  = vec3(0.160, 0.100, 0.320);
const vec3 HOR_DUSK  = vec3(0.980, 0.380, 0.220);

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

void main() {
  vec3 d = normalize(vDir);
  vec3 sun = normalize(sunDirection);

  // ---- time-of-day blending ----
  float dayAmt   = smoothstep(0.10, ${DAY_ELEV.toFixed(2)}, sunElev);
  float nightAmt = 1.0 - smoothstep(${NIGHT_ELEV.toFixed(2)}, -0.02, sunElev);
  float lowAmt   = (1.0 - dayAmt) * (1.0 - nightAmt); // peaks near horizon

  vec3 zenLow = mix(ZEN_DAWN, ZEN_DUSK, duskMix);
  vec3 horLow = mix(HOR_DAWN, HOR_DUSK, duskMix);
  vec3 zenith  = mix(mix(zenLow, ZEN_NOON, dayAmt), ZEN_NIGHT, nightAmt);
  vec3 horizon = mix(mix(horLow, HOR_NOON, dayAmt), HOR_NIGHT, nightAmt);

  // ---- Rayleigh-style vertical gradient ----
  float h = d.y;
  float up = clamp(h, 0.0, 1.0);
  // pow curve: fast falloff near zenith, wide band near horizon (cheap Mie-ish feel)
  vec3 col = mix(horizon, zenith, pow(up, 0.55));
  // below horizon: settle toward horizon color (terrain covers it anyway)
  col = mix(col, horizon * 0.85, smoothstep(0.0, -0.25, h));

  // ---- sun disk + glow ----
  float cosA = dot(d, sun);
  float disk = smoothstep(0.99925, 0.99965, cosA);
  float glow = pow(max(cosA, 0.0), 350.0) * 1.4
             + pow(max(cosA, 0.0), 24.0) * 0.35;
  vec3 sunTint = mix(vec3(1.0, 0.96, 0.88), vec3(1.0, 0.45, 0.18), lowAmt);
  col += sunTint * (disk * 2.5 + glow) * (1.0 - nightAmt);

  // ---- horizon glow, strongest on the sun's side at low sun ----
  vec2 dxz = normalize(d.xz + vec2(1e-5));
  vec2 sxz = normalize(sun.xz + vec2(1e-5));
  float sunSide = pow(max(dot(dxz, sxz), 0.0), 3.0);
  float band = pow(1.0 - abs(h), 6.0);
  col += horLow * band * sunSide * lowAmt * 0.9;

  // ---- stars (night only, above horizon) ----
  float starVis = nightAmt * smoothstep(0.02, 0.25, h);
  if (starVis > 0.001) {
    vec3 cell = floor(d * 220.0);
    float hs = hash13(cell);
    vec3 f = fract(d * 220.0) - 0.5;
    float star = smoothstep(0.28, 0.05, length(f)) * step(0.93, hs);
    float twinkle = 0.7 + 0.3 * sin(uTime * 2.5 + hs * 40.0);
    col += vec3(0.85, 0.90, 1.0) * star * twinkle * starVis;
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Create the procedural sky.
 * @param {object} [opts]
 * @param {THREE.DirectionalLight} [opts.dirLight]  synced to sun position/color
 * @param {THREE.AmbientLight} [opts.ambientLight]  intensity follows time of day
 * @param {number} [opts.hour=10]                   initial time of day (0–24)
 * @returns {THREE.Mesh} sky mesh with .setTimeOfDay(h), .setSunDirection(v3),
 *                       .getSunDirection(), .update(cameraPos)
 */
export function createSky(opts = {}) {
  const { dirLight = null, ambientLight = null, hour = 10 } = opts;

  const uniforms = {
    sunDirection: { value: new THREE.Vector3(0, 1, 0) },
    sunElev: { value: 1 },
    duskMix: { value: 0 },
    uTime: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });

  // Small sphere; the vertex shader pins it to the far plane, so radius is
  // irrelevant to depth — keep segment count low for the vertex stage.
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000; // draw first, everything else overdraws it
  mesh.name = 'SkyShaderDome';

  const api = {
    /** Sun elevation as sin(elev), -1..1. */
    sunElev: 1,
    /** Normalized sun direction, world space. */
    sunDirection: uniforms.sunDirection.value,

    /**
     * Set time of day. Drives sun position, sky palette, and (if provided)
     * the directional/ambient lights.
     * @param {number} h hour in [0, 24)
     */
    setTimeOfDay(h) {
      const hour = ((h % 24) + 24) % 24;
      // Solar curve: sunrise ~6h, peak ~13h, sunset ~20h (long summer evening,
      // Sitka-style). Elevation as sin over the day arc.
      const dayT = (hour - 6) / 14; // 0 at 6h, 1 at 20h
      const elevSin = Math.sin(dayT * Math.PI); // 1 at ~13h, 0 at 6h/20h, <0 at night
      // Azimuth: 90° (east) at 6h → 180° (south) at 13h → 270° (west) at 20h.
      const azimDeg = 90 + dayT * 180;

      const phi = (90 - Math.asin(Math.max(-1, Math.min(1, elevSin))) / DEG2RAD) * DEG2RAD;
      const theta = azimDeg * DEG2RAD;
      uniforms.sunDirection.value.setFromSphericalCoords(1, phi, theta);
      uniforms.sunElev.value = elevSin;
      // Dawn side before solar noon, dusk side after — only matters near horizon.
      uniforms.duskMix.value = hour >= 13 ? 1 : 0;
      api.sunElev = elevSin;

      api._syncLights(elevSin);
      return api;
    },

    /**
     * Override sun direction directly (e.g. from a config UI).
     * @param {THREE.Vector3} dir normalized direction toward the sun
     */
    setSunDirection(dir) {
      uniforms.sunDirection.value.copy(dir).normalize();
      const e = uniforms.sunDirection.value.y;
      uniforms.sunElev.value = e;
      api.sunElev = e;
      api._syncLights(e);
      return api;
    },

    getSunDirection() {
      return uniforms.sunDirection.value;
    },

    /** Keep the dome centered on the camera; call once per frame. */
    update(cameraPos) {
      mesh.position.copy(cameraPos);
      uniforms.uTime.value = performance.now() / 1000;
      return api;
    },

    /** Internal: drive scene lights from sun elevation. */
    _syncLights(elevSin) {
      if (dirLight) {
        const dayAmt = THREE.MathUtils.smoothstep(elevSin, 0.1, DAY_ELEV);
        const nightAmt = 1 - THREE.MathUtils.smoothstep(elevSin, NIGHT_ELEV, -0.02);
        if (elevSin > NIGHT_ELEV) {
          // Sun: position + warm→white color ramp, brighter when high.
          dirLight.position.copy(uniforms.sunDirection.value).multiplyScalar(1e5);
          dirLight.color.setHex(0xffb36b).lerp(new THREE.Color(0xffffff), dayAmt);
          dirLight.intensity = 0.25 + dayAmt * 1.25;
        } else {
          // Moonlight: dim blue from a fixed high angle.
          dirLight.position.set(0.3, 1, 0.2).multiplyScalar(1e5);
          dirLight.color.setHex(0x8fa3cc);
          dirLight.intensity = 0.14 * nightAmt + 0.02;
        }
      }
      if (ambientLight) {
        const dayAmt = THREE.MathUtils.smoothstep(elevSin, 0.1, DAY_ELEV);
        ambientLight.intensity = 0.08 + dayAmt * 0.32;
      }
    },
  };

  // Attach the API to the mesh so callers can treat it as one object.
  mesh.setTimeOfDay = api.setTimeOfDay;
  mesh.setSunDirection = api.setSunDirection;
  mesh.getSunDirection = api.getSunDirection;
  mesh.update = api.update;
  mesh.sunDirection = api.sunDirection;

  api.setTimeOfDay(hour);
  return mesh;
}

export default createSky;
