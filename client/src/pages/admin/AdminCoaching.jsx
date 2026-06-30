import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  adminGetCoaches, adminGetCoachingClients,
  adminSetCoach, adminAssignClient, adminListUsers,
} from '../../lib/api';

// ─── DESIGN TOKENS (match all other admin tabs exactly) ──────────────────────

const C = {
  surface:   '#131119',
  surface2:  '#0C0A0F',
  bone:      '#F3F1ED',
  ash:       '#ABA9B0',
  ashDim:    '#7A7880',
  pinkGlow:  'rgba(255,79,196,0.5)',
  pinkLine:  'rgba(255,79,196,0.25)',
  pinkBorder:'rgba(255,79,196,0.42)',
  red:       '#C0392B',
  redBorder: 'rgba(192,57,43,0.4)',
  redGlow:   'rgba(192,57,43,0.35)',
  green:     '#4A9968',
  greenLine: 'rgba(74,153,104,0.35)',
  greenGlow: 'rgba(74,153,104,0.3)',
};

const thStyle = {
  textAlign: 'left', fontFamily: "'Inter', sans-serif",
  fontSize: '10.5px', letterSpacing: '1.2px', color: C.ashDim,
  textTransform: 'uppercase', padding: '10px 14px',
  borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '16px 14px', fontSize: 14, color: C.ash,
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  fontFamily: "'Inter', sans-serif", verticalAlign: 'middle',
};
const cardStyle = {
  background: 'linear-gradient(160deg, #131119, #0C0A0F)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 16, padding: 26,
  boxShadow: '0 12px 30px -16px rgba(0,0,0,0.55)',
  marginBottom: 32,
};
const sectionHeading = {
  fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 28,
  textTransform: 'uppercase', color: C.bone, marginBottom: 6,
};
const sectionSub = {
  fontFamily: "'Inter', sans-serif", fontSize: 14, color: C.ash, marginBottom: 22,
};
const labelStyle = {
  display: 'block', fontFamily: "'Inter', sans-serif",
  fontSize: 11, letterSpacing: '1.2px', textTransform: 'uppercase',
  color: C.ashDim, marginBottom: 8,
};
const inputStyle = {
  width: '100%', background: C.surface2,
  border: `1px solid ${C.pinkLine}`,
  borderRadius: 10, padding: '13px 15px',
  color: C.bone, fontFamily: "'Inter', sans-serif", fontSize: 14,
  outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
};
const selectStyle = {
  ...inputStyle, cursor: 'pointer', appearance: 'none',
};
const btnPrimary = {
  background: 'linear-gradient(160deg,#18151F,#100E15)',
  border: `1px solid ${C.pinkBorder}`,
  borderRadius: 10, padding: '13px 22px',
  color: C.bone, fontFamily: "'Oswald', sans-serif",
  fontWeight: 700, fontSize: 12, letterSpacing: '1px',
  textTransform: 'uppercase', cursor: 'pointer',
  boxShadow: `0 8px 22px -8px ${C.pinkGlow}`,
  transition: 'opacity 0.15s',
};
const btnDanger = {
  background: 'transparent',
  border: `1px solid ${C.redBorder}`,
  borderRadius: 8, padding: '8px 14px',
  color: C.red, fontFamily: "'Inter', sans-serif",
  fontWeight: 600, fontSize: 13, cursor: 'pointer',
  boxShadow: `0 0 12px -4px ${C.redGlow}`,
  transition: 'opacity 0.15s',
};
const btnGhost = {
  background: 'transparent',
  border: `1px solid ${C.pinkLine}`,
  borderRadius: 8, padding: '8px 14px',
  color: C.ash, fontFamily: "'Inter', sans-serif",
  fontWeight: 600, fontSize: 13, cursor: 'pointer',
};

function UserChip({ user, onClear }) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.surface2, border: `1px solid ${C.pinkLine}`, borderRadius: 8, padding: '8px 12px', color: C.bone, fontFamily: "'Inter', sans-serif", fontSize: 14 }}>
      <span>{name}</span>
      <span style={{ color: C.ashDim, fontSize: 12 }}>{user.email}</span>
      <button onClick={onClear} style={{ background: 'none', border: 'none', color: C.ashDim, cursor: 'pointer', padding: '0 2px', fontSize: 16, lineHeight: 1 }}>×</button>
    </div>
  );
}

function SearchUsers({ token, placeholder, selected, onSelect, onClear, excludeIds = [] }) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await adminListUsers(token, { search: query, sort: 'createdAt', dir: 'desc' });
        setResults((res.users || []).filter(u => !excludeIds.includes(u.id)).slice(0, 6));
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [query, token]); // eslint-disable-line

  if (selected) return <UserChip user={selected} onClear={() => { onClear(); setQuery(''); setResults([]); }} />;

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="cadmin-inp"
        type="search"
        placeholder={placeholder}
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={inputStyle}
      />
      {results.length > 0 && (
        <div style={{ marginTop: 4, background: C.surface2, border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 10, overflow: 'hidden' }}>
          {results.map(u => {
            const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';
            return (
              <div
                key={u.id}
                onClick={() => { onSelect(u); setQuery(''); setResults([]); }}
                style={{ padding: '12px 14px', cursor: 'pointer', borderBottom: `1px solid rgba(255,255,255,0.04)`, display: 'flex', alignItems: 'center', gap: 10 }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ color: C.bone, fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500 }}>{name}</span>
                <span style={{ color: C.ashDim, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>{u.email}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminCoaching() {
  const [token,   setToken]   = useState('');
  const [coaches, setCoaches] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add-coach form
  const [coachSel,     setCoachSel]     = useState(null);
  const [coachWorking, setCoachWorking] = useState(false);
  const [coachMsg,     setCoachMsg]     = useState({ type: '', text: '' });

  // Remove-coach per-row feedback
  const [removeMsg, setRemoveMsg] = useState({});

  // Add-client form
  const [clientSel,     setClientSel]     = useState(null);
  const [clientCoachId, setClientCoachId] = useState('');
  const [clientWorking, setClientWorking] = useState(false);
  const [clientMsg,     setClientMsg]     = useState({ type: '', text: '' });

  // Remove-client confirm
  const [confirmRemove, setConfirmRemove] = useState(null);

  const loadAll = useCallback(async (tok) => {
    const t = tok || token;
    if (!t) return;
    setLoading(true);
    try {
      const [coachesRes, clientsRes] = await Promise.all([
        adminGetCoaches(t),
        adminGetCoachingClients(t),
      ]);
      setCoaches(coachesRes.coaches || []);
      setClients(clientsRes.clients || []);
    } catch (e) { console.error('[AdminCoaching] load', e); }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setToken(data.session.access_token);
        loadAll(data.session.access_token);
      }
    });
  }, []); // eslint-disable-line

  async function handleMakeCoach() {
    if (!coachSel) return;
    setCoachWorking(true);
    setCoachMsg({ type: '', text: '' });
    try {
      await adminSetCoach(token, { user_id: coachSel.id, is_coach: true });
      const name = [coachSel.firstName, coachSel.lastName].filter(Boolean).join(' ') || coachSel.email;
      setCoachMsg({ type: 'ok', text: `${name} is now a coach.` });
      setCoachSel(null);
      await loadAll();
    } catch (e) {
      setCoachMsg({ type: 'err', text: e.message });
    }
    setCoachWorking(false);
  }

  async function handleRemoveCoach(coach) {
    setRemoveMsg(m => ({ ...m, [coach.id]: '' }));
    try {
      await adminSetCoach(token, { user_id: coach.id, is_coach: false });
      await loadAll();
    } catch (e) {
      setRemoveMsg(m => ({ ...m, [coach.id]: e.message }));
    }
  }

  async function handleAssignClient() {
    if (!clientSel || !clientCoachId) return;
    setClientWorking(true);
    setClientMsg({ type: '', text: '' });
    try {
      await adminAssignClient(token, { user_id: clientSel.id, coach_id: clientCoachId });
      const name = [clientSel.firstName, clientSel.lastName].filter(Boolean).join(' ') || clientSel.email;
      setClientMsg({ type: 'ok', text: `${name} assigned.` });
      setClientSel(null);
      setClientCoachId('');
      await loadAll();
    } catch (e) {
      setClientMsg({ type: 'err', text: e.message });
    }
    setClientWorking(false);
  }

  async function handleRemoveClient(clientId) {
    try {
      await adminAssignClient(token, { user_id: clientId, coach_id: null });
      setConfirmRemove(null);
      await loadAll();
    } catch (e) { console.error('[AdminCoaching] remove client', e); }
  }

  const fmtName = u => [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';

  if (loading) {
    return <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash, padding: '40px 0' }}>Loading…</div>;
  }

  // Coach IDs already in use — exclude from "add coach" search (already coaches)
  const existingCoachIds = coaches.map(c => c.id);
  // Client IDs already assigned — exclude from "add client" search
  const existingClientIds = clients.map(c => c.id);

  return (
    <div>
      <style>{`
        .cadmin-inp:focus { border-color: ${C.pinkBorder} !important; box-shadow: 0 0 18px -8px ${C.pinkGlow} !important; outline: none; }
        .cadmin-btn:active { transform: scale(0.97); }
      `}</style>

      {/* ── COACHES ── */}
      <div style={sectionHeading}>Coaches</div>
      <p style={sectionSub}>Users with coaching access. They can read all client check-ins and respond.</p>

      <div style={cardStyle}>
        {coaches.length === 0 ? (
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: C.ashDim }}>No coaches yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Clients</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {coaches.map(c => (
                <tr key={c.id}>
                  <td style={{ ...tdStyle, color: C.bone, fontWeight: 500 }}>{fmtName(c)}</td>
                  <td style={{ ...tdStyle, color: C.ashDim }}>{c.email}</td>
                  <td style={tdStyle}>{c.clientCount}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {confirmRemove === ('coach-' + c.id) ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: C.ash, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>Remove coach?</span>
                        <button onClick={() => handleRemoveCoach(c)} className="cadmin-btn" style={btnPrimary}>Yes</button>
                        <button onClick={() => setConfirmRemove(null)} style={btnGhost}>Cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmRemove('coach-' + c.id)} className="cadmin-btn" style={btnPrimary}>Remove Coach</button>
                    )}
                    {removeMsg[c.id] && (
                      <div style={{ marginTop: 6, fontSize: 12, color: C.red, fontFamily: "'Inter', sans-serif", maxWidth: 300, textAlign: 'right' }}>
                        {removeMsg[c.id]}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Coach form */}
      <div style={cardStyle}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 16, textTransform: 'uppercase', color: C.bone, marginBottom: 18, letterSpacing: '0.06em' }}>
          Promote User to Coach
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Search by name or email</label>
          <SearchUsers
            token={token}
            placeholder="Name or email…"
            selected={coachSel}
            onSelect={setCoachSel}
            onClear={() => setCoachSel(null)}
            excludeIds={existingCoachIds}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={handleMakeCoach}
            disabled={!coachSel || coachWorking}
            style={{ ...btnPrimary, opacity: (!coachSel || coachWorking) ? 0.45 : 1 }}
          >
            {coachWorking ? 'Saving…' : 'Make Coach'}
          </button>
          {coachMsg.text && (
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: coachMsg.type === 'ok' ? C.green : C.red }}>
              {coachMsg.text}
            </span>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '12px 0 40px' }} />

      {/* ── COACHING CLIENTS ── */}
      <div style={sectionHeading}>Coaching Clients</div>
      <p style={sectionSub}>Users assigned to a coach. They get dashboard access without a Stripe subscription.</p>

      <div style={cardStyle}>
        {clients.length === 0 ? (
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: C.ashDim }}>No clients assigned yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Coach</th>
                <th style={thStyle}>Template</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {clients.map(cl => (
                <tr key={cl.id}>
                  <td style={{ ...tdStyle, color: C.bone, fontWeight: 500 }}>{fmtName(cl)}</td>
                  <td style={{ ...tdStyle, color: C.ashDim }}>{cl.email}</td>
                  <td style={tdStyle}>{[cl.coachFirstName, cl.coachLastName].filter(Boolean).join(' ') || cl.coachEmail || '—'}</td>
                  <td style={tdStyle}>
                    <span style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 12, color: C.ashDim }}>{cl.checkinTemplate}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {confirmRemove === cl.id ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: C.ash, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>Remove — revokes dashboard access</span>
                        <button onClick={() => handleRemoveClient(cl.id)} className="cadmin-btn" style={btnPrimary}>Yes, remove</button>
                        <button onClick={() => setConfirmRemove(null)} style={btnGhost}>Cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmRemove(cl.id)} className="cadmin-btn" style={btnPrimary}>Remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Assign Client form */}
      <div style={cardStyle}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 16, textTransform: 'uppercase', color: C.bone, marginBottom: 18, letterSpacing: '0.06em' }}>
          Assign a Coaching Client
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>User (search by name or email)</label>
            <SearchUsers
              token={token}
              placeholder="Client name or email…"
              selected={clientSel}
              onSelect={setClientSel}
              onClear={() => setClientSel(null)}
              excludeIds={existingClientIds}
            />
          </div>
          <div>
            <label style={labelStyle}>Assign to coach</label>
            <select
              className="cadmin-inp"
              value={clientCoachId}
              onChange={e => setClientCoachId(e.target.value)}
              style={selectStyle}
            >
              <option value="">— select coach —</option>
              {coaches.map(c => (
                <option key={c.id} value={c.id}>
                  {fmtName(c)} ({c.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={handleAssignClient}
            disabled={!clientSel || !clientCoachId || clientWorking}
            style={{ ...btnPrimary, opacity: (!clientSel || !clientCoachId || clientWorking) ? 0.45 : 1 }}
          >
            {clientWorking ? 'Saving…' : 'Assign Client'}
          </button>
          {clientMsg.text && (
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: clientMsg.type === 'ok' ? C.green : C.red }}>
              {clientMsg.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
