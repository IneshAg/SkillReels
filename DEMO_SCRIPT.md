# MOVE / SkillReels — Demo Script
### PS6 "Attention to Career" · Techcora
*A ~5-minute walkthrough for the demo video. Left column = what to say. Right notes = what to click.*

---

## Before you record (setup checklist)

1. Start the backend (one working port — use **5055** on this machine, since 8000 is blocked):
   ```
   python -m uvicorn backend.main:app --host 127.0.0.1 --port 5055
   ```
2. Start the frontend:
   ```
   cd frontend && npm run dev
   ```
3. Open the app, click **System view** (top right), then click **Cold start** once so you begin from a clean, known state.
4. Have the **System view** panel open on the right for the whole demo — it's your evidence that the engine is real, not scripted.

> Judging weights understanding over code volume, so narrate *why*, not just *what*. The System view's "Why this?" and policy chips are there to prove every decision.

---

## 0:00 — The problem (20s)

> "Short-form feeds are the best attention engines ever built — and they optimise for watch time. MOVE keeps that exact pull, but changes the reward. It optimises for **useful career progress**, not minutes watched. I'll define what progress means, show the feed learning on its own, and then trigger the five situations the brief asks about — live."

*(Stay on the feed; the reels are auto-playing.)*

---

## 0:20 — It feels like Reels, and it learns on its own (45s)

> "This is a full-bleed vertical feed — swipe, autoplay, like, save, share. The difference: the content is concept visuals, each showing the real code for the idea. I never told the system what I know or like. Watch the System view on the right."

**Do:** scroll through 3–4 reels on the same topic (e.g. APIs). Like one, skip one.

> "Every watch, skip, like and dislike updates the learner model — observed interests, format preferences, evidence counts. No quiz, no onboarding form. And every pick is explainable —"

**Do:** click **"Why this?"** on a reel. Point at the policy chip and signals.

---

## 1:05 — Progress is evidence, not screen time (30s)

> "Here's the core design decision. Progress isn't minutes — it's evidence. Watching is exposure. Answering is a concept. Fixing or ordering code is application. Building something is implementation. A three-minute build outranks thirty minutes of watching, by design."

**Do:** point at the evidence ladder / the "Progress, not screen time" panel in the System view.

---

## 1:35 — Turning attention into action (50s)

> "The feed doesn't just show — it converts. When I opt in, or when the engine decides I've watched enough, it hands me something to *do*."

**Do:** on a reel, click **"Go deeper"** → go through the short lesson → land on a game. Show two different games if you can:
- **Quiz** — tap the right answer; it locks and explains.
- **Build** — "assemble the smallest useful read endpoint": pick the METHOD and ROUTE, run the request, save the working result.

> "Each completed action is logged as evidence — concept, application, or a build — and it feeds straight back into what comes next."

---

## 2:25 — The five situations, triggered live (2:00)

> "The brief lists five dynamic situations. All five are runnable right here in the judge view — nothing is pre-baked."

**For each: click the scenario button, then read the one-liner while pointing at the policy chip + the learner state that changed.**

**(1) Endless watching** →
> "A user watches and watches but never acts. The engine notices an eight-reel same-topic streak and offers a related challenge — a nudge, not a lock. Still skippable."

**(2) Goal and interest diverge** →
> "My declared goal is backend, but my behaviour screams frontend. Instead of fighting that, the engine gives me a bridge task — connect a React screen to an API — tying the interest to the goal."

**(3) Engagement drops** →
> "A previously active user starts skipping. The engine flips to a variety policy — new topic, new format — and avoids what I just skipped."

**(4) Dopamine loop reversal** — *(spend the most time here — this is the core design question)* →
> "This is the heart of the brief: a three-minute task should beat thirty minutes of passive watching. So I measure it."

**Do:** click **Dopamine loop reversal**. Point at the **"Progress, not screen time"** panel.
> "Thirty minutes of passive watching earns 0.15 progress per minute. A three-minute watch-answer-apply path earns 0.47 — about **three times** the progress per minute, in a tenth of the time. The dopamine loop is reversed, and it's a number, not a slogan."

**(5) Cold start** →
> "A brand-new user, no history. The engine runs an exploration policy and labels it honestly as a first signal — not a bandit, not a learned model. From here the feed starts personalising from behaviour."

---

## 4:25 — Change the goal, the feed remakes itself (20s)

**Do:** go to **Profile** → click a different goal (e.g. **Data Analyst**) → back to the feed.

> "Change the goal and the feed is remade around it — Data Analyst gets data and SQL reels, not backend APIs. Concepts that don't fit the goal, or whose prerequisites aren't met, simply never appear."

---

## 4:45 — Architecture & honesty in one breath (15s)

> "Under the hood: a React feed, a FastAPI boundary with one idempotent write path, a pure Python recommender — candidates, score, policy, reason — and SQLite as the single source of truth. No ML, on purpose: with no historical data, a learned ranker would be unverifiable. The heuristic layer is the honest choice, and the pipeline already has the exact shape you'd swap a learned ranker into later."

---

## 5:00 — Close (10s)

> "MOVE competes for attention like a short-form feed, then turns it into evidence of real skill — and it can prove, per minute, that it's working. That's attention, redirected to career progress."

---

## Quick-reference: the buttons you'll click

| Moment | Where | Action |
|---|---|---|
| Clean state | System view | **Cold start** |
| Show learning-on-demand | A reel | **Go deeper** → lesson → game |
| Scenario 1 | System view | **Endless watching** |
| Scenario 2 | System view | **Goal and interest diverge** |
| Scenario 3 | System view | **Engagement drops** |
| Scenario 4 | System view | **Dopamine loop reversal** → point at Progress/min |
| Scenario 5 | System view | **Cold start** |
| Goal remake | Profile | pick **Data Analyst** → Feed |
| Explainability | Any reel | **Why this?** |

## If something goes wrong on camera
- Feed stuck or odd state → click **Cold start** to reset.
- A reel looks blank → it's a designed visual with a read timer; give it a second, or scroll to the next.
- Backend error banner → confirm the backend is running on **5055** and the Vite proxy points to the same port.
