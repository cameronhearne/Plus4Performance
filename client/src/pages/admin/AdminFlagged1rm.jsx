import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { adminGetFlagged1rm, adminApprove1rm, adminReject1rm } from '../../lib/api';

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────

const C = {
  surface:  '#131119',
  surface2: '#0C0A0F',
  bone:     '#F3F1ED',
  ash:      '#ABA9B0',
  ashDim:   '#7A7880',
};

// ─── LABEL MAPS ──────────────────────────────────────────────────────────────

const LIFT_LABELS = {
  bench_press:    'Bench Press',
  squat:          'Squat',
  deadlift:       'Deadlift',
  overhead_press: 'OHP',
};

const FLAG_LABELS = {
  exceeds_4x_bodyweight:                '> 4× bodyweight',
  exceeds_50pct_jump:                   '> 50% jump from PB',
  exceeds_4x_bodyweight_and_50pct_jump: '> 4× BW + > 50% jump',
};

// ─── TABLE STYLES ─────────────────────────────────────────────────────────────

const thStyle = {
  textAlign: 'left', fontFamily: "'Inter', sans-serif",
  fontSize: '10px', letterSpacing: '1.2px', color: C.ashDim,
  textTransform: 'uppercase', padding: '10px 14px',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
};
const tdStyle = {
  fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash,
  padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)',
  verticalAlign: 'middle',
};

const fmtDate = iso => new Date(iso).toLocaleString('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export default function AdminFlagged1rm() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState(new Set());
  const [token,   setToken]   = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const t = data.session?.access_token;
      setToken(t);
      if (t) load(t);
    });
  }, []);

  async function load(t) {
    setLoading(true);
    try {
      const data = await adminGetFlagged1rm(t || token);
      setEntries(data.entries || []);
    } finally {
      setLoading(false);
    }
  }

  function setBusy(id, val) {
    setBusyIds(prev => { const s = new Set(prev); val ? s.add(id) : s.delete(id); return s; });
  }

  async function approve(id) {
    setBusy(id, true);
    try {
      await adminApprove1rm(token, id);
      setEntries(e => e.filter(r => r.id !== id));
    } catch (err) {
      alert(err.message || 'Failed to approve');
    } finally {
      setBusy(id, false);
    }
  }

  async function reject(id) {
    setBusy(id, true);
    try {
      await adminReject1rm(token, id);
      setEntries(e => e.filter(r => r.id !== id));
    } catch (err) {
      alert(err.message || 'Failed to reject');
    } finally {
      setBusy(id, false);
    }
  }

  return (
    <div>
      {/* Heading */}
      <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 28, textTransform: 'uppercase', color: C.bone, marginBottom: 10 }}>
        Flagged 1RMs
      </div>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14.5, color: C.ash, marginBottom: 36 }}>
        Entries pending review before appearing on leaderboards
      </p>

      {loading ? (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash }}>Loading…</div>
      ) : entries.length === 0 ? (
        /* Empty state — dark gradient surface card, grey body text, exact existing copy */
        <div style={{
          background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16, padding: '60px 24px', textAlign: 'center',
          boxShadow: '0 12px 30px -16px rgba(0,0,0,0.55)',
        }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14.5, color: C.ash }}>
            No flagged entries pending review.
          </div>
        </div>
      ) : (
        <div style={{
          background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 12px 30px -16px rgba(0,0,0,0.55)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>User</th>
                <th style={thStyle}>Lift</th>
                <th style={thStyle}>Logged</th>
                <th style={thStyle}>Prev Best</th>
                <th style={thStyle}>Bodyweight</th>
                <th style={thStyle}>Flag Reason</th>
                <th style={thStyle}>Logged At</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const busy = busyIds.has(e.id);
                return (
                  <tr key={e.id}>
                    <td style={{ ...tdStyle, color: C.bone, fontWeight: 500 }}>{e.username}</td>
                    <td style={tdStyle}>{LIFT_LABELS[e.lift] || e.lift}</td>
                    <td style={{ ...tdStyle, fontFamily: "'Roboto Mono', monospace", color: C.bone }}>
                      {e.weight_kg} kg{e.is_calculated ? ' (est.)' : ''}
                    </td>
                    <td style={{ ...tdStyle, color: C.ashDim }}>{e.previous_best != null ? `${e.previous_best} kg` : '—'}</td>
                    <td style={{ ...tdStyle, color: C.ashDim }}>{e.bodyweight != null ? `${e.bodyweight} kg` : '—'}</td>
                    <td style={tdStyle}>
                      {/* Flag badge — amber warning indicator, communicative colour */}
                      <span style={{
                        display: 'inline-block', padding: '3px 8px', borderRadius: 6,
                        fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700,
                        letterSpacing: '0.8px', textTransform: 'uppercase',
                        background: 'rgba(255,152,0,0.1)', border: '1px solid rgba(255,152,0,0.3)', color: '#E8A020',
                      }}>
                        {FLAG_LABELS[e.flagged_reason] || e.flagged_reason || '—'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: C.ashDim, fontSize: 11 }}>{fmtDate(e.logged_at)}</td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => approve(e.id)}
                        disabled={busy}
                        style={{
                          padding: '7px 14px', borderRadius: 7, cursor: busy ? 'default' : 'pointer',
                          background: 'rgba(74,153,104,0.12)', border: '1px solid rgba(74,153,104,0.4)', color: '#4A9968',
                          fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700,
                          letterSpacing: '0.8px', textTransform: 'uppercase', marginRight: 8,
                          opacity: busy ? 0.5 : 1,
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => reject(e.id)}
                        disabled={busy}
                        style={{
                          padding: '7px 14px', borderRadius: 7, cursor: busy ? 'default' : 'pointer',
                          background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.35)', color: '#C0392B',
                          fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700,
                          letterSpacing: '0.8px', textTransform: 'uppercase',
                          opacity: busy ? 0.5 : 1,
                        }}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
