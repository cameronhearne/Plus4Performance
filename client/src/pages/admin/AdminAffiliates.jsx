import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { adminListAffiliates, adminCreateAffiliate, adminMarkAffiliatePaid } from '../../lib/api';

const S = {
  section:    { marginBottom: 48 },
  heading:    { fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#F5F3EE', marginBottom: 20 },
  subhead:    { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#787878', marginBottom: 16 },
  table:      { width: '100%', borderCollapse: 'collapse' },
  th:         { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#555', padding: '8px 12px 8px 0', textAlign: 'left', borderBottom: '1px solid #222' },
  td:         { fontSize: 13, color: '#CDCDC8', padding: '12px 12px 12px 0', borderBottom: '1px solid #161616', verticalAlign: 'middle' },
  code:       { fontFamily: 'monospace', background: '#1a1a1a', border: '1px solid #2a2a2a', padding: '2px 8px', fontSize: 12, letterSpacing: '0.08em', color: '#C8C8C8' },
  badge:      { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', padding: '3px 8px', border: '1px solid' },
  btnSmall:   { background: 'none', border: '1px solid rgba(200,200,200,0.2)', color: '#CDCDC8', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '6px 14px', cursor: 'pointer' },
  btnRed:     { background: '#C0392B', border: 'none', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '11px 24px', cursor: 'pointer' },
  form:       { background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.12)', padding: '28px 32px', maxWidth: 560 },
  formRow:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  label:      { display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#787878', marginBottom: 6 },
  input:      { width: '100%', background: '#111', border: '1px solid rgba(200,200,200,0.15)', color: '#F5F3EE', fontFamily: "'Barlow', sans-serif", fontSize: 13, padding: '10px 14px', outline: 'none', boxSizing: 'border-box' },
  select:     { width: '100%', background: '#111', border: '1px solid rgba(200,200,200,0.15)', color: '#F5F3EE', fontFamily: "'Barlow', sans-serif", fontSize: 13, padding: '10px 14px', outline: 'none', appearance: 'none' },
  errMsg:     { fontSize: 12, color: '#ef4444', marginBottom: 12, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em' },
  okMsg:      { fontSize: 12, color: '#4CAF50', marginBottom: 12, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em' },
};

export default function AdminAffiliates() {
  const [affiliates, setAffiliates] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [paying, setPaying]         = useState(null);   // affiliate id being marked paid
  const [form, setForm] = useState({ name: '', email: '', commission_type: 'flat', commission_value: '', referral_code: '' });
  const [creating, setCreating]     = useState(false);
  const [formErr, setFormErr]       = useState('');
  const [formOk, setFormOk]         = useState('');

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  }

  async function load() {
    const token = await getToken();
    try {
      const { affiliates: list } = await adminListAffiliates(token);
      setAffiliates(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function setF(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormErr(''); setFormOk('');

    const code = form.referral_code.trim();
    if (code) {
      if (!/^[A-Z0-9]+$/.test(code)) {
        setFormErr('Referral code must be uppercase letters and numbers only — no spaces or special characters.');
        return;
      }
      if (affiliates.some(a => a.referral_code === code)) {
        setFormErr(`Code "${code}" is already in use by another affiliate.`);
        return;
      }
    }

    setCreating(true);
    try {
      const token = await getToken();
      const result = await adminCreateAffiliate(token, {
        name: form.name,
        email: form.email,
        commission_type: form.commission_type,
        commission_value: parseFloat(form.commission_value) || 0,
        ...(code ? { referral_code: code } : {}),
      });
      setFormOk(`Affiliate created — code: ${result.affiliate?.referral_code ?? code}`);
      setForm({ name: '', email: '', commission_type: 'flat', commission_value: '', referral_code: '' });
      load();
    } catch (e) {
      setFormErr(e.message || 'Failed to create affiliate');
    } finally {
      setCreating(false);
    }
  }

  async function handleMarkPaid(affiliateId) {
    setPaying(affiliateId);
    try {
      const token = await getToken();
      await adminMarkAffiliatePaid(token, affiliateId);
      load();
    } catch (e) {
      alert(e.message || 'Failed to mark paid');
    } finally {
      setPaying(null);
    }
  }

  return (
    <div>
      {/* ── Create affiliate ───────────────────────────── */}
      <div style={S.section}>
        <div style={S.heading}>Add Affiliate</div>
        <form onSubmit={handleCreate} style={S.form}>
          <div style={S.formRow}>
            <div>
              <label style={S.label}>Name</label>
              <input style={S.input} value={form.name} onChange={setF('name')} required placeholder="Full name" />
            </div>
            <div>
              <label style={S.label}>Email</label>
              <input style={S.input} type="email" value={form.email} onChange={setF('email')} required placeholder="their@email.com" />
            </div>
          </div>
          <div style={S.formRow}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={S.label}>Referral Code</label>
              <input
                style={S.input}
                value={form.referral_code}
                onChange={e => setForm(f => ({ ...f, referral_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                placeholder="e.g. NATHAN — leave blank to auto-generate"
                maxLength={20}
              />
            </div>
          </div>
          <div style={S.formRow}>
            <div>
              <label style={S.label}>Commission type</label>
              <select style={S.select} value={form.commission_type} onChange={setF('commission_type')}>
                <option value="flat">Flat (£ per referral)</option>
                <option value="percentage">Percentage (% of subscription)</option>
              </select>
            </div>
            <div>
              <label style={S.label}>
                {form.commission_type === 'flat' ? 'Amount (£)' : 'Percentage (%)'}
              </label>
              <input style={S.input} type="number" min="0" step="0.01" value={form.commission_value} onChange={setF('commission_value')} required placeholder="0.00" />
            </div>
          </div>
          {formErr && <p style={S.errMsg}>{formErr}</p>}
          {formOk  && <p style={S.okMsg}>{formOk}</p>}
          <button type="submit" style={S.btnRed} disabled={creating}>
            {creating ? '…' : 'Create Affiliate'}
          </button>
        </form>
      </div>

      {/* ── Affiliate list ─────────────────────────────── */}
      <div style={S.section}>
        <div style={S.heading}>All Affiliates</div>
        {loading ? (
          <p style={{ color: '#555', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13 }}>Loading…</p>
        ) : affiliates.length === 0 ? (
          <p style={{ color: '#555', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13 }}>No affiliates yet.</p>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                {['Name', 'Email', 'Code', 'Commission', 'Earned', 'Paid', 'Pending', 'Status', ''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {affiliates.map(a => {
                const pending = Math.round((a.total_commission - a.paid_commission) * 100) / 100;
                return (
                  <tr key={a.id}>
                    <td style={S.td}>{a.name}</td>
                    <td style={S.td}>{a.email}</td>
                    <td style={S.td}><span style={S.code}>{a.referral_code}</span></td>
                    <td style={S.td}>
                      {a.commission_type === 'flat'
                        ? `£${Number(a.commission_value).toFixed(2)}`
                        : `${Number(a.commission_value)}%`}
                    </td>
                    <td style={S.td}>£{a.total_commission.toFixed(2)}</td>
                    <td style={S.td}>£{a.paid_commission.toFixed(2)}</td>
                    <td style={{ ...S.td, color: pending > 0 ? '#F5F3EE' : '#555' }}>
                      £{pending.toFixed(2)}
                    </td>
                    <td style={S.td}>
                      <span style={{
                        ...S.badge,
                        color:       a.status === 'active' ? '#4CAF50' : '#787878',
                        borderColor: a.status === 'active' ? 'rgba(76,175,80,0.4)' : 'rgba(120,120,120,0.3)',
                      }}>
                        {a.status}
                      </span>
                    </td>
                    <td style={S.td}>
                      {pending > 0 && (
                        <button
                          style={S.btnSmall}
                          disabled={paying === a.id}
                          onClick={() => handleMarkPaid(a.id)}
                        >
                          {paying === a.id ? '…' : 'Mark Paid'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
