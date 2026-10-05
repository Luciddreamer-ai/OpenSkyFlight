/**
 * TouchControls — touch input for iPad / mobile.
 *
 * Layout:
 *  - Left 45% of the screen: floating virtual joystick. Touch down drops
 *    the stick where your thumb lands; drag up/down = forward/backward,
 *    left/right = strafe.
 *  - Everywhere else: drag to look around (replaces mouse pointer-lock look).
 *  - Action buttons (bottom-center): VIEW / TEX / HUD. These dispatch
 *    synthetic keydown events so they flow through the same InputManager
 *    bindings as the keyboard shortcuts — no duplicate action logic.
 *
 * Feeds FlightController through addLook() / setTouchMove(), so the
 * desktop keyboard+mouse path is completely untouched.
 */
const TOUCH_LOOK_GAIN = 1.6; // finger drags are shorter than mouse sweeps
const STICK_RADIUS_PX = 60;
const STICK_ZONE_FRACTION = 0.45; // left portion of screen = joystick

export default class TouchControls {
  /** True on touch-capable devices (iPad, phones, touch laptops). */
  static isTouchDevice() {
    return (
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    );
  }

  /**
   * @param {FlightController} flightController
   */
  constructor(flightController) {
    this.fc = flightController;
    this.stickTouchId = null;
    this.lookTouchId = null;
    this.stickOrigin = { x: 0, y: 0 };
    this.lastLook = { x: 0, y: 0 };

    this._buildUI();

    // Document-level so touches over the HUD overlay canvas also steer.
    // Touches that begin on real UI controls are left alone.
    document.addEventListener('touchstart', this._onTouchStart, { passive: false });
    document.addEventListener('touchmove', this._onTouchMove, { passive: false });
    document.addEventListener('touchend', this._onTouchEnd, { passive: false });
    document.addEventListener('touchcancel', this._onTouchEnd, { passive: false });

    document.body.classList.add('touch');
    this._updateHelpText();
  }

  // ---------------- UI ----------------

  _buildUI() {
    const ui = document.createElement('div');
    ui.id = 'touch-ui';
    ui.innerHTML = `
      <div id="tc-stick-base"><div id="tc-stick-knob"></div></div>
      <div id="tc-buttons">
        <button type="button" data-key="v" aria-label="Toggle cockpit/chase view">VIEW</button>
        <button type="button" data-key="t" aria-label="Cycle texture mode">TEX</button>
        <button type="button" data-key="h" aria-label="Toggle HUD">HUD</button>
      </div>`;
    document.body.appendChild(ui);
    this.ui = ui;
    this.stickBase = ui.querySelector('#tc-stick-base');
    this.stickKnob = ui.querySelector('#tc-stick-knob');

    ui.querySelectorAll('#tc-buttons button').forEach((btn) => {
      btn.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._pressKey(btn.dataset.key);
        },
        { passive: false }
      );
      // Fallback for stylus/mouse taps on the buttons
      btn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this._pressKey(btn.dataset.key);
      });
    });
  }

  /** Fire a synthetic keydown so InputManager bindings handle it. */
  _pressKey(key) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }

  _updateHelpText() {
    const help = document.getElementById('help');
    if (help) {
      help.innerHTML =
        'Left thumb : virtual stick — fly<br>' +
        'Right thumb : drag to look around<br>' +
        'VIEW : cockpit/chase | TEX : texture mode | HUD : instruments<br>' +
        'V : toggle view | H : toggle HUD | M : toggle map | I : info &amp; help<br>' +
        'T : cycle texture mode | R : hi-res mode (static views) | X : debug tiles<br>' +
        'N : record waypoints | Shift+N : clear plan | P : add waypoint<br>' +
        'L : load flight plan | G : autopilot on/off<br>' +
        'B : benchmark | Shift+B : store baseline';
    }
  }

  // ---------------- Touch handling ----------------

  _isUiTouch(target) {
    return (
      target instanceof Element &&
      !!target.closest(
        '#control-panel, #flightplan-menu, #log-panel, input, select, textarea, a, button'
      )
    );
  }

  _onTouchStart = (e) => {
    if (this._isUiTouch(e.target)) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      const inStickZone = t.clientX < window.innerWidth * STICK_ZONE_FRACTION;
      if (inStickZone && this.stickTouchId === null) {
        this.stickTouchId = t.identifier;
        this.stickOrigin = { x: t.clientX, y: t.clientY };
        this._showStick(t.clientX, t.clientY, 0, 0);
      } else if (!inStickZone && this.lookTouchId === null) {
        this.lookTouchId = t.identifier;
        this.lastLook = { x: t.clientX, y: t.clientY };
      }
    }
  };

  _onTouchMove = (e) => {
    if (this.stickTouchId === null && this.lookTouchId === null) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.stickTouchId) {
        let dx = t.clientX - this.stickOrigin.x;
        let dy = t.clientY - this.stickOrigin.y;
        const len = Math.hypot(dx, dy);
        if (len > STICK_RADIUS_PX) {
          dx = (dx / len) * STICK_RADIUS_PX;
          dy = (dy / len) * STICK_RADIUS_PX;
        }
        this._showStick(this.stickOrigin.x, this.stickOrigin.y, dx, dy);
        // Screen-up (negative dy) = forward
        this.fc.setTouchMove(dx / STICK_RADIUS_PX, -dy / STICK_RADIUS_PX);
      } else if (t.identifier === this.lookTouchId) {
        const dx = t.clientX - this.lastLook.x;
        const dy = t.clientY - this.lastLook.y;
        this.lastLook = { x: t.clientX, y: t.clientY };
        this.fc.addLook(dx * TOUCH_LOOK_GAIN, dy * TOUCH_LOOK_GAIN);
      }
    }
  };

  _onTouchEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === this.stickTouchId) {
        this.stickTouchId = null;
        this.fc.setTouchMove(0, 0);
        this._hideStick();
      } else if (t.identifier === this.lookTouchId) {
        this.lookTouchId = null;
      }
    }
  };

  _showStick(x, y, dx, dy) {
    const base = this.stickBase;
    base.style.display = 'block';
    base.style.left = `${x - STICK_RADIUS_PX}px`;
    base.style.top = `${y - STICK_RADIUS_PX}px`;
    this.stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  _hideStick() {
    this.stickBase.style.display = 'none';
  }

  dispose() {
    document.removeEventListener('touchstart', this._onTouchStart);
    document.removeEventListener('touchmove', this._onTouchMove);
    document.removeEventListener('touchend', this._onTouchEnd);
    document.removeEventListener('touchcancel', this._onTouchEnd);
    this.ui.remove();
    document.body.classList.remove('touch');
  }
}
