/**
 * voice-quilt.js — voice-command overlay for OpenSkyFlight.
 *
 * Experimental mode (off by default; ?voice=1 or the 🎙 VOICE button).
 * Cell pattern mirrors the voice-game prototypes:
 *   Ear → Router → Jev Gate → Prism → Decompose → Act (+ Memory, Sleep)
 * Hands on the sim go through window.__osfVoice (VoiceCommander, js/voice/),
 * which drives the sim's own FlightController / FlightPlanRecorder APIs.
 *
 * Honesty notes:
 *  - "Jev Gate" here is a LOCAL heuristic confidence gate (pattern match
 *    quality), not a live Jev judge call. Unknown commands are refused,
 *    never guessed.
 *  - The Prism "orienting" pause stands in for the LLM/Jev orienting call
 *    the prototypes make. After 3 clean runs a pattern becomes a reflex
 *    (local, no pause) — same learning shape, labeled for what it is.
 */
(function () {
  'use strict';

  var TRANSCRIBE_URL = 'https://cloudflare-stt-worker.casey-digennaro.workers.dev/transcribe';
  var LEARN_AFTER = 3;
  var LS_KEY = 'vq-patterns-v1';

  var PLACES = [
    'cape edgecumbe', 'mount edgecumbe', 'edgecumbe', 'the volcano',
    'biorka', 'biorka island', 'sitka airport', 'the airport', 'the runway',
    'sitka', 'kruzof', 'kruzof island',
  ];

  var BANTER = {
    flyto: 'banter/01-fly-to-sitka.mp3',
    turn: 'banter/04-turn-left-speed-up.mp3',
    slow: 'banter/05-slow-down-biorka.mp3',
    speed: 'banter/08-speed-up.mp3',
    stop: 'banter/09-hold-position.mp3',
  };

  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- pattern memory (localStorage) ---------------- */
  var patterns = {};
  try { patterns = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { patterns = {}; }
  function savePatterns() { try { localStorage.setItem(LS_KEY, JSON.stringify(patterns)); } catch (e) {} }
  function patStatus(p) { return (patterns[p] && patterns[p].uses >= LEARN_AFTER); }
  function touchPattern(p) {
    patterns[p] = patterns[p] || { uses: 0 };
    patterns[p].uses++;
    savePatterns();
    return patterns[p].uses >= LEARN_AFTER;
  }

  /* ---------------- quilt SVG ---------------- */
  var QCX = 220, QCY = 150;
  var QCELLS = [
    { id: 'ear', x: 70, y: 60, label: 'Ear', ring: 'body', model: 'Web Speech API', cost: 'browser-native',
      blurb: 'Your voice, straight from the mic. Chrome: on-device-ish Web Speech; elsewhere the Cloudflare Whisper fallback.' },
    { id: 'router', x: 70, y: 150, label: 'Router', ring: 'body', model: 'keyword match', cost: '<1 ms',
      blurb: 'Meaning routes, not exact words. "fly to", "head to", "take me to" all land in the same place.' },
    { id: 'judge', x: 70, y: 240, label: 'Jev Gate', ring: 'body', model: 'local heuristic', cost: '~1 ms',
      blurb: 'Confidence gate on the parse. Known patterns pass; unknown commands are refused, never guessed.' },
    { id: 'prism', x: 220, y: 150, label: 'Prism', ring: 'mind', model: 'heuristic orienter', cost: '~8 ms', w: 120,
      blurb: 'Orienting pause — stands in for the LLM/Jev call in this build. After 3 clean runs the pattern becomes a reflex and skips it.' },
    { id: 'decomp', x: 370, y: 90, label: 'Decompose', ring: 'mind', model: 'step planner', cost: '6 ms',
      blurb: '"fly to cape edgecumbe" → [fix destination → build 3-waypoint plan → engage autopilot → monitor arrival].' },
    { id: 'act', x: 370, y: 210, label: 'Act', ring: 'mind', model: 'sim bridge', cost: '1 frame',
      blurb: 'Hands on the real sim: FlightController for manual flight, the sim\'s own autopilot spline for "fly to".' },
    { id: 'mem', x: 220, y: 262, label: 'Memory', ring: 'memory', model: 'pattern store', cost: 'localStorage',
      blurb: 'Every command you speak, counted. Three clean runs and it becomes a reflex — no orienting pause.' },
    { id: 'sleep', x: 370, y: 262, label: 'Sleep', ring: 'dream', model: 'distiller', cost: 'idle only',
      blurb: 'Distill now: everything practiced becomes a reflex immediately.' },
  ];
  var RINGC = { body: '#39d0d8', mind: '#5df08a', memory: '#a78bfa', dream: '#f5b942' };
  var NS = 'http://www.w3.org/2000/svg';

  function buildQuilt() {
    var svg = $('vq-quilt');
    if (!svg) return;
    function qel(t, a, p) {
      var e = document.createElementNS(NS, t);
      for (var k in a) e.setAttribute(k, a[k]);
      (p || svg).appendChild(e);
      return e;
    }
    QCELLS.forEach(function (c) {
      if (c.id !== 'prism') qel('line', { x1: c.x, y1: c.y, x2: QCX, y2: QCY, stroke: 'rgba(125,147,168,.22)', 'stroke-width': 1 });
    });
    QCELLS.forEach(function (c, i) {
      var col = c.id === 'prism' ? '#ff7ad9' : RINGC[c.ring];
      var g = qel('g', { 'class': 'vq-cell', id: 'vq-' + c.id });
      var w = c.w || 86, h = 40;
      qel('rect', { x: c.x - w / 2, y: c.y - h / 2, width: w, height: h, rx: 9, fill: 'rgba(10,20,32,.94)', stroke: col, 'stroke-width': 1.4, style: 'color:' + col }, g);
      var t = qel('text', { x: c.x, y: c.y + 4, 'text-anchor': 'middle', fill: '#d7e6f2', 'font-size': 11 }, g);
      t.textContent = c.label;
      g.addEventListener('click', function () {
        logEv('cell · ' + c.label, 'model: ' + c.model + ' · cost: ' + c.cost, c.blurb, '');
      });
    });
  }

  function qlight(id, ms) {
    var g = $('vq-' + id);
    if (!g) return;
    g.classList.remove('idle'); g.classList.add('active');
    setTimeout(function () { g.classList.remove('active'); g.classList.add('idle'); }, ms || 600);
  }

  /* ---------------- log / transcript ---------------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function logEv(title, out, why, cls) {
    var log = $('vq-log');
    if (!log) return;
    log.insertAdjacentHTML('afterbegin',
      '<div class="vq-ev ' + (cls || '') + '"><div class="vq-t">' + new Date().toLocaleTimeString() +
      ' · ' + esc(title) + '</div><div>→ <b>' + out + '</b></div>' +
      (why ? '<div class="vq-why">why: ' + why + '</div>' : '') + '</div>');
  }

  /* ---------------- audio: unlock, banter, TTS ---------------- */
  var soundOn = true;
  var audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { var ctx = new AC(); if (ctx.state === 'suspended') ctx.resume(); }
    } catch (e) {}
    try {
      // Prime SpeechSynthesis (iOS requires a user gesture first).
      var u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }
  function playBanter(file, fallbackText) {
    if (!soundOn) { if (fallbackText) logEv('radio', esc(fallbackText), 'sound off — text readback', ''); return; }
    try {
      var a = new Audio(file);
      a.play().catch(function () { speak(fallbackText); });
    } catch (e) { speak(fallbackText); }
  }
  function speak(text) {
    if (!soundOn || !text) return;
    try {
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95; u.pitch = 0.85; // slightly lower reads as "radio"
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ---------------- command parsing (Router) ---------------- */
  function parseCommand(text) {
    var t = text.toLowerCase().trim();
    for (var i = 0; i < PLACES.length; i++) {
      var pk = PLACES[i];
      if (t.indexOf(pk) !== -1 && /(fly|go|head|take me|navigate|bring me)/.test(t))
        return { pattern: 'flyto', action: 'flyto', placeKey: pk, raw: text, conf: 1.0 };
    }
    if (/take off|takeoff|launch|rotate/.test(t)) return { pattern: 'takeoff', action: 'takeoff', raw: text, conf: 1.0 };
    if (/\bland\b|touch down|final approach/.test(t)) return { pattern: 'land', action: 'land', raw: text, conf: 1.0 };
    if (/turn left|left turn|bank left/.test(t)) return { pattern: 'turn', action: 'turn', dir: -1, raw: text, conf: 1.0 };
    if (/turn right|right turn|bank right/.test(t)) return { pattern: 'turn', action: 'turn', dir: 1, raw: text, conf: 1.0 };
    if (/speed up|faster|full throttle|throttle up|climb/.test(t)) return { pattern: 'speed', action: 'speed', d: 1, raw: text, conf: 1.0 };
    if (/slow down|slower|throttle down|ease off|descend/.test(t)) return { pattern: 'slow', action: 'speed', d: -1, raw: text, conf: 1.0 };
    if (/\bstop\b|hold position|hover|all halt/.test(t)) return { pattern: 'stop', action: 'stop', raw: text, conf: 1.0 };
    if (/where am i|my position|location|where are we/.test(t)) return { pattern: 'where', action: 'where', raw: text, conf: 1.0 };
    if (/\bstatus\b|how am i|report|how fast|how high|altitude/.test(t)) return { pattern: 'status', action: 'status', raw: text, conf: 1.0 };
    // weak matches — heard something flight-shaped but not a full pattern
    if (/(fly|turn|land|speed|throttle|take)/.test(t)) return { pattern: 'weak', action: 'unknown', raw: text, conf: 0.3 };
    return { pattern: 'unknown', action: 'unknown', raw: text, conf: 0 };
  }

  function describeSteps(cmd) {
    switch (cmd.action) {
      case 'flyto': return ['fix destination: ' + cmd.placeKey, 'build 3-waypoint spline', 'engage sim autopilot', 'monitor arrival'];
      case 'takeoff': return ['take manual control', 'throttle → 100%', 'rotate +0.12 rad'];
      case 'land': return ['approach leg to Sitka Airport', 'short final, manual', 'flare', 'touchdown'];
      case 'turn': return ['take manual control', 'yaw ' + (cmd.dir < 0 ? '−0.5' : '+0.5') + ' rad'];
      case 'speed': return ['take manual control', 'throttle ' + (cmd.d > 0 ? '+25%' : '−25%')];
      case 'stop': return ['take manual control', 'throttle → 5%'];
      case 'status': case 'where': return ['read sim state', 'format readback'];
      default: return [];
    }
  }

  function banterFor(cmd) {
    if (cmd.action === 'flyto') return cmd.placeKey.indexOf('sitka') !== -1 ? BANTER.flyto : null;
    if (cmd.action === 'turn') return BANTER.turn;
    if (cmd.action === 'speed') return cmd.d > 0 ? BANTER.speed : BANTER.slow;
    if (cmd.action === 'stop') return BANTER.stop;
    return null;
  }

  /* ---------------- the pipeline ---------------- */
  function osfVoice() { return window.__osfVoice || null; }

  async function handleCommand(text) {
    var cmd = parseCommand(text);
    var tr = $('vq-transcript');
    if (tr) tr.innerHTML = '<span class="vq-heard">🎙 “' + esc(text) + '”</span><br><span class="vq-parsed">parsed: ' +
      esc(cmd.pattern) + (cmd.placeKey ? ' → ' + esc(cmd.placeKey) : '') + '</span>';

    qlight('ear', 500); await sleep(120);
    qlight('router', 500);
    logEv('Ear → Router', '“' + esc(text) + '”', 'keyword match → pattern <b>' + esc(cmd.pattern) + '</b>', '');
    await sleep(150);

    // Jev Gate: local confidence heuristic. Refuse, never guess.
    qlight('judge', 600);
    if (cmd.conf < 0.5) {
      qlight('prism', 400);
      logEv('Jev Gate', 'REFUSED — not in spec', 'confidence ' + cmd.conf.toFixed(1) + ' < 0.5, no guess made', 'hot');
      var refusal = 'Negative — not in the flight manual. Try "take off", "fly to cape edgecumbe", or "status". Over.';
      logEv('radio', esc(refusal), 'readback (text — no refusal clip cut yet)', '');
      speak(refusal);
      return;
    }
    logEv('Jev Gate', 'PASS — in spec', 'confidence ' + cmd.conf.toFixed(1), '');
    await sleep(150);

    // Prism: orienting (stands in for the LLM/Jev call); reflex after 3 runs.
    var learned = patStatus(cmd.pattern);
    if (!learned) {
      qlight('prism', 900);
      var uses = (patterns[cmd.pattern] || { uses: 0 }).uses + 1;
      logEv('Prism', 'orienting…', 'pattern "' + esc(cmd.pattern) + '" not yet a reflex (' + uses + '/' + LEARN_AFTER + ')', 'learn');
      await sleep(750);
      if (touchPattern(cmd.pattern)) logEv('Memory', '🧠 pattern learned!', '“' + esc(cmd.pattern) + '” → reflex from now on', 'local');
    } else {
      qlight('prism', 400);
      logEv('Prism', 'reflex — no orienting pause', '“' + esc(cmd.pattern) + '” already learned', 'local');
    }
    qlight('mem', 400); await sleep(120);

    qlight('decomp', 600);
    var steps = describeSteps(cmd);
    if (steps.length) logEv('Decompose', steps.map(esc).join(' → '), '1 intent → ' + steps.length + ' steps', '');
    await sleep(200);

    // Act: hands on the real sim.
    qlight('act', 700); qlight('prism', 400);
    var vc = osfVoice();
    if (!vc || !vc.ready) {
      logEv('Act', 'SIM NOT READY', 'voice bridge not attached yet — terrain still loading?', 'hot');
      speak('Stand by — the sim is still loading.');
      return;
    }
    var result;
    try {
      switch (cmd.action) {
        case 'flyto': {
          var place = vc.findPlace(cmd.placeKey);
          result = vc.flyTo(place);
          break;
        }
        case 'takeoff': result = vc.takeoff(); break;
        case 'land': result = vc.land(); break;
        case 'turn': result = vc.turn(cmd.dir); break;
        case 'speed': result = vc.speed(cmd.d); break;
        case 'stop': result = vc.hold(); break;
        case 'status': result = vc.status(); break;
        case 'where': result = vc.where(); break;
        default: result = { ok: false, reply: 'not in the flight manual' };
      }
    } catch (err) {
      result = { ok: false, reply: 'command fault: ' + String((err && err.message) || err) };
    }
    logEv('Act', esc(result.reply), result.ok ? 'hands on the sim ✓' : 'FAULT', result.ok ? 'hot' : 'hot');

    // Radio readback AFTER execution (~1s delay is authentic).
    await sleep(900);
    var clip = result.ok ? banterFor(cmd) : null;
    if (clip) {
      logEv('radio', '📻 readback clip', esc(clip), '');
      playBanter(clip, result.reply);
    } else {
      logEv('radio', '📻 “' + esc(result.reply) + '”', 'TTS readback (no clip cut for this command yet)', '');
      speak(result.reply);
    }
  }

  /* ---------------- voice input wiring ---------------- */
  var voice = null;

  function setPttState(s) {
    var ptt = $('vq-ptt');
    if (!ptt) return;
    ptt.classList.toggle('listening', s === 'listening' || s === 'transcribing');
    ptt.textContent =
      s === 'listening' ? '🔴 LISTENING…' :
      s === 'transcribing' ? '📻 TRANSCRIBING…' :
      s === 'error' ? '⚠️ MIC ERROR — tap to retry' :
      '🎙 HOLD TO TALK';
  }

  function initVoice() {
    if (typeof createVoiceCommand !== 'function') {
      var ptt0 = $('vq-ptt');
      if (ptt0) { ptt0.disabled = true; ptt0.textContent = '🎙 voice lib missing — type below'; }
      logEv('system', 'voice lib not loaded', 'use the text box', 'hot');
      return;
    }
    voice = createVoiceCommand({
      transcribeUrl: TRANSCRIBE_URL,
      onCommand: handleCommand,
      onState: setPttState,
      preferBrowserStt: true,
      maxClipSeconds: 6,
    });
    var ptt = $('vq-ptt');
    // Hold-to-talk: press starts, release ends GRACEFULLY (end(), not
    // stop()/abort() — abort discards the utterance on quick release).
    ptt.addEventListener('pointerdown', function (e) { e.preventDefault(); unlockAudio(); voice.start(); });
    ptt.addEventListener('pointerup', function () { if (voice.isListening()) voice.end(); });
    ptt.addEventListener('pointerleave', function () { if (voice.isListening()) voice.end(); });
    ptt.addEventListener('pointercancel', function () { voice.stop(); });
    logEv('system', 'voice ready (' + (window.SpeechRecognition || window.webkitSpeechRecognition ? 'Web Speech' : 'server STT fallback') + ')',
      'hold the mic, or type below', 'local');
  }

  /* ---------------- panel open/close ---------------- */
  function openPanel() { var r = $('vq-root'); if (r) r.hidden = false; }
  function closePanel() { var r = $('vq-root'); if (r) r.hidden = true; }

  /* ---------------- boot ---------------- */
  function boot() {
    buildQuilt();
    initVoice();

    $('vq-open').addEventListener('click', function () {
      unlockAudio();
      var r = $('vq-root');
      if (r.hidden) openPanel(); else closePanel();
    });
    $('vq-close').addEventListener('click', closePanel);
    $('vq-sound').addEventListener('click', function () {
      soundOn = !soundOn;
      $('vq-sound').textContent = soundOn ? '🔊' : '🔇';
      if (!soundOn) { try { window.speechSynthesis.cancel(); } catch (e) {} }
    });
    $('vq-sleep').addEventListener('click', function () {
      var n = 0;
      Object.keys(patterns).forEach(function (k) { if (!patStatus(k)) { patterns[k].uses = LEARN_AFTER; n++; } });
      savePatterns();
      qlight('sleep', 1500);
      logEv('🌙 sleep cycle', n + ' patterns distilled', 'the orienting pause dissolves into reflex', 'local');
      speak('Sleep cycle complete. All commands are now reflexes.');
    });
    var typed = $('vq-typed');
    typed.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && typed.value.trim()) {
        unlockAudio();
        handleCommand(typed.value.trim());
        typed.value = '';
      }
    });

    // Sim bridge: poll for window.__osfVoice (app.js exposes it once the
    // terrain + flight controller exist), then run the landing/arrival pump.
    var waited = 0;
    var iv = setInterval(function () {
      var vc = osfVoice();
      if (vc && vc.ready) {
        clearInterval(iv);
        logEv('system', 'sim bridge attached ✓', 'VoiceCommander driving FlightController + autopilot', 'local');
        vc.onEvent(function (ev) {
          if (ev.type === 'arrived') { speak('Arrived at ' + ev.name + '. You have the controls.'); }
          if (ev.type === 'landed') { speak('Touchdown. Welcome to Sitka.'); playBanter(BANTER.stop, null); }
        });
        setInterval(function () { try { vc.update(); } catch (e) {} }, 500);
      } else if (++waited > 120) {
        clearInterval(iv);
        logEv('system', 'sim bridge not found', 'is js/app.js serving with the voice hook?', 'hot');
      }
    }, 500);

    if (new URLSearchParams(location.search).has('voice')) openPanel();
    logEv('welcome', 'voice quilt · experimental', 'say "take off", then "fly to cape edgecumbe"', '');
    setTimeout(function () { ['ear', 'router', 'judge', 'prism'].forEach(function (id, i) { setTimeout(function () { qlight(id, 500); }, i * 300); }); }, 600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
