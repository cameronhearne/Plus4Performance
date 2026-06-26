import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { adminListAffiliates, adminCreateAffiliate, adminMarkAffiliatePaid } from '../../lib/api';

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

const thStyle = {
  textAlign: 'left', fontFamily: "'Inter', sans-serif",
  fontSize: '10.5px', letterSpacing: '1.2px', color: C.ashDim,
  textTransform: 'uppercase', padding: '10px 14px',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
};
const tdStyle = {
  padding: '16px 14px', fontSize: 14, color: C.ash,
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  fontFamily: "'Inter', sans-serif", verticalAlign: 'middle',
};

const fieldEyebrow = {
  fontFamily: "'Inter', sans-serif", fontSize: 11,
  letterSpacing: '1.3px', color: C.ashDim, textTransform: 'uppercase', marginBottom: 8,
};

export default function AdminAffiliates() {
  const [affiliates, setAffiliates] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [paying,     setPaying]     = useState(null);
  const [form,       setForm]       = useState({ name: '', email: '', commission_type: 'flat', commission_value: '', referral_code: '' });
  const [creating,   setCreating]   = useState(false);
  const [formErr,    setFormErr]    = useState('');
  const [formOk,     setFormOk]     = useState('');

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
      <style>{`
        .aff-inp { width: 100%; background: #0C0A0F; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 13px 15px; color: #F3F1ED; font-size: 14px; font-family: 'Inter', sans-serif; outline: none; box-sizing: border-box; transition: border-color 0.25s, box-shadow 0.25s; }
        .aff-inp:focus { border-color: rgba(255,79,196,0.25); box-shadow: 0 0 18px -8px rgba(255,79,196,0.5); }
        select.aff-inp { appearance: none; cursor: pointer; }
      `}</style>

      {/* ── Add Affiliate form ── */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 28, textTransform: 'uppercase', color: C.bone, marginBottom: 20 }}>
          Add Affiliate
        </div>
        <form onSubmit={handleCreate} style={{
          background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16, padding: 26,
          boxShadow: '0 12px 30px -16px rgba(0,0,0,0.55)',
          maxWidth: 640,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={fieldEyebrow}>Name</div>
              <input className="aff-inp" value={form.name} onChange={setF('name')} required placeholder="Full name" />
            </div>
            <div>
              <div style={fieldEyebrow}>Email</div>
              <input className="aff-inp" type="email" value={form.email} onChange={setF('email')} required placeholder="their@email.com" />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={fieldEyebrow}>Referral Code</div>
            <input
              className="aff-inp"
              value={form.referral_code}
              onChange={e => setForm(f => ({ ...f, referral_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
              placeholder="e.g. NATHAN — leave blank to auto-generate"
              maxLength={20}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={fieldEyebrow}>Commission Type</div>
              <select className="aff-inp" value={form.commission_type} onChange={setF('commission_type')}>
                <option value="flat">Flat (£ per referral)</option>
                <option value="percentage">Percentage (% of subscription)</option>
              </select>
            </div>
            <div>
              <div style={fieldEyebrow}>{form.commission_type === 'flat' ? 'Amount (£)' : 'Percentage (%)'}</div>
              <input className="aff-inp" type="number" min="0" step="0.01" value={form.commission_value} onChange={setF('commission_value')} required placeholder="0.00" />
            </div>
          </div>
          {formErr && <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#fca5a5', marginBottom: 12 }}>{formErr}</p>}
          {formOk  && <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.green, marginBottom: 12 }}>{formOk}</p>}
          <button type="submit" disabled={creating} style={{
            background: creating ? C.surface2 : 'linear-gradient(160deg, #18151F, #100E15)',
            border: `1px solid ${C.pinkLine}`,
            color: C.bone, borderRadius: 10, padding: '14px 26px',
            fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 12.5,
            letterSpacing: '1.2px', textTransform: 'uppercase',
            cursor: creating ? 'default' : 'pointer', minHeight: 44,
            opacity: creating ? 0.6 : 1,
            boxShadow: creating ? 'none' : `0 10px 26px -8px ${C.pinkGlow}`,
          }}>
            {creating ? '…' : 'Create Affiliate'}
          </button>
        </form>
      </div>

      {/* ── All Affiliates table ── */}
      <div>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 28, textTransform: 'uppercase', color: C.bone, marginBottom: 20 }}>
          All Affiliates
        </div>
        {loading ? (
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash }}>Loading…</p>
        ) : affiliates.length === 0 ? (
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash }}>No affiliates yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Email', 'Code', 'Commission', 'Earned', 'Paid', 'Pending', 'Status', ''].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {affiliates.map(a => {
                const pending = Math.round((a.total_commission - a.paid_commission) * 100) / 100;
                return (
                  <tr key={a.id}>
                    <td style={{ ...tdStyle, color: C.bone }}>{a.name}</td>
                    <td style={{ ...tdStyle, color: C.ashDim }}>{a.email}</td>
                    <td style={tdStyle}>
                      {/* Referral code chip — Roboto Mono, dark surface, subtle border */}
                      <span style={{
                        fontFamily: "'Roboto Mono', monospace",
                        background: C.surface2, border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 6, padding: '4px 9px', fontSize: 12.5, color: C.bone,
                      }}>
                        {a.referral_code}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {a.commission_type === 'flat'
                        ? `£${Number(a.commission_value).toFixed(2)}`
                        : `${Number(a.commission_value)}%`}
                    </td>
                    <td style={tdStyle}>£{a.total_commission.toFixed(2)}</td>
                    <td style={tdStyle}>£{a.paid_commission.toFixed(2)}</td>
                    <td style={{ ...tdStyle, color: pending > 0 ? C.bone : C.ashDim }}>
                      £{pending.toFixed(2)}
                    </td>
                    <td style={tdStyle}>
                      {/* Active = green (positive status); anything else = neutral */}
                      <span style={{
                        display: 'inline-block', padding: '5px 11px', borderRadius: 7,
                        fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700,
                        letterSpacing: '0.8px', textTransform: 'uppercase',
                        ...(a.status === 'active'
                          ? { background: 'rgba(74,153,104,0.1)', border: `1px solid ${C.greenLine}`, color: C.green, boxShadow: `0 0 10px -4px ${C.greenGlow}` }
                          : { background: C.surface2, border: '1px solid rgba(255,255,255,0.08)', color: C.ashDim }),
                      }}>
                        {a.status}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {pending > 0 && (
                        <button
                          style={{
                            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                            color: C.ash, borderRadius: 8,
                            fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600,
                            letterSpacing: '0.8px', textTransform: 'uppercase',
                            padding: '7px 14px',
                            cursor: paying === a.id ? 'default' : 'pointer',
                            opacity: paying === a.id ? 0.55 : 1,
                          }}
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
