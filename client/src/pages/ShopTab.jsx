import React, { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || '';

// Add a creator's slug here once their subdomain is live to restore full card behaviour.
const LIVE_CREATOR_SLUGS = new Set([]);

// ─── SHARED COMING-SOON SECTION ──────────────────────────────────────────────

function ComingSoonSection({ title, children }) {
  return (
    <div style={{ padding: '44px 0 8px', textAlign: 'center' }}>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700,
        letterSpacing: '0.32em', textTransform: 'uppercase', color: '#C0392B',
        marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
      }}>
        <span style={{ display: 'block', width: 28, height: 1, background: '#C0392B' }} />
        Coming Soon
        <span style={{ display: 'block', width: 28, height: 1, background: '#C0392B' }} />
      </div>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(44px, 8vw, 72px)',
        letterSpacing: '0.04em', color: '#F5F3EE', lineHeight: 1, marginBottom: 24,
      }}>
        {title}
      </div>
      <p style={{
        fontFamily: "'Barlow', sans-serif", fontSize: 15, fontWeight: 300,
        color: '#787878', lineHeight: 1.75, maxWidth: 380, margin: '0 auto',
      }}>
        {children}
      </p>
    </div>
  );
}

function SectionDivider() {
  return <div style={{ borderTop: '1px solid rgba(200,200,200,0.08)', margin: '48px 0 0' }} />;
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export default function ShopTab() {
  const [creators, setCreators] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState(false);

  useEffect(() => {
    fetch(`${API}/api/marketplace/creators`)
      .then(r => r.json())
      .then(data => { setCreators(data.creators || []); })
      .catch(() => { setCreators([]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  function handleCardClick(slug) {
    if (LIVE_CREATOR_SLUGS.has(slug)) {
      window.location.href = `https://${slug}.plus4performance.com/signup`;
      return;
    }
    setToast(true);
  }

  return (
    <div>

      {/* ── Section 1: Creator Plans ─────────────────────────────── */}
      <div style={S.eyebrow}>Creator Plans</div>
      <h2 style={S.heading}>Specialist Programmes</h2>
      <p style={S.sub}>
        Coaching programmes from expert creators, all powered by the Plus 4 Performance platform.
      </p>

      {loading ? (
        <p style={S.empty}>Loading…</p>
      ) : creators.length === 0 ? (
        <div style={S.emptyState}>
          <div style={S.emptyHeading}>No creator plans available yet</div>
          <p style={S.emptyBody}>Check back soon — we're onboarding specialist coaches and creators to the platform.</p>
        </div>
      ) : (
        <div style={S.grid}>
          {creators.map(c => {
            const isLive = LIVE_CREATOR_SLUGS.has(c.slug);
            return (
              <div
                key={c.id}
                style={S.card}
                onClick={() => handleCardClick(c.slug)}
                onMouseEnter={e => e.currentTarget.style.borderColor = isLive ? (c.primary_color || '#C0392B') : 'rgba(200,200,200,0.2)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(200,200,200,0.12)'}
              >
                {!isLive && <div style={S.badge}>Coming Soon</div>}
                <div style={{ ...S.cardAccent, background: c.primary_color || '#C0392B', opacity: isLive ? 1 : 0.35 }} />
                <div style={{ ...S.cardInner, opacity: isLive ? 1 : 0.45 }}>
                  {c.logo_url
                    ? <img src={c.logo_url} alt={c.name} style={S.logo} />
                    : <div style={{ ...S.logoPlaceholder, color: c.primary_color || '#C0392B' }}>
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>}
                  <div style={S.cardName}>{c.name}</div>
                  <div style={S.cardCta}>{isLive ? 'View Programme →' : 'Coming Soon'}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div style={S.toast}>
          This creator's programme isn't available yet — check back soon
        </div>
      )}

      {/* ── Section 2: Supplements ───────────────────────────────── */}
      <SectionDivider />
      <ComingSoonSection title="Supplements">
        Trusted supplement recommendations — creatine, pre-workout, and more
        from brands we rate. Coming soon.
      </ComingSoonSection>

      {/* ── Section 3: Clothing ──────────────────────────────────── */}
      <SectionDivider />
      <ComingSoonSection title="Clothing">
        Plus 4 Performance clothing — coming soon.
      </ComingSoonSection>

    </div>
  );
}

const S = {
  eyebrow:      { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#C0392B', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 },
  heading:      { fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(36px,5vw,56px)', letterSpacing: '0.03em', color: '#F5F3EE', marginBottom: 12, lineHeight: 1 },
  sub:          { fontSize: 14, color: '#787878', lineHeight: 1.7, maxWidth: 560, marginBottom: 40 },
  empty:        { color: '#555', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: '0.06em' },
  emptyState:   { background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.1)', padding: '48px 40px', maxWidth: 480 },
  emptyHeading: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#F5F3EE', marginBottom: 12 },
  emptyBody:    { fontSize: 14, color: '#555', lineHeight: 1.7 },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 1, background: 'rgba(200,200,200,0.08)' },
  card:         { background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.12)', textDecoration: 'none', display: 'block', position: 'relative', overflow: 'hidden', transition: 'border-color 0.2s', cursor: 'pointer' },
  badge:        { position: 'absolute', top: 14, right: 14, background: '#C0392B', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', padding: '3px 7px', zIndex: 2 },
  cardAccent:   { height: 3, width: '100%' },
  cardInner:    { padding: '28px 24px 24px' },
  logo:         { height: 44, objectFit: 'contain', marginBottom: 16 },
  logoPlaceholder: { width: 44, height: 44, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, marginBottom: 16 },
  cardName:     { fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: '0.04em', color: '#F5F3EE', marginBottom: 16, lineHeight: 1 },
  cardCta:      { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#787878' },
  toast:        { position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', border: '1px solid rgba(200,200,200,0.15)', color: '#CDCDC8', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: '0.06em', padding: '12px 20px', zIndex: 100, whiteSpace: 'nowrap' },
};
