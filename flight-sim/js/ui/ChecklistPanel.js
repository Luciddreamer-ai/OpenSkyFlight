/**
 * ChecklistPanel — MSFS-style checklist UI for iPad.
 *
 * The ritual rule: each item requires a 500ms press-and-hold to confirm.
 * A tap is a grocery list. A hold is a pilot.
 *
 * API:
 *   const panel = new ChecklistPanel(container, checklistData);
 *   panel.onPhaseComplete = (phaseId) => { ... };
 *   panel.show('preflight');
 *   panel.isPhaseComplete('preflight') → bool
 */

const HOLD_MS = 500;

export class ChecklistPanel {
  constructor(container, checklistData) {
    this.container = container;
    this.data = checklistData;
    this.state = {}; // phaseId → { checked: Set<itemId>, complete: bool }
    this.currentPhase = null;
    this.onPhaseComplete = null;
    this.onAllComplete = null;

    for (const phaseId of Object.keys(checklistData)) {
      this.state[phaseId] = { checked: new Set(), complete: false };
    }

    this._build();
  }

  _build() {
    this.el = document.createElement('div');
    this.el.className = 'checklist-panel';
    this.el.innerHTML = `
      <div class="cl-header">
        <div class="cl-title"></div>
        <div class="cl-subtitle"></div>
        <div class="cl-progress"><div class="cl-progress-fill"></div></div>
      </div>
      <div class="cl-items"></div>
      <div class="cl-footer">
        <span class="cl-hint">Press &amp; hold each item to confirm</span>
      </div>`;
    this.container.appendChild(this.el);

    this.titleEl = this.el.querySelector('.cl-title');
    this.subtitleEl = this.el.querySelector('.cl-subtitle');
    this.itemsEl = this.el.querySelector('.cl-items');
    this.progressFill = this.el.querySelector('.cl-progress-fill');
  }

  show(phaseId) {
    const phase = this.data[phaseId];
    if (!phase) return;
    this.currentPhase = phaseId;
    this.titleEl.textContent = phase.title;
    this.subtitleEl.textContent = phase.subtitle;
    this.itemsEl.innerHTML = '';

    const st = this.state[phaseId];
    for (const item of phase.items) {
      const row = document.createElement('div');
      row.className = 'cl-item' + (st.checked.has(item.id) ? ' checked' : '');
      row.dataset.itemId = item.id;
      row.innerHTML = `
        <div class="cl-hold-ring"><svg viewBox="0 0 36 36"><circle class="cl-ring-bg" cx="18" cy="18" r="15.5"/><circle class="cl-ring-fg" cx="18" cy="18" r="15.5"/></svg><span class="cl-check">✓</span></div>
        <div class="cl-text"><div class="cl-label">${item.label}</div><div class="cl-detail">${item.detail}</div></div>`;
      this._attachHold(row, phaseId, item.id);
      this.itemsEl.appendChild(row);
    }
    this._updateProgress();
    this.el.classList.add('visible');
  }

  hide() {
    this.el.classList.remove('visible');
  }

  _attachHold(row, phaseId, itemId) {
    const st = this.state[phaseId];
    if (st.checked.has(itemId)) return; // already done

    const ring = row.querySelector('.cl-ring-fg');
    const circumference = 2 * Math.PI * 15.5;
    ring.style.strokeDasharray = `${circumference}`;
    ring.style.strokeDashoffset = `${circumference}`;

    let timer = null;
    let startT = 0;
    let raf = null;

    const cancel = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      ring.style.strokeDashoffset = `${circumference}`;
      row.classList.remove('holding');
    };

    const tick = () => {
      const p = Math.min(1, (performance.now() - startT) / HOLD_MS);
      ring.style.strokeDashoffset = `${circumference * (1 - p)}`;
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    const begin = (e) => {
      e.preventDefault();
      if (st.checked.has(itemId)) return;
      row.classList.add('holding');
      startT = performance.now();
      raf = requestAnimationFrame(tick);
      timer = setTimeout(() => {
        this._confirm(phaseId, itemId, row);
      }, HOLD_MS);
    };

    row.addEventListener('pointerdown', begin);
    row.addEventListener('pointerup', cancel);
    row.addEventListener('pointerleave', cancel);
    row.addEventListener('pointercancel', cancel);
    // Prevent context menu on long-press (iPad)
    row.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _confirm(phaseId, itemId, row) {
    const st = this.state[phaseId];
    st.checked.add(itemId);
    row.classList.remove('holding');
    row.classList.add('checked');
    // Haptic nudge on iPad (if available)
    if (navigator.vibrate) navigator.vibrate(10);
    this._updateProgress();

    const phase = this.data[phaseId];
    if (st.checked.size >= phase.items.length && !st.complete) {
      st.complete = true;
      row.closest('.checklist-panel').classList.add('phase-done');
      if (this.onPhaseComplete) this.onPhaseComplete(phaseId);
      this._checkAllComplete();
    }
  }

  _updateProgress() {
    if (!this.currentPhase) return;
    const phase = this.data[this.currentPhase];
    const st = this.state[this.currentPhase];
    const pct = (st.checked.size / phase.items.length) * 100;
    this.progressFill.style.width = `${pct}%`;
  }

  _checkAllComplete() {
    const all = Object.values(this.state).every((s) => s.complete);
    if (all && this.onAllComplete) this.onAllComplete();
  }

  isPhaseComplete(phaseId) {
    return this.state[phaseId]?.complete ?? false;
  }

  reset(phaseId) {
    if (phaseId) {
      this.state[phaseId] = { checked: new Set(), complete: false };
      if (this.currentPhase === phaseId) this.show(phaseId);
    } else {
      for (const pid of Object.keys(this.state)) {
        this.state[pid] = { checked: new Set(), complete: false };
      }
      if (this.currentPhase) this.show(this.currentPhase);
    }
    this.el.classList.remove('phase-done');
  }
}
