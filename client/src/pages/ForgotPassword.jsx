import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>PLUS 4 PERFORMANCE</div>
        <h1 style={styles.heading}>Reset your password</h1>

        {sent ? (
          <div>
            <p style={styles.success}>
              Check your inbox — we've sent a password reset link to <strong>{email}</strong>.
            </p>
            <p style={{ ...styles.footer, marginTop: 24 }}>
              <Link to="/login" style={styles.link}>Back to login</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={styles.sub}>Enter your email and we'll send you a reset link.</p>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            {error && <p className="form-error" style={{ marginBottom: 16 }}>{error}</p>}
            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <p style={styles.footer}>
              <Link to="/login" style={styles.link}>Back to login</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    background: 'radial-gradient(ellipse at center, #111 0%, #080808 100%)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: '#0d0d0d',
    border: '1px solid rgba(200,200,200,0.12)',
    padding: '48px 40px',
  },
  logo: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 18,
    letterSpacing: '0.16em',
    color: '#C8C8C8',
    marginBottom: 32,
  },
  heading: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 36,
    letterSpacing: '0.04em',
    color: '#F5F3EE',
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    color: '#787878',
    marginBottom: 28,
  },
  success: {
    fontSize: 14,
    color: '#CDCDC8',
    lineHeight: 1.7,
    padding: '16px 20px',
    background: 'rgba(200,200,200,0.05)',
    border: '1px solid rgba(200,200,200,0.12)',
  },
  footer: {
    marginTop: 20,
    fontSize: 13,
    color: '#787878',
    textAlign: 'center',
  },
  link: { color: '#C8C8C8', textDecoration: 'underline' },
};
