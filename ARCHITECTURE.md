# MOVE — Attention to Career (PS6)
### System explanation for judging

MOVE is a short-form feed that competes for attention like Instagram/TikTok, but its objective function is **useful career progress**, not watch time. This document explains the system exactly as it is built (React + Vite frontend, FastAPI + SQLite backend) against the six judging areas.

---

## 01 — Problem & domain understanding

**What problem are we solving?**
People spend hours in highly personalised short-form feeds that optimise for *watch time*. That attention rarely converts into skills or career movement. MOVE keeps the feed's pull but re-points the optimisation at **progress**: watch → answer → apply → build.

**Who experiences it?**
Students and early-career learners (our demo persona is a backend-track student) who consume a lot of content but struggle to turn it into demonstrable skill or a portfolio.

**How does the real-world domain work?**
Modern feeds (TikTok For You, Instagram Reels, X Home Mixer, YouTube) all share one shape: *signals → user model → candidate generation → ranking → mixing/policy → next item → new signals*. They weight strong signals (completion, like, "not interested") above weak ones, inject diversity, and use negative feedback. MOVE borrows those **mechanics** and changes the **reward**.

**Important constraints**
- No historical interaction dataset → a learned ranker can't be trained; the system must be **explainable** and **reproducible** for a live demo.
- The demo must run on one machine, offline-capable, with deterministic scenarios judges can trigger.
- It must not become a TikTok clone, an LMS, or a chatbot — the hard part is the **feedback loop**.

**What makes it difficult?**
Defining "progress" rigorously, detecting when consumption stops producing progress, balancing personalisation vs. exploration, and keeping passive watching from dominating — all without punishing the user or locking the feed.

---

## 02 — Architecture

**Major components**
- **Feed client (React + Vite, TypeScript)** — the reel feed (video → quiz → code-fix → order-the-code → fill-blank → build), a Progress view (evidence + learning path), a Profile view (declared goal + inferred interests + goal switch), and a **System view** for judges (live learner state + scenario simulator).
- **API layer (FastAPI)** — one write path (`POST /events`) and read paths (`/feed/next`, `/feed/learning/{id}`, `/user/goal`, `/simulate/*`).
- **Recommendation engine (`engine.py`)** — candidate generation → heuristic scoring → post-ranking policy → next unit + structured reason.
- **Store (SQLite via SQLModel)** — content catalog, append-only event log, and the per-user learner model.
- **Seed catalog (`seed_data.py`)** — the curated, deterministic content pool.

**Data flow**
```
UI interaction
  → POST /events {event_id, user_id, unit_id, event_type}   (idempotent)
  → SQLite: append Event + update UserState   (one transaction)
  → engine.get_next_recommendation(state)
       candidate generation → score → policy → reason
  → { state, recommendation: { unit, reason, policy_applied } }
  → UI renders the next card + "Why this?"
```

**Domain entities**
- **ContentUnit** — `id, type (video|lesson|quiz|challenge), evidence_type (exposure|concept|application|build), difficulty, prerequisites[], task_data{}` (topic, skills, goal_tags, interest_tags, interaction, media…).
- **Event** — append-only; `event_id` is **unique** (makes client retries safe).
- **UserState** — `declared_goal`, behaviour signals (`passive_streak`, `recent_skip_streak`, `intervention_cooldown`…), **evidence counts** (exposure/concept/application/build), `observed_interests{}`, `skill_evidence{}`, and format preferences.

**Why this architecture**
A thin write path + a pure recommender + a small relational store is the smallest thing that cleanly separates *what happened* (events), *what we believe about the user* (state), and *what to show next* (engine). It's explainable end-to-end, which is exactly what the rubric rewards and what a no-dataset prototype needs.

---

## 03 — Technical reasoning

**Algorithm (deterministic, not ML).** The engine is a transparent pipeline:
1. **Candidate generation** — pull *unseen* units that fit the current goal, instead of scoring the whole catalog. A `GOAL_TOPICS` map scopes each goal to its topics (e.g. Data Analyst → data + databases, Frontend Developer → frontend + APIs), and a prerequisite gate hides any concept whose prerequisites aren't completed yet. Switching the goal re-points this stage, so the feed is visibly remade to fit the new goal; a fallback keeps the feed from running dry once a goal's pool is exhausted.
2. **Multi-signal score** (hand-set prototype weights, stated as such):
   `0.25·goal_relevance + 0.20·skill_gap + 0.15·interest_fit + 0.15·difficulty_fit + 0.15·progress_potential + 0.10·format_fit + bridge_bonus − skip_penalty`.
3. **Post-ranking policy** — cold-start exploration, adjacent-topic exploration (after a run on one topic), skip→variety, a consumption→practice *offer* (after an 8-reel same-topic streak), a build *offer* after an application, and a goal↔interest **bridge**.
4. **Explanation** — every recommendation returns a structured `reason {primary, text, signals, trigger, components}` powering the "Why this?" panel.

**"Progress" is defined as evidence, not points:**
`watch = exposure` < `correct quiz = concept` < `fix/order code = application` < `in-app build = implementation`. Career exploration is tracked on a **separate** axis so "looking at a role" never inflates skill. This is the core design decision the whole system is built around.

**Data models / database.** SQLite via SQLModel; `task_data`, `observed_interests`, `skill_evidence` are JSON columns, so content and signals are flexible without migrations. Additive column migrations run on startup so an existing demo DB is never dropped.

**Consistency approach.** Each event is handled in **one SQLite transaction**: append the Event, update UserState, commit — or roll back on any error. SQLite is the single consistency boundary; there is no distributed state to reconcile.

**ML approach.** None, deliberately. With no historical data, a learned ranker would be unverifiable and unexplainable. The heuristic layer is the honest, defensible choice; in production the scorer could be swapped for a learned/contextual-bandit ranker once real interaction data exists — the pipeline shape (signals → candidates → rank → policy) already matches the public designs of TikTok/X/YouTube.

**Optimisation strategy.** Candidate generation narrows the catalog *before* scoring; the client **prefetches one reel ahead** so scrolling stays smooth; interactions unlock optimistically so a slow write never blocks the UI.

**Failure-handling mechanisms.** Idempotent `event_id` (unique constraint), a duplicate-completion guard, strict event/unit validation, transactional writes with rollback, a `CONTENT_EXHAUSTED` end state, and a media fallback. (Detailed next.)

---

## 04 — Failure & edge cases

| Situation | What the system does |
|---|---|
| **Data missing / stale** | Reels render as **designed concept visuals** (the actual snippet/term for the concept, styled per topic) rather than streamed stock clips, so there is no external-media dependency to break. Missing `task_data` fields fall back to sensible component defaults (a reel with no snippet shows its skill/title card). |
| **A service fails** | If the backend is down, the client shows a clear "can't reach the learning service" error and **does not** silently advance the feed. A failed `UNIT_SERVED` write can't lock the card (controls unlock optimistically). |
| **A network connection fails** | The `fetch` wrapper catches the error and surfaces a banner; because every event carries a unique `event_id`, retrying the same action is safe. |
| **Requests are duplicated** | A repeated `event_id` returns `duplicate: true` and changes nothing. Completing the same unit twice awards **no second evidence** (completion guard). |
| **A critical resource unavailable** | When no eligible candidate exists, the engine returns `CONTENT_EXHAUSTED` and the UI shows an end/reset state instead of recycling the same unit or crashing. |
| **Conditions change while running** | Changing the goal re-ranks the feed immediately; a skip streak flips to a variety policy; a same-topic consumption streak triggers a skippable practice offer; a completed application triggers an optional build. |

**Known limitation:** SQLite is single-writer, so a burst of *concurrent* retries can still hit a write conflict (surfaced as a 500) — acceptable for a single-user prototype, and the honest thing to state on camera.

---

## 05 — Trade-offs

**Optimised for:** interpretability and explainability, a reproducible one-user demo, deterministic PS6 scenarios, and a feed that *feels* like short-form while rewarding action.

**Sacrificed:** a learned ranker, a large content catalog, locally-packaged licensed media, multi-user scale, and real authentication.

**Limitations:** the scoring weights are hand-tuned, not learned; the content pool is small; the "action efficiency / progress" numbers are prototype operationalisations, not validated behavioural measures; SQLite caps concurrency.

**What we'd change with more time:**
- Replace the heuristic scorer with a learned/contextual-bandit ranker once interaction data exists.
- A **short onboarding** diagnostic to personalise the cold start, then let the feed and observed interests take over.
- A **search** path and a **discovery feed** for finding adjacent interests on demand.
- A much larger, multi-career content library with locally-packaged, topic-relevant media.
- Interest-driven dynamic content selection so the feed reshapes fully as the goal/interests change.

---

## Appendix — roadmap

**Shipped in this build**
1. **Unavailable concepts are filtered** — a unit whose topic is out of scope for the current goal, or whose prerequisites aren't completed, never enters the feed (`GOAL_TOPICS` + prerequisite gate in `engine.py`).
2. **Catalog expanded** across all five career tracks (backend, frontend, data, cloud, security) — 50 content units — so switching the goal visibly remakes the feed.
3. **Stock clips replaced** with topic-relevant designed concept visuals (per-topic palette + the concept's real code/term, driven by a short read timer).

**Still ahead**
4. **Onboarding → search → discovery** — a short onboarding diagnostic to warm the cold start, a search path, and a discovery feed for adjacent interests on demand.
5. **Learned ranker** — swap the heuristic scorer for a contextual-bandit/learned ranker once real interaction data exists; the pipeline shape already matches that design.
6. **Larger media library** — more units per track and, where useful, licensed topic footage alongside the concept visuals.
