# Sitka Skies — OpenSkyFlight

**[▶ Click to Play](https://lucineer.github.io/OpenSkyFlight/)** — no install, runs in your browser (iPad + desktop)

A browser-based 3D flight simulator over real-world terrain, home-based in **Sitka, Alaska**. Take off from Sitka Rocky Gutierrez Airport, soar over Kruzof Island and Mount Edgecumbe, or jump anywhere on Earth.

Built from [OpenSkyFlight](https://github.com/jeanjerome/OpenSkyFlight) by Jean Jérôme — all credit for the original terrain engine, WebGPU renderer, and flight model goes to him. This fork reshapes it into a game platform with touch controls, a Sitka home base, and (coming soon) mini-games.

![WebGPU](https://img.shields.io/badge/WebGPU-Three.js-green)
![iPad](https://img.shields.io/badge/iPad-touch_controls-blue)

## What works right now (Level 1 — stable)

- **Take off from Sitka** — spawn at Sitka Airport, throttle up, and climb out over Sitka Sound
- **Fly anywhere** — LOC button with search + presets (Seattle, Grand Canyon, Mont Blanc, Tokyo, NYC, Sydney, Random), or `?lat=`/`?lon=` URL params
- **Touch controls** — floating joystick, drag-to-look, vertical throttle slider, VIEW/TEX/HUD/LOC buttons (iPad-first)
- **Real-world terrain** — elevation from AWS Terrarium, satellite/road/SAR/elevation textures, adaptive LOD
- **Rafale jet** — 3D model with chase + cockpit cameras, banking, full 360° flight
- **Crash system** — fly into terrain and get a physics-flavored crash animation (fireball, skid, cartwheel, splash) with a quip and instant respawn
- **HUD + minimap** — compass, artificial horizon, altimeter, speed, live OSM minimap
- **Flight plans** — record waypoints, autopilot follows your path

## Roadmap

- **Aircraft fleet** — 8 flyable planes (Bush Cub, Twin Otter, ATR 72, biplane, floatplane, stunt plane, Coast Guard helicopter) via in-game hangar
- **Mini-games** — 50 ideas cataloged: helicopter rescues, dogfights, ring courses, wildlife spotting, glacier landings, and more
- **Explorer mode** — Wikipedia-powered POI bubbles over real landmarks
- **More home bases** — beyond Sitka

## Quick Start

Just open the **[play link](https://lucineer.github.io/OpenSkyFlight/)** in Safari (iPad) or any WebGPU-capable desktop browser. No build, no API key.

For local development:

```bash
git clone https://github.com/Lucineer/OpenSkyFlight.git
cd OpenSkyFlight
# Serve with any static server, e.g.:
npx serve .
```

## Controls

**Touch (iPad):**
- Left stick — steer (push forward for extra speed, pull back to slow)
- Left slider — throttle
- Drag right side — look around
- VIEW / TEX / HUD / LOC — camera, textures, instruments, location picker

**Keyboard:**
- `W/S` — throttle up/down, `A/D` — rudder, arrows — pitch/roll
- `E/Q` — climb/descend
- `V` — cockpit/chase, `T` — texture mode, `H` — HUD, `M` — map
- `L` — location picker

## Credits

- **Original engine**: [Jean Jérôme / OpenSkyFlight](https://github.com/jeanjerome/OpenSkyFlight)
- **Terrain data**: [AWS Terrarium](https://registry.opendata.aws/terrain-tiles/), Esri, OpenStreetMap
- **This fork**: Lucineer — iPad adaptation, Sitka home base, game platform direction

## Screenshots

*Coming soon — Sitka Sound, Mount Edgecumbe, Kruzof Island from the air.*
