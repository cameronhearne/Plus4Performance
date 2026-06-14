import React, { useEffect, useState, useCallback } from 'react';
import { Flame } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { unlockAchievement } from '../lib/achievements';

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

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function localDayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function calcStreak(completions, trainingDays) {
  if (!completions?.length || !trainingDays) return 0;

  // Returns 'YYYY-MM-DD' of the Monday starting the ISO week containing `date`
  function weekMonday(date) {
    const d = new Date(date);
    const daysSinceMonday = (d.getDay() + 6) % 7; // Sun=6, Mon=0, …, Sat=5
    d.setDate(d.getDate() - daysSinceMonday);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  // Count completions per week
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

  // If the current week already hit the target, include it; otherwise skip it
  // (still in progress — don't penalise an incomplete week)
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

function getWeekNum(startDateStr) {
  if (!startDateStr) return 1;
  const start = new Date(startDateStr);
  const daysIn = Math.max(0, Math.floor((Date.now() - start) / 86400000));
  return Math.min(12, Math.floor(daysIn / 7) + 1);
}

function getProgress(startDateStr) {
  if (!startDateStr) return 0;
  const start = new Date(startDateStr);
  const daysIn = Math.max(0, Math.floor((Date.now() - start) / 86400000));
  return Math.min(1, daysIn / 84);
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

// ─── FLIP CARD ───────────────────────────────────────────────────────────────

function FlipCard({ currentWeight, targetWeight }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <div
        onClick={() => setFlipped(f => !f)}
        style={{ perspective: '1000px', width: 160, height: 160, cursor: 'pointer' }}
      >
        <div style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.55s cubic-bezier(0.4,0,0.2,1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}>
          {/* Front — current weight */}
          <div style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden',
            background: '#111',
            border: '1px solid rgba(200,200,200,0.1)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, color: '#F5F3EE', lineHeight: 1 }}>
              {currentWeight != null ? currentWeight : '—'}
            </div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#555' }}>
              Current Weight
            </div>
          </div>
          {/* Back — target weight */}
          <div style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: '#111',
            border: '1px solid rgba(200,200,200,0.1)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, color: '#C0392B', lineHeight: 1 }}>
              {targetWeight != null ? targetWeight : '—'}
            </div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#555' }}>
              Target Weight
            </div>
          </div>
        </div>
      </div>
      {/* Discovery hint */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span className="tap-dot" style={{ display: 'block', width: 4, height: 4, borderRadius: '50%', background: '#444' }} />
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 8, letterSpacing: '0.22em', color: '#444', textTransform: 'uppercase' }}>tap</span>
      </div>
    </div>
  );
}

// ─── PROGRESS RING ───────────────────────────────────────────────────────────

function ProgressRing({ startDate }) {
  const weekNum  = getWeekNum(startDate);
  const progress = getProgress(startDate);
  const size = 120;
  const sw = 8;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a1a1a" strokeWidth={sw} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke="#C0392B" strokeWidth={sw}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90, ${cx}, ${cy})`}
        />
        <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="auto"
          fill="#F5F3EE" fontFamily="'Bebas Neue', sans-serif" fontSize={36}>
          {weekNum}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" dominantBaseline="auto"
          fill="#555" fontFamily="'Barlow Condensed', sans-serif" fontSize={11} letterSpacing="0.14em">
          OF 12
        </text>
      </svg>
    </div>
  );
}

// ─── STREAK BADGE ────────────────────────────────────────────────────────────

function StreakBadge({ streak }) {
  const flameSize  = streak >= 8 ? 40 : streak >= 3 ? 36 : 32;
  const flameColor = streak === 0 ? '#333333' : streak >= 8 ? '#FF4500' : streak >= 3 ? '#FF6B00' : '#C0392B';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0, width: 120 }}>
      <span className={streak >= 30 ? 'flame-pulse' : ''}>
        <Flame size={flameSize} color={flameColor} strokeWidth={1.5} />
      </span>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, color: '#F5F3EE', lineHeight: 1 }}>
        {streak}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#555' }}>
          Session Streak
        </div>
        {streak === 0 && (
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, letterSpacing: '0.1em', color: '#333', textAlign: 'center' }}>
            Complete a session to begin
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SESSION FOR TODAY ────────────────────────────────────────────────────────

const DAY_ORDER_MON = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_NAMES_JS  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getSessionForToday(plan, intakeData) {
  const allSessions = (plan?.phases || []).flatMap(p => p.sessions || []);
  if (!allSessions.length) return { session: null, isRestDay: false, tomorrowSession: null };

  const numTrainingDays = parseInt(intakeData?.trainingDays || '4', 10);
  const scheduleType    = intakeData?.scheduleType || 'rolling';
  const preferredDays   = intakeData?.preferredDays || [];
  const startDateStr    = intakeData?.startDate;

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const todayName = DAY_NAMES_JS[todayDate.getDay()];

  const startDate = startDateStr ? new Date(startDateStr) : new Date(todayDate);
  startDate.setHours(0, 0, 0, 0);
  const daysElapsed = Math.max(0, Math.floor((todayDate - startDate) / 86400000));

  if (scheduleType === 'fixed' && preferredDays.length > 0) {
    const sortedDays = [...preferredDays].sort((a, b) => DAY_ORDER_MON.indexOf(a) - DAY_ORDER_MON.indexOf(b));

    if (!sortedDays.includes(todayName)) {
      let tomorrowSession = null;
      for (let i = 1; i <= 7; i++) {
        const nextDate = new Date(todayDate);
        nextDate.setDate(todayDate.getDate() + i);
        const nextName = DAY_NAMES_JS[nextDate.getDay()];
        if (sortedDays.includes(nextName)) {
          const nextElapsed  = daysElapsed + i;
          const weeksPassed  = Math.floor(nextElapsed / 7);
          const nextDayIdx   = sortedDays.indexOf(nextName);
          const sessionIdx   = (weeksPassed * sortedDays.length + nextDayIdx) % allSessions.length;
          tomorrowSession    = allSessions[sessionIdx];
          break;
        }
      }
      return { session: null, isRestDay: true, tomorrowSession };
    }

    const weeksPassed = Math.floor(daysElapsed / 7);
    const dayIdx      = sortedDays.indexOf(todayName);
    const sessionIdx  = (weeksPassed * sortedDays.length + dayIdx) % allSessions.length;
    return { session: allSessions[sessionIdx], isRestDay: false, tomorrowSession: null };
  }

  // Rolling: train first N days of each 7-day cycle
  const dayInCycle = daysElapsed % 7;
  const fullWeeks  = Math.floor(daysElapsed / 7);

  if (dayInCycle >= numTrainingDays) {
    const sessionsCompleted = (fullWeeks + 1) * numTrainingDays;
    return { session: null, isRestDay: true, tomorrowSession: allSessions[sessionsCompleted % allSessions.length] };
  }

  const sessionsCompleted = fullWeeks * numTrainingDays + dayInCycle;
  return { session: allSessions[sessionsCompleted % allSessions.length], isRestDay: false, tomorrowSession: null };
}

// ─── MOTIVATIONAL LINE ───────────────────────────────────────────────────────

function MotivationalLine({ streak, currentWeight, startingWeight, targetWeight, weekNum }) {
  let line = `Week ${weekNum} of 12. Stay the course.`;

  if (streak >= 7) {
    line = `${streak} sessions straight. You're building something real.`;
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
      color: '#888',
      fontSize: 13,
      fontFamily: "'Barlow', sans-serif",
      fontWeight: 300,
      letterSpacing: '0.02em',
      margin: '0 0 28px',
    }}>
      {line}
    </p>
  );
}

// ─── REST DAY CARD ───────────────────────────────────────────────────────────

function RestDayCard({ tomorrowSession }) {
  return (
    <div style={{ background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.12)', padding: '24px 20px', marginBottom: 12 }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#C0392B', marginBottom: 12 }}>
        Rest Day
      </div>
      <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: '#CDCDC8', lineHeight: 1.7, margin: '0 0 16px', fontWeight: 300 }}>
        Recovery is part of the programme. Stay active, hit your nutrition targets, and come back strong tomorrow.
      </p>
      {tomorrowSession && (
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#555' }}>
          TOMORROW: {tomorrowSession.name}
        </div>
      )}
    </div>
  );
}

// ─── STAT CHIPS ──────────────────────────────────────────────────────────────

const GOAL_LABELS = {
  fat_loss:         'FAT LOSS',
  muscle_building:  'LEAN BULK',
  maintenance:      'RECOMP',
};

function StatChip({ label, value }) {
  return (
    <div style={{ background: '#111', border: '1px solid rgba(192,57,43,0.35)', padding: '10px 16px', flex: '1 1 80px', minWidth: 80 }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#555', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, color: '#F5F3EE', letterSpacing: '0.06em' }}>
        {value}
      </div>
    </div>
  );
}

function StatChips() {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
      <StatChip label="Goal"     value="LEAN BULK" />
      <StatChip label="Calories" value="3456 KCAL" />
      <StatChip label="Protein"  value="228G" />
    </div>
  );
}

// ─── MISSION CARD ────────────────────────────────────────────────────────────

function Pill({ children }) {
  return (
    <span style={{
      background: '#1a1a1a',
      border: '1px solid #2a2a2a',
      padding: '4px 12px',
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: '#555',
    }}>
      {children}
    </span>
  );
}

function MissionCard({ session, library, sessionLength, weekNum, onComplete, onOpenLogbook }) {
  const [open, setOpen]             = useState(false);
  const [expandedEx, setExpandedEx] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted]   = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(
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
    <div style={{ background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.12)', marginBottom: 12 }}>
      {/* Collapsible header */}
      <button
        type="button"
        onClick={handleToggle}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '20px 20px 12px', textAlign: 'left' }}
      >
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#C0392B', marginBottom: 8 }}>
          Today's Mission
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#F5F3EE', lineHeight: 1 }}>
            {session.name}
          </div>
          <span
            className={!open && !hasBeenOpened ? 'pulse-expand' : ''}
            style={{ color: !open && !hasBeenOpened ? '#C0392B' : '#555', fontSize: 24, fontWeight: 700, paddingTop: 2 }}
          >
            {open ? '−' : '+'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Pill>{exCount} exercises</Pill>
          {duration && <Pill>{duration}</Pill>}
          <Pill>{focus}</Pill>
        </div>
      </button>

      {/* OPEN LOGBOOK — always visible, below pills */}
      <div style={{ padding: '10px 20px 16px' }}>
        <button
          type="button"
          onClick={() => onOpenLogbook?.(session.name)}
          style={{
            background: 'none', border: '1px solid #C0392B',
            color: '#C0392B', fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 12, fontWeight: 700, letterSpacing: '0.18em',
            textTransform: 'uppercase', padding: '9px 20px', cursor: 'pointer',
          }}
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
                  <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#787878', padding: '8px 8px 8px 0', textAlign: 'left', borderBottom: '1px solid #222' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(session.exercises || []).map((ex, i) => {
                const info   = library[ex.ex] || {};
                const name   = info.name || ex.ex;
                const isOpen = expandedEx === i;
                const hasCue = !!(info.cues || info.common_mistakes || info.injury_modifications);
                return (
                  <React.Fragment key={i}>
                    <tr
                      style={{ background: i % 2 === 0 ? '#111' : '#0d0d0d', cursor: hasCue ? 'pointer' : 'default' }}
                      onClick={() => hasCue && setExpandedEx(isOpen ? null : i)}
                    >
                      <td style={{ fontSize: 13, color: '#CDCDC8', padding: '10px 8px 10px 0', verticalAlign: 'top' }}>
                        {name}
                        {hasCue && <span style={{ color: '#444', fontSize: 11, marginLeft: 6 }}>{isOpen ? '▲' : '▼'}</span>}
                      </td>
                      <td style={{ fontSize: 13, color: '#CDCDC8', padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' }}>{ex.sets}</td>
                      <td style={{ fontSize: 13, color: '#CDCDC8', padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' }}>{ex.reps}</td>
                      <td style={{ fontSize: 13, color: '#CDCDC8', padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' }}>{ex.rest}</td>
                    </tr>
                    {isOpen && hasCue && (
                      <tr style={{ background: '#0a0a0a' }}>
                        <td colSpan={4} style={{ padding: '10px 0 14px', fontSize: 12, color: '#CDCDC8', lineHeight: 1.6 }}>
                          {info.cues && <div style={{ marginBottom: 4 }}><span style={{ color: '#787878', fontWeight: 700 }}>Cue: </span>{info.cues}</div>}
                          {info.common_mistakes && <div style={{ marginBottom: 4 }}><span style={{ color: '#787878', fontWeight: 700 }}>Avoid: </span>{info.common_mistakes}</div>}
                          {info.injury_modifications && <div><span style={{ color: '#787878', fontWeight: 700 }}>Mod: </span>{info.injury_modifications}</div>}
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
                style={{ width: '100%', background: '#C0392B', border: 'none', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', padding: '16px 0', cursor: completing ? 'default' : 'pointer', opacity: completing ? 0.7 : 1 }}
              >
                {completing ? '…' : 'Session Complete'}
              </button>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '0.14em', color: '#4CAF50' }}>
                ✓ Session logged.
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

      // Upsert today's entry if one already exists
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
      <div style={{ background: '#111', border: '1px solid rgba(200,200,200,0.12)', padding: '32px 28px', width: 320, maxWidth: '90vw' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#555', marginBottom: 20 }}>
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
            style={{ width: '100%', padding: '14px 52px 14px 16px', background: '#1a1a1a', border: '1px solid rgba(200,200,200,0.15)', color: '#F5F3EE', fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, outline: 'none', boxSizing: 'border-box' }}
          />
          <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#555', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, pointerEvents: 'none' }}>kg</span>
        </div>
        {err && <p style={{ color: '#ef4444', fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 12 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleConfirm}
            disabled={saving || !val}
            style={{ flex: 1, background: '#C0392B', border: 'none', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', padding: '14px 0', cursor: 'pointer', opacity: saving || !val ? 0.5 : 1 }}
          >
            {saving ? '…' : 'Confirm'}
          </button>
          <button
            onClick={onClose}
            style={{ flex: 1, background: 'none', border: '1px solid rgba(200,200,200,0.15)', color: '#555', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '14px 0', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export default function TodayTab({ snapshot, plan, isUnlocked, onUnlock, onOpenLogbook }) {
  const [currentWeight, setCurrentWeight] = useState(null);
  const [startingWeight, setStartingWeight] = useState(null);
  const [targetWeight, setTargetWeight]   = useState(null);
  const [startDate, setStartDate]         = useState(null);
  const [sessionLength, setSessionLength] = useState(null);
  const [streak, setStreak]               = useState(0);
  const [showModal, setShowModal]         = useState(false);
  const [logSuccess, setLogSuccess]       = useState(false);
  const [intakeSchedule, setIntakeSchedule] = useState({ scheduleType: 'rolling', trainingDays: '4', preferredDays: [], goal: null });
  // Stored as JSON { type: 'training'|'rest', session?: string } keyed to today
  const [dayOverride, setDayOverride]     = useState(() => {
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

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Weight logs
      const { data: logs } = await supabase
        .from('weight_logs')
        .select('weight_kg, logged_at')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: true });

      if (logs?.length) {
        setStartingWeight(logs[0].weight_kg);
        setCurrentWeight(logs[logs.length - 1].weight_kg);
      }

      // Intake data
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

      // Streak — handle gracefully if table absent
      try {
        const trainingDays = parseInt(intake?.data?.trainingDays || '4', 10);
        const { data: completions, error: cErr } = await supabase
          .from('session_completions')
          .select('completed_at')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false });
        if (!cErr && completions) setStreak(calcStreak(completions, trainingDays));
      } catch { /* table may not exist yet */ }
    }
    load();
  }, []);

  useEffect(() => {
    if (plan) {
      console.log('[TodayTab] plan loaded — top-level keys:', Object.keys(plan));
      console.log('[TodayTab] plan.user_summary:', plan.user_summary);
      console.log('[TodayTab] plan.nutrition:', plan.nutrition);
    }
  }, [plan]);

  const weekNum   = getWeekNum(startDate);
  const library   = plan?.exercise_library || {};
  const nutrition = plan?.nutrition;

  const todayInfo       = (plan && isUnlocked)
    ? getSessionForToday(plan, { ...intakeSchedule, startDate })
    : { session: null, isRestDay: false, tomorrowSession: null };
  const todaySession    = todayInfo.session;
  const isRestDay       = todayInfo.isRestDay;
  const tomorrowSession = todayInfo.tomorrowSession;

  // Phase 1 sessions for the picker
  const phase1Sessions = plan?.phases?.[0]?.sessions || [];

  // Override logic — persists in localStorage keyed to today's date
  const effectiveIsRestDay = dayOverride === 'rest'     ? true
                           : dayOverride === 'training' ? false
                           : isRestDay;

  // Resolve picked session object from phase 1 by stored name
  const pickedSession = overrideSession
    ? (phase1Sessions.find(s => s.name === overrideSession) ?? null)
    : null;

  // pickedSession wins; training override with no pick yet → null (show picker only);
  // otherwise fall through to the natural session
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

      console.log('[Achievements] checking unlocks, completions count:', completions.length);
      console.log('[Achievements] userId:', user.id);

      const numTrainingDays = parseInt(intakeSchedule.trainingDays || '4', 10);
      const newStreak = calcStreak(completions, numTrainingDays);
      setStreak(newStreak);

      // first_rep — unlock on every session call; upsert ignoreDuplicates makes it idempotent
      try {
        await unlockAchievement(supabase, user.id, 'first_rep', 100);
        console.log('[Achievements] unlocked: first_rep');
      } catch (e) {
        console.error('[Achievements] error unlocking first_rep:', e);
      }

      // on_fire — 3 consecutive successful weeks
      if (newStreak >= 3) {
        try {
          await unlockAchievement(supabase, user.id, 'on_fire', 100);
          console.log('[Achievements] unlocked: on_fire');
        } catch (e) {
          console.error('[Achievements] error unlocking on_fire:', e);
        }
      }

      // unstoppable — 8 consecutive successful weeks
      if (newStreak >= 8) {
        try {
          await unlockAchievement(supabase, user.id, 'unstoppable', 300);
          console.log('[Achievements] unlocked: unstoppable');
        } catch (e) {
          console.error('[Achievements] error unlocking unstoppable:', e);
        }
      }

      // week1_warrior — completed all scheduled sessions in week 1
      const week1Count = completions.filter(c => c.week_number === 1).length;
      if (week1Count >= numTrainingDays) {
        try {
          await unlockAchievement(supabase, user.id, 'week1_warrior', 150);
          console.log('[Achievements] unlocked: week1_warrior');
        } catch (e) {
          console.error('[Achievements] error unlocking week1_warrior:', e);
        }
      }
    } catch (e) {
      console.error('[Achievements] handleSessionComplete error:', e);
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
        .today-stats-row { display:flex; justify-content:center; align-items:center; gap:40px; flex-wrap:wrap; margin-bottom:20px; }
        @media (max-width:600px) {
          .today-stats-row { flex-direction:column; gap:24px; align-items:center; }
          .today-mission-card { font-size:0.9em; }
          .today-btn { min-height:44px; }
        }
        @keyframes tapPulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
        .tap-dot { animation: tapPulse 2s ease-in-out infinite; }
        @keyframes flamePulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
        .flame-pulse { animation: flamePulse 1.5s ease-in-out infinite; display:inline-flex; }
        @keyframes pulseExpand { 0%,100%{transform:scale(1);filter:drop-shadow(0 0 0px #C0392B)} 50%{transform:scale(1.2);filter:drop-shadow(0 0 6px #C0392B)} }
        .pulse-expand { display:inline-block; animation: pulseExpand 1.5s ease-in-out infinite; }
        .override-link { background:none; border:none; color:#555; font-family:'Barlow Condensed',sans-serif; font-size:12px; letter-spacing:0.06em; cursor:pointer; padding:0; text-decoration:none; }
        .override-link:hover { text-decoration:underline; color:#787878; }
      `}</style>

      {/* ── Stats row ─────────────────────────────────────────── */}
      <div className="today-stats-row">
        <ProgressRing startDate={startDate} />
        <FlipCard currentWeight={currentWeight} targetWeight={targetWeight} />
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
      <StatChips plan={null} intakeGoal={null} />

      {/* ── Today's Mission ────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }} className="today-mission-card">
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.06em', color: '#F5F3EE', marginBottom: 14, marginTop: 4 }}>
          Today's Session
        </div>
        {isUnlocked ? (
          <>
            {/* Session picker — shown when training override is active */}
            {dayOverride === 'training' && phase1Sessions.length > 0 && (
              <div style={{ marginBottom: 12, padding: '14px 16px', background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.08)' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#555', marginBottom: 10 }}>
                  Pick a session
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {phase1Sessions.map(s => {
                    const selected = overrideSession === s.name;
                    return (
                      <button
                        key={s.name}
                        type="button"
                        onClick={() => handleOverride('training', s.name)}
                        style={{
                          padding: '7px 14px',
                          background: '#111',
                          border: `1px solid ${selected ? '#C0392B' : '#2a2a2a'}`,
                          color: selected ? '#C0392B' : '#787878',
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s, color 0.15s',
                        }}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Card */}
            {effectiveIsRestDay ? (
              <RestDayCard tomorrowSession={tomorrowSession} />
            ) : effectiveSession ? (
              <MissionCard session={effectiveSession} library={library} sessionLength={sessionLength} weekNum={weekNum} onComplete={handleSessionComplete} onOpenLogbook={onOpenLogbook} />
            ) : null}
          </>
        ) : (
          <div style={{ position: 'relative' }}>
            <div style={{ filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none', background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.12)', padding: '20px' }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#C0392B', marginBottom: 8 }}>Today's Mission</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: '#F5F3EE' }}>Upper Body A</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {['6 exercises', '45 min', 'Upper Body'].map(t => (
                  <span key={t} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', padding: '4px 12px', fontSize: 11, color: '#555', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.14em', textTransform: 'uppercase' }}>{t}</span>
                ))}
              </div>
            </div>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,8,8,0.5)' }}>
              <button className="btn-primary today-btn" onClick={onUnlock} style={{ fontSize: 12, padding: '10px 20px' }}>
                Unlock — £9.99/month
              </button>
            </div>
          </div>
        )}

        {/* ── Day override links ──────────────────────────────── */}
        {isUnlocked && (effectiveSession || effectiveIsRestDay || dayOverride === 'training') && (
          <div style={{ marginTop: 16, display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
            {dayOverride === null && (
              <button
                type="button"
                className="override-link"
                onClick={() => handleOverride(effectiveIsRestDay ? 'training' : 'rest')}
              >
                {effectiveIsRestDay
                  ? 'Training today anyway? Switch to training day'
                  : 'Taking a rest day today? Switch to rest day'}
              </button>
            )}
            {dayOverride !== null && (
              <button type="button" className="override-link" onClick={() => handleOverride(null)}>
                Reset to default
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Today's Nutrition ──────────────────────────────────── */}
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.06em', color: '#F5F3EE', marginBottom: 14 }}>
        Today's Nutrition
      </div>
      {isUnlocked && nutrition ? (
        <div style={{ background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.12)', padding: '20px', marginBottom: 28 }}>
          {[
            ['Calories', (nutrition.training_day?.calories ?? '—') + ' kcal'],
            ['Protein',  (nutrition.training_day?.protein  ?? '—') + 'g'],
            ['Carbs',    (nutrition.training_day?.carbs    ?? '—') + 'g'],
            ['Fat',      (nutrition.training_day?.fat      ?? '—') + 'g'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#CDCDC8', padding: '8px 0', borderBottom: '1px solid #1a1a1a' }}>
              <span style={{ color: '#787878' }}>{k}</span>
              <span style={{ color: '#F5F3EE', fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ position: 'relative', marginBottom: 28 }}>
          <div style={{ filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none', background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.12)', padding: '20px' }}>
            {[['Calories','2,800 kcal'],['Protein','180g'],['Carbs','320g'],['Fat','78g']].map(([k,v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#CDCDC8', padding: '8px 0', borderBottom: '1px solid #1a1a1a' }}>
                <span style={{ color: '#787878' }}>{k}</span><span>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,8,8,0.5)' }}>
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
          style={{ background: 'none', border: '1px solid rgba(200,200,200,0.2)', color: '#787878', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', padding: '12px 24px', cursor: 'pointer' }}
        >
          Log Today's Weight →
        </button>
        {logSuccess && (
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', color: '#4CAF50' }}>
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
