import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'p4p_cookie_consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      // Small tick so the slide-in animation plays after mount
      const t = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(t);
    }
  }, []);

  function accept(value) {
    localStorage.setItem(STORAGE_KEY, value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={styles.bar}>
      <p style={styles.text}>
        We use cookies to improve your experience. Essential cookies are always active.
        Analytics and marketing cookies are optional.
      </p>
      <div style={styles.actions}>
        <button style={styles.btnEssential} onClick={() => accept('essential')}>
          ESSENTIAL ONLY
        </button>
        <button style={styles.btnAccept} onClick={() => accept('all')}>
          ACCEPT ALL
        </button>
      </div>
    </div>
  );
}

const styles = {
  bar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    background: '#111',
    borderTop: '1px solid #1e1e1e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '24px',
    padding: '16px 32px',
    animation: 'p4pBannerSlideUp 0.3s ease-out both',
    flexWrap: 'wrap',
  },
  text: {
    color: '#fff',
    fontSize: '14px',
    lineHeight: '1.5',
    margin: 0,
    flex: '1 1 280px',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  btnAccept: {
    background: '#C0392B',
    color: '#fff',
    border: 'none',
    padding: '10px 22px',
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.12em',
    cursor: 'pointer',
    minHeight: '44px',
    whiteSpace: 'nowrap',
  },
  btnEssential: {
    background: 'transparent',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.35)',
    padding: '10px 22px',
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.12em',
    cursor: 'pointer',
    minHeight: '44px',
    whiteSpace: 'nowrap',
  },
};

// Inject keyframe once into the document head
if (typeof document !== 'undefined' && !document.getElementById('p4p-banner-style')) {
  const s = document.createElement('style');
  s.id = 'p4p-banner-style';
  s.textContent = `
    @keyframes p4pBannerSlideUp {
      from { transform: translateY(100%); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    @media (max-width: 600px) {
      [data-p4p-banner] { flex-direction: column !important; }
      [data-p4p-banner] > div { width: 100%; }
      [data-p4p-banner] button { width: 100%; justify-content: center; }
    }
  `;
  document.head.appendChild(s);
}
