import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { adminListUsers } from '../../lib/api';

const S = {
  heading:  { fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#F5F3EE', marginBottom: 24 },
  toolbar:  { display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' },
  search:   { flex: 1, maxWidth: 340, padding: '10px 14px', background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.15)', color: '#F5F3EE', fontFamily: "'Barlow', sans-serif", fontSize: 13, outline: 'none' },
  table:    { width: '100%', borderCollapse: 'collapse' },
  th:       { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#555', padding: '10px 12px 10px 0', textAlign: 'left', borderBottom: '1px solid #1a1a1a', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' },
  td:       { fontSize: 13, color: '#CDCDC8', padding: '12px 12px 12px 0', borderBottom: '1px solid #111', fontFamily: "'Barlow', sans-serif", verticalAlign: 'middle' },
  row:      { cursor: 'pointer' },
  badge:    { display: 'inline-block', padding: '3px 8px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' },
  pager:    { display: 'flex', gap: 8, alignItems: 'center', marginTop: 20, justifyContent: 'flex-end' },
  pageBtn:  { padding: '7px 14px', background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.15)', color: '#787878', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em' },
  pageBtnD: { padding: '7px 14px', background: 'transparent', border: '1px solid #1a1a1a', color: '#333', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, cursor: 'default', letterSpacing: '0.1em' },
  pageInfo: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#555', letterSpacing: '0.06em' },
};

const STATUS_BADGE = {
  active:    { background: 'rgba(76,175,80,0.15)',  color: '#4CAF50',  label: 'Active' },
  canceled:  { background: 'rgba(120,120,120,0.1)', color: '#555',      label: 'Cancelled' },
  past_due:  { background: 'rgba(255,152,0,0.12)',  color: '#FF9800',  label: 'Past Due' },
  trialing:  { background: 'rgba(33,150,243,0.12)', color: '#2196F3',  label: 'Trial' },
  none:      { background: 'rgba(120,120,120,0.08)', color: '#444',     label: 'No Sub' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_BADGE[status] || STATUS_BADGE.none;
  return (
    <span style={{ ...S.badge, background: cfg.background, color: cfg.color }}>{cfg.label}</span>
  );
}

const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const SORT_COLS = [
  { key: 'firstName', label: 'Name' },
  { key: 'email',     label: 'Email' },
  { key: 'createdAt', label: 'Signed Up' },
  { key: 'status',    label: 'Status' },
  { key: 'lastSignIn',label: 'Last Active' },
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

  return (
    <div>
      <div style={S.heading}>Users <span style={{ color: '#555', fontSize: 18 }}>({total})</span></div>

      <div style={S.toolbar}>
        <input
          type="search"
          placeholder="Search name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={S.search}
        />
      </div>

      {loading ? (
        <div style={{ color: '#555', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em', padding: '40px 0' }}>Loading…</div>
      ) : (
        <>
          <table style={S.table}>
            <thead>
              <tr>
                {SORT_COLS.map(c => (
                  <th key={c.key} style={S.th} onClick={() => handleSort(c.key)}>
                    {c.label} {sort === c.key ? (dir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                ))}
                <th style={S.th}>Plan Start</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6} style={{ ...S.td, color: '#444', padding: '40px 0' }}>No users found.</td></tr>
              ) : users.map(u => (
                <tr
                  key={u.id}
                  style={S.row}
                  onClick={() => navigate(`/admin/users/${u.id}`)}
                  onMouseEnter={e => { e.currentTarget.style.background = '#0d0d0d'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={S.td}>
                    <span style={{ color: '#F5F3EE', fontWeight: 500 }}>
                      {[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}
                    </span>
                    {u.isAdmin && <span style={{ ...S.badge, background: 'rgba(192,57,43,0.12)', color: '#C0392B', marginLeft: 8 }}>Admin</span>}
                  </td>
                  <td style={S.td}>{u.email}</td>
                  <td style={S.td}>{fmtDate(u.createdAt)}</td>
                  <td style={S.td}><StatusBadge status={u.subscription?.status || 'none'} /></td>
                  <td style={S.td}>{fmtDate(u.lastSignIn)}</td>
                  <td style={S.td}>{fmtDate(u.planStartDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={S.pager}>
            <span style={S.pageInfo}>Page {page} of {totalPages}</span>
            <button
              style={page <= 1 ? S.pageBtnD : S.pageBtn}
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >← Prev</button>
            <button
              style={page >= totalPages ? S.pageBtnD : S.pageBtn}
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >Next →</button>
          </div>
        </>
      )}
    </div>
  );
}
