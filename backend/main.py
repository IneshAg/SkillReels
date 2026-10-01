"""FastAPI boundary for the MOVE attention-to-action prototype."""

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Session, select

from .database import create_db_and_tables, engine
from .engine import (
    dopamine_comparison,
    get_learning_recommendation,
    get_next_recommendation,
    progress_score,
)
from .models import ContentUnit, Event, EventSource, EventType, UserState
from .seed_data import seed_db


app = FastAPI(title="MOVE · Attention to Career")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_session():
    with Session(engine) as session:
        yield session


@app.on_event("startup")
def on_startup() -> None:
    # Safe and idempotent: this updates the catalog but never drops learner
    # events or progress.
    seed_db()


class EventPayload(BaseModel):
    event_id: str
    user_id: str = "u1"
    unit_id: str
    event_type: EventType
    source: EventSource = EventSource.USER


def _adjust_interest(user: UserState, unit: ContentUnit, delta: float) -> None:
    data = unit.task_data or {}
    interests = dict(user.observed_interests or {})
    for tag in data.get("interest_tags", []):
        key = str(tag).strip().lower()
        if key:
            interests[key] = round(min(1.0, max(0.0, interests.get(key, 0.0) + delta)), 3)
    user.observed_interests = interests


def _record_skill_evidence(user: UserState, unit: ContentUnit) -> None:
    if unit.evidence_type not in {"concept", "application", "build"}:
        return
    data = unit.task_data or {}
    skills = dict(user.skill_evidence or {})
    for skill in data.get("skills", []):
        key = str(skill)
        if key:
            skills[key] = skills.get(key, 0) + 1
    user.skill_evidence = skills


def _current_response(
    session: Session,
    user: UserState,
    exclude_unit_id: str | None = None,
    *,
    duplicate: bool = False,
) -> dict[str, Any]:
    return {
        "duplicate": duplicate,
        "state": user.model_dump(),
        "recommendation": get_next_recommendation(session, user, exclude_unit_id),
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/events")
def process_event(payload: EventPayload, session: Session = Depends(get_session)):
    try:
        user = session.get(UserState, payload.user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")

        unit = session.get(ContentUnit, payload.unit_id)
        if unit is None:
            raise HTTPException(status_code=404, detail="Unit not found")

        existing = session.exec(select(Event).where(Event.event_id == payload.event_id)).first()
        if existing:
            if existing.user_id != payload.user_id:
                raise HTTPException(status_code=409, detail="Event ID already belongs to another user")
            return _current_response(session, user, duplicate=True)

        # A retry with a fresh transport ID must not award the same unit's
        # evidence twice. Failed attempts and impressions remain repeatable.
        if payload.event_type in {EventType.WATCH_COMPLETED, EventType.TASK_COMPLETED}:
            prior_completion = session.exec(
                select(Event)
                .where(Event.user_id == payload.user_id)
                .where(Event.content_id == payload.unit_id)
                .where(Event.event_type.in_([EventType.WATCH_COMPLETED.value, EventType.TASK_COMPLETED.value]))
            ).first()
            if prior_completion:
                return _current_response(session, user, exclude_unit_id=payload.unit_id, duplicate=True)

        if payload.event_type == EventType.WATCH_COMPLETED and unit.type != "video":
            raise HTTPException(status_code=422, detail="Only video units can emit WATCH_COMPLETED")
        if payload.event_type == EventType.LESSON_COMPLETED and unit.type != "lesson":
            raise HTTPException(status_code=422, detail="Only lesson units can emit LESSON_COMPLETED")
        if payload.event_type == EventType.TASK_COMPLETED and unit.type in {"video", "lesson"}:
            raise HTTPException(status_code=422, detail="Videos and lessons use their own completion event")

        previous_reaction = None
        if payload.event_type in {EventType.LIKED, EventType.DISLIKED, EventType.REACTION_CLEARED}:
            previous_reaction = session.exec(
                select(Event)
                .where(Event.user_id == payload.user_id)
                .where(Event.content_id == payload.unit_id)
                .where(Event.event_type.in_([EventType.LIKED.value, EventType.DISLIKED.value, EventType.REACTION_CLEARED.value]))
                .order_by(Event.id.desc())
            ).first()
            previous_reaction = previous_reaction.event_type if previous_reaction else None
            if previous_reaction == EventType.REACTION_CLEARED.value:
                previous_reaction = None
            if payload.event_type == EventType.REACTION_CLEARED or payload.event_type.value != previous_reaction:
                if previous_reaction == EventType.LIKED.value:
                    _adjust_interest(user, unit, -0.08)
                elif previous_reaction == EventType.DISLIKED.value:
                    _adjust_interest(user, unit, 0.15)

        session.add(
            Event(
                event_id=payload.event_id,
                user_id=payload.user_id,
                content_id=payload.unit_id,
                event_type=payload.event_type.value,
                source=payload.source.value,
            )
        )

        if payload.event_type == EventType.UNIT_SERVED:
            user.total_items_served += 1
            if user.intervention_cooldown > 0:
                user.intervention_cooldown -= 1
        elif payload.event_type == EventType.WATCH_COMPLETED:
            user.passive_streak += 1
            user.recent_skip_streak = 0
            user.evidence_exposure += 1
            _adjust_interest(user, unit, 0.06)
        elif payload.event_type == EventType.LESSON_COMPLETED:
            user.passive_streak += 1
            user.recent_skip_streak = 0
            user.evidence_exposure += 1
            _adjust_interest(user, unit, 0.06)
        elif payload.event_type == EventType.TASK_COMPLETED:
            user.passive_streak = 0
            user.recent_skip_streak = 0
            user.intervention_skips = 0
            user.intervention_cooldown = 0
            user.meaningful_actions += 1
            if unit.evidence_type == "concept":
                user.evidence_concept += 1
            elif unit.evidence_type == "application":
                user.evidence_application += 1
            elif unit.evidence_type == "build":
                user.evidence_build += 1
            elif unit.evidence_type == "career_exploration":
                user.evidence_career += 1
            _record_skill_evidence(user, unit)
            _adjust_interest(user, unit, 0.12)
            pref_key = f"pref_{unit.type}"
            if hasattr(user, pref_key):
                setattr(user, pref_key, min(2.0, getattr(user, pref_key) + 0.1))
        elif payload.event_type == EventType.TASK_FAILED:
            user.task_failures += 1
            pref_key = f"pref_{unit.type}"
            if hasattr(user, pref_key):
                setattr(user, pref_key, max(0.25, getattr(user, pref_key) - 0.04))
        elif payload.event_type == EventType.SKIPPED:
            user.recent_skip_streak += 1
            _adjust_interest(user, unit, -0.08)
            pref_key = f"pref_{unit.type}"
            if hasattr(user, pref_key):
                setattr(user, pref_key, max(0.25, getattr(user, pref_key) - 0.08))
        elif payload.event_type == EventType.NOT_INTERESTED:
            user.recent_skip_streak += 1
            _adjust_interest(user, unit, -0.18)
        elif payload.event_type == EventType.INTERVENTION_SKIPPED:
            user.intervention_skips += 1
            user.intervention_cooldown = 5
        elif payload.event_type == EventType.LIKED and previous_reaction != EventType.LIKED.value:
            _adjust_interest(user, unit, 0.12)
        elif payload.event_type == EventType.DISLIKED and previous_reaction != EventType.DISLIKED.value:
            _adjust_interest(user, unit, -0.15)
        elif payload.event_type == EventType.SHARED:
            _adjust_interest(user, unit, 0.05)

        session.add(user)
        session.commit()
        session.refresh(user)

        # Failed answers stay on the same activity so the learner can retry.
        if payload.event_type == EventType.TASK_FAILED:
            return {
                "duplicate": False,
                "state": user.model_dump(),
                "recommendation": get_next_recommendation(session, user, exclude_unit_id=None),
                "retry_unit_id": unit.id,
            }

        exclude_id = payload.unit_id if payload.event_type in {
            EventType.WATCH_COMPLETED,
            EventType.LESSON_COMPLETED,
            EventType.TASK_COMPLETED,
            EventType.SKIPPED,
            EventType.INTERVENTION_SKIPPED,
            EventType.NOT_INTERESTED,
        } else None
        return _current_response(session, user, exclude_unit_id=exclude_id)
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail="Could not process the interaction") from exc


@app.get("/feed/next")
def get_feed(user_id: str = "u1", session: Session = Depends(get_session)):
    user = session.get(UserState, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return {"state": user.model_dump(), "recommendation": get_next_recommendation(session, user)}


@app.get("/feed/learning/{video_id}")
def get_optional_learning(video_id: str, user_id: str = "u1", session: Session = Depends(get_session)):
    user = session.get(UserState, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    recommendation = get_learning_recommendation(session, user, video_id)
    if recommendation["unit"] is None:
        raise HTTPException(status_code=404, detail=recommendation["reason"]["text"])
    return {"state": user.model_dump(), "recommendation": recommendation}


class GoalPayload(BaseModel):
    user_id: str = "u1"
    goal: str


@app.post("/user/goal")
def set_goal(payload: GoalPayload, session: Session = Depends(get_session)):
    """Let the learner change their declared direction; the feed re-ranks for it."""
    user = session.get(UserState, payload.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    goal = payload.goal.strip()
    if goal:
        user.declared_goal = goal
        session.add(user)
        session.commit()
        session.refresh(user)
    return {"state": user.model_dump(), "recommendation": get_next_recommendation(session, user)}


def _simulation_user(session: Session) -> UserState:
    user = session.get(UserState, "u1")
    if user is None:
        user = UserState(user_id="u1", declared_goal="Backend Developer")
        session.add(user)
        session.commit()
        session.refresh(user)
    return user


@app.post("/simulate/stall")
def simulate_stall(session: Session = Depends(get_session)):
    user = _simulation_user(session)
    now = datetime.now(timezone.utc)
    for unit_id in ["api_01", *(f"api_{index:02d}" for index in range(5, 14))]:
        session.add(Event(event_id=f"sim_serve_{uuid4().hex}", user_id=user.user_id, content_id=unit_id, event_type=EventType.UNIT_SERVED.value, source=EventSource.SIMULATED.value, timestamp=now))
        session.add(Event(event_id=f"sim_watch_{uuid4().hex}", user_id=user.user_id, content_id=unit_id, event_type=EventType.WATCH_COMPLETED.value, source=EventSource.SIMULATED.value, timestamp=now))
    user.total_items_served += 10
    user.evidence_exposure = max(user.evidence_exposure, 10)
    user.observed_interests = {**(user.observed_interests or {}), "apis": max((user.observed_interests or {}).get("apis", 0.0), 0.65)}
    user.passive_streak = max(user.passive_streak, 10)
    user.recent_skip_streak = 0
    user.intervention_cooldown = 0
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"state": user.model_dump(), "recommendation": get_next_recommendation(session, user)}


@app.post("/simulate/disengagement")
def simulate_disengagement(session: Session = Depends(get_session)):
    user = _simulation_user(session)
    for unit_id, event_type in (("api_01", EventType.WATCH_COMPLETED.value), ("api_02", EventType.TASK_COMPLETED.value)):
        prior = session.exec(
            select(Event)
            .where(Event.user_id == user.user_id)
            .where(Event.content_id == unit_id)
            .where(Event.event_type.in_([EventType.WATCH_COMPLETED.value, EventType.TASK_COMPLETED.value]))
        ).first()
        if prior is None:
            session.add(
                Event(
                    event_id=f"sim_{uuid4().hex}",
                    user_id=user.user_id,
                    content_id=unit_id,
                    event_type=event_type,
                    source=EventSource.SIMULATED.value,
                )
            )
    user.recent_skip_streak = 3
    user.passive_streak = 0
    user.intervention_cooldown = 0
    user.evidence_exposure = max(user.evidence_exposure, 1)
    user.evidence_concept = max(user.evidence_concept, 1)
    now = datetime.now(timezone.utc)
    for unit_id in ("api_01", "sql_01", "docker_01"):
        session.add(
            Event(
                event_id=f"sim_{uuid4().hex}",
                user_id=user.user_id,
                content_id=unit_id,
                event_type=EventType.SKIPPED.value,
                source=EventSource.SIMULATED.value,
                timestamp=now,
            )
        )
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"state": user.model_dump(), "recommendation": get_next_recommendation(session, user)}


@app.post("/simulate/divergence")
def simulate_divergence(session: Session = Depends(get_session)):
    user = _simulation_user(session)
    user.observed_interests = {"frontend": 0.9, "react": 0.85, "design": 0.7, "backend": 0.25}
    user.passive_streak = 0
    user.recent_skip_streak = 0
    user.intervention_skips = 0
    user.intervention_cooldown = 0
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"state": user.model_dump(), "recommendation": get_next_recommendation(session, user)}


@app.post("/simulate/reset")
def simulate_reset(session: Session = Depends(get_session)):
    user = _simulation_user(session)
    events = session.exec(select(Event).where(Event.user_id == user.user_id)).all()
    for event in events:
        session.delete(event)

    user.passive_streak = 0
    user.recent_skip_streak = 0
    user.intervention_skips = 0
    user.intervention_cooldown = 0
    user.task_failures = 0
    user.total_items_served = 0
    user.meaningful_actions = 0
    user.evidence_exposure = 0
    user.evidence_concept = 0
    user.evidence_application = 0
    user.evidence_build = 0
    user.evidence_career = 0
    user.observed_interests = {}
    user.skill_evidence = {}
    user.pref_video = 1.0
    user.pref_quiz = 1.0
    user.pref_challenge = 1.0
    user.pref_career_action = 1.0
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"state": user.model_dump(), "recommendation": get_next_recommendation(session, user)}


_COMPLETION_EVENTS = (
    EventType.WATCH_COMPLETED.value,
    EventType.LESSON_COMPLETED.value,
    EventType.TASK_COMPLETED.value,
)


def _minutes_consumed(session: Session, user_id: str) -> float:
    """Wall-clock minutes the learner actually spent, from unit durations."""
    units = {unit.id: unit for unit in session.exec(select(ContentUnit)).all()}
    seconds = 0.0
    for event in session.exec(
        select(Event).where(Event.user_id == user_id).where(Event.event_type.in_(_COMPLETION_EVENTS))
    ).all():
        unit = units.get(event.content_id)
        if unit:
            seconds += float((unit.task_data or {}).get("duration_seconds", 30))
    return round(seconds / 60.0, 1)


@app.post("/simulate/reversal")
def simulate_reversal(session: Session = Depends(get_session)):
    """PS6 scenario 4 — dopamine-loop reversal.

    Seeds a 3-minute watch -> answer -> apply path so the live learner model
    shows real progress from very little time, and returns the progress-per-
    minute comparison against 30 minutes of passive watching.
    """
    user = _simulation_user(session)
    now = datetime.now(timezone.utc)
    path = [
        ("api_01", EventType.WATCH_COMPLETED.value),
        ("api_lesson_01", EventType.LESSON_COMPLETED.value),
        ("api_02", EventType.TASK_COMPLETED.value),
        ("api_03", EventType.TASK_COMPLETED.value),
    ]
    for unit_id, event_type in path:
        session.add(Event(event_id=f"sim_{uuid4().hex}", user_id=user.user_id, content_id=unit_id, event_type=event_type, source=EventSource.SIMULATED.value, timestamp=now))
    user.evidence_exposure = max(user.evidence_exposure, 1)
    user.evidence_concept = max(user.evidence_concept, 1)
    user.evidence_application = max(user.evidence_application, 1)
    user.meaningful_actions = max(user.meaningful_actions, 2)
    user.total_items_served = max(user.total_items_served, 4)
    user.passive_streak = 0
    user.recent_skip_streak = 0
    user.intervention_cooldown = 0
    user.observed_interests = {**(user.observed_interests or {}), "apis": max((user.observed_interests or {}).get("apis", 0.0), 0.6)}
    session.add(user)
    session.commit()
    session.refresh(user)
    return {
        "state": user.model_dump(),
        "recommendation": get_next_recommendation(session, user),
        "metrics": {
            "progress_score": progress_score(user),
            "minutes_consumed": _minutes_consumed(session, user.user_id),
            "comparison": dopamine_comparison(),
        },
    }


@app.get("/metrics")
def metrics(user_id: str = "u1", session: Session = Depends(get_session)):
    """Progress-not-engagement measurement for the judge view."""
    user = session.get(UserState, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    minutes = _minutes_consumed(session, user_id)
    score = progress_score(user)
    return {
        "progress_score": score,
        "minutes_consumed": minutes,
        "progress_per_min": round(score / minutes, 2) if minutes > 0 else 0.0,
        "meaningful_actions": user.meaningful_actions,
        "items_served": user.total_items_served,
        "comparison": dopamine_comparison(),
    }
