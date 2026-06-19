import React, { useState } from 'react';
import ShopTab from './ShopTab';

export default function PublicMarketplace() {
  const [showCta, setShowCta] = useState(false);

  function handleCardClick(slug, isLive) {
    if (isLive) {
      window.location.href = `/signup?plan=${slug}`;
      return;
    }
    setShowCta(true);
  }

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <a href="/marketplace" style={S.logo}>PLUS 4 PERFORMANCE</a>
        <div style={S.navRight}>
          <a href="/login" style={S.navLink}>Log in</a>
          <a href="/signup" style={S.navCta}>Get started</a>
        </div>
      </nav>

      <div style={S.inner}>
        <ShopTab onCardClick={handleCardClick} />
      </div>

      {showCta && (
        <div style={S.ctaPanel}>
          <div style={S.ctaContent}>
            <div>
              <div style={S.ctaHeading}>Ready to get started?</div>
              <p style={S.ctaBody}>
                Create a free account to subscribe to creator programmes and track your progress.
              </p>
            </div>
            <div style={S.ctaActions}>
              <a href="/signup" style={S.ctaPrimary}>Sign up free</a>
              <a href="/login" style={S.ctaSecondary}>Log in</a>
              <button onClick={() => setShowCta(false)} style={S.ctaDismiss}>✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#080808',
  },
  nav: {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 40px',
    background: 'rgba(8,8,8,0.95)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(200,200,200,0.1)',
  },
  logo: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 18,
    letterSpacing: '0.16em',
    color: '#C8C8C8',
    textDecoration: 'none',
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
  },
  navLink: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#787878',
    textDecoration: 'none',
  },
  navCta: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#F5F3EE',
    textDecoration: 'none',
    padding: '9px 18px',
    border: '1px solid rgba(200,200,200,0.25)',
    background: 'transparent',
  },
  inner: {
    maxWidth: 860,
    margin: '0 auto',
    padding: '40px 24px 80px',
  },
  ctaPanel: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    background: '#111',
    borderTop: '1px solid rgba(200,200,200,0.15)',
  },
  ctaContent: {
    maxWidth: 860,
    margin: '0 auto',
    padding: '20px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
    flexWrap: 'wrap',
  },
  ctaHeading: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 22,
    letterSpacing: '0.04em',
    color: '#F5F3EE',
    marginBottom: 4,
  },
  ctaBody: {
    fontFamily: "'Barlow', sans-serif",
    fontSize: 13,
    color: '#787878',
    lineHeight: 1.5,
    margin: 0,
  },
  ctaActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  ctaPrimary: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#fff',
    textDecoration: 'none',
    padding: '10px 24px',
    background: '#C0392B',
    border: 'none',
    display: 'inline-block',
  },
  ctaSecondary: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#C8C8C8',
    textDecoration: 'none',
    padding: '10px 20px',
    border: '1px solid rgba(200,200,200,0.2)',
    display: 'inline-block',
  },
  ctaDismiss: {
    background: 'none',
    border: 'none',
    color: '#555',
    cursor: 'pointer',
    fontSize: 16,
    padding: '4px 8px',
    lineHeight: 1,
  },
};
