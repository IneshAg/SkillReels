from datetime import datetime, timezone
import enum
from typing import Any, Optional

from sqlmodel import Column, Field, JSON, SQLModel


class EventType(str, enum.Enum):
    UNIT_SERVED = "UNIT_SERVED"
    WATCH_COMPLETED = "WATCH_COMPLETED"
    LESSON_COMPLETED = "LESSON_COMPLETED"
    SKIPPED = "SKIPPED"
    TASK_COMPLETED = "TASK_COMPLETED"
    TASK_FAILED = "TASK_FAILED"
    INTERVENTION_SKIPPED = "INTERVENTION_SKIPPED"
    NOT_INTERESTED = "NOT_INTERESTED"
    LIKED = "LIKED"
    DISLIKED = "DISLIKED"
    REACTION_CLEARED = "REACTION_CLEARED"
    SHARED = "SHARED"


class EventSource(str, enum.Enum):
    USER = "user"
    SIMULATED = "simulated"


class ContentUnit(SQLModel, table=True):
    """A short learning, practice, build, or career-exploration activity."""

    id: str = Field(primary_key=True)
    type: str
    title: str
    difficulty: int = Field(default=1)
    evidence_type: str
    prerequisites: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    task_data: Optional[dict[str, Any]] = Field(default=None, sa_column=Column(JSON))


class Event(SQLModel, table=True):
    """Append-only interaction history; event_id makes client retries safe."""

    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: str = Field(unique=True, index=True)
    user_id: str = Field(index=True)
    content_id: str = Field(index=True)
    event_type: str = Field(index=True)
    source: str = Field(default=EventSource.USER.value)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserState(SQLModel, table=True):
    """Small, inspectable learner model used by the prototype recommender."""

    user_id: str = Field(primary_key=True)
    declared_goal: str = Field(default="Backend Developer")

    # Behavior and separately counted evidence: consumption is not mastery.
    passive_streak: int = Field(default=0)
    recent_skip_streak: int = Field(default=0)
    intervention_skips: int = Field(default=0)
    intervention_cooldown: int = Field(default=0)
    task_failures: int = Field(default=0)
    total_items_served: int = Field(default=0)
    meaningful_actions: int = Field(default=0)
    evidence_exposure: int = Field(default=0)
    evidence_concept: int = Field(default=0)
    evidence_application: int = Field(default=0)
    evidence_build: int = Field(default=0)
    evidence_career: int = Field(default=0)

    # Behavioral signals are not hard-coded profile claims. They are updated
    # from a learner's selections, completions, skips, and activity outcomes.
    observed_interests: dict[str, float] = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False)
    )
    skill_evidence: dict[str, int] = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False)
    )

    pref_video: float = Field(default=1.0)
    pref_quiz: float = Field(default=1.0)
    pref_challenge: float = Field(default=1.0)
    pref_career_action: float = Field(default=1.0)
