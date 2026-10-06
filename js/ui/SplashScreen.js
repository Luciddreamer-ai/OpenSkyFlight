// Splash screen: aircraft selection hangar.
// Shows on load, populates the plane grid from PlaneFactory, handles selection.
// The chosen plane is stored in localStorage and passed via ?plane= URL param.

import { PLANES } from '../aircraft/planes/PlaneFactory.js';
import Logger from './Logger.js';

const STORAGE_KEY = 'osf_plane';

export function getSelectedPlane() {
  // URL param wins, then localStorage, then default
  try {
    const params = new URLSearchParams(location.search);
    const p = params.get('plane');
    if (p && PLANES[p]) return p;
  } catch { /* non-browser */ }
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s && PLANES[s]) return s;
  } catch { /* no storage */ }
  return 'rafale';
}

export function initSplash(onFly) {
  const splash = document.getElementById('splash-screen');
  const grid = document.getElementById('plane-grid');
  const flyBtn = document.getElementById('fly-button');
  if (!splash || !grid || !flyBtn) {
    Logger.warn('Splash', 'Splash DOM not found, skipping');
    onFly(getSelectedPlane());
    return;
  }

  let selected = getSelectedPlane();

  // Build plane cards
  Object.entries(PLANES).forEach(([key, def]) => {
    const card = document.createElement('div');
    card.className = 'plane-card' + (key === selected ? ' selected' : '');
    card.dataset.plane = key;
    card.innerHTML = `<div class="plane-name">${def.name}</div><div class="plane-desc">${def.desc}</div>`;
    card.addEventListener('click', () => {
      selected = key;
      grid.querySelectorAll('.plane-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      try { localStorage.setItem(STORAGE_KEY, key); } catch { /* no storage */ }
      Logger.info('Splash', `Plane selected: ${def.name}`);
    });
    grid.appendChild(card);
  });

  flyBtn.addEventListener('click', () => {
    splash.classList.add('hidden');
    // Show the boot/loading overlay while the world prepares
    document.getElementById('boot-overlay')?.classList.remove('hidden');
    Logger.info('Splash', `Taking off in: ${PLANES[selected].name}`);
    onFly(selected);
  });

  // Allow Enter to fly
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Enter' && !splash.classList.contains('hidden')) {
      document.removeEventListener('keydown', handler);
      flyBtn.click();
    }
  });
}
