import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { supabase } from '../../lib/supabase';
import {
  adminGetUser, adminGetLastCharge,
  adminCancelSub, adminRefund, adminRegeneratePlan,
} from '../../lib/api';

// ─── SHARED STYLES ────────────────────────────────────────────────────────────

const S = {
  back:      { display: 'inline-block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555', textDecoration: 'none', marginBottom: 24, cursor: 'pointer', background: 'none', border: 'none', padding: 0 },
  heading:   { fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: '0.04em', color: '#F5F3EE', lineHeight: 1, marginBottom: 6 },
  sub:       { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#555', letterSpacing: '0.06em', marginBottom: 32 },
  grid:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 },
  section:   { background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.1)', padding: '20px 20px', marginBottom: 16 },
  sLabel:    { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#555', marginBottom: 14 },
  row:       { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #111', fontSize: 13 },
  rowLabel:  { color: '#555', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em' },
  rowVal:    { color: '#CDCDC8', fontFamily: "'Barlow', sans-serif", fontWeight: 300 },
  badge:     { display: 'inline-block', padding: '3px 8px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' },
  actionBtn: { padding: '11px 20px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', cursor: 'pointer', border: 'none', marginRight: 10, marginBottom: 10 },
  danger:    { background: 'rgba(192,57,43,0.15)', color: '#C0392B', border: '1px solid rgba(192,57,43,0.3)' },
  ghost:     { background: 'none', border: '1px solid rgba(200,200,200,0.18)', color: '#787878' },
  // modal
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' },
  modal:     { background: '#111', border: '1px solid rgba(200,200,200,0.12)', padding: '28px 28px', maxWidth: 440, width: '100%' },
  mTitle:    { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#C0392B', marginBottom: 14 },
  mBody:     { fontFamily: "'Barlow', sans-serif", fontSize: 13, color: '#CDCDC8', lineHeight: 1.7, marginBottom: 20, fontWeight: 300 },
  mInput:    { width: '100%', padding: '10px 12px', background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.18)', color: '#F5F3EE', fontFamily: "'Barlow', sans-serif", fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 16 },
  mSelect:   { display: 'flex', gap: 10, marginBottom: 20 },
  mOpt:      { flex: 1, padding: '10px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', border: '1px solid rgba(200,200,200,0.12)', textAlign: 'center', background: 'transparent', color: '#787878', textTransform: 'uppercase' },
  mOptSel:   { flex: 1, padding: '10px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', border: '1px solid #C0392B', textAlign: 'center', background: 'rgba(192,57,43,0.1)', color: '#F5F3EE', textTransform: 'uppercase' },
  mBtns:     { display: 'flex', gap: 10 },
  mConfirm:  { flex: 1, padding: '12px', background: '#C0392B', border: 'none', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', cursor: 'pointer' },
  mCancel:   { flex: 1, padding: '12px', background: 'none', border: '1px solid rgba(200,200,200,0.18)', color: '#787878', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' },
  errMsg:    { color: '#ef4444', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.06em', marginBottom: 12 },
  okMsg:     { color: '#4CAF50', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.06em', marginBottom: 12 },
  logRow:    { padding: '10px 0', borderBottom: '1px solid #111', display: 'flex', gap: 16 },
  logDate:   { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555', letterSpacing: '0.06em', minWidth: 140, flexShrink: 0 },
  logType:   { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C0392B', minWidth: 140, flexShrink: 0 },
  logDetail: { fontFamily: "'Barlow', sans-serif", fontSize: 12, color: '#555' },
};

const STATUS_BADGE = {
  active:   { bg: 'rgba(76,175,80,0.15)',  color: '#4CAF50' },
  canceled: { bg: 'rgba(120,120,120,0.1)', color: '#555' },
  past_due: { bg: 'rgba(255,152,0,0.12)', color: '#FF9800' },
  trialing: { bg: 'rgba(33,150,243,0.12)', color: '#2196F3' },
};

const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
const fmtDateTime = iso => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtMoney = (pence, currency = 'gbp') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency.toUpperCase() }).format(pence / 100);

// ─── CONFIRM MODAL ────────────────────────────────────────────────────────────

function ConfirmModal({ title, children, onConfirm, onCancel, confirming, confirmLabel = 'Confirm', danger = true }) {
  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={S.modal}>
        <div style={S.mTitle}>{title}</div>
        {children}
        <div style={S.mBtns}>
          <button style={S.mCancel}  onClick={onCancel} disabled={confirming}>Cancel</button>
          <button style={{ ...S.mConfirm, background: danger ? '#C0392B' : '#2a2a2a', opacity: confirming ? 0.6 : 1 }}
            onClick={onConfirm} disabled={confirming}>
            {confirming ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CANCEL SUBSCRIPTION MODAL ────────────────────────────────────────────────

function CancelModal({ onConfirm, onCancel, confirming, error }) {
  const [mode, setMode] = useState('at_period_end');
  return (
    <ConfirmModal title="Cancel Subscription" onConfirm={() => onConfirm(mode)} onCancel={onCancel}
      confirming={confirming} confirmLabel="Cancel Subscription">
      <p style={S.mBody}>Choose when the subscription should end.</p>
      {error && <p style={S.errMsg}>{error}</p>}
      <div style={S.mSelect}>
        <button style={mode === 'at_period_end' ? S.mOptSel : S.mOpt} onClick={() => setMode('at_period_end')}>
          At period end
        </button>
        <button style={mode === 'immediately' ? S.mOptSel : S.mOpt} onClick={() => setMode('immediately')}>
          Immediately
        </button>
      </div>
    </ConfirmModal>
  );
}

// ─── REFUND MODAL ─────────────────────────────────────────────────────────────

function RefundModal({ lastCharge, onConfirm, onCancel, confirming, error }) {
  const defaultAmt = lastCharge ? String(lastCharge.amount) : '';
  const [amt, setAmt] = useState(defaultAmt);

  const amtNum   = parseInt(amt, 10);
  const amtValid = !isNaN(amtNum) && amtNum > 0;
  const amtPounds = amtValid ? fmtMoney(amtNum, lastCharge?.currency || 'gbp') : '—';

  return (
    <ConfirmModal title="Issue Refund" onConfirm={() => onConfirm(lastCharge?.id, amtNum)} onCancel={onCancel}
      confirming={confirming} confirmLabel={`Refund ${amtPounds}`}>
      {!lastCharge ? (
        <p style={S.mBody}>No charge found for this customer.</p>
      ) : (
        <>
          <p style={S.mBody}>
            Last charge: <strong style={{ color: '#F5F3EE' }}>{fmtMoney(lastCharge.amount, lastCharge.currency)}</strong>
            {lastCharge.last4 && <> · card ending <strong style={{ color: '#F5F3EE' }}>…{lastCharge.last4}</strong></>}
          </p>
          {error && <p style={S.errMsg}>{error}</p>}
          <label style={{ display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555', marginBottom: 8 }}>
            Amount (pence)
          </label>
          <input type="number" value={amt} onChange={e => setAmt(e.target.value)} style={S.mInput} min="1" />
        </>
      )}
    </ConfirmModal>
  );
}

// ─── REGENERATE PLAN MODAL ────────────────────────────────────────────────────

function RegenModal({ onConfirm, onCancel, confirming, error }) {
  return (
    <ConfirmModal title="Regenerate Plan" onConfirm={onConfirm} onCancel={onCancel}
      confirming={confirming} confirmLabel="Regenerate" danger={false}>
      <p style={S.mBody}>
        This will generate a new 12-week plan using the user's most recent intake data, overwriting their current plan. This counts against the per-user rate limit and calls Claude.
      </p>
      {error && <p style={S.errMsg}>{error}</p>}
    </ConfirmModal>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function AdminUserDetail() {
  const { userId } = useParams();
  const navigate   = useNavigate();

  const [data,       setData]       = useState(null);
  const [lastCharge, setLastCharge] = useState(undefined); // undefined = not loaded
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(null); // 'cancel' | 'refund' | 'regen'
  const [working,    setWorking]    = useState(false);
  const [actionErr,  setActionErr]  = useState('');
  const [actionOk,   setActionOk]   = useState('');

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const d = await adminGetUser(session.access_token, userId);
        setData(d);
      } catch (e) { console.error('[AdminUserDetail]', e); }
      setLoading(false);
    }
    load();
  }, [userId]);

  async function openRefundModal() {
    setModal('refund');
    if (lastCharge === undefined) {
      const { data: { session } } = await supabase.auth.getSession();
      try {
        const r = await adminGetLastCharge(session.access_token, userId);
        setLastCharge(r.charge || null);
      } catch { setLastCharge(null); }
    }
  }

  async function handleCancelSub(mode) {
    setWorking(true); setActionErr('');
    const { data: { session } } = await supabase.auth.getSession();
    try {
      await adminCancelSub(session.access_token, userId, mode);
      setModal(null);
      setActionOk(`Subscription cancelled (${mode === 'immediately' ? 'immediately' : 'at period end'}).`);
      // Reload to get updated data
      const d = await adminGetUser(session.access_token, userId);
      setData(d);
    } catch (e) { setActionErr(e.message || 'Failed.'); }
    setWorking(false);
  }

  async function handleRefund(chargeId, amount) {
    setWorking(true); setActionErr('');
    const { data: { session } } = await supabase.auth.getSession();
    try {
      await adminRefund(session.access_token, userId, chargeId, amount);
      setModal(null);
      setActionOk(`Refund issued successfully.`);
    } catch (e) { setActionErr(e.message || 'Failed.'); }
    setWorking(false);
  }

  async function handleRegen() {
    setWorking(true); setActionErr('');
    const { data: { session } } = await supabase.auth.getSession();
    try {
      await adminRegeneratePlan(session.access_token, userId);
      setModal(null);
      setActionOk('Plan regenerated successfully.');
    } catch (e) { setActionErr(e.message || 'Failed.'); }
    setWorking(false);
  }

  function closeModal() { setModal(null); setActionErr(''); }

  if (loading) {
    return <div style={{ color: '#555', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em', padding: '60px 0' }}>Loading…</div>;
  }
  if (!data) {
    return <div style={{ color: '#ef4444', fontFamily: "'Barlow Condensed', sans-serif" }}>User not found.</div>;
  }

  const { user, subscription, intake, plan, checkins, weightLogs, liftLogs, adminActions } = data;
  const subBadge = STATUS_BADGE[subscription?.status] || { bg: 'rgba(120,120,120,0.08)', color: '#444' };

  // Weight chart data
  const weightChartData = (weightLogs || []).map(l => ({
    date:   new Date(l.logged_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    weight: Number(l.weight_kg),
  }));

  // Group 1RM data by lift
  const lifts = ['bench_press', 'squat', 'deadlift', 'overhead_press'];
  const liftNames = { bench_press: 'Bench Press', squat: 'Squat', deadlift: 'Deadlift', overhead_press: 'Overhead Press' };
  const liftData = lifts.reduce((acc, lift) => {
    const entries = (liftLogs || []).filter(l => l.lift === lift);
    if (entries.length) acc[lift] = entries;
    return acc;
  }, {});

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

  return (
    <div>
      <button style={S.back} onClick={() => navigate('/admin/users')}>← Back to users</button>

      <div style={S.heading}>{fullName}</div>
      <div style={S.sub}>{user.email} · Joined {fmtDate(user.createdAt)}</div>

      {actionOk && <div style={S.okMsg}>✓ {actionOk}</div>}
      {actionErr && !modal && <div style={S.errMsg}>{actionErr}</div>}

      {/* ── Profile + Subscription grid ── */}
      <div style={S.grid}>
        <div style={S.section}>
          <div style={S.sLabel}>Profile</div>
          {[
            ['Name',       fullName],
            ['Email',      user.email],
            ['User ID',    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#555' }}>{user.id}</span>],
            ['Joined',     fmtDate(user.createdAt)],
            ['Last Active', fmtDateTime(user.lastSignIn)],
            ['Role',       user.isAdmin ? 'Admin' : 'User'],
          ].map(([label, val]) => (
            <div key={label} style={S.row}>
              <span style={S.rowLabel}>{label}</span>
              <span style={S.rowVal}>{val}</span>
            </div>
          ))}
        </div>

        <div style={S.section}>
          <div style={S.sLabel}>Subscription</div>
          {subscription ? (
            <>
              {[
                ['Status', <span style={{ ...S.badge, background: subBadge.bg, color: subBadge.color }}>{subscription.status}</span>],
                ['Period End', fmtDate(subscription.current_period_end)],
                ['Stripe Sub ID', <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#555' }}>{subscription.stripe_subscription_id}</span>],
                ['Stripe Customer', <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#555' }}>{subscription.stripe_customer_id}</span>],
              ].map(([label, val]) => (
                <div key={label} style={S.row}>
                  <span style={S.rowLabel}>{label}</span>
                  <span style={S.rowVal}>{val}</span>
                </div>
              ))}
            </>
          ) : (
            <div style={{ color: '#444', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13 }}>No subscription on record.</div>
          )}
        </div>
      </div>

      {/* ── Plan intake summary ── */}
      {intake && (
        <div style={S.section}>
          <div style={S.sLabel}>Intake / Plan Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 24px' }}>
            {[
              ['Goal',           intake.goal],
              ['Experience',     intake.experience],
              ['Equipment',      intake.equipment],
              ['Training Days',  intake.trainingDays ? `${intake.trainingDays}×/week` : null],
              ['Session Length', intake.sessionLength ? `${intake.sessionLength} min` : null],
              ['Start Date',     fmtDate(intake.startDate)],
              ['Current Weight', intake.currentWeight ? `${intake.currentWeight} kg` : null],
              ['Target Weight',  intake.targetWeight  ? `${intake.targetWeight} kg`  : null],
              ['Height',         intake.height        ? `${intake.height} cm`        : null],
            ].filter(([, v]) => v).map(([label, val]) => (
              <div key={label} style={{ ...S.row, gridColumn: 'auto' }}>
                <span style={S.rowLabel}>{label}</span>
                <span style={S.rowVal}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Weight trend ── */}
      {weightChartData.length >= 2 && (
        <div style={S.section}>
          <div style={S.sLabel}>Weight Trend ({weightChartData.length} logs)</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weightChartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif" }} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#555', fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif" }} axisLine={false} tickLine={false} width={36} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#CDCDC8' }} />
              <Line type="monotone" dataKey="weight" stroke="#C0392B" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── 1RM history ── */}
      {Object.keys(liftData).length > 0 && (
        <div style={S.section}>
          <div style={S.sLabel}>1RM History</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {Object.entries(liftData).map(([lift, entries]) => {
              const latest = entries[entries.length - 1];
              return (
                <div key={lift} style={{ background: '#111', border: '1px solid #1a1a1a', padding: '12px 14px' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>
                    {liftNames[lift]}
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: '#F5F3EE', lineHeight: 1 }}>
                    {latest.weight_kg} kg
                  </div>
                  <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: '#444', marginTop: 4 }}>
                    {fmtDate(latest.logged_at)} · {entries.length} entries
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Check-in history ── */}
      {checkins.length > 0 && (
        <div style={S.section}>
          <div style={S.sLabel}>Check-In History ({checkins.length})</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date', 'Weight', 'Feeling', 'Energy', 'Nutrition', 'Motivation', 'Notes'].map(h => (
                  <th key={h} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#555', padding: '8px 10px 8px 0', textAlign: 'left', borderBottom: '1px solid #1a1a1a' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {checkins.map(c => (
                <tr key={c.id}>
                  <td style={{ fontSize: 12, color: '#787878', padding: '10px 10px 10px 0', borderBottom: '1px solid #111', fontFamily: "'Barlow Condensed', sans-serif", whiteSpace: 'nowrap' }}>{fmtDate(c.created_at)}</td>
                  <td style={{ fontSize: 12, color: '#CDCDC8', padding: '10px 10px 10px 0', borderBottom: '1px solid #111' }}>{c.current_weight ? `${c.current_weight} kg` : '—'}</td>
                  <td style={{ fontSize: 12, color: '#CDCDC8', padding: '10px 10px 10px 0', borderBottom: '1px solid #111' }}>{c.feeling || '—'}</td>
                  <td style={{ fontSize: 12, color: '#CDCDC8', padding: '10px 10px 10px 0', borderBottom: '1px solid #111' }}>{c.energy || '—'}</td>
                  <td style={{ fontSize: 12, color: '#CDCDC8', padding: '10px 10px 10px 0', borderBottom: '1px solid #111' }}>{c.nutrition_compliance || '—'}</td>
                  <td style={{ fontSize: 12, color: '#CDCDC8', padding: '10px 10px 10px 0', borderBottom: '1px solid #111' }}>{c.motivation_level || '—'}</td>
                  <td style={{ fontSize: 12, color: '#555', padding: '10px 10px 10px 0', borderBottom: '1px solid #111' }}>{c.injuries || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Actions ── */}
      <div style={{ ...S.section, border: '1px solid rgba(192,57,43,0.2)' }}>
        <div style={S.sLabel}>Actions</div>
        <div style={{ marginBottom: 4 }}>
          <button style={{ ...S.actionBtn, ...S.danger }}
            disabled={!subscription || subscription.status !== 'active'}
            onClick={() => { setActionErr(''); setActionOk(''); setModal('cancel'); }}>
            Cancel Subscription
          </button>
          <button style={{ ...S.actionBtn, ...S.danger }}
            onClick={openRefundModal}>
            Issue Refund
          </button>
          <button style={{ ...S.actionBtn, ...S.ghost }}
            disabled={!intake}
            onClick={() => { setActionErr(''); setActionOk(''); setModal('regen'); }}>
            Regenerate Plan
          </button>
        </div>
        {!subscription && <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#444', letterSpacing: '0.06em', margin: '8px 0 0' }}>Cancel subscription is disabled — no active subscription found.</p>}
        {!intake && <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#444', letterSpacing: '0.06em', margin: '4px 0 0' }}>Regenerate plan is disabled — no intake data found.</p>}
      </div>

      {/* ── Admin action log ── */}
      <div style={S.section}>
        <div style={S.sLabel}>Action History</div>
        {adminActions.length === 0 ? (
          <div style={{ color: '#444', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12 }}>No admin actions logged yet.</div>
        ) : adminActions.map(a => (
          <div key={a.id} style={S.logRow}>
            <span style={S.logDate}>{fmtDateTime(a.created_at)}</span>
            <span style={S.logType}>{a.action_type.replace(/_/g, ' ')}</span>
            <span style={S.logDetail}>{a.details ? JSON.stringify(a.details) : ''}</span>
          </div>
        ))}
      </div>

      {/* ── Modals ── */}
      {modal === 'cancel' && (
        <CancelModal onConfirm={handleCancelSub} onCancel={closeModal} confirming={working} error={actionErr} />
      )}
      {modal === 'refund' && (
        <RefundModal lastCharge={lastCharge === undefined ? null : lastCharge} onConfirm={handleRefund} onCancel={closeModal} confirming={working} error={actionErr} />
      )}
      {modal === 'regen' && (
        <RegenModal onConfirm={handleRegen} onCancel={closeModal} confirming={working} error={actionErr} />
      )}
    </div>
  );
}
