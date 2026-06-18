import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getWeekSchedule, saveWeekSchedule, resetWeekSchedule } from '../lib/api';

const DAY_LABELS    = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Full names match TodayTab's DAY_NAMES_JS / DAY_ORDER_MON constants exactly
const DAY_NAMES_JS  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ORDER_MON = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getMondayOfWeek(d = new Date()) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

function toISODate(d) { return d.toISOString().split('T')[0]; }

// Mirrors getSessionForToday logic — uses flatMap across all phases so rotation matches.
function buildDefaultSchedule(plan, intakeSchedule, startDateStr, mondayDate) {
  const allSessions = (plan?.phases || []).flatMap(p => p.sessions || []);
  const numTrainingDays = parseInt(intakeSchedule?.trainingDays || '4', 10);
  const scheduleType    = intakeSchedule?.scheduleType || 'rolling';
  const preferredDays   = intakeSchedule?.preferredDays || [];
  const planStart = startDateStr ? new Date(startDateStr) : new Date(mondayDate);
  planStart.setHours(0, 0, 0, 0);

  if (!allSessions.length)
    return Object.fromEntries([...Array(7)].map((_, i) => [String(i), null]));

  const schedule = {};
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(mondayDate);
    dayDate.setDate(mondayDate.getDate() + i);
    dayDate.setHours(0, 0, 0, 0);
    const daysElapsed = Math.max(0, Math.floor((dayDate - planStart) / 86400000));
    const dayNameJs   = DAY_NAMES_JS[dayDate.getDay()];

    if (scheduleType === 'fixed' && preferredDays.length > 0) {
      const sortedDays = [...preferredDays].sort((a, b) => DAY_ORDER_MON.indexOf(a) - DAY_ORDER_MON.indexOf(b));
      if (!sortedDays.includes(dayNameJs)) {
        schedule[String(i)] = null;
      } else {
        const weeksPassed = Math.floor(daysElapsed / 7);
        const dayIdx      = sortedDays.indexOf(dayNameJs);
        const sessionIdx  = (weeksPassed * sortedDays.length + dayIdx) % allSessions.length;
        schedule[String(i)] = allSessions[sessionIdx].name;
      }
    } else {
      const dayInCycle = daysElapsed % 7;
      const fullWeeks  = Math.floor(daysElapsed / 7);
      if (dayInCycle >= numTrainingDays) {
        schedule[String(i)] = null;
      } else {
        const sessionsCompleted = fullWeeks * numTrainingDays + dayInCycle;
        schedule[String(i)] = allSessions[sessionsCompleted % allSessions.length].name;
      }
    }
  }
  return schedule;
}

// Map session name → primary muscle group for conflict detection.
const MUSCLE_KEYWORDS = {
  push:  ['push', 'chest', 'shoulder', 'tricep', 'press'],
  pull:  ['pull', 'back', 'row', 'bicep', 'lat', 'chin'],
  legs:  ['leg', 'squat', 'deadlift', 'glute', 'hamstring', 'quad', 'lunge', 'hinge'],
  upper: ['upper'],
  lower: ['lower'],
};

function getMuscleGroup(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  for (const [group, kws] of Object.entries(MUSCLE_KEYWORDS)) {
    if (kws.some(k => n.includes(k))) return group;
  }
  return null;
}

function conflictDays(schedule) {
  const set = new Set();
  for (let d = 0; d < 6; d++) {
    const a = schedule[String(d)], b = schedule[String(d + 1)];
    if (!a || !b) continue;
    const ga = getMuscleGroup(a), gb = getMuscleGroup(b);
    if (ga && gb && ga === gb) { set.add(d); set.add(d + 1); }
  }
  return set;
}

export default function WeeklyScheduleView({ plan, intakeSchedule, startDate, weekNum, onClose, onScheduleChange }) {
  const monday     = getMondayOfWeek();
  const weekStart  = toISODate(monday);
  const todayDayIdx = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })(); // 0=Mon

  const [schedule,    setSchedule]    = useState(null);
  const [defaults,    setDefaults]    = useState(null);
  const [hasOverride, setHasOverride] = useState(false);
  const [dragFrom,    setDragFrom]    = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState('');

  useEffect(() => {
    const def = buildDefaultSchedule(plan, intakeSchedule, startDate, monday);
    setDefaults(def);
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setSchedule(def); return; }
        const result = await getWeekSchedule(weekStart, session.access_token);
        if (result.schedule) { setSchedule(result.schedule); setHasOverride(true); }
        else { setSchedule(def); setHasOverride(false); }
      } catch { setSchedule(def); }
    })();
  }, []);

  async function persist(newSchedule) {
    setSaving(true); setErr('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await saveWeekSchedule(weekStart, newSchedule, session.access_token);
      setHasOverride(true);
      onScheduleChange?.(newSchedule);
    } catch (e) { setErr('Could not save — try again.'); }
    finally { setSaving(false); }
  }

  async function handleReset() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await resetWeekSchedule(weekStart, session.access_token);
      setSchedule(defaults);
      setHasOverride(false);
      onScheduleChange?.(null);
    } catch { setErr('Could not reset — try again.'); }
  }

  function handleDrop(toDay) {
    if (dragFrom === null || dragFrom === toDay) { setDragFrom(null); return; }
    const next = { ...schedule };
    [next[String(dragFrom)], next[String(toDay)]] = [next[String(toDay)], next[String(dragFrom)]];
    setSchedule(next);
    persist(next);
    setDragFrom(null);
  }

  if (!schedule) {
    return <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#555', letterSpacing: '0.06em' }}>Loading…</p>;
  }

  const conflicts = conflictDays(schedule);

  return (
    <div style={{ marginTop: 20 }}>
      {/* Conflict warning */}
      {conflicts.size > 0 && (
        <div style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.35)', padding: '10px 14px', marginBottom: 14, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#CDCDC8', letterSpacing: '0.04em', lineHeight: 1.5 }}>
          <span style={{ color: '#C0392B', fontWeight: 700 }}>Heads up</span> — consecutive sessions train similar muscle groups. Consider a rest day between them if you can.
        </div>
      )}

      {/* 7-day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5, overflowX: 'auto' }}>
        {DAY_LABELS.map((label, i) => {
          const name       = schedule[String(i)];
          const isToday    = i === todayDayIdx;
          const isConflict = conflicts.has(i);
          const isDragging = dragFrom === i;

          return (
            <div
              key={i}
              draggable={!!name}
              onDragStart={() => setDragFrom(i)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => setDragFrom(null)}
              style={{
                background:  isDragging ? '#1a1a1a' : '#0d0d0d',
                border:      `1px solid ${isConflict ? 'rgba(192,57,43,0.55)' : isToday ? 'rgba(200,200,200,0.28)' : 'rgba(200,200,200,0.1)'}`,
                padding:     '8px 4px',
                minHeight:   72,
                display:     'flex',
                flexDirection: 'column',
                alignItems:  'center',
                gap:         5,
                cursor:      name ? 'grab' : 'default',
                opacity:     isDragging ? 0.35 : 1,
                transition:  'opacity 0.12s',
                userSelect:  'none',
              }}
            >
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: isToday ? '#C0392B' : '#444' }}>
                {label}
              </div>
              {name ? (
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#F5F3EE', textAlign: 'center', lineHeight: 1.3, padding: '0 2px' }}>
                  {name}
                </div>
              ) : (
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, color: '#2a2a2a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Rest
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {hasOverride && (
          <button onClick={handleReset} style={{ background: 'none', border: '1px solid rgba(200,200,200,0.18)', color: '#787878', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '7px 14px', cursor: 'pointer' }}>
            Reset to default
          </button>
        )}
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer', padding: 0 }}>
          Close ✕
        </button>
        {saving && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: '#555', letterSpacing: '0.06em' }}>Saving…</span>}
        {err    && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: '#ef4444' }}>{err}</span>}
      </div>

      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: '#333', letterSpacing: '0.06em', marginTop: 10 }}>
        Drag sessions between days to swap. Override resets automatically next week.
      </p>
    </div>
  );
}
