"""Transparent candidate generation, ranking, and feed policy."""

from __future__ import annotations

from collections import Counter
from typing import Any
from uuid import uuid4

from sqlmodel import Session, select

from .models import ContentUnit, Event, EventType, UserState


SUCCESS_EVENTS = (
    EventType.WATCH_COMPLETED.value,
    EventType.LESSON_COMPLETED.value,
    EventType.TASK_COMPLETED.value,
)
SKIP_EVENTS = (
    EventType.SKIPPED.value,
    EventType.INTERVENTION_SKIPPED.value,
    EventType.NOT_INTERESTED.value,
)
PROGRESS_VALUE = {
    "exposure": 0.15,
    "concept": 0.48,
    "application": 0.78,
    "build": 1.0,
    "career_exploration": 0.55,
}
# Prototype policy knob, not a learned or "magic" count. A clear same-topic
# A streak of 3 uninterrupted video completions without any quizzes
# (Lowered for rapid hackathon demonstration)
PRACTICE_OFFER_STREAK = 3

# Which content topics belong to each career goal. Switching the declared goal
# re-points candidate generation at that goal's topics, so the feed is remade to
# fit the goal and topics that don't belong to it are simply never surfaced.
# APIs are treated as cross-cutting (every track touches an API boundary); the
# goal->interest bridge (api_integration) stays available wherever APIs do.
GOAL_TOPICS: dict[str, set[str]] = {
    "backend developer": {"apis", "databases", "security", "cloud", "api_integration"},
    "frontend developer": {"frontend", "apis", "api_integration"},
    "data analyst": {"data", "databases"},
    "cloud engineer": {"cloud", "apis", "api_integration"},
    "security engineer": {"security", "apis", "api_integration"},
}


def _allowed_topics(user: UserState) -> set[str] | None:
    """Topics in scope for the user's current goal, or None for no restriction."""
    return GOAL_TOPICS.get(user.declared_goal.strip().lower())


def _goal_scoped(unit: ContentUnit, user: UserState, allowed: set[str] | None) -> bool:
    """A unit fits the goal if its topic is in scope or it is tagged for the goal."""
    if allowed is None:
        return True
    
    topic = _unit_topic(unit)
    if topic in allowed:
        return True
        
    # If the user spends time on an exploration topic and shows high interest,
    # permanently unlock it as part of their personalized feed.
    interests = {key.lower(): float(value) for key, value in (user.observed_interests or {}).items()}
    if topic and interests.get(topic, 0.0) >= 0.35:
        return True

    goal = user.declared_goal.strip().lower()
    return goal in _lower_set(_metadata(unit).get("goal_tags"))


def _prereqs_met(unit: ContentUnit, completed: set[str]) -> bool:
    """A concept is only 'available' once its prerequisites are completed."""
    prerequisites = unit.prerequisites or []
    return all(pre in completed for pre in prerequisites)


def progress_score(user: UserState) -> float:
    """Progress as evidence weight, not time or item count.

    This is the system's answer to 'reward outcomes, not screen time': an
    application or build is worth far more than any number of passive views.
    """
    return round(
        user.evidence_exposure * PROGRESS_VALUE["exposure"]
        + user.evidence_concept * PROGRESS_VALUE["concept"]
        + user.evidence_application * PROGRESS_VALUE["application"]
        + user.evidence_build * PROGRESS_VALUE["build"],
        2,
    )


def dopamine_comparison() -> dict[str, Any]:
    """Quantify PS6 scenario 4 (dopamine-loop reversal) from the real weights.

    Same evidence weights the engine ranks on: 30 minutes of passive watching
    vs a 3-minute watch->answer->apply path. Progress-per-minute, not screen
    time, is the reward signal, so the short active path wins decisively.
    """
    passive = {"label": "30 min passive watching", "minutes": 30, "evidence": {"exposure": 30}}
    active = {"label": "3 min watch -> answer -> apply", "minutes": 3, "evidence": {"exposure": 1, "concept": 1, "application": 1}}
    for persona in (passive, active):
        score = round(sum(count * PROGRESS_VALUE[kind] for kind, count in persona["evidence"].items()), 2)
        persona["progress"] = score
        persona["per_min"] = round(score / persona["minutes"], 3) if persona["minutes"] else 0.0
    ratio = round(active["per_min"] / passive["per_min"], 1) if passive["per_min"] else 0.0
    return {"passive": passive, "active": active, "active_advantage_x": ratio}


def _metadata(unit: ContentUnit) -> dict[str, Any]:
    return unit.task_data or {}


def _lower_set(values: Any) -> set[str]:
    if not isinstance(values, (list, tuple, set)):
        return set()
    return {str(value).strip().lower() for value in values if str(value).strip()}


def _completed_unit_ids(session: Session, user_id: str) -> set[str]:
    rows = session.exec(
        select(Event.content_id)
        .where(Event.user_id == user_id)
        .where(Event.event_type.in_(SUCCESS_EVENTS))
    ).all()
    return set(rows)


def generate_candidates(
    session: Session, user: UserState, exclude_unit_id: str | None = None
) -> list[ContentUnit]:
    """Return unseen discovery reels. Lessons and actions are opt-in/intervention only."""
    all_units = session.exec(select(ContentUnit)).all()
    completed = _completed_unit_ids(session, user.user_id)
    served_videos = set(session.exec(
        select(Event.content_id)
        .where(Event.user_id == user.user_id)
        .where(Event.event_type == EventType.UNIT_SERVED.value)
    ).all())
    eligible: list[ContentUnit] = []
    allowed = _allowed_topics(user)

    for unit in all_units:
        data = _metadata(unit)
        if unit.type != "video" or data.get("feed_eligible") is False:
            continue
        if unit.id == exclude_unit_id or unit.id in completed or unit.id in served_videos:
            continue
        # Hide concepts that aren't available yet: wrong goal, or prerequisites
        # the learner hasn't completed. A reel gated behind an unfinished check
        # never appears in the discovery feed.
        if not _goal_scoped(unit, user, allowed):
            continue
        if not _prereqs_met(unit, completed):
            continue
        eligible.append(unit)

    # Fallback: never strand the learner on an empty feed because the goal's
    # topic pool is exhausted — fall back to any unseen, unlocked reel.
    if not eligible and allowed is not None:
        for unit in all_units:
            data = _metadata(unit)
            if unit.type != "video" or data.get("feed_eligible") is False:
                continue
            if unit.id == exclude_unit_id or unit.id in completed or unit.id in served_videos:
                continue
            if _prereqs_met(unit, completed):
                eligible.append(unit)

    return eligible


def _unit_topic(unit: ContentUnit) -> str:
    return str(_metadata(unit).get("topic", "")).strip().lower()


def _display_topic(topic: str) -> str:
    normalized = topic.replace("_", " ").strip().lower()
    labels = {"api": "API", "apis": "APIs", "http": "HTTP", "sql": "SQL", "rest apis": "REST APIs", "ui": "UI"}
    return labels.get(normalized, normalized.title())


def generate_action_candidates(
    session: Session, user: UserState, topic: str, *, evidence_types: set[str]
) -> list[ContentUnit]:
    """Find unfinished topic-matched challenges. Builds are offered after application."""
    all_units = session.exec(select(ContentUnit)).all()
    completed = _completed_unit_ids(session, user.user_id)
    actions = []
    for unit in all_units:
        data = _metadata(unit)
        if data.get("feed_eligible") is False or unit.id in completed:
            continue
        if unit.type != "challenge":
            continue
        if unit.evidence_type not in evidence_types:
            continue
        # Don't offer a challenge whose prerequisites aren't completed yet.
        if not _prereqs_met(unit, completed):
            continue
        if _unit_topic(unit) == topic:
            actions.append(unit)
    return actions


def _pick_practice(actions: list[tuple[ContentUnit, float, dict[str, Any]]]) -> tuple[ContentUnit, float, dict[str, Any]] | None:
    if not actions:
        return None
    return sorted(actions, key=lambda item: (item[0].difficulty, item[0].id))[0]


def _divergent_interest(user: UserState) -> str | None:
    interests = {key.lower(): float(value) for key, value in (user.observed_interests or {}).items()}
    if not interests:
        return None
    strongest = max(interests, key=interests.get)
    if interests[strongest] < 0.55:
        return None
    goal = user.declared_goal.strip().lower()
    conflict = {"frontend", "react", "design", "ui"}
    if "backend" in goal and strongest in conflict:
        return strongest
    return None


def _unfinished_bridge(session: Session, user: UserState) -> ContentUnit | None:
    completed = _completed_unit_ids(session, user.user_id)
    for unit in session.exec(select(ContentUnit)).all():
        if _metadata(unit).get("relationship") == "bridge" and unit.id not in completed:
            return unit
    return None


def _reaction_topics(history: list[Event], unit_by_id: dict[str, ContentUnit]) -> tuple[set[str], set[str]]:
    """Apply recent feedback to at most the next two served reels."""
    latest_by_topic: dict[str, tuple[int, str]] = {}
    seen_units: set[str] = set()
    active_units = 0
    reaction_types = {
        EventType.LIKED.value,
        EventType.DISLIKED.value,
        EventType.REACTION_CLEARED.value,
        EventType.NOT_INTERESTED.value,
    }

    for index, event in enumerate(history):
        if event.event_type not in reaction_types or event.content_id in seen_units:
            continue
        seen_units.add(event.content_id)
        unit = unit_by_id.get(event.content_id)
        if not unit or unit.type != "video":
            continue

        served_since_feedback = {
            newer.content_id
            for newer in history[:index]
            if newer.event_type == EventType.UNIT_SERVED.value
            and (served_unit := unit_by_id.get(newer.content_id)) is not None
            and served_unit.type == "video"
        }
        if len(served_since_feedback) >= 2:
            continue

        if event.event_type == EventType.LIKED.value:
            reaction = "liked"
        elif event.event_type in {EventType.DISLIKED.value, EventType.NOT_INTERESTED.value}:
            reaction = "disliked"
        else:
            reaction = "cleared"

        active_units += 1
        if active_units > 4:
            break
        topic = _unit_topic(unit)
        if reaction == "disliked":
            # A dislike should cool the reel's subject, not broad labels like
            # "backend" or "coding" that could suppress most of the catalog.
            tags = {topic} if topic else _lower_set(_metadata(unit).get("interest_tags"))
        else:
            tags = _lower_set(_metadata(unit).get("interest_tags"))
            if topic:
                tags.add(topic)
        for tag in tags:
            if tag not in latest_by_topic or (event.id or 0) > latest_by_topic[tag][0]:
                latest_by_topic[tag] = (event.id or 0, reaction)

    liked = {tag for tag, (_event_id, reaction) in latest_by_topic.items() if reaction == "liked"}
    disliked = {tag for tag, (_event_id, reaction) in latest_by_topic.items() if reaction == "disliked"}
    return liked, disliked


def _apply_reaction_bias(
    ranked: list[tuple[ContentUnit, float, dict[str, Any]]],
    liked: set[str],
    disliked: set[str],
) -> list[tuple[ContentUnit, float, dict[str, Any]]]:
    adjusted = []
    for unit, score, outcomes in ranked:
        tags = _lower_set(_metadata(unit).get("interest_tags"))
        topic = _unit_topic(unit)
        if topic:
            tags.add(topic)
        extra = 0.0
        if tags & liked:
            extra += 0.28
        if tags & disliked:
            extra -= 0.5
        components = dict(outcomes.get("components") or {})
        components["reaction_fit"] = extra
        adjusted.append((unit, score + extra, {**outcomes, "components": components}))
    return sorted(adjusted, key=lambda item: (-item[1], item[0].id))


def _topic_behavior(
    session: Session,
    user: UserState,
    history: list[Event],
) -> dict[str, Any]:
    """Summarize the current reel streak and progress signals for intervention policy."""
    units = session.exec(select(ContentUnit)).all()
    unit_by_id = {unit.id: unit for unit in units}

    # A successful retrieval, application, or build resets the passive streak.
    last_progress_id = 0
    for event in history:
        unit = unit_by_id.get(event.content_id)
        if (
            event.event_type == EventType.TASK_COMPLETED.value
            and unit
            and unit.evidence_type in {"concept", "application", "build"}
        ):
            last_progress_id = event.id or 0
            break

    outcomes: list[tuple[Event, ContentUnit]] = []
    seen_units: set[str] = set()
    for event in history:
        if (event.id or 0) <= last_progress_id:
            break
        if event.event_type not in {EventType.WATCH_COMPLETED.value, *SKIP_EVENTS}:
            continue
        unit = unit_by_id.get(event.content_id)
        if not unit or unit.type != "video" or unit.id in seen_units:
            continue
        seen_units.add(unit.id)
        outcomes.append((event, unit))

    if not outcomes:
        return {
            "topic": None,
            "reel_streak": 0,
            "completion_rate": 0.0,
            "interest": 0.0,
            "goal_relevance": 0.0,
            "passive_ratio": 0.0,
            "skill_evidence": 0,
            "score": 0.0,
            "related_count": 0,
            "components": {
                "topic_streak_fit": 0.0,
                "completion_rate": 0.0,
                "sustained_interest": 0.0,
                "goal_relevance": 0.0,
                "passive_consumption": 0.0,
                "recent_action_gap": 0.0,
                "skill_evidence_gap": 0.0,
            },
        }

    current_topic = str(_metadata(outcomes[0][1]).get("topic", "")).strip().lower()
    related = []
    for event, unit in outcomes:
        topic = str(_metadata(unit).get("topic", "")).strip().lower()
        if topic != current_topic:
            break
        related.append((event, unit))
        if len(related) >= PRACTICE_OFFER_STREAK:
            break
    # Consecutive completed reels build the streak. A skip remains visible in
    # the completion-rate signal and breaks the uninterrupted watch streak.
    reel_streak = 0
    for event, _unit in related:
        if event.event_type != EventType.WATCH_COMPLETED.value:
            break
        reel_streak += 1

    completed = sum(event.event_type == EventType.WATCH_COMPLETED.value for event, _unit in related)
    completion_rate = completed / len(related) if related else 0.0
    interests = {key.lower(): float(value) for key, value in (user.observed_interests or {}).items()}
    interest = interests.get(current_topic, 0.0)
    focus_unit = outcomes[0][1]
    goal_tags = _lower_set(_metadata(focus_unit).get("goal_tags"))
    goal = user.declared_goal.strip().lower()
    goal_relevance = 1.0 if goal in goal_tags else 0.15 if goal_tags else 0.35
    passive_ratio = min(max(user.passive_streak / PRACTICE_OFFER_STREAK, 0.0), 1.0)
    focus_skills = _lower_set(_metadata(focus_unit).get("skills"))
    skill_evidence = sum(
        count for skill, count in (user.skill_evidence or {}).items()
        if skill.strip().lower() in focus_skills
    )
    recent_action_gap = min(len(related) / PRACTICE_OFFER_STREAK, 1.0)
    evidence_gap = 1.0 / (1.0 + max(skill_evidence, 0))
    components = {
        "topic_streak_fit": min(reel_streak / PRACTICE_OFFER_STREAK, 1.0),
        "completion_rate": completion_rate,
        "sustained_interest": interest,
        "goal_relevance": goal_relevance,
        "passive_consumption": passive_ratio,
        "recent_action_gap": recent_action_gap,
        "skill_evidence_gap": evidence_gap,
    }
    score = (
        0.27 * components["topic_streak_fit"]
        + 0.23 * completion_rate
        + 0.18 * interest
        + 0.05 * goal_relevance
        + 0.18 * passive_ratio
        + 0.04 * recent_action_gap
        + 0.05 * evidence_gap
    )
    return {
        "topic": current_topic,
        "reel_streak": reel_streak,
        "completion_rate": completion_rate,
        "interest": interest,
        "goal_relevance": goal_relevance,
        "passive_ratio": passive_ratio,
        "skill_evidence": skill_evidence,
        "score": score,
        "related_count": len(related),
        "components": components,
    }


def _score_components(
    unit: ContentUnit,
    user: UserState,
    history: list[Event],
    interaction_count: int,
) -> dict[str, float]:
    data = _metadata(unit)
    goal = user.declared_goal.strip().lower()
    goal_tags = _lower_set(data.get("goal_tags"))
    goal_relevance = 1.0 if goal in goal_tags else 0.35 if not goal_tags else 0.15

    topic = _unit_topic(unit)
    interests = {key.lower(): float(value) for key, value in (user.observed_interests or {}).items()}
    if topic and interests.get(topic, 0.0) >= 0.35:
        # If the user organically spent time on this out-of-scope topic,
        # treat it as highly relevant to their self-directed path.
        goal_relevance = max(goal_relevance, 0.85)

    skills = [str(value) for value in data.get("skills", [])]
    skill_evidence = {key.lower(): value for key, value in (user.skill_evidence or {}).items()}
    if skills:
        mastery = sum(min(skill_evidence.get(skill.lower(), 0) / 3, 1.0) for skill in skills) / len(skills)
        skill_gap = 1.0 - mastery
    else:
        skill_gap = 0.35

    interests = {key.lower(): float(value) for key, value in (user.observed_interests or {}).items()}
    interest_tags = _lower_set(data.get("interest_tags"))
    interest_fit = (
        sum(interests.get(tag, 0.0) for tag in interest_tags) / len(interest_tags)
        if interests and interest_tags
        else 0.25
    )

    readiness = 1 + min((user.evidence_concept + user.evidence_application) // 3, 3)
    difficulty_fit = max(0.0, 1.0 - abs(unit.difficulty - readiness) / 4)
    progress_potential = PROGRESS_VALUE.get(unit.evidence_type, 0.25)

    pref_name = f"pref_{unit.type}"
    if not hasattr(user, pref_name) and unit.type == "challenge":
        pref_name = "pref_challenge"
    format_fit = min(max(float(getattr(user, pref_name, 1.0)) / 2.0, 0.0), 1.0)

    skip_counts: Counter[str] = Counter()
    for event in history:
        if event.event_type in SKIP_EVENTS:
            skip_counts[event.content_id] += 1
    skip_penalty = min(skip_counts.get(unit.id, 0) * 0.22, 0.8)
    bridge_bonus = 0.0
    if data.get("relationship") == "bridge" and interests:
        bridge_bonus = min(max(interest_fit - 0.15, 0.0), 0.35)

    return {
        "goal_relevance": goal_relevance,
        "skill_gap": skill_gap,
        "interest_fit": interest_fit,
        "difficulty_fit": difficulty_fit,
        "progress_potential": progress_potential,
        "format_fit": format_fit,
        "bridge_fit": bridge_bonus,
        "skip_penalty": skip_penalty,
        "repetition_penalty": 0.0,
        "interaction_count": float(interaction_count),
    }


def predict_outcomes(
    unit: ContentUnit,
    user: UserState,
    history: list[Event] | None = None,
    interaction_count: int = 0,
) -> dict[str, Any]:
    """Return explainable prototype features, not calibrated probabilities."""
    components = _score_components(unit, user, history or [], interaction_count)
    score = (
        0.25 * components["goal_relevance"]
        + 0.20 * components["skill_gap"]
        + 0.15 * components["interest_fit"]
        + 0.15 * components["difficulty_fit"]
        + 0.15 * components["progress_potential"]
        + 0.10 * components["format_fit"]
        + components["bridge_fit"]
        - components["skip_penalty"]
        - components["repetition_penalty"]
    )
    return {
        "completion_fit": components["format_fit"],
        "meaningful_action": 1.0 if unit.evidence_type != "exposure" else 0.0,
        "skill_evidence": components["progress_potential"],
        "career_relevance": components["goal_relevance"],
        "passive_consumption": 1.0 if unit.evidence_type == "exposure" else 0.0,
        "score": score,
        "components": components,
    }


def rank_candidates(
    candidates: list[ContentUnit],
    user: UserState,
    history: list[Event] | None = None,
    interaction_count: int = 0,
) -> list[tuple[ContentUnit, float, dict[str, Any]]]:
    history = history or []
    ranked = []
    for unit in candidates:
        outcomes = predict_outcomes(unit, user, history, interaction_count)
        ranked.append((unit, outcomes["score"], outcomes))
    # ID is a stable tie-breaker so cold-start behavior is reproducible.
    return sorted(ranked, key=lambda item: (-item[1], item[0].id))


def _reason_for(
    unit: ContentUnit,
    user: UserState,
    outcomes: dict[str, Any],
    trigger: str,
) -> dict[str, Any]:
    data = _metadata(unit)
    interests = {key.lower(): float(value) for key, value in (user.observed_interests or {}).items()}
    strongest_interest = max(interests, key=interests.get) if interests else None

    if unit.type == "video":
        topic = str(data.get("topic", "this topic")).strip().title()
        text = f"A short {topic} reel, selected around your goal and the topics holding your attention."
        primary = "discovery_reel"
        signals = [f"Goal: {user.declared_goal}", f"Topic affinity: {interests.get(topic.lower(), 0.0):.2f}", "Format: short discovery reel"]
    elif data.get("relationship") == "bridge" and strongest_interest:
        text = (
            f"You've shown interest in {strongest_interest}, while your goal is "
            f"{user.declared_goal}. This activity connects the two through APIs."
        )
        primary = "goal_interest_bridge"
        signals = [f"Observed interest: {strongest_interest}", f"Declared goal: {user.declared_goal}", "Bridge activity connects frontend and backend work"]
    elif trigger == "COLD_START":
        text = "This short activity starts your path and gives MOVE an early signal about what you want to learn."
        primary = "cold_start"
        signals = [f"Goal: {user.declared_goal}", "Learner history is still limited", "Introductory activity is available"]
    else:
        skill = next(iter(data.get("skills", [])), None)
        if unit.evidence_type == "application":
            text = f"Your next step is to apply {skill or 'this concept'} in a short activity."
            primary = "skill_application"
        elif unit.type == "lesson":
            text = f"A short explanation fills in the idea behind {skill or 'this topic'} before the next check."
            primary = "guided_explanation"
        elif unit.evidence_type == "build":
            text = f"You've applied the concept. This build turns it into stronger {skill or 'project'} evidence."
            primary = "build_evidence"
        elif unit.evidence_type == "career_exploration":
            text = "Compare your demonstrated skills with a role and choose a gap to explore."
            primary = "career_exploration"
        elif outcomes["components"]["skill_gap"] >= 0.65:
            text = f"{skill or 'This skill'} is an open evidence gap on your {user.declared_goal} path."
            primary = "skill_gap"
        else:
            text = f"This is a relevant next step toward {user.declared_goal}."
            primary = "goal_alignment"
        signals = [f"Goal: {user.declared_goal}", f"Activity format: {unit.type}"]
        if skill:
            signals.append(f"Skill focus: {skill}")

    return {
        "primary": primary,
        "text": text,
        "signals": signals,
        "trigger": trigger,
        "components": outcomes["components"],
    }


def _recommendation(
    unit: ContentUnit | None,
    reason: dict[str, Any],
    policy: str,
) -> dict[str, Any]:
    return {
        "recommendation_id": str(uuid4()),
        "unit": unit.model_dump() if unit else None,
        "reason": reason,
        "policy_applied": policy,
    }


def get_learning_recommendation(
    session: Session, user: UserState, video_id: str
) -> dict[str, Any]:
    """Return the optional explainer explicitly linked from a discovery reel."""
    video = session.get(ContentUnit, video_id)
    lesson_id = _metadata(video).get("related_learning_unit_id") if video else None
    lesson = session.get(ContentUnit, lesson_id) if lesson_id else None
    if not video or video.type != "video" or not lesson or lesson.type != "lesson":
        return _recommendation(
            None,
            {
                "primary": "optional_learning_unavailable",
                "text": "There is no deeper lesson attached to this reel yet.",
                "signals": [],
                "trigger": "LEARNER_REQUESTED",
                "components": {},
            },
            "LEARNING_ON_DEMAND",
        )
    topic = str(_metadata(video).get("topic", "this topic")).strip()
    reason = {
        "primary": "learner_chose_to_go_deeper",
        "text": f"You chose to explore the {topic} idea in more depth. Finish the lesson to continue into a short check.",
        "signals": [f"Learner opened the optional lesson from {video.title}", f"Topic: {topic}", "This is an opt-in learning path, separate from the reel feed"],
        "trigger": "LEARNER_REQUESTED",
        "components": {},
    }
    return _recommendation(lesson, reason, "LEARNING_ON_DEMAND")


def _guided_path_recommendation(
    session: Session,
    user: UserState,
    history: list[Event],
    unit_by_id: dict[str, ContentUnit],
) -> dict[str, Any] | None:
    """Continue an opt-in lesson path without putting actions in the reel feed."""
    latest_completion = next(
        (
            event
            for event in history
            if event.event_type in {EventType.LESSON_COMPLETED.value, EventType.TASK_COMPLETED.value}
        ),
        None,
    )
    if not latest_completion:
        return None

    current = unit_by_id.get(latest_completion.content_id)
    next_id = _metadata(current).get("next_path_unit_id") if current else None
    target = unit_by_id.get(str(next_id)) if next_id else None
    if not target or target.id in _completed_unit_ids(session, user.user_id):
        return None

    is_offer = target.evidence_type in {"build", "career_exploration"}
    next_label = "an optional next move" if is_offer else "the next short check"
    reason = {
        "primary": "guided_path_next",
        "text": f"You completed {current.title}. Continue to {target.title}, {next_label} in the path you chose.",
        "signals": [
            "Opt-in path: See → Learn → Try → Build → Connect",
            f"Completed: {current.title}",
            f"Next: {target.title}",
            "The discovery reel feed remains separate",
        ],
        "trigger": "GUIDED_PATH_COMPLETION",
        "components": {},
    }
    return _recommendation(target, reason, "INTERVENTION_OFFERED" if is_offer else "GUIDED_PATH")


def get_next_recommendation(
    session: Session,
    user: UserState,
    exclude_unit_id: str | None = None,
) -> dict[str, Any]:
    candidates = generate_candidates(session, user, exclude_unit_id)
    history = session.exec(
        select(Event).where(Event.user_id == user.user_id).order_by(Event.id.desc())
    ).all()
    behavior_events = [event for event in history if event.event_type != EventType.UNIT_SERVED.value]
    behavior = _topic_behavior(session, user, history)
    unit_by_id = {unit.id: unit for unit in session.exec(select(ContentUnit)).all()}
    guided_path = _guided_path_recommendation(session, user, history, unit_by_id)
    # Engagement drop takes priority: if the learner is actively skipping, the
    # skip-variety policy below should change topic/format instead of pushing
    # them further down the opt-in path they are visibly disengaging from.
    if guided_path and user.recent_skip_streak < 3:
        return guided_path
    liked_topics, disliked_topics = _reaction_topics(history, unit_by_id)
    ranked = _apply_reaction_bias(
        rank_candidates(candidates, user, history, len(behavior_events)),
        liked_topics,
        disliked_topics,
    )
    if disliked_topics:
        alternatives = []
        for entry in ranked:
            tags = _lower_set(_metadata(entry[0]).get("interest_tags"))
            topic = _unit_topic(entry[0])
            if topic:
                tags.add(topic)
            if not (tags & disliked_topics):
                alternatives.append(entry)
        # A recent explicit dislike suppresses matching topics whenever the
        # unseen catalog contains another option; if it does not, keep the
        # remaining items available instead of exhausting the feed early.
        if alternatives:
            ranked = alternatives
    served_video_ids: list[str] = []
    seen_video_ids: set[str] = set()
    for event in history:
        if event.event_type != EventType.UNIT_SERVED.value or event.content_id in seen_video_ids:
            continue
        served_unit = unit_by_id.get(event.content_id)
        if served_unit and served_unit.type == "video":
            seen_video_ids.add(served_unit.id)
            served_video_ids.append(served_unit.id)
    recent_topics = [_unit_topic(unit_by_id[unit_id]) for unit_id in served_video_ids[:5] if _unit_topic(unit_by_id[unit_id])]
    focus_topic = Counter(recent_topics).most_common(1)[0][0] if recent_topics else None
    consecutive_same = 0
    for unit_id in served_video_ids:
        if _unit_topic(unit_by_id[unit_id]) == (focus_topic or ""):
            consecutive_same += 1
        else:
            break

    topic_labels = {"apis": "APIs", "databases": "databases", "security": "security", "cloud": "deployment"}

    # Goal-interest divergence takes priority over other offers so its bridge
    # remains visible even when a learner has a long prior reel history.
    divergent = _divergent_interest(user)
    bridge = _unfinished_bridge(session, user) if divergent else None
    if divergent and bridge and user.intervention_cooldown <= 0:
        outcomes = predict_outcomes(bridge, user, history, len(behavior_events))
        reason = {
            "primary": "goal_interest_bridge",
            "text": (
                f"You've been drawn to {divergent}, while your goal is {user.declared_goal}. "
                "This short task connects a React screen to an API."
            ),
            "signals": [
                f"Observed interest: {divergent}",
                f"Declared goal: {user.declared_goal}",
                f"Bridge unit: {bridge.title}",
                "Heuristic policy, not a learned model",
            ],
            "trigger": "GOAL_INTEREST_DIVERGENCE",
            "components": outcomes["components"],
        }
        return _recommendation(bridge, reason, "BRIDGE_RECOMMENDATION")

    # Lessons never auto-follow a reel. After a same-topic watch streak, offer
    # a related in-app application challenge. Builds stay a later offer.
    if (
        behavior["topic"]
        and behavior["reel_streak"] >= PRACTICE_OFFER_STREAK
        and user.intervention_cooldown <= 0
    ):
        action_candidates = generate_action_candidates(
            session, user, behavior["topic"], evidence_types={"application"}
        )
        picked = _pick_practice(rank_candidates(action_candidates, user, history, len(behavior_events)))
        if picked:
            unit, _, outcomes = picked
            topic_label = topic_labels.get(behavior["topic"], behavior["topic"].title())
            reason = {
                "primary": "consumption_without_progress",
                "text": f"You've stayed with {topic_label} for a stretch. Want to try a short challenge on it?",
                "signals": [
                    f"Same-topic reels completed in a row: {behavior['reel_streak']}",
                    f"Practice offer streak (prototype policy): {PRACTICE_OFFER_STREAK}",
                    f"Suggested practice: {unit.title}",
                ],
                "trigger": "CONSUMPTION_WITHOUT_PROGRESS",
                "components": {**behavior["components"], **outcomes["components"]},
            }
            return _recommendation(unit, reason, "INTERVENTION_OFFERED")

    latest_behavior = next((event for event in history if event.event_type != EventType.UNIT_SERVED.value), None)
    last_progress = unit_by_id.get(latest_behavior.content_id) if latest_behavior else None
    if (
        latest_behavior
        and latest_behavior.event_type == EventType.TASK_COMPLETED.value
        and last_progress
        and last_progress.evidence_type == "application"
        and user.intervention_cooldown <= 0
    ):
        builds = generate_action_candidates(
            session, user, _unit_topic(last_progress), evidence_types={"build"}
        )
        picked = _pick_practice(rank_candidates(builds, user, history, len(behavior_events)))
        if picked:
            unit, _, outcomes = picked
            reason = {
                "primary": "build_offer",
                "text": f"You applied the idea. This in-app build is optional: {unit.title}.",
                "signals": [f"Last application: {last_progress.title}", f"Optional build: {unit.title}"],
                "trigger": "APPLICATION_COMPLETED",
                "components": outcomes["components"],
            }
            return _recommendation(unit, reason, "INTERVENTION_OFFERED")

    if user.recent_skip_streak >= 3 and ranked:
        recently_skipped_ids = {
            event.content_id
            for event in history[:8]
            if event.event_type in SKIP_EVENTS
        }
        skipped_topics = {
            _unit_topic(unit_by_id[content_id])
            for content_id in recently_skipped_ids
            if content_id in unit_by_id and _unit_topic(unit_by_id[content_id])
        }
        alternatives = [
            entry
            for entry in ranked
            if entry[0].id not in recently_skipped_ids and _unit_topic(entry[0]) not in skipped_topics
        ]
        if not alternatives:
            alternatives = [entry for entry in ranked if entry[0].id not in recently_skipped_ids]
        if alternatives:
            unit, _, outcomes = alternatives[0]
            other_topic = _unit_topic(unit) or "another topic"
            reason = {
                "primary": "format_or_topic_variation",
                "text": f"You've skipped a few clips. Here's {other_topic.replace('_', ' ')} instead; skip again whenever you like.",
                "surface_note": f"A topic change after your recent skips · {other_topic.replace('_', ' ')}",
                "signals": [
                    "Recent skip streak",
                    f"Avoided topics: {', '.join(sorted(skipped_topics)) or 'recently skipped items'}",
                    f"Next reel: {unit.title}",
                ],
                "trigger": "RECENT_SKIPS",
                "components": outcomes["components"],
            }
            return _recommendation(unit, reason, "VARIETY_AFTER_SKIPS")

    if not ranked:
        return _recommendation(
            None,
            {
                "primary": "content_exhausted",
                "text": "You've reached the end of the discovery reels for this demo. Reset to run the loop again.",
                "signals": ["No unseen discovery reels are available"],
                "trigger": "CONTENT_EXHAUSTED",
                "components": {},
            },
            "CONTENT_EXHAUSTED",
        )

    import random
    if random.random() < 0.20:
        all_units = session.exec(select(ContentUnit)).all()
        completed = _completed_unit_ids(session, user.user_id)
        served_videos = set(session.exec(select(Event.content_id).where(Event.user_id == user.user_id).where(Event.event_type == EventType.UNIT_SERVED.value)).all())
        allowed = _allowed_topics(user)
        explore_cands = [u for u in all_units if u.type == "video" and u.id not in completed and u.id not in served_videos and _metadata(u).get("feed_eligible") is not False and not _goal_scoped(u, user, allowed)]
        if explore_cands:
            explore_unit = random.choice(explore_cands)
            return _recommendation(
                explore_unit,
                {
                    "primary": "exploration",
                    "text": f"You're focused on {user.declared_goal}, but you might find this interesting too.",
                    "signals": ["20% exploration chance triggered", f"Topic: {_unit_topic(explore_unit)} (outside goal)"],
                    "trigger": "EXPLORATION_TRIGGER",
                    "components": {"goal_relevance": 0.0, "progress_potential": 0.0},
                },
                "EXPLORATION_OFFER"
            )

    chosen = ranked[0]
    adjacent_pick = False
    building_topic_streak = 0 < behavior["reel_streak"] < PRACTICE_OFFER_STREAK
    profile_confident = len(behavior_events) >= 4 and len(user.observed_interests or {}) >= 2
    if focus_topic:
        same_topic = [entry for entry in ranked if _unit_topic(entry[0]) == focus_topic]
        other_topics = [entry for entry in ranked if _unit_topic(entry[0]) != focus_topic]
        if disliked_topics:
            preferred = [entry for entry in ranked if _unit_topic(entry[0]) not in disliked_topics]
            if preferred:
                ranked_for_mix = preferred
                same_topic = [entry for entry in ranked_for_mix if _unit_topic(entry[0]) == focus_topic]
                other_topics = [entry for entry in ranked_for_mix if _unit_topic(entry[0]) != focus_topic]
        if (
            profile_confident
            and consecutive_same >= 4
            and other_topics
            and not building_topic_streak
        ):
            chosen = other_topics[0]
            adjacent_pick = True
        elif same_topic:
            chosen = same_topic[0]
        elif other_topics:
            chosen = other_topics[0]
            adjacent_pick = True

    unit, _, outcomes = chosen
    trigger = "NORMAL"
    policy = "NORMAL"
    cold_start = len(behavior_events) < 2 or (behavior_events and len(user.observed_interests or {}) < 2)
    if adjacent_pick:
        trigger = "ADJACENT_TOPIC_EXPLORATION"
        policy = "ADJACENT_EXPLORATION"
    elif cold_start:
        trigger = "COLD_START"
        policy = "EXPLORATION"

    reason = _reason_for(unit, user, outcomes, trigger)
    if adjacent_pick:
        topic = _unit_topic(unit).replace("_", " ") or "a nearby topic"
        focus = (focus_topic or "your recent interest").replace("_", " ")
        reason["primary"] = "adjacent_topic_exploration"
        reason["text"] = f"A nearby {topic} reel after several {focus} clips. Ranked among adjacent options, not a random slot."
        reason["surface_note"] = f"A nearby topic after {focus} · {topic} was the strongest adjacent pick"
        reason["signals"].append("Mixer: stay on-topic until the profile is confident, then the best-ranked adjacent reel")
    elif liked_topics & (_lower_set(_metadata(unit).get("interest_tags")) | {_unit_topic(unit)}):
        reason["text"] = f"Staying near topics you liked, including {_unit_topic(unit) or 'this subject'}."
        reason["signals"].append(f"Recent likes boosted: {', '.join(sorted(liked_topics))}")
    elif cold_start:
        reason["primary"] = "cold_start"
        reason["text"] = "Exploration policy: little history yet, so this reel is a first signal. It is not a bandit or learned model."
        reason["surface_note"] = "Exploration · MOVE is learning what interests you"
        reason["signals"] = [f"Goal: {user.declared_goal}", "History is still limited", "Hand-set exploration heuristic"]
    elif focus_topic:
        reason["text"] = f"Staying with {focus_topic.replace('_', ' ')} while that topic still has useful unseen reels."
        reason["signals"].append("Mixer: most reels stay on-topic; adjacent picks wait until the profile is confident")
    if disliked_topics:
        reason["signals"].append(f"Recent dislikes suppressed: {', '.join(sorted(disliked_topics))}")
    selected_tags = _lower_set(_metadata(unit).get("interest_tags"))
    selected_topic = _unit_topic(unit)
    if selected_topic:
        selected_tags.add(selected_topic)
    matched_likes = selected_tags & liked_topics
    matched_dislikes = selected_tags & disliked_topics
    if matched_likes:
        label = _display_topic(sorted(matched_likes)[0])
        reason["signals"].append("A recent like lifted this topic for up to the next two served reels.")
        reason["surface_note"] = f"Because you liked {label}"
    elif matched_dislikes:
        label = _display_topic(sorted(matched_dislikes)[0])
        reason["signals"].append("No unseen alternative currently avoids this topic, so it remains available after your feedback.")
        reason["surface_note"] = f"No unseen alternative yet to avoid {label}"
    elif disliked_topics:
        label = _display_topic(sorted(disliked_topics)[0])
        reason["signals"].append("Your recent negative feedback suppressed matching topics for up to the next two served reels.")
        reason["surface_note"] = f"Fewer {label} reels after your feedback"
    elif liked_topics:
        label = _display_topic(sorted(liked_topics)[0])
        reason["signals"].append("Your recent like lifted matching candidates for up to the next two served reels.")
        reason["surface_note"] = f"Your {label} like is shaping the next reels"
    reason["signals"].extend([
        f"Current passive streak: {user.passive_streak}",
        f"Same-topic reel streak: {behavior['reel_streak']}/{PRACTICE_OFFER_STREAK}",
        f"Application evidence: {user.evidence_application}",
        "Weights are prototype heuristics, not calibrated ML",
    ])
    reason["components"].update({
        "topic_streak_fit": behavior["components"]["topic_streak_fit"],
        "recent_related_completion": behavior["completion_rate"],
        "sustained_interest": behavior["interest"],
        "intervention_score": behavior["score"],
    })
    return _recommendation(unit, reason, policy)
