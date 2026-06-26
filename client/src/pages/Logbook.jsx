import React, { useEffect, useState, useCallback, useRef } from 'react';
import { GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../lib/supabase';

// ─── EXERCISE AUTOCOMPLETE LIST ───────────────────────────────────────────────

const EXERCISE_LIST = [
  'Arnold Press', 'Barbell Bench Press', 'Barbell Row', 'Cable Fly',
  'Cable Lateral Raise', 'Calf Raise', 'Chest Dip', 'Deadlift',
  'Dumbbell Curl', 'Dumbbell Shoulder Press', 'EZ Bar Skull Crushers',
  'Face Pull', 'Hammer Curl', 'Hip Thrust', 'Incline Curl',
  'Incline Dumbbell Press', 'Incline Plate Loaded Chest Press',
  'Lat Pulldown', 'Leg Curl', 'Leg Extension', 'Leg Press',
  'Overhead Press', 'Pec Fly Machine', 'Preacher Curl', 'Pull Up',
  'Romanian Deadlift', 'Seated Cable Row', 'Squat', 'Tricep Dip',
  'Tricep Pushdown Rope',
];

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────

const C = {
  surface:    '#131119',
  surface2:   '#0C0A0F',
  bone:       '#F3F1ED',
  ash:        '#ABA9B0',
  ashDim:     '#7A7880',
  pinkGlow:   'rgba(255,79,196,0.5)',
  pinkLine:   'rgba(255,79,196,0.25)',
  pinkBorder: 'rgba(255,79,196,0.1)',
};

const ctaBtn = {
  background: 'linear-gradient(160deg, #18151F, #100E15)',
  border: `1px solid rgba(255,79,196,0.25)`,
  color: '#F3F1ED',
  borderRadius: 10,
  fontFamily: "'Oswald', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: '1.4px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  boxShadow: `0 8px 22px -8px rgba(255,79,196,0.5)`,
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function groupHistory(rows) {
  const groups = {};
  const order  = [];
  for (const row of rows) {
    const d       = new Date(row.logged_at);
    const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const key     = `${d.toISOString().split('T')[0]}__${row.session_name || ''}`;
    if (!groups[key]) {
      groups[key] = { key, date: dateStr, sessionName: row.session_name || 'Unknown', exercises: [], rawDate: row.logged_at };
      order.push(key);
    }
    groups[key].exercises.push(row);
  }
  return order.map(k => groups[k]);
}

function computePRs(rows) {
  const sorted     = [...rows].sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at));
  const runningMax = {};
  const prs        = new Set();
  for (const row of sorted) {
    const prev = runningMax[row.exercise_name];
    if (prev !== undefined && row.weight_kg > prev) prs.add(row.id);
    if (prev === undefined || row.weight_kg > prev) runningMax[row.exercise_name] = row.weight_kg;
  }
  return prs;
}

function inp(extra = {}) {
  return {
    padding: '10px 12px',
    background: C.surface2,
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    color: C.bone,
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    outline: 'none',
    ...extra,
  };
}

// ─── AUTOCOMPLETE INPUT ───────────────────────────────────────────────────────

function AutocompleteInput({ value, onChange, extraOptions, inputStyle }) {
  const [showSugg, setShowSugg] = useState(false);
  const wrapperRef = useRef(null);

  const allOptions = [...new Set([...EXERCISE_LIST, ...(extraOptions || [])])].sort();
  const suggestions = value.length < 1 ? [] : allOptions
    .filter(e => e.toLowerCase().includes(value.toLowerCase()))
    .slice(0, 5);

  useEffect(() => {
    function handleOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowSugg(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setShowSugg(true); }}
        onFocus={() => setShowSugg(true)}
        style={inputStyle || inp({ width: '100%', fontWeight: 600, boxSizing: 'border-box' })}
      />
      {showSugg && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: C.surface,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          boxShadow: '0 8px 22px -8px rgba(0,0,0,0.7)',
          marginTop: 2,
          overflow: 'hidden',
        }}>
          {suggestions.map(s => (
            <button
              key={s}
              type="button"
              onMouseDown={e => { e.preventDefault(); onChange(s); setShowSugg(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', background: 'none',
                border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                padding: '10px 12px', color: C.ash,
                fontFamily: "'Inter', sans-serif", fontSize: 13, cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = C.bone; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.ash; }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── EXERCISE CARD ───────────────────────────────────────────────────────────

function ExerciseCard({ ex, idx, lastKg, onChange, dragHandleProps, planExerciseNames }) {
  return (
    <div style={{
      background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12, padding: 16, marginBottom: 10,
    }}>
      {/* Row 1: drag handle + autocomplete name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span
          style={{ color: C.ashDim, cursor: 'grab', flexShrink: 0, display: 'flex', alignItems: 'center', touchAction: 'none' }}
          {...dragHandleProps}
        >
          <GripVertical size={18} strokeWidth={1.5} />
        </span>
        <AutocompleteInput
          value={ex.name}
          onChange={val => onChange(idx, 'name', val)}
          extraOptions={planExerciseNames}
          inputStyle={inp({ flex: 1, fontWeight: 600, boxSizing: 'border-box', width: '100%' })}
        />
      </div>

      {/* Row 2: sets / reps / weight */}
      <div className="logbook-fields">
        <label style={fieldLabel}>
          Sets
          <input
            type="text"
            value={ex.sets}
            onChange={e => onChange(idx, 'sets', e.target.value)}
            style={inp({ width: '100%', boxSizing: 'border-box' })}
          />
        </label>
        <label style={fieldLabel}>
          Reps
          <input
            type="text"
            value={ex.reps}
            onChange={e => onChange(idx, 'reps', e.target.value)}
            style={inp({ width: '100%', boxSizing: 'border-box' })}
          />
        </label>
        <label style={fieldLabel}>
          Weight (kg)
          <input
            type="number"
            step="0.5"
            value={ex.weight}
            onChange={e => onChange(idx, 'weight', e.target.value)}
            placeholder="kg"
            style={inp({ width: '100%', boxSizing: 'border-box' })}
          />
          {lastKg != null && (
            <span style={{ fontSize: 10, color: C.ashDim, fontFamily: "'Inter', sans-serif", fontStyle: 'italic' }}>
              Last: {lastKg} kg
            </span>
          )}
        </label>
      </div>

      {/* Row 3: notes */}
      <input
        type="text"
        value={ex.notes}
        onChange={e => onChange(idx, 'notes', e.target.value)}
        placeholder="Notes…"
        style={{ ...inp({ width: '100%', marginTop: 10, boxSizing: 'border-box' }), fontStyle: ex.notes ? 'normal' : 'italic' }}
      />
    </div>
  );
}

// ─── SORTABLE WRAPPER ─────────────────────────────────────────────────────────

function SortableExerciseCard(props) {
  const { ex } = props;
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: ex.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        zIndex: isDragging ? 1 : 'auto',
      }}
    >
      <ExerciseCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

// ─── SESSION DROPDOWN ────────────────────────────────────────────────────────

function SessionDropdown({ phases, selectedSession, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '16px 18px',
          background: C.surface,
          border: open ? `1px solid ${C.pinkLine}` : '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          color: selectedSession ? C.bone : C.ashDim,
          fontFamily: "'Inter', sans-serif", fontSize: 14,
          textAlign: 'left', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          minHeight: 44,
          transition: 'border-color 0.25s, box-shadow 0.25s',
          boxShadow: open ? `0 0 20px -8px ${C.pinkGlow}` : 'none',
          outline: 'none',
        }}
      >
        <span>{selectedSession?.name || 'Select a session…'}</span>
        <span style={{
          color: C.ashDim, fontSize: 11, marginLeft: 8, flexShrink: 0,
          display: 'inline-block', transition: 'transform 0.25s',
          transform: open ? 'rotate(180deg)' : 'none',
        }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: C.surface,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          marginTop: 8,
          maxHeight: 300, overflowY: 'auto',
          boxShadow: '0 14px 34px -16px rgba(0,0,0,0.6)',
        }}>
          {(phases || []).map(phase => (
            <React.Fragment key={phase.phase}>
              <div style={{
                padding: '12px 18px 6px',
                fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600,
                letterSpacing: '1.3px', textTransform: 'uppercase', color: C.ashDim,
                userSelect: 'none',
              }}>
                Phase {phase.phase} — {phase.label || ''}
              </div>
              {(phase.sessions || []).map((s, i) => {
                const isActive = selectedSession?.name === s.name;
                return (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); onSelect(s); setOpen(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', minHeight: 44,
                      background: isActive ? 'rgba(255,255,255,0.03)' : 'none',
                      border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                      padding: '13px 18px',
                      color: isActive ? C.bone : C.ash,
                      fontFamily: "'Inter', sans-serif", fontSize: 14,
                      cursor: 'pointer', outline: 'none',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'none'; }}
                  >
                    {s.name}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HISTORY ENTRY ───────────────────────────────────────────────────────────

function HistoryEntry({ group, expanded, onToggle, prSet }) {
  return (
    <div style={{
      background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
      border: `1px solid ${C.pinkBorder}`,
      borderRadius: 16,
      marginBottom: 14,
      overflow: 'hidden',
      boxShadow: `0 12px 30px -16px rgba(0,0,0,0.55), 0 0 22px -14px ${C.pinkGlow}, 0 1px 0 rgba(255,255,255,0.03) inset`,
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '20px 22px', textAlign: 'left',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          minHeight: 44,
        }}
      >
        <div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 700, textTransform: 'uppercase', color: C.bone, marginBottom: 4 }}>
            {group.sessionName}
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: C.ashDim }}>
            {group.date} · {group.exercises.length} exercise{group.exercises.length !== 1 ? 's' : ''}
          </div>
        </div>
        <span style={{ color: C.ashDim, fontSize: 18, fontWeight: 300, minWidth: 20, textAlign: 'center', lineHeight: 1 }}>
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '0 22px 18px' }}>
          {group.exercises.map(ex => (
            <div key={ex.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '13px 0', borderTop: '1px solid rgba(255,255,255,0.05)',
            }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: C.bone }}>{ex.exercise_name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 13.5, color: C.bone }}>{ex.weight_kg} kg</span>
                {prSet.has(ex.id) && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    padding: '3px 8px', borderRadius: 6,
                    background: C.surface2,
                    border: `1px solid ${C.pinkLine}`,
                    boxShadow: `0 0 10px -2px ${C.pinkGlow}`,
                    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', color: C.bone,
                  }}>PR</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function Logbook({ userId, plan, preselectedSession }) {
  const [selectedSession, setSelectedSession] = useState(null);
  const [exercises, setExercises]             = useState([]);
  const [lastLifts, setLastLifts]             = useState({});
  const [saving, setSaving]                   = useState(false);
  const [saved, setSaved]                     = useState(false);
  const [saveErr, setSaveErr]                 = useState('');
  const [weekNum, setWeekNum]                 = useState(1);
  const [history, setHistory]                 = useState([]);
  const [expandedKeys, setExpandedKeys]       = useState(new Set());
  const [prSet, setPrSet]                     = useState(new Set());
  const [activeId, setActiveId]               = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const library           = plan?.exercise_library || {};
  const planExerciseNames = Object.values(library).map(e => e.name).filter(Boolean);
  const allSessions       = (plan?.phases || []).flatMap(p =>
    (p.sessions || []).map(s => ({ ...s, phaseNum: p.phase, phaseLabel: p.label }))
  );

  // ── Initial data load ─────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('lift_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false });
    if (data) {
      setHistory(groupHistory(data));
      setPrSet(computePRs(data));
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('intake_submissions')
        .select('data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.data?.startDate) {
        const daysIn = Math.max(0, Math.floor((Date.now() - new Date(data.data.startDate)) / 86400000));
        setWeekNum(Math.min(12, Math.floor(daysIn / 7) + 1));
      }
    })();
  }, [fetchHistory]);

  // ── Auto-select preselected session ───────────────────────────────────────

  useEffect(() => {
    if (!preselectedSession || !plan) return;
    const found = allSessions.find(s => s.name === preselectedSession);
    if (found) loadSession(found);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedSession, plan]);

  // ── Session loading ───────────────────────────────────────────────────────

  async function loadSession(session) {
    setSelectedSession(session);
    setSaved(false);
    setSaveErr('');
    // Preserve exact plan order — no sorting here
    const exList = [...(session.exercises || [])].map((ex, i) => ({
      id:     `${ex.ex}-${i}`,
      key:    ex.ex,
      name:   library[ex.ex]?.name || ex.ex,
      sets:   String(ex.sets ?? ''),
      reps:   String(ex.reps ?? ''),
      weight: '',
      notes:  '',
    }));
    setExercises(exList);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !exList.length) return;
    const names = exList.map(e => e.name);
    const { data } = await supabase
      .from('lift_logs')
      .select('exercise_name, weight_kg')
      .eq('user_id', user.id)
      .in('exercise_name', names)
      .order('logged_at', { ascending: false });
    if (data) {
      const last = {};
      for (const r of data) {
        if (!(r.exercise_name in last)) last[r.exercise_name] = r.weight_kg;
      }
      setLastLifts(last);
    }
  }

  // ── Exercise card handlers ────────────────────────────────────────────────

  function updateExercise(idx, field, value) {
    setExercises(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  }

  // ── DnD handlers ─────────────────────────────────────────────────────────

  function handleDragStart(event) { setActiveId(event.active.id); }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    if (active.id !== over?.id) {
      setExercises(prev => {
        const oldIdx = prev.findIndex(e => e.id === active.id);
        const newIdx = prev.findIndex(e => e.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaveErr('');
    const toSave = exercises.filter(e => parseFloat(e.weight) > 0);
    if (!toSave.length) { setSaveErr('Enter at least one weight before saving.'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setSaveErr('Not authenticated.'); return; }
    const now = new Date().toISOString();
    const { error } = await supabase.from('lift_logs').insert(
      toSave.map(e => ({
        user_id:       user.id,
        exercise_name: e.name,
        weight_kg:     parseFloat(e.weight),
        logged_at:     now,
        session_name:  selectedSession?.name || '',
        week_number:   weekNum,
      }))
    );
    setSaving(false);
    if (error) { setSaveErr(error.message || 'Failed to save.'); return; }

    // Update ghost numbers immediately — no reload needed
    setLastLifts(prev => {
      const next = { ...prev };
      toSave.forEach(e => { next[e.name] = parseFloat(e.weight); });
      return next;
    });

    setSaved(true);
    fetchHistory();
    setTimeout(() => setSaved(false), 3500);
  }

  // ── History toggle ────────────────────────────────────────────────────────

  function toggleHistory(key) {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const activeEx = exercises.find(e => e.id === activeId);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      <style>{`
        .logbook-fields {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 480px) {
          .logbook-fields { grid-template-columns: 1fr; }
        }
        .logbook-save-btn { min-height: 44px; padding: 18px 0; }
        @media (max-width: 600px) {
          .logbook-save-btn { min-height: 52px; }
        }
      `}</style>

      {/* ── Session selector ──────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={eyebrow}>Session</div>
        {allSessions.length === 0 ? (
          <p style={{ color: C.ash, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
            Unlock your plan to access session data.
          </p>
        ) : (
          <SessionDropdown
            phases={plan?.phases || []}
            selectedSession={selectedSession}
            onSelect={loadSession}
          />
        )}
      </div>

      {/* ── Logging view ──────────────────────────────────────── */}
      {selectedSession && (
        <div style={{ marginBottom: 40 }}>
          <div style={sectionHead}>{selectedSession.name}</div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={exercises.map(e => e.id)}
              strategy={verticalListSortingStrategy}
            >
              {exercises.map((ex, i) => (
                <SortableExerciseCard
                  key={ex.id}
                  ex={ex}
                  idx={i}
                  lastKg={lastLifts[ex.name] ?? null}
                  onChange={updateExercise}
                  planExerciseNames={planExerciseNames}
                />
              ))}
            </SortableContext>

            <DragOverlay>
              {activeEx ? (
                <div style={{
                  background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
                  border: `1px solid ${C.pinkLine}`,
                  borderRadius: 12, padding: 16,
                  boxShadow: `0 8px 24px rgba(0,0,0,0.6), 0 0 22px -8px ${C.pinkGlow}`,
                  opacity: 0.92,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <GripVertical size={18} strokeWidth={1.5} color={C.ashDim} />
                    <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14, color: C.bone }}>
                      {activeEx.name}
                    </span>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {saveErr && (
            <p style={{ color: '#fca5a5', fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 12 }}>
              {saveErr}
            </p>
          )}
          {!saved ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="logbook-save-btn"
              style={{
                ...ctaBtn,
                width: '100%', marginTop: 4,
                opacity: saving ? 0.6 : 1,
                boxShadow: saving ? 'none' : ctaBtn.boxShadow,
              }}
            >
              {saving ? '…' : 'Save Session Log'}
            </button>
          ) : (
            <div style={{
              textAlign: 'center', padding: '18px 0',
              fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#4A9968',
              background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
              border: '1px solid rgba(74,153,104,0.25)', borderRadius: 10,
            }}>
              ✓ Logbook saved.
            </div>
          )}
        </div>
      )}

      {/* ── Log history ───────────────────────────────────────── */}
      <div>
        <div style={sectionHead}>Previous Sessions</div>
        {history.length === 0 ? (
          <p style={{ color: C.ash, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
            No sessions logged yet.
          </p>
        ) : (
          history.map(group => (
            <HistoryEntry
              key={group.key}
              group={group}
              expanded={expandedKeys.has(group.key)}
              onToggle={() => toggleHistory(group.key)}
              prSet={prSet}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── STYLE TOKENS ────────────────────────────────────────────────────────────

const sectionHead = {
  fontFamily: "'Oswald', sans-serif",
  fontWeight: 700,
  fontSize: 18,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: '#F3F1ED',
  marginBottom: 16,
  marginTop: 4,
};

const eyebrow = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: '#7A7880',
  marginBottom: 12,
};

const fieldLabel = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '1.4px',
  textTransform: 'uppercase',
  color: '#7A7880',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};
