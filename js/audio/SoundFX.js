// SoundFX — tiny synthesized sound manager for Sitka Skies mini-games.
//
// No external audio files: every sound is synthesized with the Web Audio API
// (oscillators + a pre-built noise buffer). Autoplay policy is handled by
// unlocking the AudioContext on the first user gesture (pointerdown/keydown),
// and every play method lazily ensures the context exists, so games can call
// soundFX freely without worrying about init order.
//
// Usage:
//   import { soundFX } from '../../../js/audio/SoundFX.js';
//   soundFX.pickup();          // bright chime
//   soundFX.score(0.9);        // arpeggio, pitch scaled by quality 0..1
//   soundFX.crash();           // noise boom
//   soundFX.click();           // UI blip
//   soundFX.win();             // victory fanfare
//   soundFX.toggleMute();      // mute toggle for a settings button

class SoundFX {
  constructor() {
    this._ctx = null;
    this._master = null;
    this._noiseBuf = null;
    this._unlocked = false;
    this.volume = 0.5;
    this.muted = false;

    // Unlock on first user gesture (autoplay policy). Once is enough.
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  unlock() {
    if (this._unlocked) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this._ctx = new AC();
      this._master = this._ctx.createGain();
      this._master.gain.value = this.muted ? 0 : this.volume;
      this._master.connect(this._ctx.destination);
      // One shared white-noise buffer for the crash boom.
      const len = Math.floor(this._ctx.sampleRate * 0.5);
      this._noiseBuf = this._ctx.createBuffer(1, len, this._ctx.sampleRate);
      const data = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this._unlocked = true;
      return true;
    } catch (e) {
      return false; // no audio support — play methods stay silent
    }
  }

  _ready() {
    if (!this._unlocked) this.unlock();
    if (this._ctx && this._ctx.state === 'suspended') this._ctx.resume().catch(() => {});
    return this._unlocked && !this.muted;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this._master) this._master.gain.value = this.muted ? 0 : this.volume;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this._master) this._master.gain.value = this.muted ? 0 : this.volume;
    return this.muted;
  }

  // --- primitives ---------------------------------------------------------

  // A single oscillator blip with an exponential decay envelope.
  _blip({ type = 'sine', freq = 880, dur = 0.1, at = 0, vol = 1, slideTo = null }) {
    if (!this._ready()) return;
    const t0 = this._ctx.currentTime + at;
    const osc = this._ctx.createOscillator();
    const g = this._ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this._master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // Filtered noise burst (crash boom body).
  _noise({ dur = 0.45, at = 0, vol = 1, from = 2000, to = 200 }) {
    if (!this._ready()) return;
    const t0 = this._ctx.currentTime + at;
    const src = this._ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const filt = this._ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(from, t0);
    filt.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = this._ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(g).connect(this._master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // --- game sounds --------------------------------------------------------

  // Bright two-tone chime for gate passes, pickups, waypoints.
  pickup() {
    this._blip({ type: 'triangle', freq: 1318, dur: 0.18, vol: 0.5 });
    this._blip({ type: 'sine', freq: 1975, dur: 0.15, vol: 0.25 });
  }

  // Ascending C-major arpeggio. quality 0..1 shifts the whole thing up/down
  // a touch so a great landing sounds brighter than a sloppy one.
  score(quality = 1) {
    const q = Math.max(0, Math.min(1, quality));
    const shift = 1 + (q - 0.5) * 0.12;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this._blip({ type: 'square', freq: f * shift, dur: 0.09, at: i * 0.1, vol: 0.22 });
    });
  }

  // Noise boom + sub-bass thump for crashes.
  crash() {
    this._noise({ dur: 0.45, vol: 0.9 });
    this._blip({ type: 'sine', freq: 80, slideTo: 30, dur: 0.4, vol: 0.8 });
  }

  // Tiny UI blip for button taps.
  click() {
    this._blip({ type: 'sine', freq: 1200, dur: 0.05, vol: 0.3 });
  }

  // Simple victory fanfare: C5 E5 G5 C6, then a held G5+C6 shimmer.
  win() {
    const seq = [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => {
      this._blip({ type: 'triangle', freq: f, dur: 0.14, at: i * 0.13, vol: 0.45 });
    });
    const end = seq.length * 0.13;
    this._blip({ type: 'triangle', freq: 783.99, dur: 0.45, at: end, vol: 0.35 });
    this._blip({ type: 'triangle', freq: 1046.5, dur: 0.45, at: end, vol: 0.35 });
  }
}

export const soundFX = new SoundFX();
