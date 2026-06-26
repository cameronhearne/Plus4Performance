import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { adminListUsers } from '../../lib/api';

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────

const C = {
  surface:   '#131119',
  surface2:  '#0C0A0F',
  bone:      '#F3F1ED',
  ash:       '#ABA9B0',
  ashDim:    '#7A7880',
  pinkGlow:  'rgba(255,79,196,0.5)',
  pinkLine:  'rgba(255,79,196,0.25)',
  green:     '#4A9968',
  greenGlow: 'rgba(74,153,104,0.3)',
  greenLine: 'rgba(74,153,104,0.35)',
};

// Active = green (positive status, same rule as Billing/Affiliates)
// No Sub = neutral dark pill: surface2 bg, grey border, ash-dim text — not red, not pink
const STATUS_CFG = {
  active:   { bg: 'rgba(74,153,104,0.1)', border: `1px solid ${C.greenLine}`, color: C.green,  shadow: `0 0 10px -4px ${C.greenGlow}`, label: 'Active'    },
  canceled: { bg: C.surface2, border: '1px solid rgba(255,255,255,0.08)', color: C.ashDim, shadow: 'none', label: 'Cancelled' },
  past_due: { bg: 'rgba(255,152,0,0.08)', border: '1px solid rgba(255,152,0,0.3)', color: '#E8A020', shadow: 'none', label: 'Past Due'  },
  trialing: { bg: 'rgba(33,150,243,0.08)', border: '1px solid rgba(33,150,243,0.3)', color: '#5AACF0', shadow: 'none', label: 'Trial'    },
  none:     { bg: C.surface2, border: '1px solid rgba(255,255,255,0.08)', color: C.ashDim, shadow: 'none', label: 'No Sub'   },
};

const pillBase = {
  display: 'inline-block', padding: '5px 11px', borderRadius: 7,
  fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700,
  letterSpacing: '0.8px', textTransform: 'uppercase',
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.none;
  return (
    <span style={{ ...pillBase, background: cfg.bg, border: cfg.border, color: cfg.color, boxShadow: cfg.shadow }}>
      {cfg.label}
    </span>
  );
}

// Admin tag — same dark+pink-glow pill as nav Admin badge
function AdminTag() {
  return (
    <span style={{ ...pillBase, background: C.surface2, border: `1px solid ${C.pinkLine}`, color: C.bone, boxShadow: `0 0 10px -4px ${C.pinkGlow}` }}>
      Admin
    </span>
  );
}

const thStyle = {
  textAlign: 'left', fontFamily: "'Inter', sans-serif",
  fontSize: '10.5px', letterSpacing: '1.2px', color: C.ashDim,
  textTransform: 'uppercase', padding: '10px 14px',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
  cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '16px 14px', fontSize: 14, color: C.ash,
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  fontFamily: "'Inter', sans-serif", verticalAlign: 'middle',
};

const fmtDate = iso => iso
  ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—';

const SORT_COLS = [
  { key: 'firstName',  label: 'Name'        },
  { key: 'email',      label: 'Email'       },
  { key: 'createdAt',  label: 'Signed Up'   },
  { key: 'status',     label: 'Status'      },
  { key: 'lastSignIn', label: 'Last Active' },
];

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users,   setUsers]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [sort,    setSort]    = useState('createdAt');
  const [dir,     setDir]     = useState('desc');
  const [loading, setLoading] = useState(true);
  const [focused, setFocused] = useState(false);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const res = await adminListUsers(session.access_token, { page: p, search, sort, dir });
      setUsers(res.users || []);
      setTotal(res.total || 0);
    } catch (e) { console.error('[AdminUsers]', e); }
    setLoading(false);
  }, [page, search, sort, dir]);

  useEffect(() => { load(1); setPage(1); }, [search, sort, dir]); // eslint-disable-line
  useEffect(() => { load(page); }, [page]); // eslint-disable-line

  function handleSort(col) {
    if (sort === col) {
      setDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(col);
      setDir('asc');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 50));

  const pageBtnBase = {
    background: C.surface, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
    padding: '9px 16px', color: C.ash,
    fontFamily: "'Oswald', sans-serif", fontSize: 11.5, fontWeight: 600, letterSpacing: '0.5px',
    cursor: 'pointer', minHeight: 38,
  };

  return (
    <div>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 32, textTransform: 'uppercase', color: C.bone, marginBottom: 22 }}>
        Users <span style={{ color: C.ashDim, fontWeight: 500, fontSize: 22 }}>({total})</span>
      </div>

      <input
        type="search"
        placeholder="Search name or email…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', maxWidth: 420, display: 'block',
          background: C.surface,
          border: focused ? `1px solid ${C.pinkLine}` : '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '14px 16px',
          color: C.bone, fontFamily: "'Inter', sans-serif", fontSize: 14,
          outline: 'none', marginBottom: 24,
          boxShadow: focused ? `0 0 18px -8px ${C.pinkGlow}` : 'none',
          transition: 'border-color 0.25s, box-shadow 0.25s',
        }}
      />

      {loading ? (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash, padding: '40px 0' }}>Loading…</div>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {SORT_COLS.map(c => (
                  <th key={c.key} style={thStyle} onClick={() => handleSort(c.key)}>
                    {c.label}{sort === c.key ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                ))}
                <th style={thStyle}>Plan Start</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, color: C.ashDim, padding: '40px 14px' }}>No users found.</td>
                </tr>
              ) : users.map(u => (
                <tr
                  key={u.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/admin/users/${u.id}`)}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ color: C.bone, fontWeight: 500 }}>
                        {[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}
                      </span>
                      {u.isAdmin && <AdminTag />}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: C.ashDim }}>{u.email}</td>
                  <td style={tdStyle}>{fmtDate(u.createdAt)}</td>
                  <td style={tdStyle}><StatusBadge status={u.subscription?.status || 'none'} /></td>
                  <td style={tdStyle}>{fmtDate(u.lastSignIn)}</td>
                  <td style={tdStyle}>{fmtDate(u.planStartDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 14, marginTop: 20 }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ashDim }}>
              Page {page} of {totalPages}
            </span>
            <button
              style={page <= 1 ? { ...pageBtnBase, opacity: 0.4, cursor: 'default' } : pageBtnBase}
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >← Prev</button>
            <button
              style={page >= totalPages ? { ...pageBtnBase, opacity: 0.4, cursor: 'default' } : pageBtnBase}
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >Next →</button>
          </div>
        </>
      )}
    </div>
  );
}
