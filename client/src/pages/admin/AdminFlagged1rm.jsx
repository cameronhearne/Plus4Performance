import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { adminGetFlagged1rm, adminApprove1rm, adminReject1rm } from '../../lib/api';

const LIFT_LABELS = {
  bench_press:    'Bench Press',
  squat:          'Squat',
  deadlift:       'Deadlift',
  overhead_press: 'OHP',
};

const FLAG_LABELS = {
  exceeds_4x_bodyweight:                    '> 4× bodyweight',
  exceeds_50pct_jump:                       '> 50% jump from PB',
  exceeds_4x_bodyweight_and_50pct_jump:     '> 4× BW + > 50% jump',
};

const S = {
  heading:  { fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#F5F3EE', marginBottom: 6 },
  sub:      { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#555', letterSpacing: '0.06em', marginBottom: 28 },
  empty:    { fontFamily: "'Barlow', sans-serif", fontSize: 14, color: '#555', fontWeight: 300, padding: '40px 0', textAlign: 'center' },
  table:    { width: '100%', borderCollapse: 'collapse' },
  th:       { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#555', textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid #1a1a1a' },
  td:       { fontFamily: "'Barlow', sans-serif", fontSize: 13, color: '#CDCDC8', fontWeight: 300, padding: '12px 14px', borderBottom: '1px solid #111', verticalAlign: 'middle' },
  mono:     { fontFamily: 'monospace', fontSize: 13, color: '#F5F3EE' },
  flagBadge:{ display: 'inline-block', padding: '3px 8px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'rgba(255,152,0,0.12)', color: '#FF9800', border: '1px solid rgba(255,152,0,0.3)' },
  approveBtn:{ padding: '7px 14px', background: 'rgba(76,175,80,0.15)', border: '1px solid rgba(76,175,80,0.4)', color: '#4CAF50', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', marginRight: 8 },
  rejectBtn: { padding: '7px 14px', background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.35)', color: '#C0392B', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' },
  busyBtn:   { opacity: 0.5, cursor: 'default' },
};

const fmtDate = iso => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AdminFlagged1rm() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState(new Set());
  const [token, setToken] = useState(null);

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
      <div style={S.heading}>Flagged 1RMs</div>
      <div style={S.sub}>Entries pending review before appearing on leaderboards</div>

      {loading ? (
        <div style={S.empty}>Loading…</div>
      ) : entries.length === 0 ? (
        <div style={S.empty}>No flagged entries pending review.</div>
      ) : (
        <div style={{ background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.1)' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>User</th>
                <th style={S.th}>Lift</th>
                <th style={S.th}>Logged</th>
                <th style={S.th}>Prev Best</th>
                <th style={S.th}>Bodyweight</th>
                <th style={S.th}>Flag Reason</th>
                <th style={S.th}>Logged At</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const busy = busyIds.has(e.id);
                return (
                  <tr key={e.id}>
                    <td style={S.td}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#F5F3EE', letterSpacing: '0.04em' }}>
                        {e.username}
                      </span>
                    </td>
                    <td style={S.td}>{LIFT_LABELS[e.lift] || e.lift}</td>
                    <td style={{ ...S.td, ...S.mono }}>{e.weight_kg} kg{e.is_calculated ? ' (est.)' : ''}</td>
                    <td style={{ ...S.td, color: '#787878' }}>{e.previous_best != null ? `${e.previous_best} kg` : '—'}</td>
                    <td style={{ ...S.td, color: '#787878' }}>{e.bodyweight != null ? `${e.bodyweight} kg` : '—'}</td>
                    <td style={S.td}>
                      <span style={S.flagBadge}>{FLAG_LABELS[e.flagged_reason] || e.flagged_reason || '—'}</span>
                    </td>
                    <td style={{ ...S.td, color: '#555', fontSize: 11 }}>{fmtDate(e.logged_at)}</td>
                    <td style={S.td}>
                      <button
                        onClick={() => approve(e.id)}
                        disabled={busy}
                        style={{ ...S.approveBtn, ...(busy ? S.busyBtn : {}) }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => reject(e.id)}
                        disabled={busy}
                        style={{ ...S.rejectBtn, ...(busy ? S.busyBtn : {}) }}
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
