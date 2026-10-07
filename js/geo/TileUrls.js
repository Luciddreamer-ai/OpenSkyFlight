// Tile URL resolution for the active serving mode.
//
// 'proxy'  — tiles served by the local dev server (scripts/serve.js), which acts
//            as a transparent caching proxy at tiles/{source}/{z}/{x}/{y}.png.
// 'direct' — tiles fetched straight from the upstream providers. No server is
//            needed, which is what makes the game work on static hosts such as
//            GitHub Pages (and therefore on an iPad over plain Safari).
//
// All upstream sources send Access-Control-Allow-Origin: * (verified
// 2026-10-04), so direct cross-origin fetches work from the browser:
//   - OSM raster tiles:        tile.openstreetmap.org
//   - Terrarium elevation:     s3.amazonaws.com/elevation-tiles-prod
//   - ESRI World Imagery:      server.arcgisonline.com

// ROOT-RELATIVE, not document-relative.
//
// These paths are resolved by the browser against the CURRENT PAGE URL. From
// `/` they worked by accident. From `/games/bush-pilot/` a document-relative
// `tiles/...` resolves to `/games/bush-pilot/tiles/...`, which is a 404 — so
// every game page silently fell back to direct upstream fetches and the local
// caching proxy could never serve a game. A leading slash fixes it at any
// depth, and is a no-op for the root page.
const PROXY_TEMPLATES = {
  terrarium: '/tiles/terrarium/{z}/{x}/{y}.png',
  osm: '/tiles/osm/{z}/{x}/{y}.png',
  satellite: '/tiles/satellite/{z}/{x}/{y}.png',
};

const DIRECT_TEMPLATES = {
  terrarium: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  // NOTE: ESRI tile order is z/y/x (not z/x/y) — the dev proxy swaps these.
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

let mode = 'proxy';

function fill(template, z, x, y) {
  return template.replace('{z}', z).replace('{x}', x).replace('{y}', y);
}

/**
 * @returns {'proxy'|'direct'} the currently active tile serving mode
 */
export function getTileMode() {
  return mode;
}

/**
 * Resolve the tile serving mode once at startup.
 * - `?tiles=proxy|direct` forces a mode (handy for testing).
 * - Otherwise the local proxy is probed: when no tile server answers
 *   (e.g. GitHub Pages, file://), direct upstream mode is used.
 */
export async function detectTileMode() {
  try {
    const param = new URLSearchParams(location.search).get('tiles');
    if (param === 'proxy' || param === 'direct') {
      mode = param;
      return mode;
    }
  } catch {
    /* non-browser context — keep default */
  }

  if (typeof location !== 'undefined' && location.protocol === 'file:') {
    mode = 'direct';
    return mode;
  }

  try {
    // Terrarium zoom-0 tile exists upstream, so a working proxy answers 200.
    // Any non-OK response (e.g. GitHub Pages 404) means no proxy is present.
    const res = await fetch('/tiles/terrarium/0/0/0.png', { method: 'HEAD', cache: 'no-store' });
    mode = res.ok ? 'proxy' : 'direct';
  } catch {
    mode = 'direct';
  }
  return mode;
}

/**
 * URL template with {z}/{x}/{y} placeholders, for three-tile TileSource.
 * @param {'terrarium'|'osm'|'satellite'} source
 */
export function tileTemplate(source) {
  return (mode === 'direct' ? DIRECT_TEMPLATES : PROXY_TEMPLATES)[source];
}

/**
 * Concrete tile URL, for fetch() / Image-based loaders.
 * @param {'terrarium'|'osm'|'satellite'} source
 */
export function tileUrl(source, z, x, y) {
  return fill(tileTemplate(source), z, x, y);
}
