// Diagnostics overlay.
//
// A widget, not a debug page. The people who need this data are a player on an
// iPad and a player on a laptop who have never opened devtools, and neither of
// them is going to open devtools. So the panel is a single keypress away, it
// has to be legible at arm's length, and it has to give them a way to *send*
// the result without ever leaving the app.
//
// The FPS trace is drawn rather than tabulated because the shape is the point.
// A device that sits at 60 and occasionally dives is a different problem from
// a device that sits at 22, and a table of averages cannot show you which one
// you have.

const CSS = `
.osf-diag{position:fixed;top:8px;left:8px;z-index:2147483000;width:290px;
background:rgba(8,12,18,.93);color:#cfe6f2;border:1px solid #1d3b4d;border-radius:10px;
font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;padding:10px 11px;
box-shadow:0 8px 30px rgba(0,0,0,.5);pointer-events:auto;display:none}
.osf-diag.on{display:block}
.osf-diag h4{margin:0 0 7px;font-size:11px;letter-spacing:.10em;text-transform:uppercase;
color:#7df9ff;font-weight:600;display:flex;justify-content:space-between}
.osf-diag .row{display:flex;justify-content:space-between;gap:8px;padding:1px 0}
.osf-diag .k{color:#6f8b9a}
.osf-diag .v{color:#eaf6fb;font-variant-numeric:tabular-nums}
.osf-diag .v.warn{color:#ffb347}
.osf-diag .v.bad{color:#ff5d5d}
.osf-diag canvas{width:100%;height:46px;display:block;margin:7px 0 5px;
background:#060b10;border-radius:5px;border:1px solid #142a36}
.osf-diag .log{max-height:104px;overflow-y:auto;font-size:10.5px;color:#8fa8b6;
border-top:1px solid #142a36;padding-top:6px;margin-top:5px}
.osf-diag .log div{padding:1px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.osf-diag .log .t{color:#4d6a78;margin-right:5px}
.osf-diag .log .e-long-frame,.osf-diag .log .e-health{color:#ffb347}
.osf-diag .log .e-error,.osf-diag .log .e-unhandledrejection{color:#ff5d5d}
.osf-diag button{margin-top:8px;width:100%;padding:5px;cursor:pointer;
background:#12303d;color:#cfe6f2;border:1px solid #23596e;border-radius:5px;
font:inherit;font-size:11px}
.osf-diag button:hover{background:#17415a}
.osf-diag .hint{color:#4d6a78;font-size:10px;margin-top:5px;text-align:center}
.osf-health-alert{position:fixed;bottom:74px;left:50%;transform:translateX(-50%);
z-index:2147483000;background:rgba(60,10,10,.94);color:#ffd7d7;
border:1px solid #a33;padding:8px 15px;border-radius:8px;
font:12px/1.4 ui-monospace,Menlo,monospace;display:none}
.osf-health-alert.on{display:block}
`;

const TREND = 120; // samples in the sparkline

export class DiagnosticsOverlay {
  /**
   * @param {import('./Telemetry.js').Telemetry} telemetry
   * @param {import('./HealthWatchdog.js').HealthWatchdog} [watchdog]
   */
  constructor(telemetry, watchdog) {
    this.telemetry = telemetry;
    this.watchdog = watchdog;
    this.visible = false;
    this.trend = new Array(TREND).fill(16.7);
    this._copied = 0;
    this._build();
  }

  _build() {
    if (!document.getElementById('osf-diag-style')) {
      const s = document.createElement('style');
      s.id = 'osf-diag-style';
      s.textContent = CSS;
      document.head.appendChild(s);
    }
    const el = document.createElement('div');
    el.className = 'osf-diag';
    el.id = 'osf-diag';
    el.innerHTML = `
      <h4><span>OpenSkyFlight</span><span id="osf-d-tier">—</span></h4>
      <canvas id="osf-d-graph" width="268" height="46"></canvas>
      <div class="row"><span class="k">fps</span><span class="v" id="osf-d-fps">—</span></div>
      <div class="row"><span class="k">frame p50 / p99</span><span class="v" id="osf-d-pct">—</span></div>
      <div class="row"><span class="k">worst frame</span><span class="v" id="osf-d-worst">—</span></div>
      <div class="row"><span class="k">long frames</span><span class="v" id="osf-d-long">—</span></div>
      <div class="row"><span class="k">draw calls</span><span class="v" id="osf-d-draws">—</span></div>
      <div class="row"><span class="k">backend</span><span class="v" id="osf-d-be">—</span></div>
      <div class="row"><span class="k">health</span><span class="v" id="osf-d-health">ok</span></div>
      <div class="log" id="osf-d-log"></div>
      <button id="osf-d-copy">Copy diagnostics report</button>
      <div class="hint">D toggles · F cycles frame source</div>`;
    document.body.appendChild(el);

    this.el = el;
    this.graph = el.querySelector('#osf-d-graph');
    this.gctx = this.graph.getContext('2d');
    this.logEl = el.querySelector('#osf-d-log');

    el.querySelector('#osf-d-copy').addEventListener('click', () => this.copy());

    // The notice element is owned by the overlay so the watchdog and the panel
    // cannot disagree about whether the player was warned.
    if (!document.getElementById('osf-health-alert')) {
      const n = document.createElement('div');
      n.id = 'osf-health-alert';
      n.className = 'osf-health-alert';
      document.body.appendChild(n);
    }
    this.noticeEl = document.getElementById('osf-health-alert');

    this._key = (e) => {
      if (e.key === 'd' || e.key === 'D') {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
        this.toggle();
      }
    };
    window.addEventListener('keydown', this._key);
  }

  /** Watchdog needs the notice element; call after the overlay is built. */
  getNoticeElement() {
    return this.noticeEl;
  }

  toggle() {
    this.visible = !this.visible;
    this.el.classList.toggle('on', this.visible);
    // Populate synchronously on open. Waiting for the next frame means a blank
    // panel for up to a full frame interval — which on the very hardware this
    // tool exists to diagnose can be most of a second, and reads as a broken
    // widget rather than a slow device.
    if (this.visible) this.render();
    this._showNotice();
  }

  /** Health notice is independent of the panel — it must show unprompted. */
  _showNotice() {
    if (!this.noticeEl) return;
    const bad = this.watchdog?.issues?.length > 0;
    this.noticeEl.classList.toggle('on', !!bad);
  }

  /** Push a frame time into the sparkline. Cheap; call from the render loop. */
  push(dtMs) {
    if (dtMs > 0 && dtMs < 10000) {
      this.trend.push(dtMs);
      if (this.trend.length > TREND) this.trend.shift();
    }
    if (this.visible) this.render();
  }

  render() {
    const s = this.telemetry.stats();
    const set = (id, v, cls) => {
      const e = this.el.querySelector('#' + id);
      if (!e) return;
      e.textContent = v;
      e.className = 'v' + (cls ? ' ' + cls : '');
    };

    // 16.7ms is 60fps. Grade against the frame the player is actually living.
    const fps = s.p95Ms ? Math.round(1000 / s.p95Ms) : 0;
    set('osf-d-fps', fps ? `${fps}` : '—', fps >= 50 ? '' : fps >= 30 ? 'warn' : 'bad');
    set('osf-d-pct', `${s.p50Ms ?? '—'} / ${s.p99Ms ?? '—'} ms`);
    const worstCls = s.maxMs > 1000 ? 'bad' : s.maxMs > 120 ? 'warn' : '';
    set('osf-d-worst', s.maxMs !== null && s.maxMs !== undefined ? `${s.maxMs} ms` : '—', worstCls);
    set('osf-d-long', String(s.longFrames), s.longFrames ? 'bad' : '');
    set('osf-d-draws', this.telemetry.rendererInfo?.drawCalls ?? '—');
    set('osf-d-be', this.telemetry.backend ?? '—');
    set('osf-d-tier', (this.telemetry.tier ?? '—').toUpperCase());

    const h = this.watchdog?.status();
    const hEl = this.el.querySelector('#osf-d-health');
    if (hEl && h) {
      if (h.stalled || h.nanReported) {
        hEl.textContent = h.nanReported ? 'NaN state' : 'STALLED';
        hEl.className = 'v bad';
      } else if (h.issues) {
        hEl.textContent = `${h.issues} issue(s)`;
        hEl.className = 'v warn';
      } else {
        hEl.textContent = 'ok';
        hEl.className = 'v';
      }
    }

    this._drawGraph();
    this._renderLog();
    this._showNotice();
  }

  _drawGraph() {
    const c = this.gctx;
    const W = this.graph.width;
    const H = this.graph.height;
    c.clearRect(0, 0, W, H);

    // Autoscale to the visible window, but never below 16.7ms so a healthy
    // trace sits in the upper half instead of being a flat line at the top.
    const max = Math.max(33, ...this.trend);
    const scale = H / max;

    // 60fps reference line.
    c.strokeStyle = 'rgba(125,249,255,.22)';
    c.lineWidth = 1;
    c.beginPath();
    const y60 = H - 16.7 * scale;
    c.moveTo(0, y60);
    c.lineTo(W, y60);
    c.stroke();

    c.beginPath();
    for (let i = 0; i < this.trend.length; i++) {
      const x = (i / (TREND - 1)) * W;
      const y = H - Math.min(this.trend[i], max) * scale;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.strokeStyle = '#7df9ff';
    c.lineWidth = 1.25;
    c.stroke();

    // Fill under the trace so spikes read as area, not just a spike.
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.closePath();
    c.fillStyle = 'rgba(125,249,255,.10)';
    c.fill();

    c.fillStyle = 'rgba(109,139,154,.85)';
    c.font = '9px ui-monospace,monospace';
    c.fillText(`${max.toFixed(0)}ms`, 3, 10);
  }

  _renderLog() {
    const evs = this.telemetry.events.slice(-14).reverse();
    this.logEl.innerHTML = evs
      .map((e) => {
        const t = new Date(e.at).toTimeString().slice(0, 8);
        const extra = e.ms !== undefined ? ` ${e.ms}ms` : e.message ? ` ${e.message}` : e.fields ? ` ${e.fields}` : '';
        return `<div class="e-${e.type}"><span class="t">${t}</span>${e.type}${extra}</div>`;
      })
      .join('');
  }

  /**
   * Copy the full JSON report to the clipboard.
   *
   * This is the entire delivery mechanism. Nothing is uploaded, ever — the
   * report exists only if a player chooses to send it, and the button is the
   * only thing that can cause that.
   */
  async copy() {
    const report = this.telemetry.report();
    const text = JSON.stringify(report, null, 2);
    const btn = this.el.querySelector('#osf-d-copy');
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = `Copied ${Math.round(text.length / 1024)}KB ✓`;
    } catch {
      // Clipboard API needs a secure context and a user gesture. On plain http
      // (including a local dev server) it throws, so fall back to a selectable
      // textarea rather than pretending it worked.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:8px;left:8px;z-index:2147483001;width:290px;height:300px';
      this.el.appendChild(ta);
      ta.select();
      btn.textContent = 'Select-all + copy (Ctrl/Cmd+C)';
    }
    setTimeout(() => {
      btn.textContent = 'Copy diagnostics report';
    }, 2600);
  }

  destroy() {
    window.removeEventListener('keydown', this._key);
    this.el?.remove();
  }
}
