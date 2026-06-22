import React, { useState } from 'react';
import { FAQ_SECTIONS as SECTIONS } from '../lib/faqData';

export default function FAQ() {
  const [openKeys, setOpenKeys] = useState(new Set());

  function toggle(key) {
    setOpenKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <a href="/marketplace" style={S.logo}>PLUS 4 PERFORMANCE</a>
        <div style={S.navRight}>
          <a href="/faq" style={{ ...S.navLink, color: '#C8C8C8' }}>FAQ</a>
          <a href="/login" style={S.navLink}>Log in</a>
          <a href="/signup" style={S.navCta}>Get started</a>
        </div>
      </nav>

      <div style={S.inner}>
        <div style={S.pageHead}>
          <div style={S.eyebrow}>Support</div>
          <h1 style={S.title}>Frequently Asked Questions</h1>
        </div>

        {SECTIONS.map((section, si) => (
          <div key={si} style={S.section}>
            <h2 style={S.sectionHeading}>{section.heading}</h2>
            <div style={S.itemList}>
              {section.items.map((item, qi) => {
                const key   = `${si}:${qi}`;
                const isOpen = openKeys.has(key);
                return (
                  <div key={qi} style={S.item}>
                    <button
                      type="button"
                      style={S.question}
                      onClick={() => toggle(key)}
                      aria-expanded={isOpen}
                    >
                      <span style={S.questionText}>{item.q}</span>
                      <span style={{ ...S.toggle, color: isOpen ? '#C0392B' : '#555' }}>
                        {isOpen ? '−' : '+'}
                      </span>
                    </button>
                    {isOpen && (
                      <div style={S.answer}>{item.a}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div style={S.footer}>
          <span style={S.footerText}>Still have a question? </span>
          <a href="mailto:hello@plus4performance.com" style={S.footerLink}>hello@plus4performance.com</a>
        </div>
      </div>
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
    maxWidth: 720,
    margin: '0 auto',
    padding: '56px 24px 100px',
  },
  pageHead: {
    marginBottom: 52,
  },
  eyebrow: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.28em',
    textTransform: 'uppercase',
    color: '#C0392B',
    marginBottom: 10,
  },
  title: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 48,
    letterSpacing: '0.04em',
    color: '#F5F3EE',
    margin: 0,
    lineHeight: 1,
  },
  section: {
    marginBottom: 48,
  },
  sectionHeading: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 22,
    letterSpacing: '0.06em',
    color: '#787878',
    margin: '0 0 16px',
    paddingBottom: 10,
    borderBottom: '1px solid rgba(200,200,200,0.08)',
  },
  itemList: {
    display: 'flex',
    flexDirection: 'column',
  },
  item: {
    borderBottom: '1px solid rgba(200,200,200,0.06)',
  },
  question: {
    width: '100%',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '16px 0',
    textAlign: 'left',
  },
  questionText: {
    fontFamily: "'Barlow', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    color: '#CDCDC8',
    lineHeight: 1.5,
    flex: 1,
  },
  toggle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 22,
    fontWeight: 300,
    lineHeight: 1,
    flexShrink: 0,
    marginTop: 1,
  },
  answer: {
    fontFamily: "'Barlow', sans-serif",
    fontSize: 14,
    color: '#787878',
    lineHeight: 1.75,
    paddingBottom: 18,
    paddingRight: 32,
  },
  footer: {
    marginTop: 60,
    paddingTop: 28,
    borderTop: '1px solid rgba(200,200,200,0.08)',
    fontFamily: "'Barlow', sans-serif",
    fontSize: 14,
    color: '#787878',
  },
  footerText: {
    color: '#787878',
  },
  footerLink: {
    color: '#C8C8C8',
    textDecoration: 'none',
  },
};
