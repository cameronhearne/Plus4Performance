import React, { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || '';

// Restore full card behaviour by adding a creator's slug here once their subdomain is live.
const LIVE_CREATOR_SLUGS = new Set([]);

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────

const C = {
  surface:    '#131119',
  surface2:   '#0C0A0F',
  bone:       '#F3F1ED',
  ash:        '#ABA9B0',
  ashDim:     '#7A7880',
  pinkGlow:   'rgba(255,79,196,0.5)',
  pinkLine:   'rgba(255,79,196,0.25)',
};

// ─── COMING SOON SECTION ─────────────────────────────────────────────────────

function ComingSoonSection({ title, children }) {
  return (
    <div style={{ padding: '36px 0 8px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      {/* Pink-line-flanked eyebrow */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{ width: 26, height: 1, background: C.pinkLine }} />
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, letterSpacing: '2px', color: C.bone, textTransform: 'uppercase' }}>
          Coming Soon
        </span>
        <div style={{ width: 26, height: 1, background: C.pinkLine }} />
      </div>
      {/* White heading */}
      <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 30, textTransform: 'uppercase', marginBottom: 14, color: C.bone, lineHeight: 1 }}>
        {title}
      </div>
      {/* Grey body text — exact existing copy */}
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14.5, color: C.ash, maxWidth: 440, margin: '0 auto', lineHeight: 1.6 }}>
        {children}
      </p>
    </div>
  );
}

// ─── CREATOR CARD ────────────────────────────────────────────────────────────

const creatorCardBase = {
  background: `linear-gradient(160deg, #131119 0%, #0C0A0F 100%)`,
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 16,
  padding: 24,
  position: 'relative',
  boxShadow: '0 12px 30px -16px rgba(0,0,0,0.55)',
  cursor: 'pointer',
  transition: 'border-color 0.25s',
};

const soonBadgeStyle = {
  position: 'absolute', top: 20, right: 20,
  background: '#0C0A0F',
  border: '1px solid rgba(255,79,196,0.25)',
  borderRadius: 7, padding: '6px 12px',
  fontFamily: "'Oswald', sans-serif", fontSize: 10.5, fontWeight: 700,
  letterSpacing: '1px', textTransform: 'uppercase', color: '#F3F1ED',
  boxShadow: '0 0 14px -4px rgba(255,79,196,0.5)',
};

const creatorAvatarStyle = {
  width: 56, height: 56, borderRadius: 12,
  background: '#0C0A0F', border: '1px solid rgba(255,255,255,0.08)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 16, color: '#7A7880',
  marginBottom: 20,
};

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export default function ShopTab({ onCardClick } = {}) {
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
    if (onCardClick) {
      onCardClick(slug, LIVE_CREATOR_SLUGS.has(slug));
      return;
    }
    if (LIVE_CREATOR_SLUGS.has(slug)) {
      window.location.href = `https://${slug}.plus4performance.com/signup`;
      return;
    }
    setToast(true);
  }

  return (
    <div>
      {/* ── Section 1: Creator Plans ─────────────────────────────── */}
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: C.ashDim, marginBottom: 14 }}>
        Creator Plans
      </div>
      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 'clamp(32px,5vw,38px)', textTransform: 'uppercase', color: C.bone, marginBottom: 12, lineHeight: 1 }}>
        Specialist Programmes
      </h2>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: C.ash, lineHeight: 1.7, maxWidth: 560, marginBottom: 40 }}>
        Coaching programmes from expert creators, all powered by the Plus 4 Performance platform.
      </p>

      {loading ? (
        <p style={{ color: C.ash, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>Loading…</p>
      ) : creators.length === 0 ? (
        /* Placeholder creator card matching prototype */
        <div style={{ ...creatorCardBase, maxWidth: 420, marginBottom: 50 }}>
          <div style={soonBadgeStyle}>Coming Soon</div>
          <div style={creatorAvatarStyle}>SP</div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 20, textTransform: 'uppercase', marginBottom: 6, color: C.bone }}>
            Specialist Creator
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: C.ashDim, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Coming Soon
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 50 }}>
          {creators.map(c => {
            const isLive = LIVE_CREATOR_SLUGS.has(c.slug);
            return (
              <div
                key={c.id}
                style={{ ...creatorCardBase, minWidth: 240, flex: '1 1 240px', maxWidth: 420, opacity: isLive ? 1 : 1 }}
                onClick={() => handleCardClick(c.slug)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = isLive ? C.pinkLine : 'rgba(255,255,255,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
              >
                {!isLive && <div style={soonBadgeStyle}>Coming Soon</div>}

                <div style={{ ...creatorAvatarStyle, opacity: isLive ? 1 : 0.85 }}>
                  {c.logo_url ? (
                    <img src={c.logo_url} alt={c.name} style={{ height: 44, objectFit: 'contain' }} />
                  ) : (
                    c.name.slice(0, 2).toUpperCase()
                  )}
                </div>

                <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 20, textTransform: 'uppercase', marginBottom: 6, color: C.bone, opacity: isLive ? 1 : 0.7 }}>
                  {c.name}
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: C.ashDim, letterSpacing: '0.5px', textTransform: 'uppercase', opacity: isLive ? 1 : 0.7 }}>
                  {isLive ? 'View Programme →' : 'Coming Soon'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: C.surface, border: '1px solid rgba(255,255,255,0.08)',
          color: C.ash, fontFamily: "'Inter', sans-serif", fontSize: 13,
          padding: '12px 20px', zIndex: 100, borderRadius: 10,
          boxShadow: '0 8px 22px -8px rgba(0,0,0,0.7)', whiteSpace: 'nowrap',
        }}>
          This creator's programme isn't available yet — check back soon
        </div>
      )}

      {/* ── Section 2: Supplements ───────────────────────────────── */}
      <ComingSoonSection title="Supplements">
        Trusted supplement recommendations — creatine, pre-workout, and more
        from brands we rate. Coming soon.
      </ComingSoonSection>

      {/* ── Section 3: Clothing ──────────────────────────────────── */}
      <ComingSoonSection title="Clothing">
        Plus 4 Performance clothing — coming soon.
      </ComingSoonSection>
    </div>
  );
}
