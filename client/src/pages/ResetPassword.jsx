import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase redirects to /reset-password with the session embedded in the URL hash.
    // The onAuthStateChange event fires with type PASSWORD_RECOVERY when the hash is processed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    // Also check if there's already an active session from the hash
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      navigate('/dashboard');
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
        <h1 style={styles.heading}>Set new password</h1>

        {!ready ? (
          <p style={styles.sub}>Verifying your reset link…</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={styles.sub}>Choose a new password for your account.</p>
            <div className="form-group">
              <label>New password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                minLength={8} required autoFocus />
            </div>
            <div className="form-group">
              <label>Confirm new password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                minLength={8} required />
            </div>
            {error && <p className="form-error" style={{ marginBottom: 16 }}>{error}</p>}
            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Updating…' : 'Update password'}
            </button>
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
};
