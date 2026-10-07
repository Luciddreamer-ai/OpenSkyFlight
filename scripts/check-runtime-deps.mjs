// Guard the dependencies the renderer actually loads.
//
// WHY
//
// The two libraries this app cannot run without are not in package.json and
// not in package-lock.json:
//
//   three       -> a jsDelivr URL in the <script type="importmap"> of every
//                  HTML page
//   three-tile  -> a local fork, vendor/three-tile/.../three-tile-osf.js
//
// package-lock.json is real and pins 87 packages, and it contains neither.
// So `npm ci` gives a reproducible toolchain for a renderer whose actual
// versions are governed by a string in an HTML file.
//
// That makes one specific failure likely and expensive: the sim pins one
// three version and a game page pins another. The pages still load — an
// importmap resolves per-document — and then three and three-tile disagree
// about a shared internal, and the symptom is a null-dereference in terrain
// code that points nowhere near the cause. This check makes that impossible
// to merge rather than impossible to diagnose.
//
// WHAT IT DELIBERATELY DOES NOT DO
//
// It does not query npm. A network call in a gate is a gate that fails for
// reasons unrelated to the code, and this check has to work on an air-gapped
// runner. Version currency is a human decision with a browser matrix attached;
// version CONSISTENCY is a mechanical fact and that is what this asserts.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
let failures = 0;
const ok = (m) => console.log(`  ok  ${m}`);
const fail = (m) => {
  failures++;
  console.log(`  FAIL ${m}`);
};

// --- collect every HTML page that declares an importmap ---------------------
function htmlFiles(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'vendor' || e.name === 'cache' || e.name === '.git') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) htmlFiles(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const pages = htmlFiles(ROOT);
if (!pages.length) fail('no HTML pages found — the glob is wrong, not the repo');

/** Pull the value of a bare specifier out of an importmap block. */
function importmapPin(src, spec) {
  const m = src.match(new RegExp(`"${spec.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')}":\\s*"([^"]+)"`));
  return m ? m[1] : null;
}

const pins = new Map(); // spec -> Map<page, value>
for (const page of pages) {
  const src = readFileSync(page, 'utf8');
  if (!src.includes('importmap')) continue;
  const rel = relative(ROOT, page);
  for (const spec of ['three', 'three/webgpu']) {
    const v = importmapPin(src, spec);
    if (!v) continue;
    if (!pins.has(spec)) pins.set(spec, new Map());
    pins.get(spec).set(rel, v);
  }
}

if (!pins.size) {
  fail('no importmap pins found — expected a "three" entry in at least one page');
} else {
  for (const [spec, byPage] of pins) {
    const values = new Set(byPage.values());
    if (values.size === 1) {
      const [v] = values;
      const m = v.match(/three@([\w.]+)/);
      ok(`"${spec}" pinned to three@${m ? m[1] : '?'} across ${byPage.size} page(s)`);
    } else {
      fail(
        `"${spec}" is pinned to ${values.size} DIFFERENT versions: ` +
          [...byPage.entries()].map(([p, v]) => `${p} -> ${v}`).join(' | '),
      );
    }
  }
}

// --- the vendored terrain library must actually be there -------------------
const vendored = join(ROOT, 'vendor/three-tile/packages/lib/dist/three-tile-osf.js');
if (!existsSync(vendored)) {
  fail('vendor/three-tile/.../three-tile-osf.js is missing — terrain will 404 at runtime');
} else {
  const bytes = statSync(vendored).size;
  if (bytes < 20000) fail(`vendored three-tile is only ${bytes}B — that looks truncated`);
  else ok(`vendored three-tile fork present (${(bytes / 1024).toFixed(0)}KB)`);
}

// --- and the pages that use it must resolve the same file ------------------
let importers = 0;
for (const page of pages) {
  const src = readFileSync(page, 'utf8');
  if (src.includes('three-tile')) {
    importers++;
    if (!src.includes('three-tile-osf.js')) {
      fail(`${relative(ROOT, page)} references three-tile but not the vendored fork path`);
    }
  }
}
if (importers) ok(`${importers} page(s) reference the vendored three-tile fork`);

if (failures) {
  console.error(`\ncheck-runtime-deps: ${failures} problem(s).`);
  process.exit(1);
}
console.log(`\ncheck-runtime-deps: OK — renderer dependencies are consistent across ${pages.length} page(s).`);
