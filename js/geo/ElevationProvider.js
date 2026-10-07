// Fetches and decodes AWS Terrarium elevation tiles into Float32Array heightmaps
// Source: https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
// Encoding: height = (R * 256 + G + B / 256) - 32768

import { acquireFetch, releaseFetch } from './fetchSemaphore.js';
import { tileUrl } from './TileUrls.js';
import Logger from '../utils/Logger.js';
export default class ElevationProvider {
  // LRU cache: each tile is a 256x256 Float32Array (256KB). Cap at 300 tiles
  // (~75MB) to avoid unbounded growth during long flights (iPad OOM killer).
  static MAX_CACHED_TILES = 300;

  constructor() {
    this._cache = new Map(); // key -> heightmap; insertion order = LRU order
    this._pending = new Map(); // in-flight fetch promises, keyed by tile key
    this._canvas = document.createElement('canvas');
    this._canvas.width = 256;
    this._canvas.height = 256;
    this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });
  }

  async fetchHeightmap(tileX, tileY, zoom) {
    const key = `${zoom}/${tileX}/${tileY}`;
    if (this._cache.has(key)) {
      // Refresh LRU position: delete + re-insert moves to most-recent
      const hm = this._cache.get(key);
      this._cache.delete(key);
      this._cache.set(key, hm);
      Logger.debug('Elevation', `Cache hit: ${key}`);
      return hm;
    }

    // Deduplicate in-flight requests: return existing promise if fetch already running
    if (this._pending.has(key)) return this._pending.get(key);

    const promise = this._doFetch(key, tileX, tileY, zoom);
    this._pending.set(key, promise);
    promise.finally(() => this._pending.delete(key));
    return promise;
  }

  async _doFetch(key, tileX, tileY, zoom) {
    await acquireFetch();
    try {
      // Check cache again — another request may have populated it while queued
      if (this._cache.has(key)) return this._cache.get(key);

      const url = tileUrl('terrarium', zoom, tileX, tileY);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Tile fetch failed (${response.status}): ${url}`);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);

      this._ctx.clearRect(0, 0, 256, 256);
      this._ctx.drawImage(bitmap, 0, 0, 256, 256);
      bitmap.close();

      const imageData = this._ctx.getImageData(0, 0, 256, 256);
      const pixels = imageData.data;

      const heightmap = new Float32Array(256 * 256);
      let min = Infinity,
        max = -Infinity;
      for (let i = 0; i < 256 * 256; i++) {
        const p = i * 4;
        const r = pixels[p];
        const g = pixels[p + 1];
        const b = pixels[p + 2];
        const h = r * 256 + g + b / 256 - 32768;
        heightmap[i] = h;
        if (h < min) min = h;
        if (h > max) max = h;
      }

      Logger.info('Elevation', `Fetched ${key}`, { min: Math.round(min), max: Math.round(max) });

      this._cache.set(key, heightmap);
      // Evict least-recently-used tiles beyond the cap
      while (this._cache.size > ElevationProvider.MAX_CACHED_TILES) {
        const oldestKey = this._cache.keys().next().value;
        this._cache.delete(oldestKey);
      }
      return heightmap;
    } finally {
      releaseFetch();
    }
  }

  clearCache() {
    this._cache.clear();
    this._pending.clear();
  }
}
