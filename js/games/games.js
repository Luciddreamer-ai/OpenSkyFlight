/**
 * The game catalogue.
 *
 * Games are described as DATA and the launcher turns this into cards. Adding a
 * game means adding a folder under games/ and one entry here — no change to the
 * menu, the CSS, or any other game. The same rule as CapabilityProbe: the
 * catalogue names games (which are finite and authored) rather than devices
 * (which are not).
 *
 * `tier` is a hint used for grouping and future difficulty scaling, not a
 * capability tier.
 */

export const GAMES = [
  {
    id: 'ridge-runner',
    name: 'Ridge Runner',
    tagline: 'Skim the mountains',
    blurb: 'Ride a ridgeline as close as you dare. Proximity to the rock scores; touching it ends the run.',
    icon: '⛰',
    href: 'ridge-runner/',
    accent: '#7df9ff',
    skills: ['Precision', 'Real terrain', 'Endless'],
    control: 'Stick = bank · Drag = pitch · Throttle = speed',
  },
  {
    id: 'jayhawk-rescue',
    name: 'Jayhawk Rescue',
    tagline: 'Hover and save them',
    blurb: 'Distress calls over Sitka Sound. Hold a steady hover inside the rescue ring before the clock runs out.',
    icon: '🚁',
    href: 'jayhawk-rescue/',
    accent: '#ffb347',
    skills: ['Hover', 'Timed', 'Rescue'],
    control: 'Stick = bank · Throttle = altitude',
  },
  {
    id: 'bush-pilot',
    name: 'Bush Pilot',
    tagline: 'Put it down in a field',
    blurb: 'Find a flat spot on real ground and land on it. Gentle touchdown, close to the centre, wing intact.',
    icon: '🛩',
    href: 'bush-pilot/',
    accent: '#00ff88',
    skills: ['Landing', 'Real terrain', 'Scored'],
    control: 'Stick = bank · Drag = pitch · Flare near ground',
  },
  {
    id: 'ring-run',
    name: 'Ring Run',
    tagline: 'Thread the course against the clock',
    blurb:
      'Eight rings over Sitka Sound, one clock. Score is the time you have left, so the reward is a tight line rather than a safe one.',
    icon: '◎',
    href: 'ring-run/',
    accent: '#ff6bd6',
    skills: ['Time trial', 'Waypoints', 'Real terrain'],
    control: 'Stick = bank · Drag = pitch · Throttle = speed',
  },
  {
    id: 'slalom',
    name: 'Slalom',
    tagline: 'Low and fast, always turning',
    blurb:
      'Gates sit low and alternate hard left-right. There is no line that stays straight, so hesitating costs you the whole course.',
    icon: '⇄',
    href: 'slalom/',
    accent: '#ffd93d',
    skills: ['Precision', 'Speed', 'Real terrain'],
    control: 'Stick = bank · Drag = pitch · Throttle = speed',
  },
  {
    id: 'cargo-drop',
    name: 'Cargo Drop',
    tagline: 'Collect it, then let it go',
    blurb:
      'Pick up the load, fly to the zone, and release at the right height. The score is decided by the drop, not the flying.',
    icon: '📦',
    href: 'cargo-drop/',
    accent: '#7df9ff',
    skills: ['Two-phase', 'Ballistics', 'Judgement'],
    control: 'Stick = bank · Full forward stick = release',
  },
  {
    id: 'glide',
    name: 'Glide',
    tagline: 'Engine out',
    blurb:
      'Every metre of altitude is a metre of range. Throttle is not a speed control, it is a spend — and there is no engine to get you home.',
    icon: '🪂',
    href: 'glide/',
    accent: '#9ee37d',
    skills: ['Energy', 'Endurance', 'No engine'],
    control: 'Stick = bank · Throttle = spend altitude',
  },
  {
    id: 'island-hop',
    name: 'Island Hop',
    tagline: 'A tour, with nothing at stake',
    blurb:
      'Six real places around Sitka Sound, in a loop, at whatever pace you like. No clock, no score to beat, nowhere to fail.',
    icon: '🏝',
    href: 'island-hop/',
    accent: '#5db8ff',
    skills: ['Explore', 'No fail', 'Scenic'],
    control: 'Stick = bank · Drag = pitch · Throttle = speed',
  },
  {
    id: 'wildlife-watch',
    name: 'Wildlife Watch',
    tagline: "Look, don't touch",
    blurb:
      'Find what lives around the sound and tap it to log the species. Nothing can be failed and the clock does not exist.',
    icon: '🦅',
    href: 'wildlife-watch/',
    accent: '#c58cff',
    skills: ['Spotting', 'Calm', 'No fail'],
    control: 'Stick = bank · Tap a marker to identify',
  },
  // --- placeholders, shown locked so the menu is honest about scope ---
];

export const FREE_FLY = {
  id: 'free-fly',
  name: 'Free Fly',
  tagline: 'No objectives, no clock',
  blurb: 'Just the sky. The sim, exactly as it was designed.',
  icon: '✈',
  href: '../',
  accent: '#00ff88',
  free: true,
};

/** Games that are playable right now. `comingSoon` cards are shown but locked. */
export const availableGames = () => GAMES.filter((g) => !g.comingSoon);
export const allGames = () => GAMES;
