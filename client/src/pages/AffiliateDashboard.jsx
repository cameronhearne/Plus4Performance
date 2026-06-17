import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// All data fetched via our Railway API — the server verifies the JWT and
// resolves the affiliate identity from the token email, never from client input.
const API = import.meta.env.VITE_API_URL || '';

async function afGet(path, token) {
  const res = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function AffiliateDashboard() {
  const navigate = useNavigate();
  const [affiliate, setAffiliate] = useState(null);
  const [stats, setStats]         = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/affiliate/login', { replace: true }); return; }
      const token = session.access_token;
      try {
        const [meRes, statsRes, refsRes] = await Promise.all([
          afGet('/api/affiliate/me', token),
          afGet('/api/affiliate/stats', token),
          afGet('/api/affiliate/referrals', token),
        ]);
        setAffiliate(meRes.affiliate);
        setStats(statsRes);
        setReferrals(refsRes.referrals);
      } catch (err) {
        if (err.message === 'Not an affiliate') {
          navigate('/affiliate/login', { replace: true });
        } else {
          setError(err.message || 'Failed to load dashboard');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [navigate]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/affiliate/login');
  }

  if (loading) return <div style={S.loadWrap}><span style={S.loadText}>Loading…</span></div>;
  if (error)   return <div style={S.loadWrap}><span style={{ ...S.loadText, color: '#ef4444' }}>{error}</span></div>;
  if (!affiliate || !stats) return null;

  const commissionLabel = affiliate.commission_type === 'flat'
    ? `£${Number(affiliate.commission_value).toFixed(2)} per referral`
    : `${Number(affiliate.commission_value)}% per subscription`;

  return (
    <div style={S.page}>
      {/* Nav */}
      <nav style={S.nav}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={S.logo}>PLUS 4 PERFORMANCE</span>
          <span style={S.badge}>AFFILIATE</span>
        </div>
        <button type="button" onClick={handleSignOut} style={S.signOut}>Sign out</button>
      </nav>

      <div style={S.inner}>
        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={S.eyebrow}>Affiliate Dashboard</div>
            <div style={S.name}>Welcome, {affiliate.name}</div>
          </div>
          <div style={S.codeWrap}>
            <div style={S.codeLabel}>Your referral link</div>
            <div style={S.codeBox}>
              plus4performance.com/signup?ref=<strong>{affiliate.referral_code}</strong>
            </div>
            <div style={S.codeNote}>{commissionLabel}</div>
          </div>
        </div>

        {/* Stats */}
        <div style={S.statsGrid}>
          {[
            { label: 'Total Referrals',     value: stats.totalReferrals },
            { label: 'Active Subscribers',  value: stats.activeSubscribers },
            { label: 'Total Earned',        value: `£${stats.totalCommissionEarned.toFixed(2)}` },
            { label: 'Commission Paid',     value: `£${stats.commissionPaid.toFixed(2)}` },
            { label: 'Pending',             value: `£${stats.commissionPending.toFixed(2)}`, highlight: stats.commissionPending > 0 },
          ].map(({ label, value, highlight }) => (
            <div key={label} style={S.statCard}>
              <div style={S.statLabel}>{label}</div>
              <div style={{ ...S.statValue, color: highlight ? '#F5F3EE' : undefined }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Referral list */}
        <div style={S.section}>
          <div style={S.sectionHead}>Referrals</div>
          {referrals.length === 0 ? (
            <p style={S.empty}>No referrals yet. Share your link to get started.</p>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  {['Signup Date', 'Subscription Status', 'Commission', 'Paid'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {referrals.map(r => (
                  <tr key={r.id}>
                    <td style={S.td}>{r.signup_date}</td>
                    <td style={S.td}>
                      <span style={{
                        ...S.statusBadge,
                        color:       r.subscription_status === 'active' ? '#4CAF50' : '#787878',
                        borderColor: r.subscription_status === 'active' ? 'rgba(76,175,80,0.4)' : 'rgba(120,120,120,0.3)',
                      }}>
                        {r.subscription_status}
                      </span>
                    </td>
                    <td style={S.td}>£{Number(r.commission_owed).toFixed(2)}</td>
                    <td style={S.td}>
                      {r.commission_paid
                        ? <span style={{ color: '#4CAF50', fontSize: 13 }}>✓ Paid</span>
                        : <span style={{ color: '#787878', fontSize: 13 }}>Pending</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p style={S.footer}>Commission is paid manually by the Plus 4 team. Questions? Email your account manager.</p>
      </div>
    </div>
  );
}

const S = {
  page:        { minHeight: '100vh', background: '#080808', color: '#F5F3EE' },
  loadWrap:    { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080808' },
  loadText:    { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, letterSpacing: '0.14em', color: '#555' },
  nav:         { position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 32px', background: 'rgba(8,8,8,0.97)', borderBottom: '1px solid rgba(200,200,200,0.1)', backdropFilter: 'blur(12px)' },
  logo:        { fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: '0.16em', color: '#C8C8C8' },
  badge:       { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C0392B', border: '1px solid rgba(192,57,43,0.5)', padding: '3px 8px' },
  signOut:     { background: 'none', border: 'none', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#787878', cursor: 'pointer' },
  inner:       { maxWidth: 1100, margin: '0 auto', padding: '40px 32px 80px' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 24, marginBottom: 40 },
  eyebrow:     { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#C0392B', marginBottom: 8 },
  name:        { fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: '0.04em', color: '#F5F3EE' },
  codeWrap:    { background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.12)', padding: '20px 24px', minWidth: 300 },
  codeLabel:   { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#555', marginBottom: 8 },
  codeBox:     { fontFamily: 'monospace', fontSize: 13, color: '#CDCDC8', background: '#111', border: '1px solid #2a2a2a', padding: '8px 12px', wordBreak: 'break-all' },
  codeNote:    { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555', marginTop: 8, letterSpacing: '0.06em' },
  statsGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1, background: 'rgba(200,200,200,0.08)', marginBottom: 48 },
  statCard:    { background: '#0d0d0d', padding: '24px 20px' },
  statLabel:   { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#555', marginBottom: 10 },
  statValue:   { fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: '#787878', lineHeight: 1 },
  section:     { marginBottom: 40 },
  sectionHead: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: '0.04em', color: '#F5F3EE', marginBottom: 20 },
  empty:       { fontSize: 14, color: '#555', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em' },
  table:       { width: '100%', borderCollapse: 'collapse' },
  th:          { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#555', padding: '8px 12px 8px 0', textAlign: 'left', borderBottom: '1px solid #222' },
  td:          { fontSize: 13, color: '#CDCDC8', padding: '12px 12px 12px 0', borderBottom: '1px solid #161616' },
  statusBadge: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', padding: '3px 8px', border: '1px solid' },
  footer:      { fontSize: 12, color: '#333', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.08em', marginTop: 48 },
};
