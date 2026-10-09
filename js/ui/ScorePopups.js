/**
 * ScorePopups — floating "+100" score popups for the arcade games.
 *
 * Pure DOM/CSS, ~80 lines. iPad-safe: the container has
 * pointer-events:none so popups never block touch input.
 *
 * Usage:
 *   import { showPopup } from './js/ui/ScorePopups.js';
 *   showPopup('+100');                    // center-ish, gold
 *   showPopup('TIME BONUS +450', '50%', '30%', '#7cfc00');
 */
const CONTAINER_ID = 'score-popups-layer';

function _container() {
  let c = document.getElementById(CONTAINER_ID);
  if (c) return c;
  const style = document.createElement('style');
  style.textContent = `
#${CONTAINER_ID} {
  position: fixed; inset: 0; z-index: 60;
  pointer-events: none; overflow: hidden;
}
.score-popup {
  position: absolute; transform: translate(-50%, -50%);
  font: 700 34px/1.2 -apple-system, "Segoe UI", system-ui, sans-serif;
  color: var(--pop-color, #ffd54a);
  text-shadow: 0 2px 0 rgba(0,0,0,.65), 0 0 14px rgba(0,0,0,.5);
  white-space: nowrap;
  animation: score-pop-rise 1.1s ease-out forwards;
}
@keyframes score-pop-rise {
  0%   { opacity: 0; transform: translate(-50%, -30%) scale(.7); }
  15%  { opacity: 1; transform: translate(-50%, -50%) scale(1.12); }
  30%  { transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, calc(-50% - 90px)) scale(.95); }
}`;
  document.head.appendChild(style);
  c = document.createElement('div');
  c.id = CONTAINER_ID;
  document.body.appendChild(c);
  return c;
}

/**
 * Show a floating score popup.
 * @param {string} text  — e.g. "+100"
 * @param {string} x     — CSS left ('50%' or '320px'), default center
 * @param {string} y     — CSS top, default upper-middle of screen
 * @param {string} color — CSS color, default gold
 */
export function showPopup(text, x = '50%', y = '35%', color = '#ffd54a') {
  const el = document.createElement('div');
  el.className = 'score-popup';
  el.textContent = text;
  el.style.setProperty('--pop-color', color);
  // Slight horizontal jitter so rapid popups don't stack perfectly.
  el.style.left = `calc(${x} + ${(Math.random() * 60 - 30).toFixed(0)}px)`;
  el.style.top = y;
  _container().appendChild(el);
  const done = () => el.remove();
  el.addEventListener('animationend', done, { once: true });
  setTimeout(done, 1400); // fallback if animationend never fires
}

/** Hide every popup immediately (e.g. on game restart). */
export function clearPopups() {
  const c = document.getElementById(CONTAINER_ID);
  if (c) c.innerHTML = '';
}
