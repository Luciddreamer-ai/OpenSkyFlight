# Flight Sim Playtest Framework

**Project:** Sitka-based MSFS-style flight simulator (new version, separate from existing builds)
**Base airfield:** Sitka Rocky Gutierrez Airport (SIT/PASI), runway 11/29
**Target device:** iPad first, desktop second
**Cadence:** Run the full scripted pass after every significant change; exploratory passes continuously.

---

## 1. Philosophy

Jev verdict (2026-10-08): **test the flight model first** (0.99 vs UI 0.01). A beautiful cockpit
over a broken flight model is a broken sim. Priority order in this doc reflects that.

Jev also says use **both scripted (0.70) and exploratory (0.66)** testing:
- **Scripted:** this checklist. Repeatable, comparable across builds, catches regressions.
- **Exploratory:** fly like a player with no agenda for 10 minutes. Catches the things
  checklists miss ("this just feels wrong but I can't say why").

MiniMax's broken-vs-polished lens (the 5 things that separate sims from toys):
1. **Energy/momentum** — does the plane preserve kinetic/potential energy, or does it respond
   instantly like it's bolted to the stick?
2. **Powerplant response** — spool-up time, torque/P-factor, or just "throttle = speed"?
3. **Stall behavior** — progressive buffet, defined break, wing drop, recoverable?
4. **Adverse yaw / trim / coupling** — do you need rudder for coordination? Does trim free
   the stick? Is there Dutch-roll subtlety?
5. **Audio-physical sync** — do sounds track RPM, AoA, sideslip, config, or just loop?

Every scripted test below maps to at least one of these five.

---

## 2. Scripted Checklist

### A. Boot & First Run
| # | Check | How | Pass |
|---|-------|-----|------|
| A1 | No black screen | Load page, wait 10s | 3D scene visible, no error banner |
| A2 | Boot time | Time from navigation to interactive | < 8s on iPad Safari |
| A3 | No console errors | DevTools console | Zero red errors |
| A4 | Touch UI appears on iPad | Load on iPad / touch emulation | Joystick + throttle visible |
| A5 | Desktop UI appears | Load on desktop | Keyboard hints visible, no touch UI |

### B. Flight Model (THE priority — Jev 0.99)
| # | Check | How | Pass |
|---|-------|-----|------|
| B1 | Energy preservation | Climb 500m at full throttle, cut to idle, note glide | Plane glides, doesn't fall like a rock or float |
| B2 | Stall buffet | Slow to stall speed, hold | Progressive shaking before the break, not sudden |
| B3 | Stall break & recovery | Let it stall, release back pressure | Nose drops, recovery with opposite input, no spin-lock |
| B4 | Adverse yaw | Roll left/right at cruise | Nose yaws opposite the roll; rudder corrects it |
| B5 | Turn coordination | 30° banked turn, no rudder | Ball/slip indicator shows uncoordinated; rudder fixes |
| B6 | Trim effect | Trim nose-up, release stick | Plane holds attitude without stick input |
| B7 | Throttle response | Slam throttle idle→full | Noticeable spool-up delay (not instant) |
| B8 | Overshoot tendency | Level off from a climb | Plane overshoots slightly then settles (inertia) |

### C. Takeoff (Sitka runway 11/29)
| # | Check | How | Pass |
|---|-------|-----|------|
| C1 | Spawn position | Start flight | On runway threshold, aligned with centerline |
| C2 | Ground roll | Full throttle, hold centerline | Accelerates smoothly, steerable with rudder |
| C3 | Rotation | Rotate at Vr | Nose lifts at sane speed, not glued or jumpy |
| C4 | Liftoff | Continue | Clean liftoff, positive climb, gear-up (if applicable) |
| C5 | Initial climb | Climb to 1000ft | Stable, trimmable, no porpoising |

### D. Landing
| # | Check | How | Pass |
|---|-------|-----|------|
| D1 | Approach stability | 3° glidepath, configured | Holds speed and descent rate with small inputs |
| D2 | Flare | Flare at 20–30ft | Nose rises, descent arrests, not ballooning |
| D3 | Touchdown | Touch down | Main gear first, gentle, no bounce (or one small bounce max) |
| D4 | Rollout | After touchdown | Directional control, braking effective, stops on runway |
| D5 | Go-around | Full throttle from approach | Climbs away cleanly, no settling |

### E. Touch Controls (iPad)
| # | Check | How | Pass |
|---|-------|-----|------|
| E1 | Stick responsiveness | Deflect stick, watch plane | < 100ms perceived lag |
| E2 | Throttle slider | Drag throttle 0→100% | Smooth, live % readout, no jumps |
| E3 | No accidental inputs | Fly 2 min with thumbs | No unintended button presses |
| E4 | All buttons reachable | Tap every HUD button | VIEW, HUD, checklist, etc. all respond |

### F. Audio
| # | Check | How | Pass |
|---|-------|-----|------|
| F1 | Engine tracks throttle | Throttle idle→full (SOUND ON) | Pitch/volume follow RPM, not stepped |
| F2 | Wind tracks airspeed | Dive to Vne | Wind noise rises with speed |
| F3 | Stall warning | Stall the plane | Audible warning before/during buffet |
| F4 | Touchdown sound | Land | Audible thump/scrape |
| F5 | Mute works | Tap mute | All audio stops; icon reflects state |

### G. Checklist Flow
| # | Check | How | Pass |
|---|-------|-----|------|
| G1 | Checklist opens | Tap checklist button | Readable, correctly ordered |
| G2 | Items check off | Complete each item | Visual confirmation per item |
| G3 | Flow matches phase | Pre-takeoff vs landing | Correct checklist for flight phase |

### H. Terrain & World
| # | Check | How | Pass |
|---|-------|-----|------|
| H1 | No terrain holes | Fly 5 min at 3000ft | Continuous terrain, no gaps or pop-in |
| H2 | Sitka landmarks | Fly to Mt. Edgecumbe, harbor | Recognizable, correctly placed |
| H3 | Water rendering | Fly over Sitka Sound | Animated water, not flat color |
| H4 | Sky | Look at horizon, any time | No banding, sun plausible |

### I. Crash & Edge Cases
| # | Check | How | Pass |
|---|-------|-----|------|
| I1 | Terrain crash | Fly into a mountain | Crash sequence (not clipping through) |
| I2 | Water ditching | Land on water | Ditching behavior, not instant explosion |
| I3 | Respawn | After crash | Respawns at Sitka, no reload needed |
| I4 | Pause | Pause mid-flight | Freezes sim, resumes cleanly |

### J. Performance (iPad)
| # | Check | How | Pass |
|---|-------|-----|------|
| J1 | FPS cruise | 60s at cruise | ≥ 25fps sustained on iPad |
| J2 | FPS low & fast | 60s at 200ft, high speed | ≥ 20fps (terrain streaming load) |
| J3 | No thermal throttle death | 10 min session | No progressive slowdown |

---

## 3. Exploratory Pass (10 min, no agenda)

Fly like a curious player. Note anything that feels wrong, even if you can't name it.
Prompts if stuck:
- Try to land on the shortest strip you can find.
- Fly under a bridge / through a valley.
- See how slow you can go without stalling.
- Chase your own shadow.
- Land, take off again, land somewhere else.

Log every "huh, that's weird" moment — those are the highest-value findings.

---

## 4. Common Issues to Watch For

From prior builds (2026-10-05 → 10-08):
- **Eternal black screen** → check module resolution first (import map vs dist/)
- **Plane not moving on load** → throttle default / auto-throttle
- **Flat water** → ocean shader not loaded
- **Invisible objectives** → flat ground marks need beacon pillars at altitude
- **Timer unfairness** → do the distance/speed math before setting limits
- **Keybinding conflicts** → audit full key map after every addition (B/N/Y history)
- **Touch button hidden by logic bug** → verify visibility conditions on real touch
- **Camera can't see the payoff** → tracking cam for drops/landings
- **Probes ignore heading** → rotate lookahead by yaw

---

## 5. Baseline Assessment — Current Main Game (2026-10-08)

Static assessment of https://lucineer.github.io/OpenSkyFlight/ as the "before" picture.
(Interactive browser verification still needed — flagged for parent delegation.)

| Area | Status | Notes |
|------|--------|-------|
| Boot | ✅ Pass (prior verified) | Boots clean, terrain/ocean/sky/HUD render, no error banner |
| Flight model | ⚠️ Arcade | SimpleFlight: linear throttle→speed, no stall buffet, no adverse yaw, no trim. Flies fine, feels like a toy vs MSFS. This is the #1 gap the new sim must close. |
| Takeoff | ✅ Works | Spawns flying (no runway roll in current build) |
| Landing | ⚠️ Partial | Crash system exists (fireball/skid/cartwheel), but no real flare/touchdown physics |
| Touch | ✅ Good | Floating joystick + throttle slider + buttons, iPad-first |
| Audio | ⚠️ One-shots only | Synthesized SFX (pickup/crash/win), no engine/wind loop tracking RPM/airspeed — MiniMax's #5 gap |
| Terrain | ✅ Good | Streams cleanly, no holes, velocity-lookahead prefetch |
| Crash | ✅ Fun | Varied animations + quips, respawn works |
| FPS | ✅ OK | Runs in automation; real-iPad sustained FPS unverified |

**What MSFS does better (target list for the new sim):**
1. Energy-model flight (momentum, glide, overshoot) — current game has none
2. Stall progression (buffet → break → recovery) — current game has none
3. Engine audio tied to RPM — current game has one-shot SFX only
4. Checklist-driven procedures — current game has none
5. Runway takeoff/landing physics — current game spawns airborne

---

## 6. Iteration Log

Copy this block per playtest run:

```
## Run YYYY-MM-DD — Build <commit>
- Tester: (agent/human)
- Type: scripted / exploratory
- Device: (iPad model / desktop browser)
- Results:
  - PASS: A1, A2, ...
  - FAIL: B2 (no buffet before stall), ...
  - WEIRD: (exploratory notes)
- Deltas vs last run: (fixed X, regressed Y)
- Next: (what to fix first)
```

---

## 7. Tool Usage Notes

- **MiniMax** (`~/workspace/skills/minimax/bin/chat.py`): keep prompts to 1–3 sentences,
  one question each. Long prompts return empty. Best at: game-feel critique, emotional/
  narrative texture, design patterns, fairness sanity checks. Weak at: abstract architecture
  questions. Proven loop: draft → critique → refine → validate → numbers → rescale.
- **Jev** (`~/workspace/skills/typesafe-ai/bin/jev.py`): ~$0.00002/call, ~1s. Use for
  prioritization at every fork: flight-model-vs-UI, scripted-vs-exploratory, scope cuts.
  Established: flight model first (0.99), both scripted+exploratory (0.70/0.66).
