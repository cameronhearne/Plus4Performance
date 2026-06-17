import React from 'react';

// Swap this component's internals for a live Discord feed (or any provider)
// when Community goes live. Navigation wiring stays untouched.
export default function CommunityTab() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: 420, padding: '60px 24px', textAlign: 'center',
    }}>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700,
        letterSpacing: '0.32em', textTransform: 'uppercase', color: '#C0392B',
        marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ display: 'block', width: 28, height: 1, background: '#C0392B' }} />
        Coming Soon
        <span style={{ display: 'block', width: 28, height: 1, background: '#C0392B' }} />
      </div>

      <div style={{
        fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(44px, 8vw, 72px)',
        letterSpacing: '0.04em', color: '#F5F3EE', lineHeight: 1, marginBottom: 24,
      }}>
        Community
      </div>

      <p style={{
        fontFamily: "'Barlow', sans-serif", fontSize: 15, fontWeight: 300,
        color: '#787878', lineHeight: 1.75, maxWidth: 380,
      }}>
        Connect with other Plus 4 members, share wins, and stay accountable.
        Launching soon.
      </p>
    </div>
  );
}
