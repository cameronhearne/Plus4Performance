import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function SnapshotResult() {
  const navigate = useNavigate();
  const location = useLocation();
  // Primary source: snapshot passed through navigation state from Intake
  const [snapshot, setSnapshot] = useState(location.state?.snapshot || null);
  const [loading, setLoading] = useState(!location.state?.snapshot);

  useEffect(() => {
    // If we already have the snapshot from navigation state, skip the fetch
    if (snapshot) {
      setLoading(false);
      return;
    }

    // Fallback: fetch from Supabase (handles page refresh or direct navigation)
    async function load() {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) { console.error('[SnapshotResult] auth error:', userErr); }
      if (!user) { navigate('/login'); return; }

      const { data, error } = await supabase
        .from('snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) console.error('[SnapshotResult] Supabase select error:', error);
      setSnapshot(data);
      setLoading(false);
    }
    load();
  }, [navigate, snapshot]);

  if (loading) return (
    <div style={styles.page}>
      <div style={styles.spinnerWrap}>
        <div style={styles.spinner} />
        <p style={styles.spinnerLabel}>Loading your snapshot…</p>
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>PLUS 4 PERFORMANCE</div>

        <div style={styles.eyebrow}>Your Snapshot is Ready</div>
        <h1 style={styles.heading}>Here's what we're working with.</h1>

        {snapshot ? (
          <>
            <div style={styles.summaryBlock}>
              <p style={styles.summary}>{snapshot.coach_summary}</p>
            </div>

            <div style={styles.estimateEyebrow}>Estimated targets — based on your intake</div>

            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statVal}>{snapshot.calorie_target}</div>
                <div style={styles.statLabel}>Daily calories</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statVal}>{snapshot.protein_target}g</div>
                <div style={styles.statLabel}>Daily protein</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statVal}>{snapshot.split_recommendation}</div>
                <div style={styles.statLabel}>Recommended split</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statVal}>{snapshot.goal_timeline}</div>
                <div style={styles.statLabel}>Realistic timeline</div>
              </div>
            </div>

            <p style={styles.estimateNote}>
              These are calculated from your intake data. Your full plan locks in your exact targets — built precisely around your numbers.
            </p>

            <div style={styles.divider} />

            <div style={styles.ctaBlock}>
              <p style={styles.ctaText}>
                Your full 12-week programme is ready to generate — training sessions, progressive overload, nutrition targets, and a full meal plan built specifically around your numbers.
              </p>
              <button className="btn-primary" style={styles.ctaBtn} onClick={() => navigate('/dashboard')}>
                Go to your dashboard →
              </button>
              <p style={styles.priceNote}>Unlock your full plan from £9.99/month inside the dashboard.</p>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ color: '#787878', marginBottom: 24 }}>
              No snapshot found. Please complete the intake form first.
            </p>
            <button className="btn-primary" onClick={() => navigate('/intake')}>
              Go to intake form
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '60px 20px 80px',
    background: 'radial-gradient(ellipse at center, #111 0%, #080808 100%)',
  },
  spinnerWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
    marginTop: '40vh',
  },
  spinner: {
    width: 40, height: 40,
    border: '2px solid #222',
    borderTopColor: '#C8C8C8',
    borderRadius: '50%',
    animation: 'spin 0.75s linear infinite',
  },
  spinnerLabel: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13,
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: '#787878',
  },
  card: {
    width: '100%',
    maxWidth: 580,
    background: '#0d0d0d',
    border: '1px solid rgba(200,200,200,0.12)',
    padding: '48px 44px',
  },
  logo: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 16,
    letterSpacing: '0.18em',
    color: '#C8C8C8',
    marginBottom: 36,
  },
  eyebrow: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    color: '#787878',
    marginBottom: 12,
  },
  heading: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 'clamp(32px, 6vw, 52px)',
    letterSpacing: '0.03em',
    color: '#F5F3EE',
    lineHeight: 0.95,
    marginBottom: 32,
  },
  summaryBlock: {
    borderLeft: '2px solid rgba(200,200,200,0.2)',
    paddingLeft: 20,
    marginBottom: 32,
  },
  summary: {
    fontSize: 15,
    color: '#CDCDC8',
    lineHeight: 1.75,
    fontStyle: 'italic',
    fontWeight: 300,
  },
  estimateEyebrow: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.28em',
    textTransform: 'uppercase',
    color: '#555',
    marginBottom: 14,
  },
  estimateNote: {
    fontSize: 13,
    color: '#555',
    fontWeight: 300,
    lineHeight: 1.65,
    margin: '16px 0 0',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 2,
    marginBottom: 36,
    background: 'rgba(200,200,200,0.06)',
  },
  statCard: {
    background: '#0d0d0d',
    padding: '20px 20px',
  },
  statVal: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 28,
    color: '#C8C8C8',
    lineHeight: 1,
    marginBottom: 6,
  },
  statLabel: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: '#787878',
  },
  divider: {
    height: 1,
    background: 'rgba(200,200,200,0.1)',
    marginBottom: 32,
  },
  ctaBlock: { textAlign: 'center' },
  ctaText: {
    fontSize: 14,
    color: '#787878',
    lineHeight: 1.7,
    marginBottom: 24,
    maxWidth: 400,
    margin: '0 auto 24px',
  },
  ctaBtn: {
    width: '100%',
    marginBottom: 14,
  },
  priceNote: {
    fontSize: 12,
    color: '#555',
    letterSpacing: '0.05em',
  },
};
