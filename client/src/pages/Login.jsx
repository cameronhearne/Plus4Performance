import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useBranding } from '../lib/BrandingContext';
import './intake-flow.css';

export default function Login() {
  const navigate = useNavigate();
  const branding = useBranding();
  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (error) throw error;
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="if-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="if-ambient" />

      <div className="if-content">
        <div className="if-auth-card">

          {branding.logo_url
            ? <img src={branding.logo_url} alt={branding.name} style={{ height: 36, objectFit: 'contain', marginBottom: 28 }} />
            : <div className="if-brand">{branding.name}</div>}

          <h1 className="if-heading">Welcome back</h1>

          <form onSubmit={handleSubmit}>
            <div className="if-form-group" style={{ '--if-field-delay': '0.3s' }}>
              <label className="if-label">Email</label>
              <input
                className="if-input"
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="if-form-group" style={{ '--if-field-delay': '0.36s' }}>
              <div className="if-label-row">
                <label className="if-label" style={{ margin: 0 }}>Password</label>
                <Link to="/forgot-password" className="if-link" style={{ fontSize: 12 }}>
                  Forgot password?
                </Link>
              </div>
              <input
                className="if-input"
                type="password"
                value={form.password}
                onChange={set('password')}
                placeholder="••••••••"
                required
              />
            </div>

            {error && <div className="if-error">{error}</div>}

            <div style={{ opacity: 0, animation: 'if-fadeUp 0.55s cubic-bezier(0.16,1,0.3,1) 0.44s forwards' }}>
              <button type="submit" className="if-btn" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in →'}
              </button>
            </div>
          </form>

          <div className="if-divider" />

          <p className="if-footer">
            Don't have an account?{' '}
            <Link to="/signup" className="if-link">Sign up free</Link>
          </p>
          <p className="if-footer">
            Are you a partner?{' '}
            <Link to="/affiliate/login" className="if-link">Partner login →</Link>
          </p>

        </div>
      </div>
    </div>
  );
}
