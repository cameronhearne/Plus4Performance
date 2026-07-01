import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { coachGetClients } from '../lib/api';

const C = {
  ink:        '#08070A',
  surface:    '#131119',
  surface2:   '#0C0A0F',
  bone:       '#F3F1ED',
  ash:        '#ABA9B0',
  ashDim:     '#7A7880',
  glow:       'rgba(255,79,196,0.5)',
  glowLine:   'rgba(255,79,196,0.25)',
  glowBorder: 'rgba(255,79,196,0.42)',
  green:      '#4A9968',
  greenLine:  'rgba(74,153,104,0.35)',
};

function initials(first, last) {
  return [(first || '')[0], (last || '')[0]].filter(Boolean).join('').toUpperCase() || '?';
}

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export default function CoachPortal() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const data = await coachGetClients(session.access_token);
        setClients(data.clients || []);
      } catch (e) {
        console.error('[CoachPortal]', e);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }

  const pending = clients.filter(c => c.needsReply).length;

  return (
    <div style={{ background: C.ink, minHeight: '100vh', color: C.bone, fontFamily: "'Inter', sans-serif", WebkitFontSmoothing: 'antialiased', backgroundImage: 'radial-gradient(46% 26% at 50% 0%, rgba(255,79,196,0.06), rgba(0,0,0,0) 70%)', padding: '26px 20px 60px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>

        {/* Topbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
          <div>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: '0.14em', fontSize: 16, textTransform: 'uppercase' }}>
              Plus 4 Performance
            </div>
            <div style={{ fontSize: 10, color: C.ashDim, letterSpacing: '0.3em', display: 'block', marginTop: 3 }}>
              Coach Portal
            </div>
          </div>
          <button onClick={handleSignOut} style={{ fontSize: 13, color: C.ash, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Sign out
          </button>
        </div>

        {/* Heading */}
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 32, textTransform: 'uppercase', marginBottom: 4 }}>
          Your Clients
        </h1>
        {loading ? (
          <p style={{ fontSize: 14, color: C.ash, marginBottom: 24 }}>Loading…</p>
        ) : (
          <p style={{ fontSize: 14, color: C.ash, marginBottom: 24 }}>
            {clients.length} active&nbsp;·&nbsp;
            {pending > 0
              ? <strong style={{ color: C.bone }}>{pending} check-in{pending !== 1 ? 's' : ''} waiting for you</strong>
              : <span>all up to date</span>}
          </p>
        )}

        {/* Client list card */}
        {!loading && (
          <div style={{ background: `linear-gradient(160deg,${C.surface},${C.surface2})`, border: `1px solid ${C.glowLine}`, borderRadius: 16, boxShadow: '0 12px 30px -16px rgba(0,0,0,0.55)', overflow: 'hidden' }}>
            {clients.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: C.ashDim, fontSize: 14 }}>
                No clients assigned to you yet.
              </div>
            ) : clients.map((client, i) => {
              const lc = client.latestCheckin;
              const meta = lc
                ? `${lc.period_label} · submitted ${relativeTime(lc.submitted_at)}`
                : 'No check-ins yet';

              return (
                <div key={client.id}
                  onClick={() => navigate(`/coach/client/${client.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderBottom: i < clients.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; }}>

                  {/* Avatar */}
                  <div style={{ width: 44, height: 44, borderRadius: 99, background: 'linear-gradient(160deg,#1B1622,#120E18)', border: `1px solid ${C.glowLine}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                    {initials(client.first_name, client.last_name)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 17, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {[client.first_name, client.last_name].filter(Boolean).join(' ') || client.email}
                    </div>
                    <div style={{ fontSize: 12, color: C.ashDim, marginTop: 3 }}>{meta}</div>
                  </div>

                  {/* Badge */}
                  {client.needsReply ? (
                    <span style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 600, fontSize: 10, padding: '5px 11px', borderRadius: 99, border: `1px solid ${C.glowBorder}`, color: C.bone, boxShadow: `0 0 14px -5px ${C.glow}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      NEEDS REPLY
                    </span>
                  ) : lc ? (
                    <span style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 600, fontSize: 10, padding: '5px 11px', borderRadius: 99, border: `1px solid ${C.greenLine}`, color: C.green, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      UP TO DATE
                    </span>
                  ) : null}

                  <span style={{ color: C.ashDim, fontSize: 15, flexShrink: 0 }}>&#9654;</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
