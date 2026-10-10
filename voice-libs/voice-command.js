/**
 * client-snippet.js — drop-in voice-command snippet for the browser games.
 *
 * Interface:
 *
 *   const voice = createVoiceCommand({
 *     transcribeUrl: 'https://cloudflare-stt-worker.<subdomain>.workers.dev/transcribe',
 *     onCommand: (text) => { ... },   // called with the final command text
 *     onState:   (state) => { ... },  // optional: 'idle' | 'listening' | 'transcribing' | 'error'
 *     preferBrowserStt: true,         // use Web Speech API when available (Chrome/Edge)
 *     maxClipSeconds: 6,             // MediaRecorder clip cap for the fallback path
 *   });
 *
 *   voice.start();          // begin listening for one command utterance
 *   voice.stop();           // cancel / release mic
 *   voice.using;            // 'webspeech' | 'server' | 'none'
 *   voice.isListening();    // bool
 *
 * Behavior (feature-detected):
 *   1. If the browser has Web Speech API (Chrome/Edge desktop) and
 *      preferBrowserStt is true, use it — free, instant, no server call.
 *   2. Otherwise (iPad Safari, Firefox, etc.): hold-to-talk style —
 *      MediaRecorder captures one utterance as webm/opus (or the
 *      browser's default), POSTs the blob to the Worker /transcribe
 *      endpoint, and hands the returned transcript to onCommand.
 *
 * Batch only: one whole utterance per request, no streaming, no
 * WebSocket, no chunked upload. A "transcribing…" state covers the
 * 1–3 s round trip (radio-latency: the delay is diegetic UI, not a bug).
 *
 * Do NOT paste this into the game files directly — Track A owns those.
 * This is the integration reference the games can adopt.
 *
 * FORK NOTE (voice-quilt, 2026-10-10): copied into OpenSkyFlight as
 * voice-libs/voice-command.js with one fix for hold-to-talk: the original
 * stop() aborts the Web Speech recognition, which DISCARDS the utterance
 * when the PTT button is released quickly ("nothing happens on press").
 * This copy adds voice.end() — a graceful release that calls
 * recognition.stop() so the final result is delivered. Wire pointerup to
 * end(), and keep stop() for true cancels.
 *
 * Adoption sketch for voice-game-prototype (matches its existing voice
 * path: handleCommand(text), hold-to-talk ptt button, no game-file edits
 * by this track):
 *
 *   const voice = createVoiceCommand({
 *     transcribeUrl: 'https://cloudflare-stt-worker.casey-digennaro.workers.dev/transcribe',
 *     onCommand: handleCommand,   // same callback the Web Speech path uses
 *     onState: (s) => {
 *       ptt.classList.toggle('listening', s === 'listening' || s === 'transcribing');
 *       ptt.textContent =
 *         s === 'listening' ? '🔴 LISTENING…' :
 *         s === 'transcribing' ? '📻 TRANSCRIBING…' :
 *         '🎙 HOLD TO TALK';
 *     },
 *   });
 *   // hold-to-talk: pointerdown starts, pointerup stops + uploads
 *   ptt.addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); voice.start(); });
 *   ptt.addEventListener('pointerup', () => voice.stop());
 *   ptt.addEventListener('pointerleave', () => { if (voice.isListening()) voice.stop(); });
 */

function createVoiceCommand(opts) {
  const {
    transcribeUrl,
    onCommand,
    onState = () => {},
    preferBrowserStt = true,
    maxClipSeconds = 6,
    lang = 'en-US',
  } = opts || {};

  if (typeof onCommand !== 'function') {
    throw new Error('createVoiceCommand: onCommand callback is required');
  }
  if (typeof transcribeUrl !== 'string' || !transcribeUrl) {
    throw new Error('createVoiceCommand: transcribeUrl is required');
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  const api = {
    using: 'none',
    isListening() {
      return state === 'listening';
    },
    start,
    stop,
    // FORK FIX (2026-10-10): graceful release for hold-to-talk. stop()
    // aborts the recognizer and discards the utterance; end() lets the
    // final result through. Wire pointerup → end(), cancel → stop().
    end,
  };

  let state = 'idle'; // idle | listening | transcribing | error
  let recognition = null; // Web Speech path
  let mediaRecorder = null; // Server-STT path
  let mediaStream = null;
  let clipTimer = null;
  let chunks = [];

  function setState(next, detail) {
    state = next;
    try {
      onState(next, detail);
    } catch (_) {
      /* game-side handler errors must not break the mic path */
    }
  }

  function pickPath() {
    if (preferBrowserStt && SpeechRecognition) return 'webspeech';
    return 'server';
  }

  function start() {
    stop(); // reset any in-flight attempt
    const path = pickPath();
    api.using = path;
    if (path === 'webspeech') startWebSpeech();
    else startServerStt();
  }

  // FORK FIX (2026-10-10): graceful end for hold-to-talk release.
  // Unlike stop() (abort = discard), this lets the in-flight utterance
  // complete so onresult still fires with the final transcript.
  function end() {
    if (clipTimer) {
      clearTimeout(clipTimer);
      clipTimer = null;
    }
    if (recognition) {
      // Graceful: recognition.stop() delivers the final result; abort()
      // would throw it away. The onresult/onend handlers do the cleanup.
      try {
        recognition.stop();
      } catch (_) {}
      // Safety: if onend never fires (some browsers), force idle.
      setTimeout(() => {
        if (state === 'listening') {
          cleanupRecognition();
          setState('idle');
        }
      }, 1500);
      return;
    }
    // Server path: same as stop() — the clip uploads on recorder stop.
    stop();
  }

  function stop() {
    if (clipTimer) {
      clearTimeout(clipTimer);
      clipTimer = null;
    }
    if (recognition) {
      try {
        recognition.abort();
      } catch (_) {}
      recognition = null;
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop();
      } catch (_) {}
    }
    mediaRecorder = null;
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (_) {}
      });
      mediaStream = null;
    }
    chunks = [];
    if (state !== 'idle') setState('idle');
  }

  // --- Path 1: in-browser Web Speech API (Chrome/Edge) ---------------------
  function startWebSpeech() {
    setState('listening');
    recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript || '';
      cleanupRecognition();
      setState('idle');
      if (text.trim()) onCommand(text.trim());
    };
    recognition.onerror = (event) => {
      cleanupRecognition();
      setState('error', { path: 'webspeech', error: event.error });
    };
    recognition.onend = () => {
      if (state === 'listening') setState('idle'); // user stopped early
      recognition = null;
    };
    try {
      recognition.start();
    } catch (err) {
      cleanupRecognition();
      setState('error', { path: 'webspeech', error: String(err) });
    }
  }

  function cleanupRecognition() {
    if (recognition) {
      try {
        recognition.abort();
      } catch (_) {}
      recognition = null;
    }
  }

  // --- Path 2: MediaRecorder -> Worker batch STT (iPad Safari, Firefox) ----
  async function startServerStt() {
    setState('listening');
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setState('error', { path: 'server', error: 'mic-denied: ' + String(err) });
      return;
    }

    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : undefined; // fall back to the browser default (Safari: mp4/aac)
    try {
      mediaRecorder = mime ? new MediaRecorder(mediaStream, { mimeType: mime }) : new MediaRecorder(mediaStream);
    } catch (err) {
      stop();
      setState('error', { path: 'server', error: 'recorder: ' + String(err) });
      return;
    }

    chunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.onstop = onClipComplete;
    mediaRecorder.start(250); // timeslice so data flows even if stop races

    // Auto-stop the clip: one utterance, batch upload, done.
    clipTimer = setTimeout(() => {
      clipTimer = null;
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    }, maxClipSeconds * 1000);
  }

  async function onClipComplete() {
    if (clipTimer) {
      clearTimeout(clipTimer);
      clipTimer = null;
    }
    const blob = new Blob(chunks, {
      type: (mediaRecorder && mediaRecorder.mimeType) || 'audio/webm',
    });
    chunks = [];
    // release the mic right away; the upload is fire-and-forget batch
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (_) {}
      });
      mediaStream = null;
    }
    mediaRecorder = null;

    if (!blob.size) {
      setState('idle');
      return;
    }
    setState('transcribing'); // <- game shows "transcribing…" on the radio dial

    try {
      const resp = await fetch(transcribeUrl, {
        method: 'POST',
        headers: { 'Content-Type': blob.type },
        body: blob,
      });
      if (!resp.ok) {
        throw new Error('HTTP ' + resp.status);
      }
      const data = await resp.json();
      setState('idle');
      // filler:true means Whisper hallucinated on near-silence — ignore it.
      if (data && data.text && data.text.trim() && !data.filler) {
        onCommand(data.text.trim());
      }
    } catch (err) {
      setState('error', { path: 'server', error: 'transcribe: ' + String(err) });
    }
  }

  return api;
}

// UMD-ish export for the single-file game pages (script tag or module).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createVoiceCommand };
} else if (typeof window !== 'undefined') {
  window.createVoiceCommand = createVoiceCommand;
}
