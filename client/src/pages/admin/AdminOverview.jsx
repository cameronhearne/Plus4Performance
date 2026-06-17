import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { supabase } from '../../lib/supabase';
import { adminGetStats, adminGetRevenue } from '../../lib/api';

const S = {
  heading:   { fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#F5F3EE', marginBottom: 28 },
  cards:     { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 },
  card:      { background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.12)', padding: '20px 20px' },
  cardLabel: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#555', marginBottom: 10 },
  cardVal:   { fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: '#F5F3EE', lineHeight: 1 },
  cardSub:   { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#555', marginTop: 6, letterSpacing: '0.06em' },
  section:   { background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.12)', padding: '24px 24px 16px', marginBottom: 24 },
  sHead:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  sTitle:    { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#555' },
  periodBtn: { padding: '5px 10px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', border: '1px solid rgba(200,200,200,0.15)' },
};

const PERIODS = ['daily', 'weekly', 'monthly'];

function StatCard({ label, value, sub }) {
  return (
    <div style={S.card}>
      <div style={S.cardLabel}>{label}</div>
      <div style={S.cardVal}>{value}</div>
      {sub && <div style={S.cardSub}>{sub}</div>}
    </div>
  );
}

const fmtCurrency = n => `£${Number(n).toFixed(2)}`;
const fmtDate = str => {
  if (!str) return str;
  if (str.length === 10) return str.slice(5); // MM-DD
  return str;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#111', border: '1px solid #333', padding: '8px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#CDCDC8' }}>
      <div style={{ color: '#555', marginBottom: 4 }}>{label}</div>
      <div>{fmtCurrency(payload[0].value)}</div>
    </div>
  );
};

export default function AdminOverview() {
  const [stats,   setStats]   = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [period,  setPeriod]  = useState('daily');
  const [loading, setLoading] = useState(true);
  const [revLoading, setRevLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const s = await adminGetStats(session.access_token);
        setStats(s);
      } catch (e) { console.error('[AdminOverview] stats:', e); }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    async function loadRevenue() {
      setRevLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const r = await adminGetRevenue(session.access_token, period);
        setRevenue(r.data || []);
      } catch (e) { console.error('[AdminOverview] revenue:', e); }
      setRevLoading(false);
    }
    loadRevenue();
  }, [period]);

  return (
    <div>
      <div style={S.heading}>Overview</div>

      {loading ? (
        <div style={{ color: '#555', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em' }}>Loading…</div>
      ) : (
        <div style={S.cards}>
          <StatCard label="Total Users" value={stats?.totalUsers ?? '—'} />
          <StatCard label="Active Subscribers" value={stats?.activeSubscribers ?? '—'} />
          <StatCard label="MRR" value={stats ? fmtCurrency(stats.mrr) : '—'} sub="@ £9.99/user" />
          <StatCard label="Churn This Month" value={stats ? `${stats.churnThisMonth}%` : '—'} sub="cancelled / active at month start" />
        </div>
      )}

      <div style={S.section}>
        <div style={S.sHead}>
          <span style={S.sTitle}>Revenue — last 30 days</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                ...S.periodBtn,
                background: period === p ? '#1a1a1a' : 'transparent',
                color: period === p ? '#F5F3EE' : '#787878',
                borderColor: period === p ? 'rgba(200,200,200,0.3)' : 'rgba(200,200,200,0.12)',
              }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {revLoading ? (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontFamily: "'Barlow Condensed', sans-serif" }}>Loading…</div>
        ) : revenue.length === 0 ? (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em' }}>No revenue data</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={revenue} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtDate}
                tick={{ fill: '#555', fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif" }}
                axisLine={{ stroke: '#1a1a1a' }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={v => `£${v}`}
                tick={{ fill: '#555', fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif" }}
                axisLine={false} tickLine={false} width={44} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="amount" fill="#C0392B" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
