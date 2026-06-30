import React, { useEffect, useState, useCallback } from 'react';
import { Flame } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { unlockAchievement } from '../lib/achievements';
import { getExerciseVideoEmbed } from '../lib/exerciseVideo';
import MonthlyCheckIn from '../components/MonthlyCheckIn';
import WeeklyScheduleView from './WeeklyScheduleView';
import { getWeekSchedule } from '../lib/api';
import { getSessionForToday, DAY_ORDER_MON, DAY_NAMES_JS, getWeekNum } from '../lib/schedule';

/*
  ─── SUPABASE SQL — run once in the SQL editor ─────────────────────────────

  create table session_completions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    session_name text not null,
    completed_at timestamptz not null default now(),
    week_number int,
    plan_id uuid
  );
  alter table session_completions enable row level security;
  create policy "session_completions_all" on session_completions
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  grant all on session_completions to authenticated;

  create table lift_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    exercise_name text not null,
    weight_kg numeric(5,2) not null,
    logged_at timestamptz not null default now(),
    session_name text,
    week_number int
  );
  alter table lift_logs enable row level security;
  create policy "lift_logs_all" on lift_logs
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  grant all on lift_logs to authenticated;

  ───────────────────────────────────────────────────────────────────────────
*/

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────

const C = {
  surface:   '#131119',
  surface2:  '#0C0A0F',
  bone:      '#F3F1ED',
  ash:       '#87858E',
  ashDim:    '#5C5A62',
  glow:      'rgba(255,79,196,0.5)',
  glowLine:  'rgba(255,79,196,0.22)',
  ease:      'cubic-bezier(0.16,1,0.3,1)',
};

const cardStyle = {
  background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 16,
  boxShadow: `0 14px 36px -18px rgba(0,0,0,0.55), 0 0 30px -18px ${C.glow}`,
};

const pinkCardStyle = {
  background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
  border: '1px solid rgba(255,79,196,0.1)',
  borderRadius: 14,
  boxShadow: `0 8px 18px -10px rgba(0,0,0,0.55), 0 0 22px -14px rgba(255,79,196,0.55), 0 1px 0 rgba(255,255,255,0.03) inset`,
};

const btnPrimary = {
  background: 'linear-gradient(160deg, #18151F, #100E15)',
  border: `1px solid ${C.glowLine}`,
  color: C.bone,
  borderRadius: 9,
  padding: '13px 20px',
  fontFamily: "'Oswald', sans-serif",
  fontWeight: 600,
  fontSize: 12.5,
  letterSpacing: '1.2px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  boxShadow: `0 0 18px -10px ${C.glow}`,
  transition: `transform 0.2s ${C.ease}`,
};

const btnGhost = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.1)',
  color: C.ash,
  borderRadius: 10,
  padding: 15,
  fontFamily: "'Oswald', sans-serif",
  fontWeight: 600,
  fontSize: 12.5,
  letterSpacing: '1.2px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  width: '100%',
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function localDayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function calcStreak(completions, trainingDays) {
  if (!completions?.length || !trainingDays) return 0;

  function weekMonday(date) {
    const d = new Date(date);
    const daysSinceMonday = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - daysSinceMonday);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  const weekCounts = {};
  completions.forEach(c => {
    const k = weekMonday(new Date(c.completed_at));
    weekCounts[k] = (weekCounts[k] || 0) + 1;
  });

  const currentKey = weekMonday(new Date());

  function subWeek(key) {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d - 7);
    return dt.getFullYear() + '-' +
      String(dt.getMonth() + 1).padStart(2, '0') + '-' +
      String(dt.getDate()).padStart(2, '0');
  }

  let checkKey = (weekCounts[currentKey] || 0) >= trainingDays
    ? currentKey
    : subWeek(currentKey);

  let streak = 0;
  while ((weekCounts[checkKey] || 0) >= trainingDays) {
    streak++;
    checkKey = subWeek(checkKey);
  }
  return streak;
}

function getProgress(startDateStr) {
  if (!startDateStr) return 0;
  const start = new Date(startDateStr);
  const daysIn = Math.max(0, Math.floor((Date.now() - start) / 86400000));
  return Math.min(1, daysIn / 84);
}

function daysSince(isoStr) {
  return Math.floor((Date.now() - new Date(isoStr)) / 86400000);
}

const FOCUS_MAP = {
  push:     'Chest & Shoulders',
  pull:     'Back & Biceps',
  upper:    'Upper Body',
  lower:    'Lower Body',
  full:     'Full Body',
  legs:     'Legs & Glutes',
  chest:    'Chest',
  back:     'Back',
  shoulders:'Shoulders',
  arms:     'Arms',
  core:     'Core',
};
function inferFocus(sessionName) {
  const first = (sessionName || '').split(/\s+/)[0].toLowerCase();
  return FOCUS_MAP[first] || (sessionName?.split(/\s+/)[0]) || 'Mixed';
}

// ─── COUNT-UP HOOK ───────────────────────────────────────────────────────────

function useCountUp(target, { delay = 500, duration = 900 } = {}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target == null || target === 0) return;
    const timer = setTimeout(() => {
      const t0 = performance.now();
      function tick(now) {
        const p = Math.min((now - t0) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(eased * target));
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timer);
  }, [target, delay, duration]);
  return val;
}

// ─── PROGRESS RING — purple/violet gradient, not pink ────────────────────────

function ProgressRing({ startDate }) {
  const weekNum  = getWeekNum(startDate);
  const progress = getProgress(startDate);
  const size = 130;
  const sw   = 8;
  const r    = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const cx   = size / 2;
  const cy   = size / 2;

  const [animOffset, setAnimOffset] = useState(circ);
  useEffect(() => {
    const t = setTimeout(() => setAnimOffset(circ * (1 - progress)), 500);
    return () => clearTimeout(t);
  }, [progress, circ]);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#6B1FB8" />
            <stop offset="45%"  stopColor="#9B2FE0" />
            <stop offset="100%" stopColor="#C961F5" />
          </linearGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.surface} strokeWidth={sw} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={sw + 1}
          strokeDasharray={circ}
          strokeDashoffset={animOffset}
          strokeLinecap="round"
          style={{
            filter: 'drop-shadow(0 0 10px rgba(155,47,224,0.6)) drop-shadow(0 0 22px rgba(201,97,245,0.3))',
            transition: `stroke-dashoffset 1.2s ${C.ease}`,
          }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 32, fontWeight: 600, color: C.bone, lineHeight: 1 }}>
          {weekNum}
        </div>
        <div style={{ fontSize: 10, letterSpacing: '1px', color: C.ashDim, textTransform: 'uppercase', marginTop: 4 }}>
          of 12
        </div>
      </div>
    </div>
  );
}

// ─── WEIGHT STAT CARD ────────────────────────────────────────────────────────

function WeightStatCard({ currentWeight }) {
  const intPart = currentWeight != null ? Math.round(currentWeight * 10) : 0;
  const counted = useCountUp(intPart, { delay: 500, duration: 900 });
  const display = currentWeight != null
    ? (Number.isInteger(currentWeight) ? counted : (counted / 10).toFixed(1))
    : '—';

  return (
    <div style={{ ...pinkCardStyle, padding: '18px 24px', textAlign: 'center', minWidth: 130 }}>
      <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 30, fontWeight: 600, lineHeight: 1, color: C.bone }}>
        {currentWeight != null ? display : '—'}
      </div>
      <div style={{ fontSize: 10.5, letterSpacing: '1.2px', color: C.ashDim, textTransform: 'uppercase', marginTop: 8 }}>
        Current Weight
      </div>
    </div>
  );
}

// ─── STREAK BADGE ────────────────────────────────────────────────────────────

function StreakBadge({ streak }) {
  const counted   = useCountUp(streak, { delay: 500, duration: 900 });
  const isActive  = streak > 0;
  const flameSize = streak >= 8 ? 40 : streak >= 3 ? 36 : 32;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <span className={streak >= 30 ? 'flame-pulse' : ''} style={{
        color: isActive ? C.bone : C.ashDim,
        filter: isActive ? `drop-shadow(0 0 10px ${C.glow})` : 'none',
      }}>
        <Flame size={flameSize} strokeWidth={1.5} />
      </span>
      <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 24, fontWeight: 600, color: C.bone, lineHeight: 1 }}>
        {counted}
      </div>
      <div style={{ fontSize: 10.5, letterSpacing: '1.2px', color: C.ashDim, textTransform: 'uppercase' }}>
        Week Streak
      </div>
      {streak === 0 && (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: C.ashDim, textAlign: 'center', maxWidth: 80 }}>
          Complete a session to begin
        </div>
      )}
    </div>
  );
}

// ─── MOTIVATIONAL LINE ───────────────────────────────────────────────────────

function MotivationalLine({ streak, currentWeight, startingWeight, targetWeight, weekNum }) {
  let line = `Week ${weekNum} of 12. Stay the course.`;

  if (streak >= 7) {
    line = `${streak} weeks on target. You're building something real.`;
  } else if (
    currentWeight != null &&
    startingWeight != null &&
    targetWeight != null &&
    startingWeight !== currentWeight
  ) {
    const lossGoal = targetWeight < startingWeight;
    const gainGoal = targetWeight > startingWeight;
    const progress = lossGoal
      ? startingWeight - currentWeight
      : gainGoal
        ? currentWeight - startingWeight
        : 0;
    if (progress > 0.05) {
      line = `You're ${progress.toFixed(1)}kg into your goal. Keep going.`;
    }
  }

  return (
    <p style={{
      textAlign: 'center',
      fontStyle: 'italic',
      color: '#C4C2C9',
      fontSize: 14.5,
      fontFamily: "'Inter', sans-serif",
      margin: '0 0 28px',
      opacity: 0,
      animation: `todayFadeUp 0.6s ${C.ease} 0.22s forwards`,
    }}>
      {line}
    </p>
  );
}

// ─── REST DAY CARD ───────────────────────────────────────────────────────────

function RestDayCard({ tomorrowSession }) {
  return (
    <div style={{ ...cardStyle, padding: '24px 20px', marginBottom: 12 }}>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: '1.8px', textTransform: 'uppercase', color: C.ash, marginBottom: 12 }}>
        Rest Day
      </div>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: '#C4C2C9', lineHeight: 1.7, margin: '0 0 16px' }}>
        Recovery is part of the programme. Stay active, hit your nutrition targets, and come back strong tomorrow.
      </p>
      {tomorrowSession && (
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: C.ashDim }}>
          TOMORROW: {tomorrowSession.name}
        </div>
      )}
    </div>
  );
}

// ─── STAT CHIPS ──────────────────────────────────────────────────────────────

const GOAL_LABELS = {
  fat_loss:        'FAT LOSS',
  muscle_building: 'LEAN BULK',
  maintenance:     'RECOMP',
};

function StatChip({ label, value }) {
  return (
    <div style={{
      background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
      border: `1px solid ${C.glowLine}`,
      borderRadius: 10,
      padding: '12px 20px',
      boxShadow: `0 0 18px -10px ${C.glow}`,
    }}>
      <div style={{ fontSize: 10, letterSpacing: '1.3px', color: C.ashDim, textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 14, marginTop: 4, color: C.bone }}>
        {value}
      </div>
    </div>
  );
}

function formatGoal(goal) {
  const labels = {
    'muscle_building': 'MUSCLE BUILDING',
    'lean_bulk':       'LEAN BULK',
    'fat_loss':        'FAT LOSS',
    'maintenance':     'MAINTENANCE',
    'recomposition':   'RECOMPOSITION',
  };
  return labels[goal?.toLowerCase()] || (goal ? goal.toUpperCase().replace(/_/g, ' ') : 'LEAN BULK');
}

// ─── MISSION CARD ────────────────────────────────────────────────────────────

function TagPill({ children }) {
  return (
    <span style={{
      background: C.surface2,
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 6,
      padding: '6px 12px',
      fontFamily: "'Inter', sans-serif",
      fontSize: 11,
      letterSpacing: '0.8px',
      textTransform: 'uppercase',
      color: C.ash,
    }}>
      {children}
    </span>
  );
}

function MissionCard({ session, library, sessionLength, weekNum, onComplete, onOpenLogbook, videoMap = {} }) {
  const [open, setOpen]                         = useState(false);
  const [expandedEx, setExpandedEx]             = useState(null);
  const [watchingVideo, setWatchingVideo]       = useState(null);
  const [completing, setCompleting]             = useState(false);
  const [completed, setCompleted]               = useState(false);
  const [logNudgeDismissed, setLogNudgeDismissed] = useState(false);
  const [hasBeenOpened, setHasBeenOpened]       = useState(
    () => localStorage.getItem('missionCardOpened') === 'true'
  );

  function handleToggle() {
    if (!open && !hasBeenOpened) {
      setHasBeenOpened(true);
      localStorage.setItem('missionCardOpened', 'true');
    }
    setOpen(o => !o);
  }

  const exCount  = session.exercises?.length ?? 0;
  const duration = sessionLength ? `${sessionLength} min` : null;
  const focus    = inferFocus(session.name);

  async function handleComplete() {
    setCompleting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCompleting(false); return; }
    const { error } = await supabase.from('session_completions').insert({
      user_id: user.id,
      session_name: session.name,
      completed_at: new Date().toISOString(),
      week_number: weekNum,
    });
    setCompleting(false);
    if (!error) { setCompleted(true); onComplete?.(); }
  }

  return (
    <div style={{ ...cardStyle, marginBottom: 12 }}>
      {/* Collapsible header */}
      <button
        type="button"
        onClick={handleToggle}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '20px 20px 12px', textAlign: 'left' }}
      >
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '1.8px', textTransform: 'uppercase', color: C.bone, marginBottom: 6 }}>
          Today's Mission
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 24, textTransform: 'uppercase', color: C.bone, lineHeight: 1 }}>
            {session.name}
          </div>
          <span
            className={!open && !hasBeenOpened ? 'pulse-expand' : ''}
            style={{ color: !open && !hasBeenOpened ? C.bone : C.ashDim, fontSize: 22, fontWeight: 600, paddingTop: 2 }}
          >
            {open ? '−' : '+'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <TagPill>{exCount} exercises</TagPill>
          {duration && <TagPill>{duration}</TagPill>}
          <TagPill>{focus}</TagPill>
        </div>
      </button>

      {/* Open Logbook — always visible */}
      <div style={{ padding: '10px 20px 16px' }}>
        <button
          type="button"
          onClick={() => onOpenLogbook?.(session.name)}
          style={{ ...btnPrimary, display: 'inline-block' }}
        >
          Open Logbook →
        </button>
      </div>

      {/* Expanded exercise list */}
      {open && (
        <div style={{ padding: '0 20px 20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
            <thead>
              <tr>
                {['Exercise', 'Sets', 'Reps', 'Rest'].map(h => (
                  <th key={h} style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 10.5,
                    letterSpacing: '1.2px',
                    color: C.ashDim,
                    textTransform: 'uppercase',
                    padding: '12px 8px 12px 0',
                    textAlign: 'left',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(session.exercises || []).map((ex, i) => {
                const info       = library[ex.ex] || {};
                const name       = info.name || ex.ex;
                const isOpen     = expandedEx === i;
                const hasCue     = !!(info.cues || info.common_mistakes || info.injury_modifications);
                const videoSrc   = getExerciseVideoEmbed(videoMap[ex.ex]);
                const isWatching = watchingVideo === i;
                return (
                  <React.Fragment key={i}>
                    <tr
                      style={{
                        background: i % 2 === 0 ? C.surface : C.surface2,
                        cursor: hasCue ? 'pointer' : 'default',
                        borderTop: '1px solid rgba(255,255,255,0.04)',
                      }}
                      onClick={() => hasCue && setExpandedEx(isOpen ? null : i)}
                    >
                      <td style={{ fontSize: 14, color: '#C4C2C9', padding: '16px 8px 16px 0', verticalAlign: 'top' }}>
                        {name}
                        {hasCue && <span style={{ color: C.ashDim, fontSize: 11, marginLeft: 6 }}>{isOpen ? '▲' : '▼'}</span>}
                        {videoSrc && (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setWatchingVideo(isWatching ? null : i); }}
                            style={{
                              display: 'block',
                              marginTop: 6,
                              background: 'none',
                              border: `1px solid ${C.glowLine}`,
                              color: C.bone,
                              fontFamily: "'Oswald', sans-serif",
                              fontSize: 11,
                              fontWeight: 600,
                              letterSpacing: '1px',
                              textTransform: 'uppercase',
                              padding: '4px 10px',
                              cursor: 'pointer',
                              borderRadius: 6,
                            }}
                          >
                            {isWatching ? '▼ Hide' : '▶ Watch Form'}
                          </button>
                        )}
                      </td>
                      <td style={{ fontSize: 14, color: '#C4C2C9', padding: '16px 8px', textAlign: 'center', verticalAlign: 'top' }}>{ex.sets}</td>
                      <td style={{ fontSize: 14, color: '#C4C2C9', padding: '16px 8px', textAlign: 'center', verticalAlign: 'top' }}>{ex.reps}</td>
                      <td style={{ fontSize: 14, color: '#C4C2C9', padding: '16px 8px', textAlign: 'center', verticalAlign: 'top' }}>{ex.rest}</td>
                    </tr>
                    {isOpen && hasCue && (
                      <tr style={{ background: C.surface2, borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                        <td colSpan={4} style={{ padding: '14px 0 18px', fontSize: 13, color: C.ash, lineHeight: 1.6 }}>
                          {info.cues            && <div style={{ marginBottom: 4 }}><span style={{ color: C.bone, fontWeight: 600 }}>Cue: </span>{info.cues}</div>}
                          {info.common_mistakes && <div style={{ marginBottom: 4 }}><span style={{ color: C.bone, fontWeight: 600 }}>Avoid: </span>{info.common_mistakes}</div>}
                          {info.injury_modifications && <div><span style={{ color: C.bone, fontWeight: 600 }}>Mod: </span>{info.injury_modifications}</div>}
                        </td>
                      </tr>
                    )}
                    {isWatching && videoSrc && (
                      <tr style={{ background: C.surface2 }}>
                        <td colSpan={4} style={{ padding: '0 0 14px' }}>
                          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
                            <iframe
                              src={videoSrc}
                              title={`${name} form guide`}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* Session complete */}
          <div style={{ marginTop: 20 }}>
            {!completed ? (
              <button
                type="button"
                onClick={handleComplete}
                disabled={completing}
                style={{
                  width: '100%',
                  background: 'linear-gradient(160deg, #18151F, #100E15)',
                  border: `1px solid ${C.glowLine}`,
                  color: C.bone,
                  borderRadius: 10,
                  padding: 16,
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: '1.8px',
                  textTransform: 'uppercase',
                  cursor: completing ? 'default' : 'pointer',
                  boxShadow: `0 10px 28px -8px ${C.glow}`,
                  opacity: completing ? 0.6 : 1,
                }}
              >
                {completing ? '…' : 'Session Complete'}
              </button>
            ) : (
              <div>
                <div style={{ textAlign: 'center', padding: '16px 0 12px', fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: '1px', color: C.bone }}>
                  ✓ Session logged.
                </div>
                {!logNudgeDismissed && (
                  <div style={{
                    background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 10,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}>
                    <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: '#C4C2C9' }}>
                      Log your working weights?
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => onOpenLogbook?.(session.name)}
                        style={{ ...btnPrimary, padding: '8px 16px', fontSize: 12 }}
                      >
                        Log Now →
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogNudgeDismissed(true)}
                        aria-label="Dismiss"
                        style={{ background: 'none', border: 'none', color: C.ashDim, fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: '4px 6px' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LOG WEIGHT MODAL ────────────────────────────────────────────────────────

function LogWeightModal({ onClose, onSuccess }) {
  const [val, setVal]       = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  async function handleConfirm() {
    const kg = parseFloat(val);
    if (!kg || kg < 20 || kg > 400) { setErr('Enter a valid weight (20–400 kg).'); return; }
    setSaving(true);
    setErr('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErr('Not authenticated.'); setSaving(false); return; }

      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay   = new Date(); endOfDay.setHours(23, 59, 59, 999);

      const { data: existing } = await supabase
        .from('weight_logs')
        .select('id')
        .eq('user_id', user.id)
        .gte('logged_at', startOfDay.toISOString())
        .lte('logged_at', endOfDay.toISOString())
        .limit(1);

      if (existing?.length) {
        const { error } = await supabase.from('weight_logs').update({ weight_kg: kg }).eq('id', existing[0].id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('weight_logs').insert({ user_id: user.id, weight_kg: kg, logged_at: new Date().toISOString() });
        if (error) throw error;
      }

      onSuccess(kg);
    } catch (e) {
      setErr(e.message || 'Failed to save.');
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        ...cardStyle,
        padding: '32px 28px',
        width: 320,
        maxWidth: '90vw',
        boxShadow: `0 20px 50px -10px rgba(0,0,0,0.8), 0 0 30px -16px ${C.glow}`,
      }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '1.8px', textTransform: 'uppercase', color: C.ash, marginBottom: 20 }}>
          Log Today's Weight
        </div>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <input
            type="number" step="0.1" min="20" max="400"
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleConfirm()}
            autoFocus
            placeholder="e.g. 84.5"
            style={{
              width: '100%',
              padding: '14px 52px 14px 16px',
              background: C.surface,
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: C.bone,
              fontFamily: "'Roboto Mono', monospace",
              fontSize: 28,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: C.ashDim, fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 600, pointerEvents: 'none' }}>kg</span>
        </div>
        {err && <p style={{ color: '#fca5a5', fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 12 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleConfirm}
            disabled={saving || !val}
            style={{
              ...btnPrimary,
              flex: 1,
              padding: '14px 0',
              opacity: saving || !val ? 0.5 : 1,
              boxShadow: `0 10px 28px -8px ${C.glow}`,
            }}
          >
            {saving ? '…' : 'Confirm'}
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: 'none',
              border: '1px solid rgba(255,255,255,0.12)',
              color: C.ash,
              borderRadius: 9,
              padding: '14px 0',
              fontFamily: "'Oswald', sans-serif",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RENEWAL BANNER ──────────────────────────────────────────────────────────

function RenewalBanner({ planGeneratedAt, onGoToAccount }) {
  const storageKey = `renewal_dismissed_${planGeneratedAt}`;
  const [visible, setVisible] = React.useState(
    planGeneratedAt && !localStorage.getItem(storageKey)
  );

  if (!visible || !planGeneratedAt || daysSince(planGeneratedAt) < 84) return null;

  function handleDismiss() {
    localStorage.setItem(storageKey, '1');
    setVisible(false);
  }

  return (
    <div style={{
      background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
      border: `1px solid ${C.glowLine}`,
      borderRadius: 16,
      padding: '20px 24px',
      marginBottom: 28,
      position: 'relative',
      boxShadow: `0 0 30px -16px ${C.glow}`,
    }}>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', color: C.ashDim, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
      >✕</button>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '1.8px', textTransform: 'uppercase', color: C.ash, marginBottom: 10 }}>
        Plan Complete
      </div>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 'clamp(22px, 3vw, 28px)', textTransform: 'uppercase', color: C.bone, lineHeight: 1.08, marginBottom: 12 }}>
        12 Weeks Done. Ready for What's Next?
      </div>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: C.ash, lineHeight: 1.65, marginBottom: 18, maxWidth: 480 }}>
        You've completed your full 12-week programme. Head to My Plan to generate your next cycle — same goal with a fresh structure, or a new direction entirely.
      </p>
      <button
        onClick={() => { onGoToAccount?.(); handleDismiss(); }}
        style={{ ...btnPrimary, boxShadow: `0 10px 28px -8px ${C.glow}` }}
      >
        Go to My Plan →
      </button>
    </div>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export default function TodayTab({ snapshot, plan, isUnlocked, onUnlock, onOpenLogbook, planGeneratedAt, onGoToAccount, isCoachingClient, onGeneratePlan }) {
  const [currentWeight, setCurrentWeight]   = useState(null);
  const [startingWeight, setStartingWeight] = useState(null);
  const [targetWeight, setTargetWeight]     = useState(null);
  const [startDate, setStartDate]           = useState(null);
  const [sessionLength, setSessionLength]   = useState(null);
  const [streak, setStreak]                 = useState(0);
  const [showModal, setShowModal]           = useState(false);
  const [logSuccess, setLogSuccess]         = useState(false);
  const [videoMap, setVideoMap]             = useState({});
  const [intakeSchedule, setIntakeSchedule] = useState({ scheduleType: 'rolling', trainingDays: '4', preferredDays: [], goal: null });
  const [dayOverride, setDayOverride]       = useState(() => {
    try {
      const raw = localStorage.getItem(`dayOverride_${new Date().toISOString().split('T')[0]}`);
      return raw ? (JSON.parse(raw).type ?? null) : null;
    } catch { return null; }
  });
  const [overrideSession, setOverrideSession] = useState(() => {
    try {
      const raw = localStorage.getItem(`dayOverride_${new Date().toISOString().split('T')[0]}`);
      return raw ? (JSON.parse(raw).session ?? null) : null;
    } catch { return null; }
  });
  const [showPicker,         setShowPicker]         = useState(false);
  const [showWeeklySchedule, setShowWeeklySchedule] = useState(false);
  const [weeklyOverride,     setWeeklyOverride]     = useState(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: logs } = await supabase
        .from('weight_logs')
        .select('weight_kg, logged_at')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: true });

      if (logs?.length) {
        setStartingWeight(logs[0].weight_kg);
        setCurrentWeight(logs[logs.length - 1].weight_kg);
      }

      const { data: intake } = await supabase
        .from('intake_submissions')
        .select('data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (intake?.data) {
        if (intake.data.targetWeight)  setTargetWeight(Number(intake.data.targetWeight));
        if (intake.data.startDate)     setStartDate(intake.data.startDate);
        if (intake.data.sessionLength) setSessionLength(intake.data.sessionLength);
        setIntakeSchedule({
          scheduleType:  intake.data.scheduleType  || 'rolling',
          trainingDays:  intake.data.trainingDays  || '4',
          preferredDays: intake.data.preferredDays || [],
          goal:          intake.data.goal          || null,
        });
      }

      try {
        const trainingDays = parseInt(intake?.data?.trainingDays || '4', 10);
        const { data: completions, error: cErr } = await supabase
          .from('session_completions')
          .select('completed_at')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false });
        if (!cErr && completions) setStreak(calcStreak(completions, trainingDays));
      } catch { /* table may not exist yet */ }

      try {
        const { data: videoRows } = await supabase
          .from('exercise_videos')
          .select('exercise_key, youtube_id');
        if (videoRows) {
          const map = {};
          for (const row of videoRows) map[row.exercise_key] = row.youtube_id;
          setVideoMap(map);
        }
      } catch { /* table may not exist yet */ }

      try {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (authSession) {
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const day   = today.getDay();
          const monday = new Date(today);
          monday.setDate(today.getDate() + (day === 0 ? -6 : 1 - day));
          const weekStart = monday.toISOString().split('T')[0];
          const result = await getWeekSchedule(weekStart, authSession.access_token);
          if (result.schedule) setWeeklyOverride(result.schedule);
        }
      } catch { /* non-critical */ }
    }
    load();
  }, []);

  const weekNum   = getWeekNum(startDate);
  const library   = plan?.exercise_library || {};
  const nutrition = plan?.nutrition;

  const todayInfo = (plan && isUnlocked)
    ? getSessionForToday(plan, { ...intakeSchedule, startDate })
    : { session: null, isRestDay: false, tomorrowSession: null };

  const todayDayIdx    = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();
  const weeklyEntry    = weeklyOverride?.[String(todayDayIdx)];
  const hasWeeklyEntry = weeklyOverride !== null && String(todayDayIdx) in (weeklyOverride || {});

  const baseIsRestDay = hasWeeklyEntry ? (weeklyEntry === null || weeklyEntry === undefined)
                                       : todayInfo.isRestDay;
  const baseTodaySession = (() => {
    if (!hasWeeklyEntry || !weeklyEntry) return todayInfo.session;
    const phaseIdx = Math.min((plan?.phases?.length || 1) - 1, Math.max(0, Math.floor((weekNum - 1) / 4)));
    const phase = plan?.phases?.[phaseIdx] || plan?.phases?.[0];
    return phase?.sessions?.find(s => s.name === weeklyEntry) ?? todayInfo.session;
  })();

  const isRestDay       = baseIsRestDay;
  const todaySession    = baseTodaySession;
  const tomorrowSession = todayInfo.tomorrowSession;

  const phase1Sessions = plan?.phases?.[0]?.sessions || [];

  const effectiveIsRestDay = dayOverride === 'rest'     ? true
                           : dayOverride === 'training' ? false
                           : isRestDay;

  const pickedSession = overrideSession
    ? (phase1Sessions.find(s => s.name === overrideSession) ?? null)
    : null;

  const effectiveSession = pickedSession
    ?? (dayOverride === 'training' ? null : isRestDay ? null : todaySession);

  function handleOverride(type, sessionName = null) {
    const key = `dayOverride_${new Date().toISOString().split('T')[0]}`;
    if (type === null) {
      localStorage.removeItem(key);
      setDayOverride(null);
      setOverrideSession(null);
    } else {
      localStorage.setItem(key, JSON.stringify({ type, session: sessionName }));
      setDayOverride(type);
      setOverrideSession(sessionName);
    }
  }

  async function handleSessionComplete() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      const { data: completions } = await supabase
        .from('session_completions')
        .select('completed_at, week_number')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });

      if (!completions) return;

      const numTrainingDays = parseInt(intakeSchedule.trainingDays || '4', 10);
      const newStreak = calcStreak(completions, numTrainingDays);
      setStreak(newStreak);

      try { await unlockAchievement(supabase, user.id, 'first_rep', 100); } catch {}
      if (newStreak >= 3)  { try { await unlockAchievement(supabase, user.id, 'on_fire', 100); } catch {} }
      if (newStreak >= 8)  { try { await unlockAchievement(supabase, user.id, 'unstoppable', 300); } catch {} }

      const week1Count = completions.filter(c => c.week_number === 1).length;
      if (week1Count >= numTrainingDays) { try { await unlockAchievement(supabase, user.id, 'week1_warrior', 150); } catch {} }
    } catch (e) {
      console.error('[TodayTab] handleSessionComplete error:', e);
    }
  }

  function handleLogSuccess(kg) {
    setCurrentWeight(kg);
    setShowModal(false);
    setLogSuccess(true);
    setTimeout(() => setLogSuccess(false), 3000);
  }

  return (
    <div>
      <style>{`
        .today-stats-row {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 40px;
          flex-wrap: wrap;
          margin-bottom: 20px;
          opacity: 0;
          animation: todayFadeUp 0.65s cubic-bezier(0.16,1,0.3,1) 0.16s forwards;
        }
        @media (max-width: 600px) {
          .today-stats-row { flex-direction: column; gap: 24px; align-items: center; }
          .today-mission-card { font-size: 0.9em; }
          .today-btn { min-height: 44px; }
        }
        @keyframes todayFadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tapPulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
        .tap-dot { animation: tapPulse 2s ease-in-out infinite; }
        @keyframes flamePulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
        .flame-pulse { animation: flamePulse 1.5s ease-in-out infinite; display:inline-flex; }
        @keyframes pulseExpand { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
        .pulse-expand { display:inline-block; animation: pulseExpand 1.5s ease-in-out infinite; }
        .override-link {
          background: none; border: none;
          color: #5C5A62;
          font-family: 'Inter', sans-serif;
          font-size: 12px; letter-spacing: 0.06em;
          cursor: pointer; padding: 0; text-decoration: none;
        }
        .override-link:hover { text-decoration: underline; color: #87858E; }
      `}</style>

      {/* ── Renewal banner ────────────────────────────────────── */}
      <RenewalBanner planGeneratedAt={planGeneratedAt} onGoToAccount={onGoToAccount} />

      {/* ── Stats row ─────────────────────────────────────────── */}
      <div className="today-stats-row">
        <ProgressRing startDate={startDate} />
        <WeightStatCard currentWeight={currentWeight} />
        <StreakBadge streak={streak} />
      </div>

      {/* ── Motivational line ──────────────────────────────────── */}
      <MotivationalLine
        streak={streak}
        currentWeight={currentWeight}
        startingWeight={startingWeight}
        targetWeight={targetWeight}
        weekNum={weekNum}
      />

      {/* ── Stat chips ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 12, margin: '24px 0',
        justifyContent: 'center', flexWrap: 'wrap',
        opacity: 0,
        animation: `todayFadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.28s forwards`,
      }}>
        <StatChip label="Goal"     value={formatGoal(plan?.user_summary?.goal || plan?.nutrition?.goal)} />
        <StatChip label="Calories" value={`${(isRestDay ? nutrition?.rest_day?.calories : nutrition?.training_day?.calories) ?? '—'} kcal`} />
        <StatChip label="Protein"  value={`${(isRestDay ? nutrition?.rest_day?.protein  : nutrition?.training_day?.protein)  ?? '—'}g`} />
      </div>

      {/* ── Monthly check-in ───────────────────────────────────── */}
      <MonthlyCheckIn weekNum={weekNum} currentWeight={currentWeight} />

      {/* ── Today's Session ────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }} className="today-mission-card">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, marginTop: 4 }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 18, textTransform: 'uppercase', color: C.bone, letterSpacing: '0.3px' }}>
            Today's Session
          </div>
          {isUnlocked && phase1Sessions.length > 0 && (
            <button type="button" className="override-link"
              onClick={() => setShowWeeklySchedule(v => !v)}
              style={{ fontSize: 11, letterSpacing: '0.1em' }}
            >
              {showWeeklySchedule ? 'Hide schedule ✕' : 'This week →'}
            </button>
          )}
        </div>

        {showWeeklySchedule && isUnlocked && (
          <WeeklyScheduleView
            plan={plan}
            intakeSchedule={intakeSchedule}
            startDate={startDate}
            weekNum={weekNum}
            onClose={() => setShowWeeklySchedule(false)}
            onScheduleChange={newSchedule => setWeeklyOverride(newSchedule)}
          />
        )}

        {isUnlocked ? (
          <>
            {effectiveIsRestDay ? (
              <RestDayCard tomorrowSession={tomorrowSession} />
            ) : effectiveSession ? (
              <MissionCard
                session={effectiveSession}
                library={library}
                sessionLength={sessionLength}
                weekNum={weekNum}
                onComplete={handleSessionComplete}
                onOpenLogbook={onOpenLogbook}
                videoMap={videoMap}
              />
            ) : isCoachingClient ? (
              <div style={{ ...cardStyle, padding: '32px 24px', textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 20, textTransform: 'uppercase', color: C.bone, marginBottom: 10, letterSpacing: '0.04em' }}>
                  {snapshot ? 'Ready to build your plan' : 'Complete your profile first'}
                </div>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: C.ash, marginBottom: 20, lineHeight: 1.6, maxWidth: 340, margin: '0 auto 20px' }}>
                  {snapshot
                    ? 'Your intake is done. Generate your personalised 12-week programme now — takes 60–90 seconds.'
                    : 'Fill in your intake form so we can build your personalised training and nutrition plan.'}
                </p>
                {snapshot ? (
                  <button style={btnPrimary} onClick={onGeneratePlan}>
                    Generate My Plan →
                  </button>
                ) : (
                  <a href="/intake" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}>
                    Start Intake →
                  </a>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <div style={{ position: 'relative' }}>
            <div style={{ filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none', ...cardStyle, padding: '20px' }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '1.8px', textTransform: 'uppercase', color: C.bone, marginBottom: 8 }}>Today's Mission</div>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 24, textTransform: 'uppercase', color: C.bone }}>Upper Body A</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {['6 exercises', '45 min', 'Upper Body'].map(t => (
                  <TagPill key={t}>{t}</TagPill>
                ))}
              </div>
            </div>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,7,10,0.5)' }}>
              <button className="btn-primary today-btn" onClick={onUnlock} style={{ fontSize: 12, padding: '10px 20px' }}>
                Unlock — £9.99/month
              </button>
            </div>
          </div>
        )}

        {/* ── Session picker / override ─────────────────────── */}
        {isUnlocked && phase1Sessions.length > 0 && (
          <div style={{ marginTop: 16 }}>
            {!showPicker ? (
              <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="override-link" onClick={() => setShowPicker(true)}>
                  Change today's session →
                </button>
                {dayOverride !== null && (
                  <button type="button" className="override-link"
                    onClick={() => { handleOverride(null); setShowPicker(false); }}>
                    Reset to scheduled
                  </button>
                )}
              </div>
            ) : (
              <div style={{ padding: '12px 0 4px' }}>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.ashDim, marginBottom: 10, textAlign: 'center' }}>
                  Choose a session for today
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 10 }}>
                  {phase1Sessions.map(s => {
                    const active = dayOverride === 'training'
                      ? overrideSession === s.name
                      : dayOverride === null && todaySession?.name === s.name;
                    return (
                      <button key={s.name} type="button"
                        onClick={() => { handleOverride('training', s.name); setShowPicker(false); }}
                        style={{
                          padding: '7px 14px',
                          background: C.surface,
                          border: `1px solid ${active ? C.glowLine : 'rgba(255,255,255,0.08)'}`,
                          color: active ? C.bone : C.ash,
                          fontFamily: "'Oswald', sans-serif",
                          fontSize: 12, fontWeight: 600,
                          letterSpacing: '1px',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          borderRadius: 7,
                          transition: 'border-color 0.15s, color 0.15s',
                        }}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                  <button type="button"
                    onClick={() => { handleOverride('rest'); setShowPicker(false); }}
                    style={{
                      padding: '7px 14px',
                      background: C.surface,
                      border: `1px solid ${dayOverride === 'rest' || (dayOverride === null && isRestDay) ? C.glowLine : 'rgba(255,255,255,0.08)'}`,
                      color: dayOverride === 'rest' || (dayOverride === null && isRestDay) ? C.bone : C.ash,
                      fontFamily: "'Oswald', sans-serif",
                      fontSize: 12, fontWeight: 600,
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      borderRadius: 7,
                      transition: 'border-color 0.15s, color 0.15s',
                    }}
                  >
                    Rest Day
                  </button>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <button type="button" className="override-link" onClick={() => setShowPicker(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Today's Nutrition ──────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 18, textTransform: 'uppercase', color: C.bone, letterSpacing: '0.3px' }}>
          Today's Nutrition
        </div>
      </div>
      {isUnlocked && nutrition ? (
        <div style={{ ...cardStyle, padding: '6px 24px', marginBottom: 24 }}>
          {(() => {
            const dayNutrition = isRestDay ? nutrition.rest_day : nutrition.training_day;
            return [
              ['Calories', dayNutrition?.calories != null ? dayNutrition.calories + ' kcal' : '—'],
              ['Protein',  dayNutrition?.protein  != null ? dayNutrition.protein  + 'g'     : '—'],
              ['Carbs',    dayNutrition?.carbs    != null ? dayNutrition.carbs    + 'g'     : '—'],
              ['Fat',      dayNutrition?.fat      != null ? dayNutrition.fat      + 'g'     : '—'],
            ];
          })().map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 14.5 }}>
              <span style={{ color: C.ash, fontFamily: "'Inter', sans-serif" }}>{k}</span>
              <span style={{ fontWeight: 600, color: C.bone, fontFamily: "'Inter', sans-serif" }}>{v}</span>
            </div>
          ))}
        </div>
      ) : isCoachingClient ? (
        <div style={{ ...cardStyle, padding: '20px 24px', marginBottom: 24, textAlign: 'center' }}>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ashDim, margin: 0, lineHeight: 1.6 }}>
            Nutrition targets will appear here once your plan is generated.
          </p>
        </div>
      ) : (
        <div style={{ position: 'relative', marginBottom: 24 }}>
          <div style={{ filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none', ...cardStyle, padding: '20px' }}>
            {[['Calories','2,800 kcal'],['Protein','180g'],['Carbs','320g'],['Fat','78g']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: C.ash }}>{k}</span><span style={{ color: C.bone }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,7,10,0.5)' }}>
            <button className="btn-primary" onClick={onUnlock} style={{ fontSize: 12, padding: '10px 20px' }}>
              Unlock — £9.99/month
            </button>
          </div>
        </div>
      )}

      {/* ── Log weight shortcut ────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          style={{ ...btnGhost, width: 'auto', padding: '13px 24px' }}
        >
          Log Today's Weight →
        </button>
        {logSuccess && (
          <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: '1px', color: C.bone }}>
            ✓ Weight logged.
          </span>
        )}
      </div>

      {/* ── Modal ─────────────────────────────────────────────── */}
      {showModal && (
        <LogWeightModal onClose={() => setShowModal(false)} onSuccess={handleLogSuccess} />
      )}
    </div>
  );
}
