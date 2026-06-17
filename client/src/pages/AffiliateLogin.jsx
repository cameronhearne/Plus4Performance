import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const API = import.meta.env.VITE_API_URL || '';

export default function AffiliateLogin() {
  const [email, setEmail]     = useState('');
  const [step, setStep]       = useState('form'); // 'form' | 'sent'
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Verify the email is a registered active affiliate before requesting OTP.
      // This prevents magic links going to non-affiliates and avoids creating
      // spurious Supabase auth users.
      const checkRes = await fetch(API + '/api/affiliate/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const checkData = await checkRes.json();
      if (!checkData.registered) {
        setError('This email is not registered as a Plus 4 affiliate. Contact your account manager.');
        setLoading(false);
        return;
      }

      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/affiliate/dashboard`,
        },
      });
      if (otpErr) throw otpErr;
      setStep('sent');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>PLUS 4 PERFORMANCE</div>
        <div style={S.eyebrow}>Affiliate Portal</div>
        <h1 style={S.heading}>Partner Login</h1>

        {step === 'sent' ? (
          <div>
            <p style={S.body}>
              Check your inbox — we've sent a magic link to <strong style={{ color: '#F5F3EE' }}>{email}</strong>.
              Click it to access your dashboard. The link expires in 60 minutes.
            </p>
            <p style={{ ...S.body, marginTop: 16 }}>
              Didn't get it? Check your spam folder, or{' '}
              <button
                type="button"
                onClick={() => setStep('form')}
                style={{ background: 'none', border: 'none', color: '#C8C8C8', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit', padding: 0 }}
              >
                try again
              </button>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={S.body}>Enter your affiliate email and we'll send you a one-time login link — no password needed.</p>
            <div style={{ marginTop: 24, marginBottom: 20 }}>
              <label style={S.label}>Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={S.input}
              />
            </div>
            {error && <p style={S.errMsg}>{error}</p>}
            <button type="submit" style={S.btn} disabled={loading}>
              {loading ? 'Checking…' : 'Send Login Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const S = {
  page:    { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: 'radial-gradient(ellipse at center, #111 0%, #080808 100%)' },
  card:    { width: '100%', maxWidth: 440, background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.12)', padding: '48px 40px' },
  logo:    { fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.16em', color: '#C8C8C8', marginBottom: 28 },
  eyebrow: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#C0392B', marginBottom: 10 },
  heading: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: '0.04em', color: '#F5F3EE', marginBottom: 0 },
  body:    { fontSize: 14, color: '#787878', lineHeight: 1.75 },
  label:   { display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#787878', marginBottom: 6 },
  input:   { width: '100%', background: '#111', border: '1px solid rgba(200,200,200,0.15)', color: '#F5F3EE', fontFamily: "'Barlow', sans-serif", fontSize: 14, padding: '12px 14px', outline: 'none', boxSizing: 'border-box' },
  btn:     { width: '100%', background: '#C0392B', border: 'none', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', padding: '14px 0', cursor: 'pointer' },
  errMsg:  { fontSize: 12, color: '#ef4444', marginBottom: 16, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em', lineHeight: 1.5 },
};
