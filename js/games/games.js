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
    tagline: 'Race the clock',
    blurb: 'Glowing rings on a real route. Thread them all, then beat your own best time.',
    icon: '◎',
    href: 'ring-run/',
    accent: '#ff6bd6',
    skills: ['Time trial', 'Best score', 'Replays'],
    control: 'Stick = bank · Drag = pitch',
    comingSoon: true,
  },
  {
    id: 'wildlife',
    name: 'Wildlife Watch',
    tagline: "Look, don't touch",
    blurb: 'Find and identify wildlife over real coastline. No timers, no failing.',
    icon: '🦅',
    href: 'wildlife/',
    accent: '#9ee37d',
    skills: ['Explore', 'Calm', 'Real places'],
    control: 'Stick = bank · Throttle = speed',
    comingSoon: true,
  },
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
