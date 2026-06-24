import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useBranding } from '../lib/BrandingContext';
import './intake-flow.css';

const API = import.meta.env.VITE_API_URL || '';

export default function Signup() {
  const navigate = useNavigate();
  const branding = useBranding();
  const [searchParams] = useSearchParams();
  const [form, setForm]       = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

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
        options: { data: { first_name: form.firstName, last_name: form.lastName } },
      });
      if (signUpErr) throw signUpErr;

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from('profiles').update({
          first_name: form.firstName,
          last_name: form.lastName,
        }).eq('id', session.user.id);

        const refCode = searchParams.get('ref')?.toUpperCase().trim()
          || sessionStorage.getItem('p4p_ref');
        if (refCode) {
          try {
            await fetch(API + '/api/affiliate/record-referral', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
              body: JSON.stringify({ referral_code: refCode }),
            });
            sessionStorage.removeItem('p4p_ref');
          } catch { /* non-fatal */ }
        }

        if (branding.slug) {
          try {
            await fetch(API + '/api/creator/associate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
              body: JSON.stringify({ slug: branding.slug }),
            });
          } catch { /* non-fatal */ }
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
    <div className="if-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="if-ambient" />

      <div className="if-content">
        <div className="if-auth-card">

          {branding.logo_url
            ? <img src={branding.logo_url} alt={branding.name} style={{ height: 36, objectFit: 'contain', marginBottom: 28 }} />
            : <div className="if-brand">{branding.name}</div>}

          <h1 className="if-heading">Create your account</h1>
          <p className="if-subheading">Free to start. No card required.</p>

          <form onSubmit={handleSubmit}>
            <div
              className="if-form-group"
              style={{ '--if-field-delay': '0.3s', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}
            >
              <div>
                <label className="if-label">First name</label>
                <input
                  className="if-input"
                  type="text"
                  value={form.firstName}
                  onChange={set('firstName')}
                  placeholder="Cameron"
                  required
                />
              </div>
              <div>
                <label className="if-label">Last name</label>
                <input
                  className="if-input"
                  type="text"
                  value={form.lastName}
                  onChange={set('lastName')}
                  placeholder="Hearne"
                  required
                />
              </div>
            </div>

            <div className="if-form-group" style={{ '--if-field-delay': '0.36s' }}>
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

            <div className="if-form-group" style={{ '--if-field-delay': '0.42s' }}>
              <label className="if-label">Password</label>
              <input
                className="if-input"
                type="password"
                value={form.password}
                onChange={set('password')}
                placeholder="Min. 8 characters"
                minLength={8}
                required
              />
            </div>

            {error && <div className="if-error">{error}</div>}

            <div style={{ opacity: 0, animation: 'if-fadeUp 0.55s cubic-bezier(0.16,1,0.3,1) 0.5s forwards' }}>
              <button type="submit" className="if-btn" disabled={loading}>
                {loading ? 'Creating account…' : 'Create account & start intake →'}
              </button>
            </div>
          </form>

          <div className="if-divider" />

          <p className="if-footer">
            Already have an account?{' '}
            <Link to="/login" className="if-link">Log in</Link>
          </p>

        </div>
      </div>
    </div>
  );
}
