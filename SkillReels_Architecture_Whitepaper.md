# SkillReels: Attention to Career
## Architectural Whitepaper & System Design

*This document captures the core system-design thesis developed for PS6, transforming the mechanics of short-form social feeds into an adaptive engine optimized for career progress.*

### 1. The Core Philosophy: Shifting the Objective Function
Modern social platforms (TikTok, X, Instagram) use sophisticated multi-signal pipelines to optimize for the probability of continued consumption. **SkillReels** borrows this exact architectural pipeline (Candidate Generation $\to$ Feature Hydration $\to$ Outcome Prediction $\to$ Ranking $\to$ Mixing) but changes the objective function.

Instead of asking, *"What is this person most likely to watch next?"*, SkillReels asks, *"Given what this person just did, what is the most useful thing they are ready to do next?"*

### 2. Evidence Hierarchy vs. Activity Traces
We do not equate watch-time with learning. Drawing from Khan Academy's mastery model, SkillReels separates activity traces from verifiable skill evidence.

**The Evidence Ladder:**
1. `EXPOSURE` (Passive watching)
2. `CONCEPT` (Answering correctly)
3. `APPLICATION` (Modifying code / Parsons problems)
4. `BUILD` (Constructing an artifact)

**Career Progression (Separate from Technical Skill):**
*   `CAREER_EXPLORATION` (Gap analysis against real job requirements)

### 3. The Recommendation Pipeline
Inspired by the open-sourced architecture of Twitter/X, our recommendation engine operates in four distinct layers:

#### A. Candidate Generation
Rather than scoring the entire 10,000+ unit library, the system retrieves small candidate pools from distinct sources:
*   `GoalSource`: Units matching the declared career goal.
*   `SkillGapSource`: Units that teach the immediate next node in the prerequisite graph.
*   `ExplorationSource`: Triggered by uncertainty (Cold Start, Conflicting Signals) to test hypotheses.

#### B. Outcome Prediction (Heuristic Estimators)
For each candidate, the system predicts behavioral probabilities based on the User Model:
*   `p_complete` (Will they finish it?)
*   `p_meaningful_action` (Will they interact?)
*   `p_skill_evidence` (Will it prove a skill?)

#### C. The Progress-Aware Ranker
Candidates are ranked against the objective:
`Score = (Progress Value + Completion Likelihood + Career Relevance) - Passive Consumption Likelihood`

#### D. Post-Ranking Policies (Intervention)
Instead of hard-locking the UI (coercion), the system applies contextual eligibility filters. If `CONSUMPTION_WITHOUT_PROGRESS` is detected (high watch time, low action), the policy heavily penalizes passive videos and boosts interactive formats, presenting an `INTERVENTION_OFFERED` state (`[Try It]` / `[Not Now]`).

### 4. Continuous Learning Loop
Exploration is not randomness; it is a deliberate hypothesis test. The system offers options (e.g., APIs vs. Databases). The explicit selection, followed by implicit behaviors (watch ratio, task completion, abandonment), feeds back into the **User Signal Service**, immediately updating the multidimensional User Model and reshaping the next Candidate Generation cycle.

### 5. Prototype Metrics
To operationalize behavioral change, the system tracks:
*   **Action Efficiency:** `Meaningful Actions / Items Served`
*   **Progress per Minute:** `Progress Evidence / Active Minute`

*(Note: These are system heuristics used to demonstrate the architecture's adaptivity, not scientifically validated behavioral outcome proofs.)*
