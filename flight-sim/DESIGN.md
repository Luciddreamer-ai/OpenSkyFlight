# Sitka Flight Simulator — Design Document

**Version:** 0.1 (Phase 1)  
**Date:** 2026-10-08  
**Status:** Design + checklist prototype

> A new MSFS-style browser flight sim, Sitka-focused and iPad-first. Reverse-engineered from the best of Microsoft Flight Simulator (including the 90s classics), distilled to what makes you *feel like a pilot*.

---

## Vision

Not a game with a plane in it. A **simulator that makes you feel like a pilot**.

The difference: ritual, consequence, place. You don't "start a level" — you walk through a pre-flight checklist, talk to Sitka Tower, taxi to runway 11, and rotate off into the rain. The checklist isn't a menu; it's the thing that makes your hands feel like a pilot's.

Home base: **Sitka Airport (PASI)**, Rocky Gutierrez Airport. Spawn on the ramp. Real runway (11/29, 6,600 ft). Real surroundings: Mount Edgecumbe across the sound, Japonski Island, the town.

---

## MSFS Pillars (adapted)

### 1. Sitka Airport (PASI) as home base
- Detailed runway 11/29, taxiways, ramp spawn
- Airport beacon, windsock, runway lighting
- Future: terminal building, fuel pumps, tiedowns

### 2. Checklist system ← Phase 1
- **Pre-flight** (8 items): docs, fuel/oil, controls, gear, prop, engine, pitot-static, lights/avionics
- **Takeoff** (5 items): flaps, trim, transponder, runway clear, full power
- **Landing** (5 items): fuel, mixture, landing light, flaps, gear down
- **The ritual rule** (from MiniMax): each item requires *deliberate confirmation* — press-and-hold or slide, not instant tap. Friction IS the ritual. A tap is a grocery list; a hold is a pilot.
- Cannot take off until pre-flight + takeoff checklists complete
- Checklist panel: slide-in from left, iPad-sized touch targets

### 3. Simple ATC ← Phase 2
- Menu-based, not full phraseology (Jev: 0.95 for simplified, touch-friendly 0.83)
- Sitka Ground: "Request taxi" → "Taxi to runway 11 via Alpha"
- Sitka Tower: "Ready for departure" → "Cleared for takeoff"
- Text log + optional voice synthesis (Web Speech API)
- Future: traffic pattern calls, flight following

### 4. Missions ← Phase 2
- **Sightseeing:** Mount Edgecumbe orbit, Sitka Sound tour
- **Cross-country:** PASI → PAJN (Juneau, ~90nm), PASI → PAKT (Ketchikan, ~150nm)
- **Cargo:** Deliver supplies to remote strips
- **Floatplane:** Water landing at a cove (MiniMax must-have)
- Mission tracker HUD: waypoint, distance, ETE

### 5. Career progression ← Phase 3
- Student → Private Pilot → Commercial
- Logbook: hours, landings, airports visited
- Ratings unlock aircraft and missions
- LocalStorage persistence

### 6. Weather ← Phase 2
- Sitka's rain/fog/wind as gameplay
- Use our procedural sky shader (time-of-day)
- METAR-style briefing: "Wind 140 at 12, visibility 3SM, rain"
- Crosswind landings are the real boss fight

### 7. Aircraft ← Phase 1 (one) → Phase 3 (fleet)
- **Phase 1:** Cessna 172-style ("Skyhawk") — the trainer
- **Phase 2:** DHC-2 Beaver floatplane (water landings!)
- **Phase 3:** Twin Otter, Cub, more

### MiniMax must-haves
- ✅ Floatplane physics (Beaver, Phase 2)
- ✅ Wildlife: whales (breaching in the sound), bald eagles
- ✅ Real landmarks: Mount Edgecumbe, Japonski Island, Sitka town

---

## Technical Architecture

```
flight-sim/
├── index.html          # Entry point
├── css/
│   └── sim.css         # Sim UI styles
├── js/
│   ├── main.js         # Boot, game loop
│   ├── ui/
│   │   ├── ChecklistPanel.js   # ← Phase 1
│   │   ├── ATCWindow.js        # Phase 2
│   │   ├── MissionTracker.js   # Phase 2
│   │   └── Logbook.js          # Phase 3
│   ├── checklists/
│   │   └── c172.js             # Checklist data
│   ├── atc/
│   │   └── sitka.js            # Phase 2
│   ├── missions/
│   │   └── missions.js         # Phase 2
│   ├── aircraft/
│   │   └── c172.js             # Phase 1 (one plane)
│   └── weather/
│       └── metar.js            # Phase 2
```

**Reuses from main engine:**
- `GeoTerrainManager` (real terrain)
- Sky shader (`?sky=procedural` → default here)
- Puff clouds, ocean shader
- Touch controls (adapted)
- SoundFX (engine hum, checklist clicks)

**Does NOT touch:** existing games, main app.js. Fully standalone.

---

## iPad-First Rules

1. All touch targets ≥ 44px
2. Checklist panel: thumb-reachable, slide-in from left edge
3. No hover-dependent UI
4. Landscape primary, portrait works
5. Safe-area insets respected

---

## Phase Plan

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Design doc + scaffold + checklist prototype | 🟡 In progress |
| 2 | ATC + missions + weather + Beaver floatplane | ⬜ Planned |
| 3 | Career/logbook + fleet + wildlife | ⬜ Planned |

---

## MiniMax Learnings (ongoing)

*Documenting what MiniMax is good at through iteration, per Magnus's direction.*

1. **Ritual insight (checklist):** "The friction IS the ritual." MiniMax identified that instant-tap checklists feel like todo apps, not pilot workflows. Recommended press-and-hold or slide confirmation. This single insight reshaped the checklist UX.
2. **Short prompts only.** 1-3 sentences, one question. Long prompts return empty.
3. **Strong at:** game-feel critique, emotional/narrative texture, design patterns (hazards+helpers+guides trios), fairness sanity checks.
4. **Weak at:** absolute numbers without world context (give it constraints, it rescales correctly). Abstract "top 3" questions return thin answers; concrete creative frames return gold.

## Jev Decisions (ongoing)

| Question | Verdict |
|----------|---------|
| Checklist vs missions for Phase 1 | Checklist (0.53, low confidence — but checklist_feel 0.71) |
| ATC complexity for iPad | Simplified menu (0.95, confidence 0.92) |
