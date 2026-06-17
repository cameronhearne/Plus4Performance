import React from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import AdminOverview from './AdminOverview';
import AdminUsers from './AdminUsers';
import AdminUserDetail from './AdminUserDetail';
import AdminAffiliates from './AdminAffiliates';

const S = {
  page:    { minHeight: '100vh', background: '#080808', color: '#F5F3EE' },
  nav:     { position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 32px', background: 'rgba(8,8,8,0.97)', borderBottom: '1px solid rgba(200,200,200,0.1)', backdropFilter: 'blur(12px)' },
  logo:    { fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: '0.16em', color: '#C8C8C8' },
  badge:   { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C0392B', border: '1px solid rgba(192,57,43,0.5)', padding: '3px 8px', marginLeft: 10 },
  navLinks:{ display: 'flex', alignItems: 'center', gap: 20 },
  navLink: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#787878', textDecoration: 'none' },
  subnav:  { display: 'flex', gap: 2, background: '#101010', padding: 4, marginBottom: 32 },
  tab:     { padding: '9px 20px', background: 'none', border: 'none', color: '#787878', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' },
  tabActive:{ padding: '9px 20px', background: '#1a1a1a', border: 'none', color: '#F5F3EE', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' },
  inner:   { maxWidth: 1200, margin: '0 auto', padding: '40px 32px 80px' },
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

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={S.logo}>PLUS 4 PERFORMANCE</span>
          <span style={S.badge}>ADMIN</span>
        </div>
        <div style={S.navLinks}>
          <a href="/dashboard" style={S.navLink}>← Dashboard</a>
          <button type="button" onClick={handleSignOut}
            style={{ ...S.navLink, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Sign out
          </button>
        </div>
      </nav>

      <div style={S.inner}>
        <div style={S.subnav}>
          <Link to="/admin"            style={!isUsers && !isAffiliates ? S.tabActive : S.tab}>Overview</Link>
          <Link to="/admin/users"      style={isUsers      ? S.tabActive : S.tab}>Users</Link>
          <Link to="/admin/affiliates" style={isAffiliates ? S.tabActive : S.tab}>Affiliates</Link>
        </div>

        <Routes>
          <Route index                   element={<AdminOverview />} />
          <Route path="users"            element={<AdminUsers />} />
          <Route path="users/:userId"    element={<AdminUserDetail />} />
          <Route path="affiliates"       element={<AdminAffiliates />} />
        </Routes>
      </div>
    </div>
  );
}
