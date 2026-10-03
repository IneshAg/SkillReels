import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  getOptionalLearning,
  getFeed,
  getMetrics,
  postEvent,
  simulateScenario,
  setGoal,
  GOAL_OPTIONS,
  type ContentUnit,
  type EventType,
  type FeedResponse,
  type ProgressMetrics,
  type Recommendation,
  type Scenario,
  type UserState,
} from "./client";

type Screen = "feed" | "progress" | "profile";
type Reaction = "liked" | "disliked";
type IconName = "arrow" | "bookmark" | "briefcase" | "check" | "chevron" | "close" | "code" | "compass" | "dislike" | "heart" | "home" | "info" | "pause" | "play" | "profile" | "refresh" | "share" | "spark" | "volume";
type SavedUnit = Pick<ContentUnit, "id" | "type" | "title" | "evidence_type">;

const DEFAULT_STATE: Partial<UserState> = {
  declared_goal: "Backend Developer",
  observed_interests: {},
  skill_evidence: {},
  evidence_exposure: 0,
  evidence_concept: 0,
  evidence_application: 0,
  evidence_build: 0,
  evidence_career: 0,
  total_items_served: 0,
  meaningful_actions: 0,
  passive_streak: 0,
  recent_skip_streak: 0,
  intervention_skips: 0,
  task_failures: 0,
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const icons: Record<IconName, ReactNode> = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    bookmark: <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.5L6 21V4.75Z" />,
    briefcase: <><rect x="3.5" y="7" width="17" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3.5 12h17m-10 0v2h3v-2" /></>,
    check: <path d="m5 12.5 4.25 4.25L19 7" />,
    chevron: <path d="m9 6 6 6-6 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    code: <><path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4M14 5l-4 14" /></>,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
    dislike: <><path d="M7 10V4H4v6h3Zm0-6h8.5a2 2 0 0 1 1.9 2.6l-1.5 4.9H20a1.8 1.8 0 0 1 1.7 2.4l-1.1 3a1.8 1.8 0 0 1-1.7 1.2h-6.2l.4 2.5a1.8 1.8 0 0 1-3.1 1.5L7 17" /></>,
    heart: <path d="M20.8 8.8c0 5.1-8.8 11-8.8 11s-8.8-5.9-8.8-11A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.8 2.4Z" />,
    home: <><path d="m3.5 11 8.5-7 8.5 7" /><path d="M5.5 9.5V20h13V9.5M9.5 20v-6h5v6" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
    pause: <><path d="M8 6v12M16 6v12" /></>,
    play: <path d="m9 7 8 5-8 5V7Z" />,
    profile: <><circle cx="12" cy="8.2" r="3.2" /><path d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9a7 7 0 0 1 12-2L20 12M4 12l2.5 5a7 7 0 0 0 12-2" /></>,
    share: <><path d="M12 16V3m0 0L7.5 7.5M12 3l4.5 4.5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></>,
    spark: <path d="M12 2.5 13.8 9 20 12l-6.2 3-1.8 6.5-1.8-6.5L4 12l6.2-3L12 2.5Z" />,
    volume: <><path d="M4 10v4h3l4 3V7l-4 3H4Z" /><path d="M15 9a4 4 0 0 1 0 6m2-9a7 7 0 0 1 0 12" /></>,
  };
  return (
    <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icons[name]}</g>
    </svg>
  );
}

function Logo() {
  return <div className="brand" aria-label="SkillReels"><span className="brand-mark">S<span>↗</span></span><span>SkillReels</span></div>;
}

function Navigation({ active, onChange }: { active: Screen; onChange: (screen: Screen) => void }) {
  const items: { key: Screen; label: string; icon: IconName }[] = [
    { key: "feed", label: "For you", icon: "home" },
    { key: "progress", label: "Progress", icon: "spark" },
    { key: "profile", label: "Profile", icon: "profile" },
  ];
  return (
    <nav className="side-navigation" aria-label="Main navigation">
      <Logo />
      <div className="navigation-items">
        {items.map((item) => (
          <button key={item.key} className={`navigation-item ${active === item.key ? "active" : ""}`} onClick={() => onChange(item.key)}>
            <Icon name={item.icon} size={19} /><span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="navigation-foot"><span className="status-dot" /><span>LEARN IT. TRY IT. MAKE IT.</span></div>
    </nav>
  );
}

function Header({ screen, state, showSystem, onToggleSystem }: {
  screen: Screen;
  state: Partial<UserState> | null;
  showSystem: boolean;
  onToggleSystem: () => void;
}) {
  const title = screen === "feed" ? "Your next SkillReels" : screen === "progress" ? "Your progress" : "Your profile";
  return (
    <header className="top-bar">
      <div className="mobile-brand"><Logo /></div>
      <div className="top-bar-heading"><span className="top-kicker">ATTENTION INTO PROGRESS</span><strong>{title}</strong></div>
      <div className="top-bar-actions">
        <span className="goal-chip"><Icon name="briefcase" size={15} />{state?.declared_goal || DEFAULT_STATE.declared_goal}</span>
        <button className={`system-toggle ${showSystem ? "selected" : ""}`} onClick={onToggleSystem} aria-expanded={showSystem}>
          <Icon name="code" size={16} /><span>{showSystem ? "Hide system" : "System view"}</span>
        </button>
      </div>
    </header>
  );
}

function SaveButton({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  return (
    <button className={`icon-button ${saved ? "saved" : ""}`} onClick={onClick} aria-label={saved ? "Remove saved item" : "Save item"} title={saved ? "Saved" : "Save for later"}>
      <Icon name="bookmark" size={18} />
    </button>
  );
}

function ApiFlowVisual() {
  return (
    <div className="api-flow-card" aria-label="Request flow from the frontend through an API to the database">
      <span className="api-flow-title">A REQUEST, STEP BY STEP</span>
      <div className="api-flow-diagram">
        <div className="api-flow-node">
          <span className="api-flow-glyph client"><Icon name="home" size={15} /></span>
          <small>CLIENT</small>
        </div>
        <div className="api-flow-route"><i /><small>GET /users</small></div>
        <div className="api-flow-node">
          <span className="api-flow-glyph api"><Icon name="code" size={15} /></span>
          <small>API</small>
        </div>
        <div className="api-flow-route response"><i /><small>JSON</small></div>
        <div className="api-flow-node">
          <span className="api-flow-glyph database"><i /><i /></span>
          <small>DATA</small>
        </div>
      </div>
    </div>
  );
}

function WhyPanel({ recommendation, state, onClose }: {
  recommendation: Recommendation;
  state: Partial<UserState> | null;
  onClose: () => void;
}) {
  const data = recommendation.unit?.task_data ?? {};
  const reason = recommendation.reason;
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <section className="why-panel" role="dialog" aria-modal="true" aria-labelledby="why-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="panel-heading"><div><span className="section-kicker">RECOMMENDATION REASON</span><h2 id="why-title">Why this SkillReels?</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><Icon name="close" /></button></div>
        <p className="why-copy">{reason?.text || "This activity is available for your current learning path."}</p>
        <div className="why-context">
          <div><span>Your goal</span><strong>{state?.declared_goal || DEFAULT_STATE.declared_goal}</strong></div>
          <div><span>Skill focus</span><strong>{(data.skills ?? []).join(", ") || "Career exploration"}</strong></div>
          <div><span>System policy</span><strong>{recommendation.policy_applied.replace(/_/g, " ").toLowerCase()}</strong></div>
        </div>
        {reason?.signals?.length ? <div className="signal-list"><span className="section-kicker">SIGNALS USED</span>{reason.signals.map((signal) => <div key={signal}><Icon name="check" size={15} />{signal}</div>)}</div> : null}
        <div className="why-footer"><span>{recommendation.unit?.task_data?.duration_seconds ? `${Math.max(1, Math.round(recommendation.unit.task_data.duration_seconds / 60))} min` : "Short activity"}</span><span>·</span><span>Prototype recommendation based on visible signals</span></div>
      </section>
    </div>
  );
}

function ItemMeta({ unit }: { unit: ContentUnit }) {
  const label = unit.type === "career_action" ? "CAREER ACTION" : unit.type === "challenge" ? (unit.evidence_type === "build" ? "MICRO BUILD" : "PRACTICE") : unit.type === "lesson" ? "FIELD LESSON" : unit.type.toUpperCase();
  return <div className="item-meta"><span className="format-pill">{label}</span><span>·</span><span>{Math.max(1, Math.round((unit.task_data?.duration_seconds ?? 60) / 60))} min</span><span>·</span><span>Step {unit.difficulty}</span></div>;
}

function ActionRow({ onSkip, onWhy, busy, children, showWhy = true, showSkip = true }: { onSkip: () => void; onWhy: () => void; busy: boolean; children: ReactNode; showWhy?: boolean; showSkip?: boolean }) {
  return (
    <div className="activity-actions">
      {children}
      {showSkip && <button className="text-action" disabled={busy} onClick={onSkip}>Not now</button>}
      {showWhy && <button className="why-link" onClick={onWhy}><Icon name="info" size={16} />Why this?</button>}
    </div>
  );
}

function LearningTrail({ unit }: { unit: ContentUnit }) {
  const steps = ["SEE", "LEARN", "TRY", "BUILD"];
  const current = unit.type === "video" ? 0 : unit.type === "lesson" ? 1 : unit.evidence_type === "build" ? 3 : 2;
  return <div className="learning-trail" aria-label={`SkillReels learning stage: ${steps[current]}`}>
    {steps.map((step, index) => <span key={step} className={index === current ? "current" : index < current ? "passed" : ""}><i>0{index + 1}</i>{step}</span>)}
  </div>;
}

// A concept reel is a short read, not a stock clip. It auto-advances on this
// timer so the feed keeps the swipe-and-autoplay rhythm of a short-form feed.
const REEL_DURATION_MS = 9000;

// Topic-relevant visual that replaces generic stock footage: the actual code or
// term for the concept, styled per topic, so what the learner sees always
// matches the caption and their goal track.
function ReelVisual({ unit, playing }: { unit: ContentUnit; playing: boolean }) {
  const data = unit.task_data ?? {};
  const topic = String(data.topic || "learn").toLowerCase();
  const snippet = String(data.snippet || "").trim();
  const skills: string[] = data.skills ?? [];
  const lines = snippet ? snippet.split("\n") : [];
  const label = topic.replace(/_/g, " ");
  return (
    <div className={`reel-visual topic-${topic}`} data-playing={playing ? "true" : "false"}>
      <div className="reel-visual-glow" />
      <div className="reel-visual-grid" />
      <div className="reel-visual-dots"><i /><i /><i /><span>{label}</span></div>
      {lines.length > 0 ? (
        <pre className="reel-code" aria-label="concept snippet"><code>
          {lines.map((line, index) => (
            <span key={index} className="reel-code-line" style={{ animationDelay: `${0.25 + index * 0.45}s` }}>
              {line.length ? line : " "}
            </span>
          ))}
        </code></pre>
      ) : (
        <div className="reel-term"><span>{skills[0] || unit.title}</span></div>
      )}
      {skills.length > 0 && (
        <div className="reel-visual-skills">
          {skills.slice(0, 3).map((skill) => <span key={skill}>{skill}</span>)}
        </div>
      )}
    </div>
  );
}

function VideoActivity({ unit, active, muted, busy, saved, liked, disliked, signalNote, onSave, onMute, onComplete, onSkip, onNextReel, onLearnMore, onLike, onDislike, onShare, onWhy }: {
  unit: ContentUnit; active: boolean; muted: boolean; busy: boolean; saved: boolean; liked: boolean; disliked: boolean;
  signalNote?: string;
  onSave: () => void; onMute: () => void; onComplete: () => void; onSkip: () => void; onNextReel: (type: EventType | null) => void; onLearnMore: (videoId: string) => void;
  onLike: () => void; onDislike: () => void; onShare: () => void; onWhy: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [shareMessage, setShareMessage] = useState("");
  const [completed, setCompleted] = useState(false);
  const skipRecorded = useRef(false);
  const wasActive = useRef(active);
  const skills = unit.task_data?.skills ?? [];
  const [captionOpen, setCaptionOpen] = useState(false);
  const [captionOverflow, setCaptionOverflow] = useState(false);
  const captionRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setProgress(0);
    setPlaying(true);
    setShareMessage("");
    setCompleted(false);
    setCaptionOpen(false);
    skipRecorded.current = false;
  }, [unit.id]);

  // Show the "more" toggle only when the caption is actually clipped.
  useEffect(() => {
    const el = captionRef.current;
    if (el && !captionOpen) setCaptionOverflow(el.scrollHeight > el.clientHeight + 1);
  }, [unit.id, captionOpen]);

  // The read timer only runs while this reel is the active, playing card.
  useEffect(() => {
    if (!active || !playing || completed) return;
    const tick = 100;
    const id = window.setInterval(() => {
      setProgress((value) => Math.min(100, value + (100 * tick) / REEL_DURATION_MS));
    }, tick);
    return () => window.clearInterval(id);
  }, [active, playing, completed, unit.id]);

  // Reaching the end of the read counts as a completed watch.
  useEffect(() => {
    if (progress >= 100 && !completed) {
      setCompleted(true);
      onComplete();
    }
  }, [progress, completed, onComplete]);

  // Swiping away early is a skip; swiping away near the end still counts as watched.
  useEffect(() => {
    if (wasActive.current && !active && !completed) {
      if (progress >= 85) {
        setCompleted(true);
        onComplete();
      } else if (!skipRecorded.current) {
        skipRecorded.current = true;
        onSkip();
      }
    }
    wasActive.current = active;
  }, [active, completed, progress, onComplete, onSkip]);

  const togglePlayback = () => setPlaying((value) => !value);
  const openLesson = () => {
    setPlaying(false);
    onLearnMore(unit.id);
  };
  const share = async () => {
    const text = `${unit.title} — ${unit.task_data?.description || "A short idea from SkillReels."}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: unit.title, text });
        setShareMessage("Shared");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setShareMessage("Caption copied");
      } else {
        setShareMessage("Sharing is unavailable here");
        return;
      }
      onShare();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareMessage("Could not share right now");
    }
  };

  return (
    <article className="activity-card video-card">
      <div className={`video-stage reel-visual-stage ${playing ? "is-playing" : "is-paused"}`} data-topic={String(unit.task_data?.topic || "learn")}>
        <ReelVisual unit={unit} playing={playing && active} />
        <div className="video-shade" />
        <button className="video-play" onClick={togglePlayback} aria-label={playing ? "Pause" : "Play"}>
          <Icon name={playing ? "pause" : "play"} size={22} />
        </button>
        <aside className="video-action-rail" aria-label="Video actions">
          <button className={`video-rail-action like-action ${liked ? "reacted" : ""}`} onClick={onLike} aria-label={liked ? "Remove like" : "Like"} aria-pressed={liked} disabled={busy}>
            <Icon name="heart" size={26} />
          </button>
          <button className={`video-rail-action dislike-action ${disliked ? "reacted" : ""}`} onClick={onDislike} aria-label={disliked ? "Remove dislike" : "Not for me"} aria-pressed={disliked} disabled={busy}>
            <Icon name="dislike" size={23} /><span>{disliked ? "Not for me" : "Dislike"}</span>
          </button>
          <button className="video-rail-action" onClick={() => void share()} aria-label="Share this reel" disabled={busy}>
            <Icon name="share" size={23} /><span>Share</span>
          </button>
          <button className={`video-rail-action ${saved ? "saved" : ""}`} onClick={onSave} aria-label={saved ? "Remove saved video" : "Save video"} aria-pressed={saved}>
            <Icon name="bookmark" size={23} /><span>{saved ? "Saved" : "Save"}</span>
          </button>
          <button className="video-rail-action" onClick={onWhy} aria-label="Why this reel?"><Icon name="info" size={22} /><span>Why this?</span></button>
        </aside>
        <div className="reel-caption">
          <div className="reel-handle"><span className="reel-handle-mark">M</span><strong>SkillReels</strong><span className="reel-handle-topic">· {String(unit.task_data?.topic || "learn").replace(/_/g, " ")}</span></div>
          <p ref={captionRef} className={`reel-caption-text ${captionOpen ? "is-open" : ""}`}><strong>{unit.title}.</strong> {unit.task_data?.description || "A short concept toward your goal."}</p>
          {(captionOverflow || captionOpen) && <button className="caption-toggle" onClick={() => setCaptionOpen((open) => !open)}>{captionOpen ? "show less" : "more"}</button>}
          {skills.length > 0 && <div className="reel-hashtags">{skills.slice(0, 2).map((skill: string) => <span key={skill}>#{String(skill).replace(/\s+/g, "")}</span>)}</div>}
          {unit.task_data?.related_learning_unit_id && <button className="reel-more" onClick={openLesson} disabled={busy}><Icon name="spark" size={13} />Go deeper</button>}
          {shareMessage && <span className="caption-share-feedback" role="status">{shareMessage}</span>}
        </div>
        <button className={`reel-sound ${muted ? "muted" : ""}`} onClick={onMute} aria-label={muted ? "Unmute" : "Mute"} title={muted ? "Unmute" : "Mute"}><Icon name="volume" size={18} /></button>
        <div className="reel-progress" aria-hidden="true" style={{ "--progress": `${progress}%` } as React.CSSProperties}>
          <input 
            type="range" 
            min="0" 
            max="100" 
            step="0.1" 
            value={progress} 
            onChange={(e) => {
              setProgress(Number(e.target.value));
              if (Number(e.target.value) >= 100 && !completed) {
                setCompleted(true);
                onComplete();
              }
            }}
            onPointerDown={() => setPlaying(false)}
            onPointerUp={() => setPlaying(true)}
            aria-label="Seek video" 
          />
        </div>
      </div>
    </article>
  );
}

function LessonActivity({ unit, busy, onComplete, onSkip, onWhy }: {
  unit: ContentUnit; busy: boolean; onComplete: () => void; onSkip: () => void; onWhy: () => void;
}) {
  const data = unit.task_data ?? {};
  const steps: { eyebrow?: string; heading: string; body: string; visual_label?: string; visual_value?: string }[] = data.lesson_steps ?? [];
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];

  return <article className="activity-card lesson-card">
    <div className="lesson-art" aria-hidden="true">
      <span className="lesson-art-index">{String(stepIndex + 1).padStart(2, "0")} <i>/</i> {String(steps.length).padStart(2, "0")}</span>
      <div className="lesson-art-orbit orbit-one" /><div className="lesson-art-orbit orbit-two" />
      <div className="lesson-art-note"><small>{step?.visual_label || "THE IDEA"}</small><strong>{step?.visual_value || "INPUT → OUTPUT"}</strong></div>
      <div className="lesson-art-stamp">SkillReels<br /><span>TO<br />KNOW</span></div>
      <div className="lesson-art-bottom"><span>FIELD NOTES</span><span>{(data.skills ?? []).join(" · ")}</span></div>
    </div>
    <div className="lesson-copy">
      <ItemMeta unit={unit} />
      <span className="lesson-eyebrow">{step?.eyebrow || "A concept, in plain language"}</span>
      <h1>{step?.heading || unit.title}</h1>
      <p className="lesson-explanation">{step?.body || data.description || "Work through the idea, then check what stuck."}</p>
      <div className="lesson-step-controls"><div className="lesson-step-track" aria-label={`Lesson step ${stepIndex + 1} of ${steps.length}`}>{steps.map((_, index) => <span key={index} className={index <= stepIndex ? "active" : ""} />)}</div><button className="primary-button" onClick={() => stepIndex < steps.length - 1 ? setStepIndex((index) => index + 1) : onComplete()} disabled={busy}>{stepIndex < steps.length - 1 ? "Next idea" : "Finish lesson"}<Icon name="arrow" size={17} /></button></div>
      <ActionRow onSkip={onSkip} onWhy={onWhy} busy={busy}><span className="lesson-skip-note">This lesson builds context. The next check records concept evidence.</span></ActionRow>
    </div>
  </article>;
}

type GameStats = { streak: number; best: number; points: number };

function GameHud({ game }: { game: GameStats }) {
  return (
    <div className="game-hud" aria-label={`Streak ${game.streak}, ${game.points} points`}>
      <span className={`hud-streak ${game.streak >= 2 ? "hot" : ""}`}><Icon name="spark" size={13} />{game.streak}<small>streak</small></span>
      <span className="hud-points">{game.points}<small>pts</small></span>
    </div>
  );
}

function QuizActivity({ unit, busy, game, onAnswer, onContinue, onSkip, onWhy }: {
  unit: ContentUnit; busy: boolean; game: GameStats; onAnswer: (correct: boolean) => Promise<void>; onContinue: () => void; onSkip: () => void; onWhy: () => void;
}) {
  const data = unit.task_data ?? {};
  const options: string[] = data.options?.length ? data.options : ["GET", "POST", "PUT", "DELETE"];
  const answerKey = String(data.answer ?? "GET").trim().toLowerCase();
  const [picked, setPicked] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const isRight = (o: string) => o.trim().toLowerCase() === answerKey;
  const choose = async (option: string) => {
    if (locked || busy || picked === option) return;
    setPicked(option);
    if (isRight(option)) { setLocked(true); await onAnswer(true); }
    else { await onAnswer(false); window.setTimeout(() => setPicked((p) => (p === option ? null : p)), 700); }
  };
  return (
    <article className="activity-card game-card">
      <div className="game-copy">
        <div className="game-head"><span className="game-kicker">QUICK CHECK</span><GameHud game={game} /></div>
        <h1 className="game-question">{data.question || unit.title}</h1>
        <p className="game-hint">Tap your answer — instant feedback.</p>
        <div className="tap-grid">{options.map((option, index) => {
          const cls = picked === option ? (isRight(option) ? "right" : "wrong") : locked && isRight(option) ? "right" : "";
          return <button key={option} className={`tap-option ${cls}`} aria-pressed={picked === option} onClick={() => void choose(option)} disabled={busy || locked}><span className="tap-key">{String.fromCharCode(65 + index)}</span><strong>{option}</strong>{cls === "right" && <Icon name="check" size={18} />}{cls === "wrong" && <Icon name="close" size={16} />}</button>;
        })}</div>
        {locked ? <div className="game-done"><p className="game-feedback win" role="status"><Icon name="check" size={15} />{data.explanation || "Nice — that's right."}</p><button className="primary-button continue-button" onClick={onContinue}>Continue<Icon name="arrow" size={17} /></button></div> : null}
        <ActionRow onSkip={onSkip} onWhy={onWhy} busy={busy} showSkip={!locked}><span className="challenge-spacer" /></ActionRow>
      </div>
    </article>
  );
}

function CodeFix({ unit, busy, onComplete, onFailure }: { unit: ContentUnit; busy: boolean; onComplete: () => void; onFailure: () => void }) {
  const data = unit.task_data ?? {};
  const options: string[] = data.options?.length ? data.options : ["GET", "POST", "PUT", "DELETE"];
  const answerKey = String(data.answer ?? "GET").toLowerCase();
  const [picked, setPicked] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const isRight = (o: string) => o.toLowerCase() === answerKey;
  const choose = (option: string) => {
    if (solved || busy) return;
    setPicked(option);
    if (isRight(option)) { setSolved(true); onComplete(); }
    else { onFailure(); window.setTimeout(() => setPicked((p) => (p === option ? null : p)), 700); }
  };
  return (
    <div className="game-workspace">
      <span className="game-kicker">REPAIR THE REQUEST</span>
      <p className="game-hint">{data.prompt || "Tap the method that fits what this request should do."}</p>
      <div className="code-window"><div className="code-window-bar"><span /><span /><span /><small>request.js</small></div>
        <pre><span className="code-muted">fetch(</span><span className="code-string">'/users'</span><span className="code-muted">, &#123; {data.field_label || "method"}: </span><span className={`code-slot ${picked ? (solved ? "right" : "wrong") : ""}`}>{picked ?? "???"}</span><span className="code-muted"> &#125;)</span></pre>
      </div>
      <div className="chip-row">{options.map((option) => {
        const cls = picked === option ? (isRight(option) ? "right" : "wrong") : solved && isRight(option) ? "right" : "";
        return <button key={option} className={`tap-chip ${cls}`} onClick={() => choose(option)} disabled={busy || solved}>{option}</button>;
      })}</div>
      {solved && <p className="game-feedback win" role="status"><Icon name="check" size={15} />{data.explanation || "Fixed — application evidence added."}</p>}
    </div>
  );
}

function ParsonsTask({ unit, busy, onComplete, onFailure }: { unit: ContentUnit; busy: boolean; onComplete: () => void; onFailure: () => void }) {
  const data = unit.task_data ?? {};
  const source: string[] = data.blocks?.length ? data.blocks : ["@app.get('/users')", "def get_users():", "    return users"];
  const solution: string[] = data.solution?.length ? data.solution : source;
  const shuffle = () => [...source].sort(() => Math.random() - 0.5);
  const [bank, setBank] = useState<string[]>(shuffle);
  const [stack, setStack] = useState<string[]>([]);
  const [verdict, setVerdict] = useState<"" | "right" | "wrong">("");
  const place = (block: string) => {
    if (busy || verdict === "right") return;
    const bi = bank.indexOf(block);
    if (bi < 0) return;
    const nb = [...bank]; nb.splice(bi, 1);
    const nextStack = [...stack, block];
    setBank(nb); setStack(nextStack); setVerdict("");
    if (nextStack.length === solution.length) {
      const ok = nextStack.every((b, i) => b === solution[i]);
      if (ok) { setVerdict("right"); onComplete(); } else { setVerdict("wrong"); onFailure(); }
    }
  };
  const unplace = (index: number) => {
    if (busy || verdict === "right") return;
    const block = stack[index];
    setStack(stack.filter((_, i) => i !== index));
    setBank((b) => [...b, block]);
    setVerdict("");
  };
  const reset = () => { if (verdict !== "right") { setBank(shuffle()); setStack([]); setVerdict(""); } };
  return (
    <div className="game-workspace">
      <span className="game-kicker">BUILD THE ORDER</span>
      <p className="game-hint">{data.prompt || "Tap the blocks in the order they should run."}</p>
      <div className={`parsons-stack ${verdict}`}>
        {stack.length === 0 && <span className="parsons-placeholder">Tap blocks below to build your answer…</span>}
        {stack.map((block, index) => <button key={`${block}-${index}`} className="parsons-placed" onClick={() => unplace(index)} disabled={busy || verdict === "right"}><em>{index + 1}</em><code>{block}</code></button>)}
      </div>
      <div className="parsons-bank">{bank.map((block, index) => <button key={`${block}-${index}`} className="parsons-chip" onClick={() => place(block)} disabled={busy}><code>{block}</code></button>)}</div>
      {verdict === "right" && <p className="game-feedback win" role="status"><Icon name="check" size={15} />That sequence runs correctly.</p>}
      {verdict === "wrong" && <div className="game-feedback miss" role="status"><Icon name="close" size={14} />Not quite — <button className="link-reset" onClick={reset}>reset and retry</button>.</div>}
    </div>
  );
}

function FillBlank({ unit, busy, onComplete, onFailure }: { unit: ContentUnit; busy: boolean; onComplete: () => void; onFailure: () => void }) {
  const data = unit.task_data ?? {};
  const options: string[] = data.options?.length ? data.options : ["WHERE", "ORDER BY", "SELECT", "JOIN"];
  const answerKey = String(data.answer ?? options[0]).toLowerCase();
  const template: string = data.template || "SELECT * FROM users ___ active = true;";
  const [before, after] = template.split("___");
  const [picked, setPicked] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const isRight = (o: string) => o.toLowerCase() === answerKey;
  const choose = (o: string) => {
    if (solved || busy) return;
    setPicked(o);
    if (isRight(o)) { setSolved(true); onComplete(); }
    else { onFailure(); window.setTimeout(() => setPicked((p) => (p === o ? null : p)), 700); }
  };
  return (
    <div className="game-workspace">
      <span className="game-kicker">FILL THE BLANK</span>
      <p className="game-hint">{data.prompt || "Tap the token that completes it."}</p>
      <div className="code-window"><div className="code-window-bar"><span /><span /><span /><small>{data.filename || "query.sql"}</small></div>
        <pre><span className="code-muted">{before}</span><span className={`code-slot ${picked ? (solved ? "right" : "wrong") : ""}`}>{picked ?? "___"}</span><span className="code-muted">{after || ""}</span></pre>
      </div>
      <div className="chip-row">{options.map((o) => {
        const cls = picked === o ? (isRight(o) ? "right" : "wrong") : solved && isRight(o) ? "right" : "";
        return <button key={o} className={`tap-chip ${cls}`} onClick={() => choose(o)} disabled={busy || solved}>{o}</button>;
      })}</div>
      {solved && <p className="game-feedback win" role="status"><Icon name="check" size={15} />{data.explanation || "Correct!"}</p>}
    </div>
  );
}

function BuildTask({ unit, busy, onComplete }: { unit: ContentUnit; busy: boolean; onComplete: () => void }) {
  const data = unit.task_data ?? {};
  const isEndpointBuild = data.interaction === "build_endpoint";
  const isUIBuild = data.interaction === "build_ui";
  
  const steps: string[] = data.steps?.length ? data.steps : ["Define the route", "Read the data", "Return a response"];
  const [done, setDone] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  
  // Endpoint Builder State
  const [method, setMethod] = useState(data.starter_method || "GET");
  const [path, setPath] = useState(data.starter_path || "/users");
  const [includeCollection, setIncludeCollection] = useState(true);
  const [tested, setTested] = useState(false);
  const endpointWorks = method === "GET" && path.trim() === "/users" && includeCollection;
  const sampleUsers = data.sample_users?.length ? data.sample_users : [{ id: 1, name: "Asha Patel" }, { id: 2, name: "Leo Chen" }];

  // UI Builder State
  const [hookType, setHookType] = useState("useState(0)");
  const [handler, setHandler] = useState("setCount(c => c + 1)");
  const [testedUI, setTestedUI] = useState(false);
  const [mockCount, setMockCount] = useState(0);
  const uiWorks = hookType === "useState(0)" && handler === "setCount(c => c + 1)";

  if (isEndpointBuild) return (
    <div className="challenge-workspace endpoint-workspace">
      <span className="section-kicker">SMALL BUILD · IN THIS APP</span>
      <p>{data.prompt || "Assemble the smallest useful read endpoint."} Your starter data and route are ready; adjust them, run the request, and save the working result.</p>
      <div className="endpoint-builder">
        <div className="endpoint-request">
          <label><span>METHOD</span><select value={method} onChange={(event) => { setMethod(event.target.value); setTested(false); }} disabled={busy}><option>GET</option><option>POST</option><option>PATCH</option><option>DELETE</option></select></label>
          <label className="endpoint-path"><span>ROUTE</span><input value={path} onChange={(event) => { setPath(event.target.value); setTested(false); }} aria-label="Endpoint route" disabled={busy} /></label>
        </div>
        <div className="endpoint-source">
          <div className="endpoint-panel-title"><span><i />{data.collection_name || "users"} collection</span><small>STARTER DATA · {sampleUsers.length} ROWS</small></div>
          <pre>{JSON.stringify(sampleUsers, null, 2)}</pre>
        </div>
        <label className="endpoint-return"><input type="checkbox" checked={includeCollection} onChange={(event) => { setIncludeCollection(event.target.checked); setTested(false); }} disabled={busy} /><span>Read the collection and return it as JSON</span></label>
        {tested && <div className={`endpoint-response ${endpointWorks ? "success" : "failure"}`} role="status">
          <div className="endpoint-panel-title"><span>{endpointWorks ? "200 · OK" : method === "GET" ? "404 · NOT FOUND" : "405 · METHOD NOT ALLOWED"}</span><small>{endpointWorks ? "APPLICATION/JSON" : "CHECK THE ROUTE"}</small></div>
          <pre>{endpointWorks ? JSON.stringify(sampleUsers, null, 2) : JSON.stringify({ detail: method === "GET" ? "No GET route was found at this path." : "This collection is read-only in the starter." }, null, 2)}</pre>
        </div>}
        <div className="endpoint-actions">
          {!tested || !endpointWorks ? <button className="primary-button" onClick={() => setTested(true)} disabled={busy}>Run endpoint<Icon name="arrow" size={17} /></button> : <button className="primary-button" onClick={() => { setFinished(true); onComplete(); }} disabled={busy || finished}>{finished ? "Build evidence saved" : "Save build evidence"}<Icon name="arrow" size={17} /></button>}
          {tested && endpointWorks && <span className="endpoint-pass"><Icon name="check" size={15} />Route returns the user collection.</span>}
        </div>
      </div>
      <small className="action-hint">You stay in SkillReels. A successful request preview is required before this counts as build evidence.</small>
    </div>
  );

  if (isUIBuild) return (
    <div className="challenge-workspace endpoint-workspace">
      <span className="section-kicker">SMALL BUILD · IN THIS APP</span>
      <p>{data.prompt || "Assemble a reactive UI component."} Connect the state and the event handler, then test the live component.</p>
      <div className="endpoint-builder">
        <div className="endpoint-request">
          <label><span>STATE HOOK</span><select value={hookType} onChange={(e) => { setHookType(e.target.value); setTestedUI(false); }} disabled={busy}><option>useState(0)</option><option>useRef(0)</option><option>useEffect()</option></select></label>
          <label className="endpoint-path"><span>ON CLICK</span><select value={handler} onChange={(e) => { setHandler(e.target.value); setTestedUI(false); }} disabled={busy}><option>setCount(c =&gt; c + 1)</option><option>count++</option><option>setCount(0)</option></select></label>
        </div>
        <div className="endpoint-source" style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}>
           {testedUI && uiWorks ? (
             <button style={{ padding: '10px 20px', fontSize: '16px', borderRadius: '8px', border: 'none', background: 'var(--violet)', color: '#fff', cursor: 'pointer' }} onClick={() => setMockCount(c => c + 1)}>
               Clicks: {mockCount}
             </button>
           ) : testedUI ? (
             <button style={{ padding: '10px 20px', fontSize: '16px', borderRadius: '8px', border: '1px solid red', background: 'transparent', color: 'red' }}>
               Broken Component
             </button>
           ) : (
             <div style={{ color: 'var(--text-quiet)', fontStyle: 'italic', fontSize: '12px' }}>Render preview will appear here</div>
           )}
        </div>
        <div className="endpoint-actions">
          {!testedUI || !uiWorks ? <button className="primary-button" onClick={() => { setTestedUI(true); setMockCount(0); }} disabled={busy}>Render component<Icon name="arrow" size={17} /></button> : <button className="primary-button" onClick={() => { setFinished(true); onComplete(); }} disabled={busy || finished}>{finished ? "Build evidence saved" : "Save build evidence"}<Icon name="arrow" size={17} /></button>}
          {testedUI && uiWorks && <span className="endpoint-pass"><Icon name="check" size={15} />Component is reactive. Try clicking it!</span>}
        </div>
      </div>
      <small className="action-hint">You stay in SkillReels. A successful render is required before this counts as build evidence.</small>
    </div>
  );

  return (
    <div className="challenge-workspace">
      <span className="section-kicker">SMALL BUILD</span>
      <p>{data.prompt || "Turn the idea into a concrete project step."}</p>
      <div className="build-steps">{steps.map((step, index) => <label key={step} className="build-step"><input type="checkbox" checked={done.includes(step)} onChange={(event) => setDone((current) => event.target.checked ? [...current, step] : current.filter((item) => item !== step))} disabled={busy} /><span className="build-step-num">0{index + 1}</span><span>{step}</span></label>)}</div>
      <button className="primary-button" onClick={() => { setFinished(true); onComplete(); }} disabled={busy || finished || done.length !== steps.length}>{finished ? "Build recorded" : "Mark build complete"}<Icon name="arrow" size={17} /></button>
      <small className="action-hint">Completing all steps records build evidence, not just viewing.</small>
    </div>
  );
}

function CareerTask({ unit, state, busy, onComplete }: { unit: ContentUnit; state: Partial<UserState> | null; busy: boolean; onComplete: () => void }) {
  const data = unit.task_data ?? {};
  const skills: string[] = data.skills_to_review?.length ? data.skills_to_review : ["REST APIs", "SQL", "Authentication"];
  const evidence = state?.skill_evidence ?? {};
  const [gap, setGap] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  return (
    <div className="career-workspace">
      <div className="career-callout"><Icon name="briefcase" size={19} /><span>{data.role || state?.declared_goal || DEFAULT_STATE.declared_goal}</span></div>
      <p>{data.prompt || "Compare the requirements of this role with the skills you have practiced."}</p>
      <div className="career-skill-list">{skills.map((skill) => <button key={skill} className={`career-skill ${gap === skill ? "chosen" : ""}`} onClick={() => setGap(skill)} aria-pressed={gap === skill}><span className={evidence[skill] ? "evidence-check complete" : "evidence-check"}>{evidence[skill] ? <Icon name="check" size={13} /> : null}</span><span>{skill}</span><small>{evidence[skill] ? "Practice evidence" : "Explore this skill"}</small></button>)}</div>
      <button className="primary-button" onClick={() => { setFinished(true); onComplete(); }} disabled={busy || !gap || finished}>{finished ? "Reflection recorded" : "Save career reflection"}<Icon name="arrow" size={17} /></button>
      <small className="action-hint">This records career exploration separately from technical skill evidence.</small>
    </div>
  );
}

function ChallengeActivity({ unit, state, busy, game, onComplete, onContinue, onFailure, onSkip, onWhy }: {
  unit: ContentUnit; state: Partial<UserState> | null; busy: boolean; game: GameStats;
  onComplete: () => void; onContinue: () => void; onFailure: () => void; onSkip: () => void; onWhy: () => void;
}) {
  const data = unit.task_data ?? {};
  const interaction = data.interaction || (unit.id === "api_03" ? "code_fix" : unit.evidence_type === "build" ? "build_steps" : data.blocks?.length ? "parsons" : "multiple_choice");
  const options: string[] = data.options?.length ? data.options : ["Use the backend endpoint", "Read the database from the browser", "Hard-code the response"];
  const answerKey = String(data.answer ?? options[0]).toLowerCase();
  const isRight = (o: string) => o.toLowerCase() === answerKey;
  const [picked, setPicked] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const [done, setDone] = useState(false);
  const complete = () => { setDone(true); onComplete(); };
  const choose = (o: string) => {
    if (solved || busy) return;
    setPicked(o);
    if (isRight(o)) { setSolved(true); complete(); }
    else { onFailure(); window.setTimeout(() => setPicked((p) => (p === o ? null : p)), 700); }
  };
  const skills: string[] = data.skills ?? [];

  let task: ReactNode;
  if (unit.type === "career_action") {
    task = <CareerTask unit={unit} state={state} busy={busy} onComplete={complete} />;
  } else if (unit.evidence_type === "build" || interaction === "build_steps" || interaction === "build_endpoint" || interaction === "build_ui") {
    task = <BuildTask unit={unit} busy={busy} onComplete={complete} />;
  } else if (interaction === "code_fix") {
    task = <CodeFix unit={unit} busy={busy} onComplete={complete} onFailure={onFailure} />;
  } else if (interaction === "parsons") {
    task = <ParsonsTask unit={unit} busy={busy} onComplete={complete} onFailure={onFailure} />;
  } else if (interaction === "fill_blank") {
    task = <FillBlank unit={unit} busy={busy} onComplete={complete} onFailure={onFailure} />;
  } else {
    task = <div className="game-workspace"><span className="game-kicker">{data.kicker || "MAKE THE CALL"}</span><p className="game-hint">{data.prompt || unit.title}</p><div className="tap-grid single">{options.map((option, index) => {
      const cls = picked === option ? (isRight(option) ? "right" : "wrong") : solved && isRight(option) ? "right" : "";
      return <button key={option} className={`tap-option ${cls}`} onClick={() => choose(option)} disabled={busy || solved}><span className="tap-key">{String.fromCharCode(65 + index)}</span><strong>{option}</strong>{cls === "right" && <Icon name="check" size={18} />}{cls === "wrong" && <Icon name="close" size={16} />}</button>;
    })}</div>{solved && <p className="game-feedback win" role="status"><Icon name="check" size={15} />{data.explanation || "Good call."}</p>}</div>;
  }

  return (
    <article className={`activity-card challenge-card game-challenge ${unit.type === "career_action" ? "career-card" : ""}`}>
      <div className="challenge-side"><div className="challenge-side-top"><span className="challenge-index">SkillReels / {String(unit.difficulty).padStart(2, "0")}</span><GameHud game={game} /></div><div className="challenge-graphic"><div className="graphic-ring ring-one" /><div className="graphic-ring ring-two" /><div className="graphic-core"><Icon name={unit.type === "career_action" ? "briefcase" : unit.evidence_type === "build" ? "spark" : "code"} size={30} /></div></div><div><span className="section-kicker">{unit.type === "career_action" ? "CONNECT TO A CAREER" : unit.evidence_type === "build" ? "MAKE SOMETHING" : "ACTIVE PRACTICE"}</span><h2>{unit.title}</h2><p>{unit.type === "career_action" ? "Explore where your learning could take you." : "A short action turns the idea into evidence."}</p></div><div className="challenge-side-footer">{skills.length > 0 && <div className="skill-tags">{skills.map((skill) => <span key={skill}>{skill}</span>)}</div>}</div></div>
      <div className="challenge-main">{task}{done ? <button className="primary-button continue-button" onClick={onContinue}>Continue<Icon name="arrow" size={17} /></button> : null}<ActionRow onSkip={onSkip} onWhy={onWhy} busy={busy} showSkip={!done}><span className="challenge-spacer" /></ActionRow></div>
    </article>
  );
}

function InterventionOffer({ recommendation, onTry, onSkip, onWhy, busy }: {
  recommendation: Recommendation; onTry: () => void; onSkip: () => void; onWhy: () => void; busy: boolean;
}) {
  const target = recommendation.unit;
  const title = target?.evidence_type === "build" ? "Turn this into stronger evidence?" : target?.evidence_type === "career_exploration" ? "Connect this work to your direction?" : recommendation.reason.primary === "goal_interest_bridge" ? "Bring your interests toward your goal?" : "Ready to use what you just watched?";
  return (
    <article className="intervention-card">
      <div className="intervention-mark"><Icon name="spark" size={20} /></div>
      <span className="section-kicker">{target?.evidence_type === "career_exploration" ? "A CONNECTION TO EXPLORE" : "A PAUSE FOR PRACTICE"}</span>
      <h1>{title}</h1>
      <p>{recommendation.reason.text}</p>
      <div className="intervention-suggestion"><div><small>SUGGESTED NEXT</small><strong>{recommendation.unit?.title}</strong></div><span>{Math.max(1, Math.round((recommendation.unit?.task_data?.duration_seconds ?? 120) / 60))} min</span></div>
      <div className="intervention-actions"><button className="primary-button" onClick={onTry}>Try this SkillReels<Icon name="arrow" size={17} /></button><button className="text-action" onClick={onSkip} disabled={busy}>Keep exploring</button><button className="why-link" onClick={onWhy}><Icon name="info" size={16} />Why now?</button></div>
      <small className="noncoercive-note">Your feed stays yours. You can skip this suggestion.</small>
    </article>
  );
}

function FeedPage({ queue, state, busyUnit, saved, reactions, muted, game, onSave, onMute, onEvent, onReaction, onAdvance, onContinue, onServed, onWhy, onLearnMore, servedIds, readingPause }: {
  queue: Recommendation[]; state: Partial<UserState> | null; busyUnit: string | null; saved: Set<string>; reactions: Record<string, Reaction>; muted: boolean; game: GameStats;
  onSave: (unit: ContentUnit) => void; onMute: () => void; onEvent: (unitId: string, type: EventType) => void;
  onReaction: (unitId: string, reaction: Reaction) => void;
  onAdvance: (unitId: string, type: EventType | null, nextRecommendationId?: string) => void;
  onServed: (recommendation: Recommendation) => void;
  onContinue: (unitId: string) => void;
  onWhy: (recommendation: Recommendation) => void; onLearnMore: (videoId: string) => void; servedIds: Set<string>; readingPause: boolean;
}) {
  const [activeId, setActiveId] = useState(queue.at(-1)?.recommendation_id ?? null);
  useEffect(() => {
    const sections = [...document.querySelectorAll<HTMLElement>(".feed-page[data-recommendation-id]")];
    if (!sections.length) return;
    const observer = new IntersectionObserver((entries) => {
      const mostVisible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (!mostVisible) return;
      const recommendationId = (mostVisible.target as HTMLElement).dataset.recommendationId;
      const recommendation = queue.find((item) => item.recommendation_id === recommendationId);
      if (!recommendation) return;
      setActiveId(recommendationId ?? null);
      onServed(recommendation);
    }, { threshold: [0.3, 0.55, 0.75] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [queue, onServed]);
  if (!queue.length) return null;
  return <div className="feed-scroll">
    {queue.map((recommendation, index) => {
      const unit = recommendation.unit;
      if (!unit) return null;
      const busy = busyUnit === unit.id || busyUnit === "__all__" || !servedIds.has(recommendation.recommendation_id);
      const active = recommendation.recommendation_id === activeId;
      const nextRecommendation = queue[index + 1];
      const isOptionalOffer = recommendation.policy_applied === "INTERVENTION_OFFERED" || recommendation.policy_applied === "BRIDGE_RECOMMENDATION";
      const common = {
        unit,
        busy,
        onSkip: () => onEvent(unit.id, isOptionalOffer ? "INTERVENTION_SKIPPED" : "SKIPPED"),
        onWhy: () => onWhy(recommendation),
      };
      return <section className={`feed-page ${unit.type === "video" ? "reel-feed-page" : ""}`} data-active={active ? "true" : "false"} data-recommendation-id={recommendation.recommendation_id} key={recommendation.recommendation_id}>
        {unit.type !== "video" && <div className="feed-page-heading"><div className="feed-heading-main"><span className="section-kicker">{recommendation.policy_applied === "EXPLORATION" ? "A NEW DIRECTION" : recommendation.policy_applied === "GUIDED_PATH" ? "CONTINUING YOUR PATH" : recommendation.policy_applied === "BRIDGE_RECOMMENDATION" ? "CONNECTING YOUR INTERESTS" : recommendation.policy_applied === "INTERVENTION_OFFERED" ? "A MOMENT FOR PRACTICE" : "PERSONALIZED FOR YOU"}</span><LearningTrail unit={unit} /></div><div className="feed-page-tools"><span className="feed-sequence">SkillReels / {String(index + 1).padStart(2, "0")}</span><SaveButton saved={saved.has(unit.id)} onClick={() => onSave(unit)} /></div></div>}
        {isOptionalOffer ? <InterventionOffer recommendation={recommendation} onTry={() => { const target = document.getElementById(`activity-${recommendation.recommendation_id}`); target?.classList.add("intervention-accepted"); requestAnimationFrame(() => target?.scrollIntoView({ behavior: "smooth", block: "center" })); }} onSkip={common.onSkip} onWhy={common.onWhy} busy={busy} /> : null}
        <div id={`activity-${recommendation.recommendation_id}`} className={isOptionalOffer ? "activity-reveal" : "activity-reveal open"}>
          {unit.type === "video" ? <VideoActivity {...common} active={active} saved={saved.has(unit.id)} liked={reactions[unit.id] === "liked"} disliked={reactions[unit.id] === "disliked"} signalNote={recommendation.reason.surface_note} onLike={() => onReaction(unit.id, "liked")} onDislike={() => onReaction(unit.id, "disliked")} onShare={() => onEvent(unit.id, "SHARED")} onSave={() => onSave(unit)} muted={muted} onMute={onMute} onComplete={() => onEvent(unit.id, "WATCH_COMPLETED")} onNextReel={(type) => onAdvance(unit.id, type, nextRecommendation?.recommendation_id)} onLearnMore={onLearnMore} /> : unit.type === "lesson" ? <LessonActivity unit={unit} busy={busy} onComplete={() => onEvent(unit.id, "LESSON_COMPLETED")} onSkip={common.onSkip} onWhy={common.onWhy} /> : unit.type === "quiz" ? <QuizActivity unit={unit} busy={busy} game={game} onAnswer={async (correct) => onEvent(unit.id, correct ? "TASK_COMPLETED" : "TASK_FAILED")} onContinue={() => onContinue(unit.id)} onSkip={common.onSkip} onWhy={common.onWhy} /> : <ChallengeActivity unit={unit} state={state} busy={busy} game={game} onComplete={() => onEvent(unit.id, "TASK_COMPLETED")} onContinue={() => onContinue(unit.id)} onFailure={() => onEvent(unit.id, "TASK_FAILED")} onSkip={common.onSkip} onWhy={common.onWhy} />}
        </div>
        {unit.type !== "video" && <div className="feed-page-bottom"><span className={readingPause && active ? "reading-pause" : ""} role={readingPause && active ? "status" : undefined} aria-live={readingPause && active ? "polite" : undefined}><Icon name={readingPause && active ? "pause" : "compass"} size={15} />{readingPause && active ? "Take a moment to read the feedback." : "One useful SkillReels at a time"}</span><button onClick={common.onWhy}><Icon name="info" size={15} />How this was chosen</button></div>}
      </section>;
    })}
  </div>;
}

function EvidenceCard({ label, value, icon, tone }: { label: string; value: number; icon: IconName; tone: string }) {
  return <article className={`evidence-card ${tone}`}><span className="evidence-icon"><Icon name={icon} size={18} /></span><strong>{value}</strong><span>{label}</span></article>;
}

function ProgressPath({ state }: { state: UserState }) {
  const goal = (state.declared_goal || "backend").toLowerCase();
  
  let heading = "From a concept to a working endpoint";
  let steps = [
    { label: "HTTP", note: "reel exposure", count: state.evidence_exposure },
    { label: "REST", note: "concept check", count: state.evidence_concept },
    { label: "Fix request", note: "application", count: state.evidence_application },
    { label: "Build GET /users", note: "build", count: state.evidence_build },
  ];

  if (goal.includes("frontend")) {
    heading = "From design to a working interface";
    steps = [
      { label: "React State", note: "reel exposure", count: state.evidence_exposure },
      { label: "Hooks Rules", note: "concept check", count: state.evidence_concept },
      { label: "Fix re-render", note: "application", count: state.evidence_application },
      { label: "Build Login UI", note: "build", count: state.evidence_build },
    ];
  } else if (goal.includes("data")) {
    heading = "From raw data to clean insights";
    steps = [
      { label: "Pipelines", note: "reel exposure", count: state.evidence_exposure },
      { label: "SQL Joins", note: "concept check", count: state.evidence_concept },
      { label: "Fix grouping", note: "application", count: state.evidence_application },
      { label: "Build Dashboard", note: "build", count: state.evidence_build },
    ];
  } else if (goal.includes("cloud")) {
    heading = "From a script to a deployed service";
    steps = [
      { label: "Containers", note: "reel exposure", count: state.evidence_exposure },
      { label: "Networking", note: "concept check", count: state.evidence_concept },
      { label: "Fix IAM role", note: "application", count: state.evidence_application },
      { label: "Deploy Cluster", note: "build", count: state.evidence_build },
    ];
  } else if (goal.includes("security")) {
    heading = "From vulnerabilities to secure systems";
    steps = [
      { label: "Auth Flow", note: "reel exposure", count: state.evidence_exposure },
      { label: "Encryption", note: "concept check", count: state.evidence_concept },
      { label: "Patch XSS", note: "application", count: state.evidence_application },
      { label: "Secure API", note: "build", count: state.evidence_build },
    ];
  }

  const current = steps.findIndex((step) => step.count === 0);
  return <section className="path-panel">
    <div className="path-heading"><span className="section-kicker">A ROUTE THAT ADDS UP</span><h2>{heading}</h2></div>
    <ol className="learning-path-track">{steps.map((step, index) => <li key={step.label} className={`${step.count > 0 ? "complete" : ""} ${index === current ? "current" : ""}`}>
      <span className="path-marker">{step.count > 0 ? "✓" : `0${index + 1}`}</span><strong>{step.label}</strong><small>{step.count > 0 ? `${step.count} recorded` : step.note}</small>
    </li>)}</ol>
  </section>;
}

function ProgressRule({ exposure, builds }: { exposure: number; builds: number }) {
  return <section className="progress-rule">
    <div className="path-heading"><span className="section-kicker">TIME ISN'T A MULTIPLIER</span><h2>Useful progress leaves evidence.</h2></div>
    <div className="progress-rule-compare">
      <div><small>30 MIN WATCHING</small><strong>Exposure only</strong><span>{exposure} views recorded · no skill proof from time alone</span></div>
      <Icon name="arrow" size={18} />
      <div><small>3 MIN BUILD</small><strong>Build evidence</strong><span>{builds} builds recorded · only after the task is completed</span></div>
    </div>
    <p>Example of the evidence rule, not a multiplier or a claim about this learner's minutes.</p>
  </section>;
}

function ProgressPage({ state, recommendation, onContinue , onDemo}: { state: Partial<UserState> | null; recommendation: Recommendation | null; onContinue: () => void ; onDemo?: () => void}) {
  const learner = { ...DEFAULT_STATE, ...(state ?? {}) };
  const skills = Object.entries(learner.skill_evidence ?? {}).sort((a, b) => b[1] - a[1]);
  const interests = Object.entries(learner.observed_interests ?? {}).filter(([, score]) => score > 0.05).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return <div className="product-page"><div className="page-intro"><span className="section-kicker">LEARNING THAT ADDS UP</span><h1>Evidence, not screen time.</h1><p>Each activity records a different kind of progress. Watching alone stays exposure; practice and builds show what you can do.</p></div>
    <div className="evidence-grid"><EvidenceCard label="Concepts understood" value={learner.evidence_concept ?? 0} icon="info" tone="tone-violet" /><EvidenceCard label="Applications practiced" value={learner.evidence_application ?? 0} icon="code" tone="tone-cyan" /><EvidenceCard label="Builds completed" value={learner.evidence_build ?? 0} icon="spark" tone="tone-green" /></div>
    <ProgressPath state={learner as UserState} />
    <ProgressRule exposure={learner.evidence_exposure ?? 0} builds={learner.evidence_build ?? 0} />
    <div className="progress-panels"><section className="surface-panel"><div className="section-heading"><div><span className="section-kicker">SKILL EVIDENCE</span><h2>What you've practiced</h2></div><span className="quiet-count">{skills.length} skills</span></div>{skills.length ? <div className="skill-evidence-list">{skills.map(([name, count]) => <div className="skill-evidence-row" key={name}><div><span>{name}</span><small>{count} completed {count === 1 ? "activity" : "activities"}</small></div><span className="evidence-level">{count >= 3 ? "Repeated" : count === 2 ? "Applied" : "Started"}</span></div>)}</div> : <div className="empty-inline"><Icon name="code" /><span>Complete a quiz or practice task to begin building skill evidence.</span></div>}</section>
      <section className="surface-panel interest-panel"><span className="section-kicker">OBSERVED INTERESTS</span><h2>Topics shaping your feed</h2>{interests.length ? <div className="interest-chips">{interests.map(([interest, score]) => <span key={interest}>{interest}<small>{Math.round(score * 100)}%</small></span>)}</div> : <div className="empty-inline"><Icon name="compass" /><span>SkillReels will learn from what you choose, complete, and skip.</span></div>}<div className="progress-note"><Icon name="info" size={16} /><span>These are prototype signals inferred from your activity, not a validated measure of ability.</span></div></section></div>
    
    <section className="surface-panel demo-panel" style={{ borderColor: "var(--violet)", marginBottom: "20px" }}><div className="section-heading"><div><span className="section-kicker" style={{ color: "var(--violet)" }}>JUDGE DEMO</span><h2>Live Execution Environment</h2></div></div><p style={{ fontSize: "13px", color: "var(--text-quiet)", marginBottom: "16px" }}>Skip the feed and directly launch the interactive build sandbox, where learners construct and test live code without ever leaving the app.</p><button className="primary-button" style={{ background: "var(--violet)", color: "#11140f", borderColor: "var(--violet)" }} onClick={onDemo}>Launch Build Sandbox</button></section><section className="next-step-panel"><div><span className="section-kicker">NEXT RECOMMENDATION</span><h2>{recommendation?.unit?.title || "Your next path is ready"}</h2><p>{recommendation?.reason?.text || "Continue exploring activities to build a clearer learner profile."}</p></div><button className="primary-button" onClick={onContinue}>Go to feed<Icon name="arrow" size={17} /></button></section>
  </div>;
}

function ProfilePage({ state, saved, onOpenFeed, onChangeGoal, onRevisit }: { state: Partial<UserState> | null; saved: SavedUnit[]; onOpenFeed: () => void; onChangeGoal: (goal: string) => void; onRevisit: (unit_id: string) => void }) {
  const learner = { ...DEFAULT_STATE, ...(state ?? {}) };
  const interests = Object.entries(learner.observed_interests ?? {}).filter(([, score]) => score > 0.05).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return <div className="product-page profile-page"><div className="page-intro"><span className="section-kicker">YOUR DIRECTION</span><h1>A path shaped by you.</h1><p>Your declared goal gives the feed direction. Your activity helps SkillReels find a useful route toward it.</p></div>
    <section className="profile-direction"><span className="profile-avatar">{(learner.declared_goal || "M").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div className="profile-direction-main"><span className="section-kicker">CURRENT GOAL</span><h2>{learner.declared_goal}</h2><p>Pick a different direction anytime - the feed re-ranks around it. Your observed interests stay separate.</p><div className="goal-picker">{GOAL_OPTIONS.map((goal) => <button key={goal} className={`goal-option ${learner.declared_goal === goal ? "active" : ""}`} onClick={() => onChangeGoal(goal)}>{goal}</button>)}</div></div><span className="direction-tag"><Icon name="briefcase" size={15} />In progress</span></section>
    <div className="progress-panels profile-panels"><section className="surface-panel"><span className="section-kicker">INTEREST SIGNALS</span><h2>What has caught your attention</h2>{interests.length ? <div className="interest-chips">{interests.map(([interest, score]) => <span key={interest}>{interest}<small>{Math.round(score * 100)}%</small></span>)}</div> : <p className="muted-paragraph">Your interest profile will take shape as you watch, try, and skip activities.</p>}</section><section className="surface-panel"><span className="section-kicker">ACTIVITY SUMMARY</span><h2>Progress so far</h2><div className="profile-summary"><div><strong>{learner.evidence_exposure}</strong><span>Exposure</span></div><div><strong>{learner.meaningful_actions}</strong><span>Useful actions</span></div><div><strong>{learner.task_failures}</strong><span>Attempts to retry</span></div></div></section></div>
    <section className="surface-panel saved-panel"><div className="section-heading"><div><span className="section-kicker">SAVED FOR LATER</span><h2>Activities to revisit</h2></div><button className="plain-link" onClick={onOpenFeed}>Explore feed<Icon name="arrow" size={16} /></button></div>{saved.length ? <div className="saved-list">{saved.map((item) => <button key={item.id} className="saved-row" onClick={() => onRevisit(item.id)}><span className="saved-type-icon"><Icon name={item.type === "video" ? "play" : item.type === "career_action" ? "briefcase" : "code"} size={17} /></span><div className="saved-row-text"><strong>{item.title}</strong><small>{item.type.replace(/_/g, " ")} · {item.evidence_type.replace(/_/g, " ")}</small></div></button>)}</div> : <div className="empty-inline"><Icon name="bookmark" /><span>Save a video, quiz, or challenge to keep it here.</span></div>}</section>
  </div>;
}

function SystemPanel({ state, recommendation, metrics, busy, onSimulate, onClose }: {
  state: Partial<UserState> | null; recommendation: Recommendation | null; metrics: ProgressMetrics | null; busy: boolean; onSimulate: (scenario: Scenario) => void; onClose: () => void;
}) {
  const learner = { ...DEFAULT_STATE, ...(state ?? {}) };
  const actionRate = (learner.total_items_served ?? 0) > 0 ? Math.round((learner.meaningful_actions ?? 0) / (learner.total_items_served ?? 1) * 100) : null;
  const policy = recommendation?.policy_applied || "NORMAL";
  const cmp = metrics?.comparison;
  const scenarios: { key: Scenario; title: string; detail: string }[] = [
    { key: "stall", title: "Endless watching", detail: "Seeds a same-topic streak; the engine offers a related in-app challenge." },
    { key: "divergence", title: "Goal and interest diverge", detail: "Returns the React-to-API bridge from the recommender." },
    { key: "disengagement", title: "Engagement drops", detail: "Records skips; the engine avoids the skipped topics when it can." },
    { key: "reversal", title: "Dopamine loop reversal", detail: "Seeds a 3-min watch→answer→apply path; progress-per-minute beats passive watching." },
    { key: "reset", title: "Cold start", detail: "Clears demo signals and asks the engine for an exploration reel." },
  ];
  return <aside className="system-panel"><div className="system-panel-header"><div><span className="section-kicker">JUDGE / DEBUG VIEW</span><h2>System signals</h2></div><button className="icon-button mobile-close" aria-label="Close system view" onClick={onClose}><Icon name="close" /></button></div>
    <section className="system-section"><span className="section-kicker">LEARNER MODEL</span><div className="system-goal"><small>Declared goal</small><strong>{learner.declared_goal}</strong></div><div className="system-stats"><div><strong>{learner.passive_streak}</strong><span>Passive streak</span></div><div><strong>{learner.recent_skip_streak}</strong><span>Recent skips</span></div><div><strong>{learner.total_items_served}</strong><span>Items served</span></div><div><strong>{learner.meaningful_actions}</strong><span>Useful actions</span></div></div></section>
    <section className="system-section"><span className="section-kicker">EVIDENCE COUNTS</span><div className="system-evidence"><div><span>Exposure</span><strong>{learner.evidence_exposure}</strong></div><div><span>Concept</span><strong>{learner.evidence_concept}</strong></div><div><span>Application</span><strong>{learner.evidence_application}</strong></div><div><span>Build</span><strong>{learner.evidence_build}</strong></div><div><span>Career exploration</span><strong>{learner.evidence_career}</strong></div></div></section>
    <ProgressRule exposure={learner.evidence_exposure ?? 0} builds={learner.evidence_build ?? 0} />
    <section className="system-section"><span className="section-kicker">RECOMMENDATION</span><div className="system-recommendation"><span className={`policy-chip ${policy.toLowerCase()}`}>{policy.replace(/_/g, " ")}</span><strong>{recommendation?.unit?.title || "No eligible unit"}</strong><p>{recommendation?.reason?.text || "Reset or add content to continue."}</p>{
      (() => {
        const comps = Object.entries(recommendation?.reason?.components || {}).filter(([key, value]) => key !== "interaction_count" && value !== 0);
        if (!comps.length) return null;
        return <details><summary>Ranking factors</summary><div className="factor-list">{comps.map(([key, value]) => <div key={key}><span>{key.replace(/_/g, " ")}</span><strong>{typeof value === "number" ? value.toFixed(2) : String(value)}</strong></div>)}</div></details>;
      })()
    }</div></section>
    <section className="system-section metric-section"><span className="section-kicker">PROGRESS, NOT SCREEN TIME</span>
      <div className="metric-grid">
        <div><strong>{metrics ? metrics.progress_score.toFixed(2) : "—"}</strong><span>progress score (evidence-weighted)</span></div>
        <div><strong>{metrics ? `${metrics.minutes_consumed}m` : "—"}</strong><span>time invested</span></div>
        <div><strong>{metrics ? metrics.progress_per_min.toFixed(2) : "—"}</strong><span>progress / minute</span></div>
        <div><strong>{actionRate === null ? "—" : `${actionRate}%`}</strong><span>actions / items served</span></div>
      </div>
      {cmp && <div className="reversal-compare">
        <div className="reversal-head"><span>Why 3 minutes can beat 30</span><strong className="reversal-x">{cmp.active_advantage_x}× more progress / min</strong></div>
        <div className="reversal-rows">
          <div className="reversal-row passive"><small>{cmp.passive.label}</small><span className="reversal-bar"><i style={{ width: `${Math.min(100, cmp.passive.per_min / cmp.active.per_min * 100)}%` }} /></span><b>{cmp.passive.per_min.toFixed(2)}/min</b></div>
          <div className="reversal-row active"><small>{cmp.active.label}</small><span className="reversal-bar"><i style={{ width: "100%" }} /></span><b>{cmp.active.per_min.toFixed(2)}/min</b></div>
        </div>
      </div>}
      <p>Progress is evidence weight (watch &lt; answer &lt; apply &lt; build), divided by real minutes — so a short active path outscores long passive watching. Run “Dopamine loop reversal” below to seed it live.</p>
    </section>
    <section className="system-section scenario-section"><div className="section-heading"><div><span className="section-kicker">SCENARIO SIMULATOR</span><h3>Run a PS6 situation</h3></div></div>{scenarios.map((scenario) => <button className="scenario-button" key={scenario.key} onClick={() => onSimulate(scenario.key)} disabled={busy}><span><strong>{scenario.title}</strong><small>{scenario.detail}</small></span><Icon name="chevron" size={17} /></button>)}</section>
  </aside>;
}

function EmptyFeed({ error, onRetry, onReset, busy }: { error: string | null; onRetry: () => void; onReset: () => void; busy: boolean }) {
  return <section className="empty-feed"><div className="empty-feed-icon"><Icon name={error ? "refresh" : "spark"} size={26} /></div><span className="section-kicker">{error ? "CONNECTION NEEDED" : "FEED COMPLETE"}</span><h1>{error ? "The feed couldn't load." : "You've reached the end of this demo feed."}</h1><p>{error || "Every unseen reel in this demo has been shown. Start a fresh demo run to explore the catalog again."}</p><div className="empty-feed-actions"><button className="primary-button" onClick={error ? onRetry : onReset} disabled={busy}>{error ? "Try again" : "Reset demo progress"}<Icon name={error ? "refresh" : "arrow"} size={16} /></button>{error && <button className="text-action" onClick={onReset} disabled={busy}>Reset demo instead</button>}</div></section>;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("feed");
  const [queue, setQueue] = useState<Recommendation[]>([]);
  const [systemResponse, setSystemResponse] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyUnit, setBusyUnit] = useState<string | null>(null);
  const [readingPause, setReadingPause] = useState(false);
  const [pendingAdvance, setPendingAdvance] = useState<string | null>(null);
  const [showSystem, setShowSystem] = useState(false);
  const [metrics, setMetrics] = useState<ProgressMetrics | null>(null);
  useEffect(() => {
    if (showSystem) void getMetrics().then(setMetrics).catch(() => {});
  }, [showSystem]);
  const [whyRecommendation, setWhyRecommendation] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [game, setGame] = useState({ streak: 0, best: 0, points: 0 });
  const [servedIds, setServedIds] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<SavedUnit[]>(() => {
    try { return JSON.parse(localStorage.getItem("SkillReels-saved-units") || "[]") as SavedUnit[]; }
    catch { return []; }
  });
  const [reactions, setReactions] = useState<Record<string, Reaction>>(() => {
    try { return JSON.parse(localStorage.getItem("SkillReels-reactions") || "{}") as Record<string, Reaction>; }
    catch { return {}; }
  });
  const feedRef = useRef<HTMLDivElement>(null);
  const servedEvents = useRef(new Set<string>());
  const mounted = useRef(false);

  const appendResponse = useCallback((response: FeedResponse, replace = false, silent = false) => {
    if (!silent) setSystemResponse(response);
    const recommendation = response.recommendation;
    if (!recommendation?.unit) return;
    setQueue((current) => {
      if (replace) return [recommendation];
      // Dedupe across the whole queue so prefetch and watch-advance can't append
      // the same reel twice.
      if (current.some((item) => item.unit?.id === recommendation.unit?.id)) return current;
      return [...current, recommendation];
    });
  }, []);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getFeed();
      appendResponse(response, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't load the feed.");
    } finally {
      setLoading(false);
    }
  }, [appendResponse]);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    void loadFeed();
  }, [loadFeed]);

  // A former career-reflection card may still exist in an already-open
  // browser session after a hot update. Remove it and reload the reel feed.
  useEffect(() => {
    if (!queue.some((recommendation) => recommendation.unit?.type === "career_action")) return;
    setQueue((current) => current.filter((recommendation) => recommendation.unit?.type !== "career_action"));
    void loadFeed();
  }, [queue, loadFeed]);

  useEffect(() => {
    localStorage.setItem("SkillReels-reactions", JSON.stringify(reactions));
  }, [reactions]);

  useEffect(() => {
    if (screen !== "feed" && feedRef.current) feedRef.current.scrollTop = 0;
  }, [screen]);

  useEffect(() => {
    if (!pendingAdvance || screen !== "feed") return;
    const target = [...(feedRef.current?.querySelectorAll<HTMLElement>("[data-recommendation-id]") ?? [])]
      .find((section) => section.dataset.recommendationId === pendingAdvance);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setPendingAdvance(null);
  }, [queue, pendingAdvance, screen]);

  const recordServed = useCallback((recommendation: Recommendation) => {
    const unit = recommendation.unit;
    if (!unit) return;
    const id = recommendation.recommendation_id || `served_${unit.id}`;
    if (servedEvents.current.has(id)) return;
    servedEvents.current.add(id);
    // Unlock the card's controls immediately. The UNIT_SERVED write happens in
    // the background, so a slow or failed request can never leave a reel's
    // like/save/next buttons permanently disabled.
    setServedIds((current) => new Set(current).add(id));
    void postEvent(unit.id, "UNIT_SERVED", id)
      .then((response) => {
        setSystemResponse((current) => ({ ...response, recommendation: current?.recommendation ?? recommendation }));
        // Keep one reel buffered below the active one so the feed scrolls like a
        // real short-form feed. Served reels are excluded server-side, so this
        // returns the NEXT unseen reel without marking anything watched. Appended
        // silently so the system view keeps showing the reel the learner is on.
        if (unit.type === "video") {
          void getFeed().then((next) => appendResponse(next, false, true)).catch(() => {});
        }
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not record this activity."));
  }, [appendResponse]);

  const handleEvent = async (unitId: string, type: EventType, advance = false) => {
    if (busyUnit) return;
    setBusyUnit(unitId);
    setError(null);
    try {
      const response = await postEvent(unitId, type);
      const isFeedSignal = type === "LIKED" || type === "DISLIKED" || type === "REACTION_CLEARED" || type === "SHARED";
      if (isFeedSignal) {
        setSystemResponse((current) => ({ ...response, recommendation: current?.recommendation ?? queue.at(-1) ?? response.recommendation }));
        return;
      }
      setSystemResponse(response);
      // Game feel: a correct activity builds a streak (bonus points per step);
      // a wrong attempt breaks the streak.
      if (type === "TASK_COMPLETED") setGame((g) => { const streak = g.streak + 1; return { streak, best: Math.max(g.best, streak), points: g.points + 10 + (streak - 1) * 5 }; });
      else if (type === "TASK_FAILED") setGame((g) => ({ ...g, streak: 0 }));
      if (type !== "TASK_FAILED") {
        // Reels advance immediately; a correct game answer gets a short beat to
        // show the win, a lesson a little longer to read the recap.
        const pauseMs = type === "TASK_COMPLETED" ? 1500 : type === "LESSON_COMPLETED" ? 2500 : 0;
        if (pauseMs) {
          setReadingPause(true);
          await new Promise((resolve) => window.setTimeout(resolve, pauseMs));
        }
        appendResponse(response);
        // Lessons flow on automatically; a completed quiz/challenge/build waits
        // for the learner to tap "Continue" so they're never left with no way forward.
        if ((advance || type === "LESSON_COMPLETED") && response.recommendation.unit) {
          setPendingAdvance(response.recommendation.recommendation_id);
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save that activity.");
    } finally {
      setReadingPause(false);
      setBusyUnit(null);
    }
  };

  const handleAdvance = (unitId: string, type: EventType | null, nextRecommendationId?: string) => {
    if (type) void handleEvent(unitId, type, true);
    else if (nextRecommendationId) setPendingAdvance(nextRecommendationId);
  };

  // Explicit "Continue" from a finished activity: scroll to the next card if one
  // was already queued, otherwise fetch the next unit so the feed never dead-ends.
  const handleContinue = (unitId: string) => {
    const idx = queue.findIndex((item) => item.unit?.id === unitId);
    const next = idx >= 0 ? queue[idx + 1] : queue.at(-1);
    if (next?.recommendation_id) setPendingAdvance(next.recommendation_id);
    else void loadFeed();
  };

  const handleChangeGoal = async (goal: string) => {
    if (goal === state?.declared_goal) return;
    setError(null);
    try {
      const response = await setGoal(goal);
      setSystemResponse(response);
      servedEvents.current.clear();
      setServedIds(new Set());
      appendResponse(response, true);
      setScreen("feed");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't change your goal.");
    }
  };

  const handleReaction = (unitId: string, reaction: Reaction) => {
    const current = reactions[unitId];
    const next = current === reaction ? null : reaction;
    setReactions((value) => {
      const updated = { ...value };
      if (next) updated[unitId] = next;
      else delete updated[unitId];
      return updated;
    });
    void handleEvent(unitId, next === "liked" ? "LIKED" : next === "disliked" ? "DISLIKED" : "REACTION_CLEARED");
  };

  const handleLearningOnDemand = async (videoId: string) => {
    if (busyUnit) return;
    setBusyUnit("__all__");
    setError(null);
    try {
      const response = await getOptionalLearning(videoId);
      appendResponse(response);
      if (response.recommendation.unit) setPendingAdvance(response.recommendation.recommendation_id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't open the optional lesson.");
    } finally {
      setBusyUnit(null);
    }
  };

  const handleScenario = async (scenario: Scenario) => {
    setLoading(true);
    setError(null);
    try {
      const response = await simulateScenario(scenario);
      servedEvents.current.clear();
      setServedIds(new Set());
      appendResponse(response, true);
      if (response.recommendation.unit) setPendingAdvance(response.recommendation.recommendation_id);
      void getMetrics().then(setMetrics).catch(() => {});
      setScreen("feed");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not run that scenario.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevisit = async (unit_id: string) => {
    if (loading || busyUnit === "__all__") return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/unit/${unit_id}`);
      if (!res.ok) throw new Error("Saved activity not found.");
      const response = await res.json();
      const mockRecommendation: Recommendation = {
        recommendation_id: "revisit-" + Date.now(),
        policy_applied: "REVISIT",
        unit: response,
        reason: {
          primary: "revisit",
          text: "Revisiting a saved activity.",
          signals: ["User launched from Saved items"],
          trigger: "USER_REVISIT",
          components: {}
        }
      };
      setQueue((q) => [...q, mockRecommendation]);
      setPendingAdvance(mockRecommendation.recommendation_id);
      setScreen("feed");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't load the saved activity.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSave = (unit: ContentUnit) => {
    setSaved((current) => {
      const exists = current.some((item) => item.id === unit.id);
      const next = exists
        ? current.filter((item) => item.id !== unit.id)
        : [...current, { id: unit.id, title: unit.title, type: unit.type, evidence_type: unit.evidence_type }];
      localStorage.setItem("SkillReels-saved-units", JSON.stringify(next));
      return next;
    });
  };

  const activeRecommendation = systemResponse?.recommendation ?? queue.at(-1) ?? null;
  const state = systemResponse?.state ?? null;
  const queuedIds = useMemo(() => new Set(queue.map((recommendation) => recommendation.recommendation_id)), [queue]);
  const readyServedIds = useMemo(() => new Set([...servedIds, ...[...queuedIds].filter((id) => !id)]), [servedIds, queuedIds]);

  return (
    <div className="app-frame">
      <Navigation active={screen} onChange={setScreen} />
      <main className="workspace">
        <Header screen={screen} state={state} showSystem={showSystem} onToggleSystem={() => setShowSystem((value) => !value)} />
        {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss error"><Icon name="close" size={16} /></button></div>}
        <div className={`workspace-body ${showSystem ? "with-system" : ""}`}>
          <section className="primary-pane" ref={feedRef}>
            {screen === "feed" && (loading && !queue.length ? <div className="loading-state"><span className="loading-spinner" /><p>Finding your next SkillReels...</p></div> : !activeRecommendation?.unit ? <EmptyFeed error={error} onRetry={() => void loadFeed()} onReset={() => void handleScenario("reset")} busy={loading} /> : <FeedPage queue={queue} state={state} busyUnit={loading ? "__all__" : busyUnit} saved={new Set(saved.map((item) => item.id))} reactions={reactions} muted={muted} game={game} onSave={toggleSave} onMute={() => setMuted((value) => !value)} onEvent={(id, type) => void handleEvent(id, type)} onAdvance={handleAdvance} onContinue={handleContinue} onServed={recordServed} onReaction={handleReaction} onWhy={setWhyRecommendation} onLearnMore={(id) => void handleLearningOnDemand(id)} servedIds={readyServedIds} readingPause={readingPause} />)}
            {screen === "progress" && <ProgressPage state={state} recommendation={activeRecommendation} onContinue={() => setScreen("feed")} onDemo={() => handleRevisit(state?.declared_goal?.toLowerCase().includes("frontend") ? "fe_build_01" : "api_04")} />}
            {screen === "profile" && <ProfilePage state={state} saved={saved} onOpenFeed={() => setScreen("feed")} onChangeGoal={(goal) => void handleChangeGoal(goal)} onRevisit={handleRevisit} />}
          </section>
          {showSystem && <SystemPanel state={state} recommendation={activeRecommendation} metrics={metrics} busy={loading || Boolean(busyUnit)} onSimulate={(scenario) => void handleScenario(scenario)} onClose={() => setShowSystem(false)} />}
        </div>
      </main>
      {whyRecommendation && <WhyPanel recommendation={whyRecommendation} state={state} onClose={() => setWhyRecommendation(null)} />}
      <nav className="mobile-navigation" aria-label="Main navigation">{(["feed", "progress", "profile"] as Screen[]).map((item) => <button key={item} className={screen === item ? "active" : ""} onClick={() => setScreen(item)}><Icon name={item === "feed" ? "home" : item === "progress" ? "spark" : "profile"} size={19} /><span>{item === "feed" ? "Feed" : item === "progress" ? "Progress" : "Profile"}</span></button>)}</nav>
    </div>
  );
}
