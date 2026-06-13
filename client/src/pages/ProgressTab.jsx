import React, { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { supabase } from '../lib/supabase';

/*
  Supabase table required (run once in the Supabase SQL editor):

  create table weight_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    weight_kg numeric(5,2) not null,
    logged_at timestamptz not null default now()
  );
  alter table weight_logs enable row level security;
  create policy "Users manage own logs" on weight_logs
    for all using (auth.uid() = user_id);
*/

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function todayLocalRange() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);
  return { start, end };
}

function isTodayLocal(isoString) {
  const { start, end } = todayLocalRange();
  const d = new Date(isoString);
  return d >= start && d <= end;
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── CUSTOM TOOLTIP ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#111',
      border: '1px solid #2a2a2a',
      padding: '8px 14px',
    }}>
      <div style={{ color: '#787878', fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em', marginBottom: 4 }}>
        {fmtDate(label)}
      </div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: '#F5F3EE', lineHeight: 1 }}>
        {payload[0].value} <span style={{ fontSize: 14, color: '#787878' }}>kg</span>
      </div>
    </div>
  );
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, highlight }) {
  return (
    <div style={{
      flex: 1,
      background: '#111',
      border: `1px solid ${highlight ? '#C0392B' : 'rgba(200,200,200,0.1)'}`,
      padding: '20px 20px 18px',
    }}>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 32,
        color: '#F5F3EE',
        lineHeight: 1,
        marginBottom: 6,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: '#787878',
      }}>
        {label}
      </div>
      {sub && (
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 12,
          color: '#555',
          letterSpacing: '0.08em',
          marginTop: 6,
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function ProgressTab({ userId }) {
  const [logs, setLogs]           = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [targetWeight, setTargetWeight] = useState(null);

  const [inputVal, setInputVal]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [editing, setEditing]     = useState(false);
  const [error, setError]         = useState('');

  const fetchLogs = useCallback(async () => {
    if (!userId) return;
    const { data, error: err } = await supabase
      .from('weight_logs')
      .select('id, weight_kg, logged_at')
      .eq('user_id', userId)
      .order('logged_at', { ascending: true });
    if (err) console.error('[ProgressTab] weight_logs:', err);
    setLogs(data || []);
    setLoadingLogs(false);
  }, [userId]);

  // Fetch logs + target weight from intake_submissions
  useEffect(() => {
    if (!userId) { setLoadingLogs(false); return; }
    fetchLogs();

    supabase
      .from('intake_submissions')
      .select('data')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.data?.targetWeight) {
          setTargetWeight(Number(data.data.targetWeight));
        }
      });
  }, [userId, fetchLogs]);

  // ── Derived values ───────────────────────────────────────────────────────

  const todayLog     = logs.find(l => isTodayLocal(l.logged_at));
  const startLog     = logs[0]   || null;
  const currentLog   = logs[logs.length - 1] || null;

  const chartData = logs.map(l => ({
    date:   new Date(l.logged_at).toISOString().split('T')[0],
    weight: l.weight_kg,
  }));

  const allYValues = [
    ...logs.map(l => l.weight_kg),
    targetWeight,
  ].filter(v => v != null);

  const yMin = allYValues.length ? Math.floor(Math.min(...allYValues) - 3) : 60;
  const yMax = allYValues.length ? Math.ceil(Math.max(...allYValues)  + 3) : 100;

  let toGoDisplay = null;
  let toGoSub     = null;
  if (currentLog && targetWeight != null) {
    const diff = currentLog.weight_kg - targetWeight;
    if (Math.abs(diff) < 0.05) {
      toGoDisplay = '0 kg';
      toGoSub     = '✓ at target';
    } else if (diff > 0) {
      toGoDisplay = `${diff.toFixed(1)} kg`;
      toGoSub     = '↓ to lose';
    } else {
      toGoDisplay = `${Math.abs(diff).toFixed(1)} kg`;
      toGoSub     = '↑ to gain';
    }
  }

  // ── Form handlers ────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault();
    if (!userId) { setError('Not authenticated. Please refresh.'); return; }
    const kg = parseFloat(inputVal);
    if (!kg || kg < 20 || kg > 400) {
      setError('Enter a valid weight (20–400 kg).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing && todayLog) {
        const { error: err } = await supabase
          .from('weight_logs')
          .update({ weight_kg: kg })
          .eq('id', todayLog.id)
          .eq('user_id', userId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('weight_logs')
          .insert({ user_id: userId, weight_kg: kg, logged_at: new Date().toISOString() });
        if (err) throw err;
      }
      await fetchLogs();
      setSaved(true);
      setEditing(false);
      setInputVal('');
      setTimeout(() => setSaved(false), 3500);
    } catch (err) {
      setError(err.message || 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit() {
    setEditing(true);
    setInputVal(todayLog?.weight_kg?.toString() || '');
    setSaved(false);
  }

  function handleCancelEdit() {
    setEditing(false);
    setInputVal('');
    setError('');
  }

  const showForm = !todayLog || editing;

  // ── Render ───────────────────────────────────────────────────────────────

  if (loadingLogs) {
    return <div style={{ color: '#555', padding: '60px 0', textAlign: 'center' }}>Loading…</div>;
  }

  return (
    <div>

      {/* ── Weight log input ───────────────────────────────────────── */}
      <div style={st.inputCard}>
        <div style={st.inputEyebrow}>Today's Weight</div>

        {!showForm ? (
          // Already logged — show value + edit button
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={st.loggedVal}>{todayLog.weight_kg}</span>
              <span style={st.loggedUnit}>kg</span>
              <span style={st.loggedMeta}>— logged today</span>
            </div>
            <button type="button" onClick={handleEdit} style={st.editBtn}>
              Edit
            </button>
          </div>
        ) : (
          // Form
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 200 }}>
                <input
                  type="number"
                  step="0.1"
                  min="20"
                  max="400"
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  placeholder="e.g. 84.5"
                  style={st.weightInput}
                  autoFocus
                />
                <span style={st.kgBadge}>kg</span>
              </div>
              <button
                type="submit"
                disabled={saving || !inputVal}
                style={{ ...st.logBtn, opacity: saving || !inputVal ? 0.5 : 1 }}
              >
                {saving ? '…' : editing ? 'Update' : 'Log Weight'}
              </button>
              {editing && (
                <button type="button" onClick={handleCancelEdit} style={st.cancelBtn}>
                  Cancel
                </button>
              )}
            </div>
            {error && <p style={st.errorMsg}>{error}</p>}
          </form>
        )}

        {saved && (
          <div style={st.savedMsg}>✓ Weight saved</div>
        )}
      </div>

      {/* ── Graph ─────────────────────────────────────────────────── */}
      {chartData.length < 2 ? (
        <div style={st.emptyChart}>
          <div style={st.emptyChartIcon}>📈</div>
          <p style={st.emptyChartText}>
            Log your weight each morning to track your progress
          </p>
        </div>
      ) : (
        <div style={st.chartCard}>
          <div style={st.chartEyebrow}>Weight Over Time</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 32, bottom: 4, left: 0 }}
            >
              <CartesianGrid
                stroke="#1e1e1e"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fill: '#555', fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif" }}
                axisLine={{ stroke: '#1e1e1e' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fill: '#555', fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif" }}
                axisLine={false}
                tickLine={false}
                width={42}
                tickFormatter={v => `${v}`}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#333', strokeWidth: 1 }} />

              {/* Starting weight */}
              {startLog && (
                <ReferenceLine
                  y={startLog.weight_kg}
                  stroke="#333"
                  strokeDasharray="4 3"
                  label={{
                    value: `Start  ${startLog.weight_kg}kg`,
                    position: 'insideTopLeft',
                    fill: '#555',
                    fontSize: 10,
                    fontFamily: "'Barlow Condensed', sans-serif",
                  }}
                />
              )}

              {/* Current weight */}
              {currentLog && currentLog.id !== startLog?.id && (
                <ReferenceLine
                  y={currentLog.weight_kg}
                  stroke="#444"
                  strokeDasharray="4 3"
                  label={{
                    value: `Now  ${currentLog.weight_kg}kg`,
                    position: 'insideBottomLeft',
                    fill: '#555',
                    fontSize: 10,
                    fontFamily: "'Barlow Condensed', sans-serif",
                  }}
                />
              )}

              {/* Target weight */}
              {targetWeight != null && (
                <ReferenceLine
                  y={targetWeight}
                  stroke="#1E7A3E"
                  strokeDasharray="4 3"
                  label={{
                    value: `Target  ${targetWeight}kg`,
                    position: 'insideTopRight',
                    fill: '#1E7A3E',
                    fontSize: 10,
                    fontFamily: "'Barlow Condensed', sans-serif",
                  }}
                />
              )}

              <Line
                type="monotone"
                dataKey="weight"
                stroke="#C0392B"
                strokeWidth={2}
                dot={{ fill: '#C0392B', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#C0392B', stroke: '#080808', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Stats row ─────────────────────────────────────────────── */}
      {logs.length > 0 && (
        <div style={st.statsRow}>
          <StatCard
            label="Starting Weight"
            value={startLog ? `${startLog.weight_kg} kg` : '—'}
          />
          <StatCard
            label="Current Weight"
            value={currentLog ? `${currentLog.weight_kg} kg` : '—'}
            highlight
          />
          <StatCard
            label="To Go"
            value={toGoDisplay ?? '—'}
            sub={toGoSub}
          />
        </div>
      )}

    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const st = {
  inputCard: {
    background: '#0d0d0d',
    border: '1px solid rgba(200,200,200,0.12)',
    padding: '24px 24px 22px',
    marginBottom: 20,
  },
  inputEyebrow: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.28em',
    textTransform: 'uppercase',
    color: '#555',
    marginBottom: 16,
  },
  loggedVal: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 40,
    color: '#F5F3EE',
    lineHeight: 1,
  },
  loggedUnit: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 18,
    color: '#787878',
    fontWeight: 600,
  },
  loggedMeta: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13,
    color: '#444',
    letterSpacing: '0.06em',
  },
  editBtn: {
    background: 'none',
    border: '1px solid rgba(200,200,200,0.2)',
    color: '#787878',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    padding: '8px 20px',
    cursor: 'pointer',
  },
  weightInput: {
    width: '100%',
    padding: '14px 48px 14px 16px',
    background: '#111',
    border: '1px solid rgba(200,200,200,0.15)',
    color: '#F5F3EE',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 28,
    outline: 'none',
    boxSizing: 'border-box',
    lineHeight: 1,
  },
  kgBadge: {
    position: 'absolute',
    right: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#555',
    pointerEvents: 'none',
  },
  logBtn: {
    background: '#C0392B',
    border: 'none',
    color: '#ffffff',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    padding: '0 28px',
    cursor: 'pointer',
    height: 54,
    whiteSpace: 'nowrap',
    transition: 'background 0.15s',
  },
  cancelBtn: {
    background: 'none',
    border: '1px solid rgba(200,200,200,0.15)',
    color: '#555',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    padding: '0 20px',
    cursor: 'pointer',
    height: 54,
  },
  errorMsg: {
    color: '#ef4444',
    fontSize: 12,
    fontFamily: "'Barlow Condensed', sans-serif",
    letterSpacing: '0.06em',
    marginTop: 8,
  },
  savedMsg: {
    marginTop: 14,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: '#4CAF50',
  },
  emptyChart: {
    background: '#0d0d0d',
    border: '1px solid rgba(200,200,200,0.08)',
    padding: '60px 24px',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyChartIcon: {
    fontSize: 32,
    marginBottom: 16,
  },
  emptyChartText: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 14,
    color: '#555',
    letterSpacing: '0.06em',
    maxWidth: 320,
    margin: '0 auto',
  },
  chartCard: {
    background: '#0d0d0d',
    border: '1px solid rgba(200,200,200,0.08)',
    padding: '24px 8px 16px 0',
    marginBottom: 20,
  },
  chartEyebrow: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.28em',
    textTransform: 'uppercase',
    color: '#555',
    marginBottom: 16,
    paddingLeft: 24,
  },
  statsRow: {
    display: 'flex',
    gap: 12,
  },
};
