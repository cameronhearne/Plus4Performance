import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { supabase } from '../../lib/supabase';
import { adminGetStats, adminGetRevenue } from '../../lib/api';

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────

const C = {
  surface:      '#131119',
  surface2:     '#0C0A0F',
  bone:         '#F3F1ED',
  ash:          '#ABA9B0',
  ashDim:       '#7A7880',
  pinkGlow:     'rgba(255,79,196,0.5)',
  pinkLine:     'rgba(255,79,196,0.25)',
  purpleDeep:   '#6B1FB8',
  purpleMid:    '#9B2FE0',
  purpleBright: '#C961F5',
  purpleGlow:   'rgba(155,47,224,0.45)',
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const fmtCurrency = n => `£${Number(n).toFixed(2)}`;
const fmtDate     = str => (str?.length === 10 ? str.slice(5) : str);

const PERIODS = ['daily', 'weekly', 'monthly'];

// ─── STAT CARD ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }) {
  return (
    <div style={{
      background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 14, padding: 22,
      boxShadow: `0 10px 26px -16px rgba(0,0,0,0.55), 0 0 20px -16px ${C.pinkGlow}`,
    }}>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, letterSpacing: '1.4px', textTransform: 'uppercase', color: C.ashDim, marginBottom: 12 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 600, fontSize: 30, color: C.bone, marginBottom: 8, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: C.ashDim }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── CHART TOOLTIP ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.surface2,
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, padding: '8px 12px',
      fontFamily: "'Inter', sans-serif", fontSize: 12,
    }}>
      <div style={{ color: C.ashDim, marginBottom: 4 }}>{label}</div>
      <div style={{ color: C.bone, fontFamily: "'Roboto Mono', monospace", fontWeight: 600 }}>
        {fmtCurrency(payload[0].value)}
      </div>
    </div>
  );
};

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export default function AdminOverview() {
  const [stats,      setStats]      = useState(null);
  const [revenue,    setRevenue]    = useState([]);
  const [period,     setPeriod]     = useState('daily');
  const [loading,    setLoading]    = useState(true);
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
      {/* Page heading */}
      <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 32, textTransform: 'uppercase', color: C.bone, marginBottom: 26 }}>
        Overview
      </div>

      {/* Stat cards */}
      {loading ? (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash, marginBottom: 40 }}>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          <StatCard label="Total Users"         value={stats?.totalUsers ?? '—'} />
          <StatCard label="Active Subscribers"  value={stats?.activeSubscribers ?? '—'} />
          <StatCard label="MRR"                 value={stats ? fmtCurrency(stats.mrr) : '—'} sub="@ £9.99/user" />
          <StatCard label="Churn This Month"    value={stats ? `${stats.churnThisMonth}%` : '—'} sub="cancelled / active at month start" />
        </div>
      )}

      {/* Revenue chart card */}
      <div style={{
        background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16, padding: 26,
        boxShadow: '0 12px 30px -16px rgba(0,0,0,0.55)',
        marginBottom: 24,
      }}>
        {/* Chart header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, letterSpacing: '1.6px', color: C.ashDim, textTransform: 'uppercase' }}>
            Revenue — Last 30 Days
          </div>

          {/* Period toggle — standard pink lift+glow selected state */}
          <div style={{ display: 'flex', gap: 4, background: C.surface2, borderRadius: 9, padding: 4 }}>
            {PERIODS.map(p => {
              const isActive = period === p;
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    padding: '9px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 11.5,
                    letterSpacing: '0.8px', textTransform: 'uppercase',
                    background: isActive ? 'linear-gradient(160deg, #1A1722, #100E15)' : 'none',
                    color: isActive ? C.bone : C.ash,
                    boxShadow: isActive ? `0 0 14px -4px ${C.pinkGlow}` : 'none',
                    transition: 'background 0.2s, box-shadow 0.2s',
                  }}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart content */}
        {revLoading ? (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ashDim }}>
            Loading…
          </div>
        ) : revenue.length === 0 ? (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ashDim }}>
            No revenue data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={revenue} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              {/* Purple gradient bars — intentional, reuses the purple = charted data convention */}
              <defs>
                <linearGradient id="purpleBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#C961F5" />
                  <stop offset="60%"  stopColor="#9B2FE0" />
                  <stop offset="100%" stopColor="#6B1FB8" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fill: C.ashDim, fontSize: 10, fontFamily: "'Inter', sans-serif" }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={v => `£${v}`}
                tick={{ fill: C.ashDim, fontSize: 10, fontFamily: "'Inter', sans-serif" }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="amount" fill="url(#purpleBarGrad)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
