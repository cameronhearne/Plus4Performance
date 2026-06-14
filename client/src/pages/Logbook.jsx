import React, { useEffect, useState, useCallback } from 'react';
import { GripVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  // Process oldest → newest; mark a row ID as PR when it beats previous max
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

// ─── EXERCISE CARD ───────────────────────────────────────────────────────────

function ExerciseCard({ ex, idx, total, lastKg, onChange, onMove }) {
  return (
    <div style={{
      background: '#111', border: '1px solid #1e1e1e',
      padding: '16px', marginBottom: 10,
    }}>
      {/* Row 1: grip + name + reorder */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ color: '#333', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <GripVertical size={16} strokeWidth={1.5} />
        </span>
        <input
          type="text"
          value={ex.name}
          onChange={e => onChange(idx, 'name', e.target.value)}
          style={inp({ flex: 1, fontWeight: 600 })}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => onMove(idx, -1)}
            disabled={idx === 0}
            style={reorderBtn}
          >▲</button>
          <button
            type="button"
            onClick={() => onMove(idx, 1)}
            disabled={idx === total - 1}
            style={reorderBtn}
          >▼</button>
        </div>
      </div>

      {/* Row 2: sets / reps / weight */}
      <div className="logbook-fields">
        <label style={fieldLabel}>
          Sets
          <input
            type="text"
            value={ex.sets}
            onChange={e => onChange(idx, 'sets', e.target.value)}
            style={inp({ width: '100%' })}
          />
        </label>
        <label style={fieldLabel}>
          Reps
          <input
            type="text"
            value={ex.reps}
            onChange={e => onChange(idx, 'reps', e.target.value)}
            style={inp({ width: '100%' })}
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
            style={inp({ width: '100%' })}
          />
          {lastKg != null && (
            <span style={{ fontSize: 10, color: '#555', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.08em', marginTop: 4, display: 'block' }}>
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
        placeholder="Notes..."
        style={{ ...inp({ width: '100%', marginTop: 10 }), boxSizing: 'border-box', fontStyle: ex.notes ? 'normal' : 'italic' }}
      />
    </div>
  );
}

// ─── HISTORY ENTRY ───────────────────────────────────────────────────────────

function HistoryEntry({ group, expanded, onToggle, prSet }) {
  return (
    <div style={{ background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.08)', marginBottom: 8 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 20px', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', color: '#F5F3EE', marginBottom: 2 }}>
            {group.sessionName}
          </div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555', letterSpacing: '0.08em' }}>
            {group.date} · {group.exercises.length} exercise{group.exercises.length !== 1 ? 's' : ''}
          </div>
        </div>
        <span style={{ color: '#555', fontSize: 18 }}>{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div style={{ padding: '0 20px 16px' }}>
          {group.exercises.map(ex => (
            <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #1a1a1a', fontSize: 13, color: '#CDCDC8' }}>
              <span>{ex.exercise_name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#787878' }}>{ex.weight_kg} kg</span>
                {prSet.has(ex.id) && (
                  <span style={{ background: '#C0392B', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', padding: '2px 5px' }}>
                    PR
                  </span>
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

  const library     = plan?.exercise_library || {};
  const allSessions = (plan?.phases || []).flatMap(p =>
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
    // Fetch start date for week number
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
    const exList = (session.exercises || []).map(ex => ({
      key:    ex.ex,
      name:   library[ex.ex]?.name || ex.ex,
      sets:   String(ex.sets ?? ''),
      reps:   String(ex.reps ?? ''),
      weight: '',
      notes:  '',
    }));
    setExercises(exList);

    // Fetch last logged weights for this session's exercises
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

  function moveExercise(idx, dir) {
    setExercises(prev => {
      const next = [...prev];
      const j    = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaveErr('');
    const rows = exercises.filter(e => parseFloat(e.weight) > 0);
    if (!rows.length) { setSaveErr('Enter at least one weight before saving.'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setSaveErr('Not authenticated.'); return; }
    const now = new Date().toISOString();
    const { error } = await supabase.from('lift_logs').insert(
      rows.map(e => ({
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
      `}</style>

      {/* ── Session selector ──────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={eyebrow}>Session</div>
        {allSessions.length === 0 ? (
          <p style={{ color: '#555', fontSize: 13, fontFamily: "'Barlow Condensed', sans-serif" }}>
            Unlock your plan to access session data.
          </p>
        ) : (
          <select
            value={selectedSession?.name || ''}
            onChange={e => {
              const found = allSessions.find(s => s.name === e.target.value);
              if (found) loadSession(found);
            }}
            style={{
              width: '100%', padding: '12px 14px', background: '#111',
              border: '1px solid rgba(200,200,200,0.15)', color: selectedSession ? '#F5F3EE' : '#555',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14,
              letterSpacing: '0.06em', outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">Select a session...</option>
            {(plan?.phases || []).map(phase => (
              <optgroup key={phase.phase} label={`Phase ${phase.phase} — ${phase.label || ''}`}>
                {(phase.sessions || []).map((s, i) => (
                  <option key={i} value={s.name}>{s.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </div>

      {/* ── Logging view ──────────────────────────────────────── */}
      {selectedSession && (
        <div style={{ marginBottom: 40 }}>
          <div style={sectionHead}>{selectedSession.name}</div>

          {exercises.map((ex, i) => (
            <ExerciseCard
              key={i}
              ex={ex}
              idx={i}
              total={exercises.length}
              lastKg={lastLifts[ex.name] ?? null}
              onChange={updateExercise}
              onMove={moveExercise}
            />
          ))}

          {/* Save button */}
          {saveErr && (
            <p style={{ color: '#ef4444', fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em', marginBottom: 12 }}>
              {saveErr}
            </p>
          )}
          {!saved ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{ width: '100%', background: '#C0392B', border: 'none', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', padding: '18px 0', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, marginTop: 4 }}
            >
              {saving ? '…' : 'Save Session Log'}
            </button>
          ) : (
            <div style={{ textAlign: 'center', padding: '18px 0', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '0.14em', color: '#4CAF50', background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
              ✓ Logbook saved.
            </div>
          )}
        </div>
      )}

      {/* ── Log history ───────────────────────────────────────── */}
      <div>
        <div style={sectionHead}>Previous Sessions</div>
        {history.length === 0 ? (
          <p style={{ color: '#555', fontSize: 13, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em' }}>
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
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 22,
  letterSpacing: '0.06em',
  color: '#F5F3EE',
  marginBottom: 16,
  marginTop: 4,
};

const eyebrow = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.28em',
  textTransform: 'uppercase',
  color: '#555',
  marginBottom: 10,
};

const fieldLabel = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: '#555',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

function inp(extra = {}) {
  return {
    padding: '9px 10px',
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    color: '#F5F3EE',
    fontFamily: "'Barlow', sans-serif",
    fontSize: 13,
    outline: 'none',
    ...extra,
  };
}

const reorderBtn = {
  background: 'none',
  border: '1px solid #2a2a2a',
  color: '#444',
  fontFamily: 'monospace',
  fontSize: 10,
  lineHeight: 1,
  padding: '2px 5px',
  cursor: 'pointer',
  display: 'block',
};
