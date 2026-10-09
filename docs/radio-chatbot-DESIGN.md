# Radio Chatbot — Design Document

**Codename:** "TALKSITKA"
**Status:** Design only — do not build until Magnus approves.
**Date:** 2026-10-08

---

## 1. Vision (Magnus's words)

> "Push-to-talk radio — player taps radio button, speaks (or types), releases. A few seconds later, a chatbot responds like air traffic control or a co-pilot. Like being on the radio."

Key beats:
- **Push-to-talk**, not a phone call. Tap, speak, release. Game keeps running.
- Response arrives a few seconds later, like real radio latency.
- Starts with **pre-written responses**. "That was a good one — keep that one."
- Learns over time: good responses get stored, reused, refined.
- Personality: ATC when it matters, co-pilot buddy when it doesn't.

---

## 2. UX Design

### 2.1 Radio UI

```
┌─────────────────────────────────┐
│  📻 SITKA RADIO        [—] [×]  │
├─────────────────────────────────┤
│  YOU: "where am I?"             │
│  TOWER: "Over Sitka Sound,     │
│   3 miles east of the airport." │
│                                 │
│  YOU: "tell me a joke"          │
│  CO-PILOT: "Why did the pilot   │
│   bring a ladder? New altitudes."│
├─────────────────────────────────┤
│  [      🎙 HOLD TO TALK      ]   │
│  [type instead...            ]   │
└─────────────────────────────────┘
```

- **Big push-to-talk button** (min 64px, thumb-friendly, bottom of screen).
- **Waveform animation** while recording (canvas bars, cheap).
- **Transcript** scrolls; latest exchange highlighted.
- **Thumbs up/down** on each bot response (the learning signal).
- **Two voices**: TOWER (authoritative, checklist/ATC) and CO-PILOT (casual, jokes, POI).
- Collapsible to a small 📻 badge so it never blocks flying.

### 2.2 Interaction flow

1. Player holds 🎙 (or taps and types).
2. On release: transcript shows "YOU: ..." immediately.
3. "TOWER is responding..." with radio-static shimmer (1–3s, like real latency).
4. Response appears + **spoken aloud** via SpeechSynthesis (toggleable).
5. 👍 / 👎 buttons on the response.

### 2.3 Voice input

- **Web Speech API** (`webkitSpeechRecognition` on iPad Safari).
- Verified working on iPad iOS 18 / Safari 26 in both browser tab and PWA home-screen mode (push-to-talk model; recreate the recognition instance per use).
- **Caveat:** recognition is unreliable/buggy on some iOS versions → **always offer text fallback**. Feature-detect; hide mic where unsupported, keep text input.
- Requires HTTPS (we have it via Cloudflare) + mic permission (ask once, explain why).
- Privacy note: Chrome streams audio to cloud; Safari can do on-device. Disclose in a footnote, not a popup.

### 2.4 Voice output

- **SpeechSynthesis** — solid on all iPad browsers.
- Prime with a silent utterance on first user gesture (iOS requirement).
- Toggle: 🔊 on/off. Default ON for voice input, OFF for text input (configurable).
- Pick a clear system voice; slightly lower pitch + slower rate reads as "radio."

---

## 3. Response Engine

### 3.1 v1: Pattern matching + pre-written responses (no AI)

Keyword/intent cascade on the normalized transcript:

```
normalize → exact phrase → keyword set → fallback
```

**Intent table (v1):**

| Intent | Trigger keywords | Responder |
|--------|-----------------|-----------|
| location | where am i, position, location | TOWER |
| poi_mountain | mountain, peak, edgecumbe, volcano | CO-PILOT |
| poi_island | island, japonski, baranof, kruzof | CO-PILOT |
| weather | weather, wind, visibility, clouds, rain | TOWER |
| landing_help | land, landing, runway, approach | TOWER |
| checklist | checklist, preflight, pre-flight | TOWER |
| joke | joke, funny, bored | CO-PILOT |
| greeting | hello, hi, hey | CO-PILOT |
| altitude | altitude, how high, climb, descend | TOWER |
| speed | speed, how fast, slow down | TOWER |
| fuel | fuel | TOWER |
| help | help, what can you do, commands | CO-PILOT |

Fallback: "Say again? Didn't catch that. Try 'where am I' or 'tell me a joke.'"

### 3.2 The 20 starter responses

**LOCATION (TOWER)**
1. Q: "where am I?" → "You're over Sitka Sound, {dist} miles {dir} of Sitka Airport. Looking good."
2. Q: "what's my altitude?" → "Showing {alt} feet. Pattern altitude here is 1,000 — you're {above/below}."
3. Q: "how fast am I going?" → "{speed} knots groundspeed. {comment based on regime}."

**POI (CO-PILOT)**
4. Q: "what's that mountain?" → "That's Mount Edgecumbe — a dormant volcano on Kruzof Island. Last erupted about 4,000 years ago. Pretty, right?"
5. Q: "what island is that?" → "That's {Baranof/Japonski/Kruzof} Island. {one-line flavor}."
6. Q: "any whales?" → "Keep an eye on the water — humpbacks feed in the Sound all summer. See a blow, that's your whale."

**WEATHER (TOWER)**
7. Q: "how's the weather?" → "Sitka special: {clouds}, winds {dir} at {spd} knots, visibility {vis}. {quirk}."
8. Q: "is it going to rain?" → "This is Sitka. The question isn't if, it's when. {yes/no} in the next hour."

**LANDING (TOWER)**
9. Q: "help me land" → "Runway 11 is {dist} miles {dir}. Get to 1,000 feet, slow to 70 knots, and I'll talk you down."
10. Q: "which runway?" → "Winds favor Runway {11/29} today. {length} feet of asphalt waiting for you."

**CHECKLIST (TOWER)**
11. Q: "checklist" → "Pull up the checklist panel — pre-flight, takeoff, landing. Want me to walk you through one?"
12. Q: "before takeoff" → "Mixture rich, throttle up, gauges green, runway clear. Call when ready."

**FUN (CO-PILOT)**
13. Q: "tell me a joke" → "Why did the pilot bring a ladder? To reach new altitudes."
14. Q: "another joke" → "What do you call a sleeping T-rex? A dino-snore."
15. Q: "bored" → "Bored? You're flying over the most beautiful place on Earth. Look left — eagles."

**SOCIAL (CO-PILOT)**
16. Q: "hello" → "Hey there! Sitka Radio, listening. Ask me where you are, about the weather, or just say hi."
17. Q: "thank you / thanks" → "Anytime. That's what I'm here for. Fly safe."
18. Q: "who are you?" → "I'm Sitka Radio — part tower, part co-pilot, all Alaska. Ask me anything."

**HELP**
19. Q: "help" → "I can tell you where you are, what's around you, the weather, help you land, or tell a joke. What's up?"
20. Q: "what can you do?" → Same as help.

Dynamic slots ({dist}, {alt}, {speed}, etc.) are filled from live game state — this is what makes it feel alive even with pre-written text.

### 3.3 Anti-drift guard (from MiniMax)

> "Thumbs-up rewards what sounds good, not what's radio-correct."

**Mitigation:** two-tier response store.
- **Tier A (curated):** hand-written + Magnus-approved. Never auto-modified. Thumbs-up only affects ranking among Tier A.
- **Tier B (learned):** community-favorited paraphrases. Clearly labeled, require N approvals before promotion to Tier A.
- ATC/critical responses (landing help, checklist) are **Tier A locked** — popularity can't rewrite safety info.

---

## 4. Backend Architecture (Cloudflare)

### 4.1 v1: Static + pattern matching (no Worker needed)

The v1 engine is pure client-side JS: intent table + slot filling from game state. Zero backend. Ship it in the game bundle.

### 4.2 v2: Worker for logging + shared learning

**Worker:** `sitka-radio` (new, alongside the planned leaderboard worker — or same worker, different routes).

```
POST /radio/log      { session, q, a, rating }   → D1
GET  /radio/top      ?intent=location            → top-rated responses
GET  /radio/stats                                → dashboard-ish counts
```

**D1 table:**
```sql
CREATE TABLE radio_feedback (
  id INTEGER PRIMARY KEY,
  intent TEXT NOT NULL,        -- matched intent
  question TEXT NOT NULL,      -- raw player text
  response TEXT NOT NULL,      -- response given
  tier TEXT DEFAULT 'B',       -- A or B
  up INTEGER DEFAULT 0,
  down INTEGER DEFAULT 0,
  created_at INTEGER,
  approved INTEGER DEFAULT 0   -- 1 when promoted to Tier A
);
```

**Flow:**
- Client matches intent locally, picks best Tier A response, fills slots.
- On 👍/👎, client POSTs to `/radio/log` (fire-and-forget, non-blocking).
- Periodically (or on game load), client GETs `/radio/top?intent=X` to refresh Tier B candidates.
- Promotion to Tier A is manual (Magnus or trusted curator reviews top Tier B weekly).

**Why D1 over KV:** structured queries (top by intent, approval queue). Traffic is tiny — well within free tier.

**Anti-abuse:** rate limit per IP (10 logs/min), max response length, no free-text storage beyond the question (questions are player-typed; store but don't redisplay publicly).

### 4.3 v3: MiniMax for open-ended responses

When pattern matching misses (no intent ≥ threshold):
1. Client sends `{ question, gameState }` to Worker.
2. Worker calls MiniMax API (server-side key, never in client) with a system prompt:
   - "You are Sitka Radio, a friendly ATC/co-pilot in a casual flight game over Sitka, Alaska. Keep responses under 30 words. Radio style. Never give real-world flight instruction."
3. Worker caches the Q→A in D1 (Tier B, unapproved).
4. Client displays + speaks it.

**Cost:** MiniMax calls are cheap; only on intent-miss (minority of traffic). Cache hits make repeats free.

---

## 5. Phase Plan

| Phase | What | Backend | Voice |
|-------|------|---------|-------|
| **v1** | Text input + 20 pre-written responses + slot filling + TTS output | None (client-side) | Output only |
| **v2** | Push-to-talk voice input (with text fallback), thumbs up/down, `/radio/log` + `/radio/top` | Worker + D1 | Input + output |
| **v3** | MiniMax fallback for unmatched questions, Tier B learning loop | Worker + MiniMax API | Input + output |

**Ship v1 with the next game update** — it's pure client-side, no backend risk. v2/v3 after Magnus playtests v1.

---

## 6. Open Questions for Magnus

1. **Personality split:** TOWER (serious) vs CO-PILOT (fun) — or one voice? 
2. **Jokes:** keep the dad jokes, or more Alaska-flavored?
3. **Real METAR:** should weather responses use live Sitka conditions (PASI METAR via API), or game-state only?
4. **Radio chatter:** ambient background chatter from "other pilots" for atmosphere? (Cheap: pre-written lines on a timer.)

---

## 7. MiniMax Session Notes

(per Magnus's direction: document what MiniMax is good at)

- **Strong:** Q&A pair writing with personality (the goose/UFO "G.O.O.S." bit); risk identification (the popularity-vs-authenticity drift catch was the single best insight of the session).
- **Prompt shape that worked:** "5 example Q&A pairs, radio style" / "10 short responses, under 20 words each" — concrete counts + length caps.
- **Weak:** architectural detail (the learning-system answer was thorough but generic — needed Cloudflare-specific grounding from me).
- **Pattern:** give it a creative frame ("radio style", "under 20 words") and it shines; ask for infrastructure and it hedges.

---

*End of design. Awaiting Magnus's approval to build v1.*
