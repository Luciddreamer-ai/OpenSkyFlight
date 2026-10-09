import { CONFIG, update, onChange } from '../utils/config.js';
import Logger from '../utils/Logger.js';
import { showNotification } from './Notification.js';
import { MACH_1_MS } from '../constants/physics.js';

export default class ControlPanel {
  constructor(onRegenerate) {
    this.onRegenerate = onRegenerate;
    this.panel = document.getElementById('control-panel');
    this._hideTimeout = null;

    this._setupHoverBehavior();
    this._setupRealworldControls();
    this._setupQualityPreset();
    this._setupSpeedSlider();
    this._setupAtmosphere();

    this._bindCheckbox('showLogs', 'showLogs');

    this._setupLogLevel();
  }

  /**
   * Graphics quality: AUTO by default.
   *
   * The auto path is the capability probe (see CapabilityProbe) — it already
   * picks a sensible budget for iPad, discrete desktop, and unknown hardware.
   * This control exists for the cases a probe cannot know about: a user who
   * wants battery life over frame rate, or a device the probe classified
   * optimistically. It is deliberately an override of the probe, not a
   * replacement for it.
   */
  _setupQualityPreset() {
    const sel = document.getElementById('qualityPreset');
    const hint = document.getElementById('qualityHint');
    if (!sel) return;

    // Reflect whatever the URL already asked for, then fall back to the
    // shared preference the games write. Without this the sim and the nine
    // games keep separate quality settings, which is the opposite of the
    // point of having one preference.
    try {
      const forced = new URLSearchParams(location.search).get('quality');
      if (forced) sel.value = forced;
      else {
        const stored = localStorage.getItem('osf.quality');
        if (stored) sel.value = stored;
      }
    } catch {
      /* non-browser */
    }

    const describe = () => {
      if (!hint) return;
      const v = sel.value;
      if (v === 'auto') {
        const tier = window.__osfCapabilityTier;
        hint.textContent = tier
          ? `Detected: ${tier}. Resolution adapts to frame rate automatically.`
          : 'Detecting hardware…';
      } else {
        hint.textContent = 'Applied on next load.';
      }
    };

    sel.addEventListener('change', () => {
      const v = sel.value;
      try {
        const url = new URL(location.href);
        if (v === 'auto') url.searchParams.delete('quality');
        else url.searchParams.set('quality', v);
        // Persist to the key the games read, so one choice covers the sim and
        // all nine game pages instead of having to be repeated per page.
        try {
          if (v === 'auto') localStorage.removeItem('osf.quality');
          else localStorage.setItem('osf.quality', v);
        } catch {
          /* private mode */
        }
        // Two knobs change at boot only (antialias + tile LOD), so a reload is
        // the honest way to apply a preset. Say so instead of silently doing
        // half of it.
        if (v !== 'auto') {
          window.location.href = url.toString();
          return;
        }
        history.replaceState(null, '', url.toString());
      } catch {
        /* non-browser */
      }
      describe();
    });

    describe();
  }

  _bindCheckbox(elementId, configKey) {
    const cb = document.getElementById(elementId);
    cb.checked = CONFIG[configKey];
    cb.addEventListener('change', () => {
      update(configKey, cb.checked);
    });
  }

  _setupLogLevel() {
    const logLevelSelect = document.getElementById('logLevel');
    logLevelSelect.value = CONFIG.logLevel;
    logLevelSelect.addEventListener('change', () => {
      update('logLevel', logLevelSelect.value);
    });
  }

  _setupHoverBehavior() {
    const trigger = document.getElementById('panel-trigger');

    // Reflect open state on <body> so the trigger's chevron can flip from
    // "\u2039" (open) to "\u203a" (close) via CSS.
    const syncBodyClass = () => {
      const open = this.panel.classList.contains('visible');
      document.body.classList.toggle('panel-open', open);
      // Keep aria-expanded honest for screen readers.
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    const showPanel = () => {
      clearTimeout(this._hideTimeout);
      this.panel.classList.add('visible');
      syncBodyClass();
    };

    const hidePanel = () => {
      this.panel.classList.remove('visible');
      syncBodyClass();
    };

    const scheduleHide = () => {
      clearTimeout(this._hideTimeout);
      this._hideTimeout = setTimeout(hidePanel, 300);
    };

    // Tap/click is the PRIMARY mechanism on every device, not just touch: the
    // old 300ms hover auto-hide was fragile under an imprecise finger, and on
    // touch it could close the drawer immediately after opening it. Hover is
    // kept as a convenience on pointer-precise devices only.
    const coarsePointer =
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;

    if (!coarsePointer) {
      trigger.addEventListener('mouseenter', showPanel);
      trigger.addEventListener('mouseleave', scheduleHide);
      this.panel.addEventListener('mouseenter', showPanel);
      this.panel.addEventListener('mouseleave', scheduleHide);
    }

    trigger.addEventListener('click', () => {
      clearTimeout(this._hideTimeout);
      this.panel.classList.toggle('visible');
      syncBodyClass();
    });

    // Escape closes the panel (desktop affordance; harmless on touch).
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.panel.classList.contains('visible')) {
        clearTimeout(this._hideTimeout);
        hidePanel();
      }
    });

    // Opening the drawer should not leave it stranded: close it when a
    // pointer-down lands outside both the panel and the trigger. This replaces
    // the "auto-closes and cannot be reopened" dead end playtesters hit.
    document.addEventListener('pointerdown', (e) => {
      if (!this.panel.classList.contains('visible')) return;
      if (this.panel.contains(e.target) || trigger.contains(e.target)) return;
      clearTimeout(this._hideTimeout);
      hidePanel();
    });
  }

  _setupRealworldControls() {
    // --- Lat/Lon ---
    const latInput = document.getElementById('lat');
    const lonInput = document.getElementById('lon');
    latInput.value = CONFIG.lat;
    lonInput.value = CONFIG.lon;

    // --- Texture mode ---
    const texMode = document.getElementById('textureMode');
    texMode.value = CONFIG.textureMode;
    texMode.addEventListener('change', () => update('textureMode', texMode.value));
    onChange((key, value) => {
      if (key === 'textureMode') texMode.value = value;
    });

    // --- Place search ---
    const searchInput = document.getElementById('placeSearch');
    const searchBtn = document.getElementById('searchBtn');

    const doSearch = async () => {
      const query = searchInput.value.trim();
      if (!query) return;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        );
        const data = await res.json();
        if (data.length > 0) {
          latInput.value = parseFloat(data[0].lat).toFixed(4);
          lonInput.value = parseFloat(data[0].lon).toFixed(4);
        } else {
          showNotification('Location not found', 'warn');
        }
      } catch (err) {
        Logger.warn('ControlPanel', `Nominatim search failed: ${err.message}`);
        showNotification('Search error', 'error');
      }
    };

    searchBtn.addEventListener('click', doSearch);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSearch();
    });

    // --- Load terrain button ---
    const loadBtn = document.getElementById('loadTerrain');
    loadBtn.addEventListener('click', () => {
      update('lat', parseFloat(latInput.value));
      update('lon', parseFloat(lonInput.value));
      if (this.onRegenerate) this.onRegenerate();
    });
  }

  _setupSpeedSlider() {
    const slider = document.getElementById('cameraSpeed');
    const display = document.getElementById('cameraSpeed-val');
    const MIN_LOG = Math.log(1);
    const MAX_LOG = Math.log(4000);
    slider.min = 0;
    slider.max = 1000;
    slider.step = 1;

    const toSpeed = (pos) => Math.exp(MIN_LOG + (pos / 1000) * (MAX_LOG - MIN_LOG));
    const toPos = (speed) => Math.round(((Math.log(speed) - MIN_LOG) / (MAX_LOG - MIN_LOG)) * 1000);
    const formatSpeed = (ms) => {
      if (ms < MACH_1_MS) return Math.round(ms * 3.6) + ' km/h';
      return 'Mach ' + (ms / MACH_1_MS).toFixed(1);
    };

    slider.value = toPos(CONFIG.cameraSpeed);
    display.textContent = formatSpeed(CONFIG.cameraSpeed);

    slider.addEventListener('input', () => {
      const speed = toSpeed(Number(slider.value));
      display.textContent = formatSpeed(speed);
      update('cameraSpeed', speed);
    });
  }

  _setupAtmosphere() {
    this._setupSlider('sunElevation', 'sunElevation', 0, 90, 1);
    this._setupSlider('sunAzimuth', 'sunAzimuth', 0, 360, 1);
    this._setupSlider('skyTurbidity', 'skyTurbidity', 1, 10, 0.5);
    this._setupSlider('cloudAltitude', 'cloudAltitude', 500, 12000, 100);

    this._bindCheckbox('showClouds', 'showClouds');
    this._bindCheckbox('fogEnabled', 'fogEnabled');
  }

  _setupSlider(id, configKey, min, max, step) {
    const slider = document.getElementById(id);
    const display = document.getElementById(id + '-val');
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = CONFIG[configKey];
    display.textContent = CONFIG[configKey];

    slider.addEventListener('input', () => {
      const v = Number(slider.value);
      display.textContent = v;
      update(configKey, v);
    });
  }
}
