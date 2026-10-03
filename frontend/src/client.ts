const API_BASE = "/api";
const USER_ID = "u1";

export type EventType =
  | "UNIT_SERVED"
  | "WATCH_COMPLETED"
  | "LESSON_COMPLETED"
  | "SKIPPED"
  | "TASK_COMPLETED"
  | "TASK_FAILED"
  | "INTERVENTION_SKIPPED"
  | "NOT_INTERESTED"
  | "LIKED"
  | "DISLIKED"
  | "REACTION_CLEARED"
  | "SHARED";

export type Scenario = "stall" | "disengagement" | "divergence" | "reversal" | "reset";

export interface ProgressComparisonRow {
  label: string;
  minutes: number;
  evidence: Record<string, number>;
  progress: number;
  per_min: number;
}
export interface ProgressMetrics {
  progress_score: number;
  minutes_consumed: number;
  progress_per_min: number;
  meaningful_actions: number;
  items_served: number;
  comparison: { passive: ProgressComparisonRow; active: ProgressComparisonRow; active_advantage_x: number };
}

export interface ContentUnit {
  id: string;
  type: "video" | "lesson" | "quiz" | "challenge" | "career_action";
  title: string;
  difficulty: number;
  evidence_type: "exposure" | "concept" | "application" | "build" | "career_exploration";
  prerequisites: string[];
  task_data: Record<string, any>;
}

export interface RecommendationReason {
  primary: string;
  text: string;
  surface_note?: string;
  signals?: string[];
  trigger?: string;
  components?: Record<string, number>;
}

export interface Recommendation {
  recommendation_id: string;
  unit: ContentUnit | null;
  reason: RecommendationReason;
  policy_applied: string;
}

export interface UserState {
  user_id: string;
  declared_goal: string;
  passive_streak: number;
  recent_skip_streak: number;
  intervention_skips: number;
  intervention_cooldown: number;
  task_failures: number;
  total_items_served: number;
  meaningful_actions: number;
  evidence_exposure: number;
  evidence_concept: number;
  evidence_application: number;
  evidence_build: number;
  evidence_career: number;
  observed_interests: Record<string, number>;
  skill_evidence: Record<string, number>;
  pref_video: number;
  pref_quiz: number;
  pref_challenge: number;
  pref_career_action: number;
}

export interface FeedResponse {
  duplicate?: boolean;
  state: UserState;
  recommendation: Recommendation;
  retry_unit_id?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new Error("MOVE can't reach its local learning service. Check that the backend is running, then retry.");
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // Keep the HTTP status as a useful fallback when the response isn't JSON.
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

function eventId(): string {
  return `evt_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

export function getFeed(): Promise<FeedResponse> {
  return request<FeedResponse>(`/feed/next?user_id=${USER_ID}`);
}

export function getOptionalLearning(videoId: string): Promise<FeedResponse> {
  return request<FeedResponse>(`/feed/learning/${encodeURIComponent(videoId)}?user_id=${USER_ID}`);
}

export function postEvent(
  unitId: string,
  eventType: EventType,
  stableEventId?: string,
): Promise<FeedResponse> {
  return request<FeedResponse>("/events", {
    method: "POST",
    body: JSON.stringify({
      event_id: stableEventId ?? eventId(),
      user_id: USER_ID,
      unit_id: unitId,
      event_type: eventType,
    }),
  });
}

export function getMetrics(): Promise<ProgressMetrics> {
  return request<ProgressMetrics>(`/metrics?user_id=${USER_ID}`);
}

export function simulateScenario(scenario: Scenario): Promise<FeedResponse> {
  return request<FeedResponse>(`/simulate/${scenario}`, { method: "POST" });
}

export const GOAL_OPTIONS = [
  "Backend Developer",
  "Frontend Developer",
  "Data Analyst",
  "Cloud Engineer",
  "Security Engineer",
];

export function setGoal(goal: string): Promise<FeedResponse> {
  return request<FeedResponse>("/user/goal", {
    method: "POST",
    body: JSON.stringify({ user_id: USER_ID, goal }),
  });
}
