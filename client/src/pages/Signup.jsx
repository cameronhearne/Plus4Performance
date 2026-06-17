import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const API = import.meta.env.VITE_API_URL || '';

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Capture ?ref=CODE from URL and persist in sessionStorage so it survives
  // navigation (e.g. homepage ?ref= → /signup without the param).
  useEffect(() => {
    const code = searchParams.get('ref');
    if (code) sessionStorage.setItem('p4p_ref', code.toUpperCase().trim());
  }, [searchParams]);

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: signUpErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { first_name: form.firstName, last_name: form.lastName },
        },
      });
      if (signUpErr) throw signUpErr;

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from('profiles').update({
          first_name: form.firstName,
          last_name: form.lastName,
        }).eq('id', session.user.id);

        // If user arrived via a referral link, attribute them to the affiliate.
        const refCode = searchParams.get('ref')?.toUpperCase().trim()
          || sessionStorage.getItem('p4p_ref');
        if (refCode) {
          try {
            await fetch(API + '/api/affiliate/record-referral', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ referral_code: refCode }),
            });
            sessionStorage.removeItem('p4p_ref');
          } catch { /* non-fatal — referral recording failing must not block signup */ }
        }
      }

      navigate('/intake');
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
        <h1 style={styles.heading}>Create your account</h1>
        <p style={styles.sub}>Free to start. No card required.</p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>First name</label>
              <input type="text" value={form.firstName} onChange={set('firstName')} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Last name</label>
              <input type="text" value={form.lastName} onChange={set('lastName')} required />
            </div>
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={form.password} onChange={set('password')} minLength={8} required />
          </div>

          {error && <p className="form-error" style={{ marginBottom: 16 }}>{error}</p>}

          <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Creating account…' : 'Create account & start intake'}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account? <Link to="/login" style={styles.link}>Log in</Link>
        </p>
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
    maxWidth: 480,
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
    marginBottom: 32,
  },
  footer: {
    marginTop: 24,
    fontSize: 13,
    color: '#787878',
    textAlign: 'center',
  },
  link: {
    color: '#C8C8C8',
    textDecoration: 'underline',
  },
};
