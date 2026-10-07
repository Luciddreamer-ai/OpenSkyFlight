# Games R&D — the next horizon for OpenSkyFlight

Status: proposal. Nothing in this document is implemented unless the linked PR says so.
Written against the state of the `fix/ci-gate-a11y-and-asset-weight` branch, which
ships three playable games (Ridge Runner, Bush Pilot, Jayhawk Rescue) over the real
terrain engine.

The short version: the bottleneck for this project is **not** gameplay. It is that
every game currently re-derives the same four facts (where the ground is, what the
device can do, whether a flight is interesting, and whether the player is still
having fun) in its own way. The proposals below are ordered by how much they
unlock per unit of engine work.

---

## 0. The two facts we do not have yet

Before any of this is worth building, the thing that would most change our
decisions is **real device data**, and we do not have it. Everything in
`CapabilityProbe` is currently a guess fitted to one headless software rasteriser.

The probe already publishes a diagnostic surface. On a real iPad and on the
RTX 4050 desktop, capture:

```js
{
  tier:          window.__osfCapabilityTier,    // potato | balanced | performance
  reasons:       window.__osfCapabilityReasons, // why the tier was chosen
  fps:           /* rolling mean, not a single sample */,
  terrainPressure: /* tiles in flight vs budget */,
  contextLosses:  /* count + cause */,
}
```

Two specific open questions this would settle:

1. **Does `performance` actually beat `balanced` on the 4050, and by how much?** If
   the delta is small, the `performance` tier's 1400-tile budget buys nothing and
   should be cut. We are currently paying memory for a setting nobody has measured.
2. **Which tier does an iPad actually land in, and is it stable?** The iPad path
   assumes a discrete-GPU-style cost model it almost certainly does not have. If
   iPads land in `potato` and still hold 30fps, the tier boundaries are wrong in a
   way that only shows up on real hardware.

**This is iteration zero and it blocks honest tuning of everything below.** The
`performance` tier in particular is currently unfalsifiable.

---

## 1. Daily Ridge — deterministic global challenges

**What it is.** One seeded run per day, identical for every player on Earth: same
terrain, same ridge, same start. A global leaderboard per seed.

**Why it is the cheapest interesting thing on this list.** We already have a seed
concept available for free — `Ridge Runner`'s terrain is deterministic given a
position, and the crash system already tracks a local best. What is missing is
only (a) a seed derived from the UTC date, (b) a fixed, shareable start position,
and (c) a remote store.

The hard part is (c), and it is worth being blunt about that: this needs a
backend, and a backend is a permanent operational cost. See §6 for the options.

**Determinism caveat that must not be skipped.** The DEM is fetched live from AWS
Terrarium. Two players in the same day see the same terrain only if the tile data
has not been updated in between. It is close enough to be fair, but it is not a
cryptographic guarantee, and the leaderboard should be honest about that rather
than implying otherwise.

**Verdict:** high value per line, but gated on §6. Do the local half first
(seeded daily runs, no leaderboard) — that is maybe 60 lines and is playable
immediately.

---

## 2. Real solar position — the cheapest immersion win on the list

**What it is.** Compute the actual sun position for the player's latitude, longitude,
date and time, and drive the scene's light direction and colour from it.

**Why it is high value:** a day/night cycle is the single largest perceived
quality jump available, and it makes the _existing_ terrain and sky do work that
they are not currently doing. Sitka at 57°N in December has roughly four hours of
twilight; that is a dramatic, specific, real fact that the sim currently ignores.

**Cost:** about 100 lines. The NOAA solar position algorithm is well documented
and needs only lat/lon/time — no network, no API key, no asset. We already have
lat/lon because the terrain engine is built on it.

**What it interacts with:** the capability tiers (a night scene is a very different
performance profile), and Bush Pilot (landing at dusk is a different challenge from
landing at noon — this alone is a free difficulty axis).

**Verdict:** implement. Highest ratio of felt quality to effort in this document.

---

## 3. Synthesised WebAudio immersion

**What it is.** Engine tone that tracks throttle and airspeed, plus wind noise
scaled by ground proximity. All synthesised — no audio files.

**Why synthesised rather than sampled:** a looping engine sample needs to be
pitch-shifted to match airspeed, which means playback-rate artefacts, which means
either shipping several samples or accepting a chipmunk effect. An oscillator stack
with a filter sweep maps to airspeed directly and costs zero bytes.

**Why it is on the list at all:** the simulation is currently silent. For a game
about flying, that is the largest single sensory gap, and it is the cheapest gap to
close.

**Care required:**

- **Autoplay policy.** `AudioContext` starts suspended until a user gesture. The
  resume call must be wired to the first input event, not to page load, or the
  whole feature is silently dead on iPad.
- **iPad silent switch.** iOS respects the hardware mute switch for _some_ audio
  categories. This needs an explicit test on a real device; the `balanced` tier
  assumption covers performance, not audio routing.
- **It must be optional and off-by-default during existing sessions.** An
  unexpected noise source in a sim people use for sightseeing is a regression, not
  a feature.

**Verdict:** implement, but behind an explicit opt-in control, and verify on real
iPad hardware before shipping.

---

## 4. Photo postcards and geotagged flight records

**What it is.** Capture the current view as a postcard: a rendered frame plus the
real coordinates, altitude, date, and a link that reopens that exact viewpoint in
the sim.

**Why it is the highest-leverage social feature here.** It is the one thing that
turns a private toy into something a player _sends to someone else_, and every
other item on this list is invisible until someone else plays.

**The re-open link is the real feature.** A postcard that cannot be returned to is
a screenshot. `world2geo` already converts world coordinates to longitude and
latitude exactly, so a viewpoint is expressible as two numbers plus a heading. This
needs no new engine capability at all — it is a URL parameter and a camera reset.

**Constraints to design for up front:**

- Coordinate round-tripping must be exact enough that the restored camera matches
  the captured one. `world2geo` is the single source of truth for this; do not
  write a second, approximate inverse.
- Postcards must be honest about where they were taken. Fabricated provenance is
  worse than no provenance. If the DEM tile is stale or the position is
  approximate, say so on the card.
- Local-first. `localStorage` or IndexedDB, exportable as a file, no account
  required. Anything that needs an account to share a screenshot is a worse
  screenshot.

**Verdict:** implement the view-restore link first. It is a few lines, it is the
part with lasting value, and it de-risks the rendering part.

---

## 5. Inverse-flight route authoring

**What it is.** Fly a route by hand, then have the system reverse it and make _you_
the obstacle — a chase or escort game built from your own flight.

**Why it is interesting:** it converts the existing free-flight sandbox into a
generator with zero new content. The user is the content author, which means the
game grows without us shipping maps.

**What it needs:** recorded flight state (position, orientation, velocity at
intervals), a spline through that recording, and an AI that flies it. The
recording and the spline are straightforward. The AI is the actual project, and
it is where the effort goes.

**Honest scoping:** a convincing chase AI is not a weekend. It needs a
fly-by-wire model that can fly the _splitter's_ imperfections, not a perfect line
— otherwise it looks robotic and the whole premise collapses. Budget it as a real
feature, not a task.

**Verdict:** the idea is cheap to state and expensive to finish. Prototype the
recording and replay only if §6 lands, because without persistence the routes
cannot be shared, which is the whole point.

---

## 6. Multiplayer — the honest version

Multiplayer is the most-requested-sounding and least-verified item here. The
honest framing: **we cannot yet claim the simulation is deterministic, and
determinism is the entire prerequisite for networking it.**

What stands between here and a multiplayer prototype:

1. **Flight physics determinism across devices.** Two machines must agree on
   state every tick. Floating-point behaviour varies by platform; without a fixed
   timestep and a verified cross-device lockstep, this fails in ways that are
   miserable to debug. **This is unproven and it is the whole ballgame.**
2. **A state-sync authority.** Somebody has to be right.
3. **Terrain consistency.** Every client must see the same DEM tiles, or clients
   are flying different worlds.

### Options for the transport

| Option                                 | Cost                                    | Verdict                                                                                                                                                                                                                                     |
| -------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local split-screen / same-device**   | Almost none                             | **Do this one first.** It tests the physics-determinism question with zero backend. If two viewports on one machine diverge, we have our answer for free.                                                                                   |
| **Peer-to-peer WebRTC**                | Medium, still needs a signalling server | Rejected for now. Every client is authoritative, so divergence is every client's problem.                                                                                                                                                   |
| **Cloudflare Worker + Durable Object** | Low operational cost, no servers to run | The best _serverless_ fit. A Durable Object is a single-threaded room with in-order state, which is exactly the authority model lockstep needs. But it does not remove the determinism requirement — it just makes the hard part tractable. |
| **Game server I run**                  | Highest ongoing cost                    | No. Not justified until we know determinism holds.                                                                                                                                                                                          |

**Recommendation:** do not commit to multiplayer. Spend a small, bounded amount of
effort on the same-device two-viewport experiment, and let its result decide
whether the multiplayer section of this document is real or speculative. The
server choice is downstream of that answer and is therefore premature.

---

## 7. Crash Bingo — failure as content

**What it is.** Rather than treating the crash as a fail state, make it the scoring
event. A crash in a specific way — high sink rate, low altitude, wings level,
inside a named zone — fills a square.

**Why it belongs here:** the crash system is the most developed _content_ system in
this project and it currently ends runs. This reuses it as a scoring surface
without touching the physics, so it is nearly free to build.

**The trap, and it is a real one:** the temptation is to turn crash data into a
telemetry upload. That would be extracting engagement from failure and shipping it
off-device. It should stay local unless the player explicitly shares, for the same
reason the postcard must be honest about its provenance. A game that watches you
crash is a game you stop opening.

**Verdict:** implement, local-only, no telemetry.

---

## 8. Follow-ons: Wildlife Watch and Ring Run

Both are already stubbed in the catalogue as `comingSoon`, which is honest — the
registry refuses to offer what does not exist.

**Wildlife Watch** — real coastal geography, no timer, no failing. The design
question it answers for us: _can we make a game that is not a test of skill?_ If
the answer is yes it broadens the audience, and it is the natural place to use §2
(solar position) since a sunset over a real coastline is the entire point.

**Ring Run** — a time trial threaded through a real route. It needs route
authoring, which §5 is blocked on, but the _ring_ mechanic alone is independent
and small.

**Neither should be built to fill a menu slot.** The launcher is better with three
honest games than five with two placeholders — and the current `comingSoon` cards
are already correct in not pretending otherwise.

---

## What to do next, in order

1. **Get real device data** (§0). Blocks all tuning. Cheapest, highest value.
2. **Solar position** (§2). ~100 lines, no dependencies, no backend, large visible
   gain, and it opens up bush-flying-at-dusk as free content.
3. **View-restore link** (§4, the URL half). A few lines; makes every future
   shareable feature cheaper to build.
4. **Seeded daily runs, local only** (§1, no leaderboard). ~60 lines, and it tells
   us whether anyone plays twice before we build a backend.
5. **Audio, opt-in** (§3). Only after a real iPad confirms the routing.
6. **Same-device two-viewport determinism experiment** (§6). Bounded, and its
   result decides whether multiplayer is a roadmap item or a fantasy.

Everything past step 5 is gated on either measurement or a backend. The instinct
under deadline pressure will be to skip step 1 and tune the tiers by feel; that is
the one path that makes the codebase confidently wrong.
