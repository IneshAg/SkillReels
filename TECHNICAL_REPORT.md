# MOVE / SkillReels — Technical Report
### PS6 "Attention to Career" · Techcora Hackathon
*How the app actually works, end to end.*

---

## 1. What this app is

MOVE is a short-form learning feed that looks and feels like Instagram Reels, but its objective function is **useful career progress, not watch time**. The user scrolls full-bleed vertical reels; the system quietly learns what they care about from behaviour, and at the right moments it converts passive watching into action — a quiz, a code fix, an order-the-code puzzle, a fill-the-blank, or an in-app build — then measures whether that attention is actually turning into demonstrable skill.

The whole product is built around one decision: **"progress" is defined as evidence, not screen time.**

```
Watch (exposure)  <  Answer (concept)  <  Apply (application)  <  Build (implementation)
      0.15                0.48                   0.78                     1.00
```

A single 3-minute "apply" step is worth more progress than thirty minutes of watching. That rule is the spine of the engine, the metrics, and the demo.

---

## 2. System architecture

Three parts, cleanly separated so the system is explainable end to end.

| Layer | Tech | Responsibility |
|---|---|---|
| **Feed client** | React 19 + Vite + TypeScript | The reel feed, the learning games, the Progress view, the Profile (goal) view, and a **System view** built for judges (live learner state + a scenario simulator + the progress metrics). |
| **API boundary** | FastAPI | One write path (`POST /events`) and read paths (`/feed/next`, `/feed/learning/{id}`, `/user/goal`, `/metrics`, `/simulate/*`). |
| **Recommendation engine** | Pure Python (`engine.py`) | Candidate generation → heuristic scoring → post-ranking policy → next unit + a structured, human-readable reason. No ML. |
| **Store** | SQLite via SQLModel | Content catalog, an append-only event log, and one per-user learner model. |
| **Seed catalog** | `seed_data.py` | 50 curated content units across five career tracks. |

### Data flow (one loop)

```
UI interaction
  → POST /events {event_id, user_id, unit_id, event_type}     (idempotent)
  → SQLite: append Event + update UserState                   (one transaction)
  → engine.get_next_recommendation(state)
        candidate generation → score → policy → reason
  → { state, recommendation: { unit, reason, policy_applied } }
  → UI renders the next card + a "Why this?" explanation
```

Nothing about *what to show next* is hidden: every recommendation carries the policy that produced it and the signals behind it.

---

## 3. Domain entities

**ContentUnit** — one learning atom.
`id, type (video | lesson | quiz | challenge), evidence_type (exposure | concept | application | build), difficulty, prerequisites[], task_data{}`.
`task_data` is a flexible JSON blob holding `topic`, `skills`, `goal_tags`, `interest_tags`, the reel `snippet` (the concept's real code/term), the `interaction` type for games, and so on.

**Event** — append-only log. `event_id` is **unique**, which is what makes client retries safe. Event types:
`UNIT_SERVED, WATCH_COMPLETED, LESSON_COMPLETED, SKIPPED, TASK_COMPLETED, TASK_FAILED, INTERVENTION_SKIPPED, NOT_INTERESTED, LIKED, DISLIKED, REACTION_CLEARED, SHARED`. Each event is tagged `user` or `simulated`.

**UserState** — the learner model, updated transactionally on every event:
- *Behaviour signals:* `passive_streak`, `recent_skip_streak`, `intervention_skips`, `intervention_cooldown`, `task_failures`, `total_items_served`, `meaningful_actions`.
- *Evidence counts:* `evidence_exposure / concept / application / build`.
- *Inferred model:* `observed_interests{topic: weight}`, `skill_evidence{skill: count}`.
- *Declared goal + format preferences:* `declared_goal`, `pref_video / pref_quiz / pref_challenge`.

The key design choice: the system **never asks the user what they know**. Interests and skill are inferred entirely from what they complete, skip, like, and dislike.

---

## 4. The recommendation engine

A transparent three-stage pipeline (`engine.py`), not a learned model.

### 4.1 Candidate generation
Pull *unseen* reels that fit the learner, instead of scoring the whole catalog:
- **Goal scoping (`GOAL_TOPICS`)** — each goal maps to the topics in scope for it. Data Analyst sees data + databases; Frontend sees frontend + APIs; Cloud sees cloud + APIs; Security sees security + APIs; Backend sees APIs + databases + security + cloud. Switching the goal re-points this stage, so the feed is visibly remade.
- **Prerequisite gate** — a concept whose prerequisites aren't completed yet is "not available" and never appears (e.g. the OAuth reel stays hidden until the auth check is done).
- **Fallback** — if a goal's pool is exhausted, the feed falls back to any unseen, unlocked reel rather than dead-ending.

### 4.2 Multi-signal score
Hand-set prototype weights, stated honestly as such:

```
score = 0.25·goal_relevance
      + 0.20·skill_gap
      + 0.15·interest_fit
      + 0.15·difficulty_fit
      + 0.15·progress_potential
      + 0.10·format_fit
      + bridge_bonus
      − skip_penalty
```

`difficulty_fit` grows with the learner's accumulated evidence (readiness), so harder material surfaces as they demonstrate more. Recent likes/dislikes bias the next couple of reels toward or away from a topic.

### 4.3 Post-ranking policy
A small set of explicit rules decides when to break from "just the top-ranked reel":
- **Cold start** — little history → exploration reel, flagged as a first signal (not a bandit).
- **Adjacent-topic exploration** — after a run on one topic and once the interest profile is confident, surface the best-ranked *nearby* topic.
- **Variety after skips** — a skip streak flips the feed to a different topic/format.
- **Consumption → practice offer** — after an **8-reel same-topic watch streak**, offer a related in-app challenge (skippable). 8 is a stated policy knob, not a learned number.
- **Build offer** — after an application is completed, offer an optional in-app build.
- **Goal ↔ interest bridge** — when observed interest diverges from the declared goal (e.g. loves frontend, goal is backend), surface a bridge task connecting the two through an API.
- **Guided path** — an opt-in See → Learn → Try → Build lesson path, kept *separate* from the discovery feed (learning never auto-follows a reel; the user opts in via "Go deeper").

Every branch returns a `reason {primary, text, signals, trigger, components}` that powers the "Why this?" panel.

---

## 5. The reel experience (concept visuals)

Reels are **designed concept visuals**, not stock video. Each reel renders the concept's real code or term (`GET /api/products → 200 OK`, `SELECT … JOIN …`, `const [n, setN] = useState(0)`) on a per-topic colour palette, animated, and advanced by a short read timer. This means:
- what the user sees always matches the caption and their goal track,
- there is no external-media dependency to break, and
- the feel is still swipe-and-autoplay short-form (full-bleed, like/dislike/save/share rail, caption with "more", sound toggle bottom-right, progress bar).

Watching to the end records a `WATCH_COMPLETED` (exposure); swiping away early records a `SKIPPED`.

---

## 6. The learning games (turning attention into action)

When the user opts in (or an intervention fires), the reel gives way to an interactive unit. Five interaction types, each with a streak HUD and "juicy" feedback:

| Game | Interaction | What the learner does | Evidence |
|---|---|---|---|
| **Quiz** | `multiple_choice` | Tap the correct option; locks, shows explanation, Continue | concept |
| **Code fix** | `code_fix` | Tap chips to repair a broken line of code | application |
| **Order the code** | `parsons` | Tap lines from a bank into the right order | application |
| **Fill the blank** | `fill_blank` | Tap the token that completes the snippet | application |
| **Build** | `build_endpoint` / `build_steps` | Assemble the smallest useful thing (e.g. pick METHOD + ROUTE, run the request, save the working result) | build |

Completing a game emits `TASK_COMPLETED` (which raises the matching evidence count and `meaningful_actions`); a wrong attempt emits `TASK_FAILED`. A completion guard means finishing the same unit twice awards **no second evidence**.

> **Status note:** the current content pool is interaction-light — one build, one code-fix, one quiz, two order-the-code, three fill-blank. The game *mechanics* are solid; the next improvement is more units per type and richer build tasks. (This is also the area most affected by the Figma-sync revert — see §10.)

---

## 7. How the five PS6 situations are handled

All five are runnable live from the **System view → Scenario simulator**, so a judge can trigger each on camera.

| # | PS6 situation | Simulator button | What the engine does |
|---|---|---|---|
| 1 | Endless consumption (watches, never acts) | **Endless watching** (`/simulate/stall`) | Seeds an 8-reel same-topic streak → offers a related in-app challenge (`CONSUMPTION_WITHOUT_PROGRESS`). |
| 2 | Interest discovery (goal ≠ observed interest) | **Goal and interest diverge** (`/simulate/divergence`) | Observed interest = frontend, goal = backend → returns the React-to-API **bridge** task. |
| 3 | Engagement drop (suddenly skipping) | **Engagement drops** (`/simulate/disengagement`) | Records a skip streak → **variety** policy changes topic/format and avoids the skipped topics. |
| 4 | **Dopamine loop reversal** (3-min task > 30-min passive) | **Dopamine loop reversal** (`/simulate/reversal`) | Seeds a 3-minute watch → answer → apply path, then surfaces a **progress-per-minute** measurement. |
| 5 | Cold start (no history) | **Cold start** (`/simulate/reset`) | Clears signals → exploration reel, flagged as a first signal. |

### Scenario 4 is the core design question, so it's measured, not just claimed
The System view shows a **"Progress, not screen time"** panel:
- `progress_score` (evidence-weighted), `time invested` (real minutes from unit durations), and `progress / minute`.
- A **"Why 3 minutes can beat 30"** comparison, computed from the same engine weights:
  - 30 min passive watching → 30 × 0.15 = 4.5 progress → **0.15 / min**
  - 3 min watch → answer → apply → 0.15 + 0.48 + 0.78 = 1.41 progress → **0.47 / min**
  - → the short active path earns **~3.1× more progress per minute**.

This is the honest answer to "measure whether the product changes behaviour, not just engagement": progress is evidence weight divided by real minutes, so passive watching cannot win.

---

## 8. Failure & edge-case handling

| Situation | Response |
|---|---|
| Data missing / stale | Reels are designed visuals, so there's no media URL to break; missing `task_data` fields fall back to defaults (a reel with no snippet shows its skill/title card). |
| A service fails | If the backend is down, the client shows a clear "can't reach the learning service" error and does **not** silently advance the feed. Controls unlock optimistically so a slow write never locks a card. |
| A network connection fails | The fetch wrapper surfaces a banner; because every event has a unique `event_id`, retrying the same action is safe. |
| Requests duplicated | A repeated `event_id` returns `duplicate: true` and changes nothing. Completing the same unit twice awards no second evidence (completion guard). |
| Critical resource unavailable | When no eligible candidate exists, the engine returns `CONTENT_EXHAUSTED` and the UI shows an end/reset state instead of recycling or crashing. |
| Conditions change mid-run | Changing the goal re-ranks immediately; a skip streak flips to variety; a watch streak triggers a practice offer; a completed application triggers an optional build. |

**Consistency:** each event is one SQLite transaction (append Event, update UserState, commit, or roll back). SQLite is the single consistency boundary — no distributed state to reconcile. **Known limit:** SQLite is single-writer, so a burst of concurrent retries can hit a write conflict; acceptable for a single-user prototype.

---

## 9. Trade-offs

**Optimised for:** interpretability (every recommendation is explainable), a reproducible one-user demo, deterministic PS6 scenarios, and a feed that *feels* like short-form while rewarding action.

**Sacrificed:** a learned ranker, a large content catalog, licensed media, multi-user scale, and real auth.

**Limitations:** scoring weights are hand-tuned, not learned; the content pool is small; the progress numbers are prototype operationalisations, not validated behavioural measures; SQLite caps concurrency.

**What we'd change with more time:** swap the heuristic scorer for a contextual-bandit/learned ranker once real interaction data exists (the pipeline shape already matches that design); a short onboarding diagnostic to warm the cold start; a search path and a discovery feed; and a much larger, richer game/content library.

---

## 10. Current status & what's pending (for the submission)

- **Built and verified (test copy):** goal-scoped feed, prerequisite gating, concept visuals, the five-scenario simulator including the dopamine-reversal metric, the improved games, and the earlier bug fixes (sound toggle, button contrast, Continue-after-build, scroll-resume, goal-chip contrast).
- **Pending before it's judge-ready:**
  1. A **Figma Make sync** in `frontend/.figma/make` keeps rewriting `src/*` and reverting edits — this is why game/UI changes "disappear". It (and a stale `.git/index.lock`) must be cleared first.
  2. **GitHub repo is behind** the working code — today's work isn't committed/pushed yet, so the repo is not yet complete (checklist item 3).
  3. **Port consistency** — README says 8000, but that port is blocked on the dev machine (WinError 10013); the Vite proxy uses 5055. Standardise on one working port in README + proxy + run command.
  4. Richer game content (more units per interaction type).

The clean fix is one pass once the sync/lock is cleared: re-apply the verified changes, reconcile the port, commit, and push.
