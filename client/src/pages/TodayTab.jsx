import React, { useEffect, useState, useCallback } from 'react';
import { Flame } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

function calcStreak(completions) {
  if (!completions?.length) return 0;
  const daySet = new Set(completions.map(c => localDayKey(new Date(c.completed_at))));
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (!daySet.has(localDayKey(today)) && !daySet.has(localDayKey(yesterday))) return 0;
  const cursor = daySet.has(localDayKey(today)) ? new Date(today) : new Date(yesterday);
  let n = 0;
  while (daySet.has(localDayKey(cursor))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
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
  const flameSize  = streak >= 30 ? 40 : streak >= 7 ? 36 : 32;
  const flameColor = streak === 0 ? '#333333' : streak >= 30 ? '#FF4500' : streak >= 7 ? '#FF6B00' : '#C0392B';

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
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '20px 20px 12px', textAlign: 'left' }}
      >
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#C0392B', marginBottom: 8 }}>
          Today's Mission
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#F5F3EE', lineHeight: 1 }}>
            {session.name}
          </div>
          <span style={{ color: '#555', fontSize: 20, paddingTop: 2 }}>{open ? '−' : '+'}</span>
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
        if (intake.data.targetWeight) setTargetWeight(Number(intake.data.targetWeight));
        if (intake.data.startDate)    setStartDate(intake.data.startDate);
        if (intake.data.sessionLength) setSessionLength(intake.data.sessionLength);
      }

      // Streak — handle gracefully if table absent
      try {
        const { data: completions, error: cErr } = await supabase
          .from('session_completions')
          .select('completed_at')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false });
        if (!cErr && completions) setStreak(calcStreak(completions));
      } catch { /* table may not exist yet */ }
    }
    load();
  }, []);

  const weekNum      = getWeekNum(startDate);
  const todaySession = plan?.phases?.[0]?.sessions?.[0];
  const library      = plan?.exercise_library || {};
  const nutrition    = plan?.nutrition;

  async function handleSessionComplete() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      const { data: completions } = await supabase
        .from('session_completions')
        .select('completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });
      if (completions) setStreak(calcStreak(completions));
    } catch { /* ignore if table absent */ }
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
        @media (max-width:540px) { .today-stats-row { flex-direction:column; gap:24px; } }
        @keyframes tapPulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
        .tap-dot { animation: tapPulse 2s ease-in-out infinite; }
        @keyframes flamePulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
        .flame-pulse { animation: flamePulse 1.5s ease-in-out infinite; display:inline-flex; }
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

      {/* ── Today's Mission ────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.06em', color: '#F5F3EE', marginBottom: 14, marginTop: 4 }}>
          Today's Session
        </div>
        {isUnlocked && todaySession ? (
          <MissionCard session={todaySession} library={library} sessionLength={sessionLength} weekNum={weekNum} onComplete={handleSessionComplete} onOpenLogbook={onOpenLogbook} />
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
              <button className="btn-primary" onClick={onUnlock} style={{ fontSize: 12, padding: '10px 20px' }}>
                Unlock — £9.99/month
              </button>
            </div>
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
