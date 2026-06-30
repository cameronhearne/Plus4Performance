import React from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import AdminOverview from './AdminOverview';
import AdminUsers from './AdminUsers';
import AdminUserDetail from './AdminUserDetail';
import AdminAffiliates from './AdminAffiliates';
import AdminFlagged1rm from './AdminFlagged1rm';
import AdminCoaching from './AdminCoaching';

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────

const C = {
  surface:  '#131119',
  surface2: '#0C0A0F',
  bone:     '#F3F1ED',
  ash:      '#ABA9B0',
  pinkGlow: 'rgba(255,79,196,0.5)',
  pinkLine: 'rgba(255,79,196,0.25)',
};

const S = {
  page: {
    minHeight: '100vh',
    background: '#08070A',
    color: C.bone,
  },
  nav: {
    position: 'sticky', top: 0, zIndex: 50,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 32px',
    background: 'rgba(8,7,10,0.96)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    backdropFilter: 'blur(12px)',
  },
  logo: {
    fontFamily: "'Oswald', sans-serif",
    fontWeight: 600, fontSize: 14, letterSpacing: '2.5px',
    color: C.bone,
  },
  badge: {
    background: C.surface2,
    border: `1px solid ${C.pinkLine}`,
    borderRadius: 7,
    padding: '5px 12px',
    marginLeft: 14,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 10.5, fontWeight: 700,
    letterSpacing: '1px', textTransform: 'uppercase',
    color: C.bone,
    boxShadow: `0 0 12px -4px ${C.pinkGlow}`,
  },
  navLinks: { display: 'flex', alignItems: 'center', gap: 20 },
  navLink:  {
    fontFamily: "'Inter', sans-serif",
    fontSize: 12, color: C.ash, textDecoration: 'none',
  },
  subnav: {
    display: 'inline-flex', gap: 4,
    background: C.surface,
    borderRadius: 10, padding: 5,
    marginBottom: 32,
  },
  tab: {
    padding: '10px 20px', background: 'none', border: 'none',
    color: C.ash,
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600,
    letterSpacing: '1px', textTransform: 'uppercase',
    cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
    borderRadius: 7,
  },
  tabActive: {
    padding: '10px 20px',
    background: 'linear-gradient(160deg, #1A1722, #100E15)',
    border: 'none',
    color: C.bone,
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600,
    letterSpacing: '1px', textTransform: 'uppercase',
    cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
    borderRadius: 7,
    boxShadow: `0 0 16px -4px ${C.pinkGlow}, 0 1px 0 rgba(255,255,255,0.04) inset`,
  },
  inner: { maxWidth: 1200, margin: '0 auto', padding: '40px 32px 80px' },
};

export default function AdminDashboard() {
  const { pathname } = useLocation();
  const navigate     = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  const isUsers      = pathname.startsWith('/admin/users');
  const isAffiliates = pathname.startsWith('/admin/affiliates');
  const isFlagged    = pathname.startsWith('/admin/flagged-1rm');
  const isCoaching   = pathname.startsWith('/admin/coaching');

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={S.logo}>PLUS 4 PERFORMANCE</span>
          <span style={S.badge}>ADMIN</span>
        </div>
        <div style={S.navLinks}>
          <a href="/dashboard" style={S.navLink}>← Dashboard</a>
          <button
            type="button"
            onClick={handleSignOut}
            style={{ ...S.navLink, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Sign out
          </button>
        </div>
      </nav>

      <div style={S.inner}>
        <div style={S.subnav}>
          <Link to="/admin"              style={!isUsers && !isAffiliates && !isFlagged && !isCoaching ? S.tabActive : S.tab}>Overview</Link>
          <Link to="/admin/users"        style={isUsers      ? S.tabActive : S.tab}>Users</Link>
          <Link to="/admin/affiliates"   style={isAffiliates ? S.tabActive : S.tab}>Affiliates</Link>
          <Link to="/admin/flagged-1rm"  style={isFlagged    ? S.tabActive : S.tab}>Flagged 1RMs</Link>
          <Link to="/admin/coaching"     style={isCoaching   ? S.tabActive : S.tab}>Coaching</Link>
        </div>

        <Routes>
          <Route index                element={<AdminOverview />} />
          <Route path="users"         element={<AdminUsers />} />
          <Route path="users/:userId" element={<AdminUserDetail />} />
          <Route path="affiliates"    element={<AdminAffiliates />} />
          <Route path="flagged-1rm"   element={<AdminFlagged1rm />} />
          <Route path="coaching"      element={<AdminCoaching />} />
        </Routes>
      </div>
    </div>
  );
}
