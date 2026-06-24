import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './SnapshotResult.css';

function useCountUp(target, { delay = 0, duration = 1000 } = {}) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target == null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let timerId;
    timerId = setTimeout(() => {
      const start = performance.now();
      function tick(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(Math.round(eased * target));
        if (p < 1) rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timerId);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, delay, duration]);

  return value;
}

function applyTilt(e, card) {
  const touch = e.touches ? e.touches[0] : null;
  const clientX = touch ? touch.clientX : e.clientX;
  const clientY = touch ? touch.clientY : e.clientY;
  const rect = card.getBoundingClientRect();
  const px = (clientX - rect.left) / rect.width;
  const py = (clientY - rect.top) / rect.height;
  const tiltY = (px - 0.5) * 14;
  const tiltX = (0.5 - py) * 14;
  card.style.setProperty('--tilt', `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`);
  card.classList.add('lift');
}

function releaseTilt(card) {
  card.classList.remove('lift');
  card.style.setProperty('--tilt', 'rotateX(0deg) rotateY(0deg)');
}

const tiltHandlers = {
  onMouseMove:   (e) => applyTilt(e, e.currentTarget),
  onMouseLeave:  (e) => releaseTilt(e.currentTarget),
  onTouchStart:  (e) => applyTilt(e, e.currentTarget),
  onTouchMove:   (e) => applyTilt(e, e.currentTarget),
  onTouchEnd:    (e) => releaseTilt(e.currentTarget),
};

export default function SnapshotResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const [snapshot, setSnapshot] = useState(location.state?.snapshot || null);
  const [loading, setLoading] = useState(!location.state?.snapshot);
  const [progressWidth, setProgressWidth] = useState('0%');

  useEffect(() => {
    if (snapshot) { setLoading(false); return; }
    async function load() {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) console.error('[SnapshotResult] auth error:', userErr);
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

  useEffect(() => {
    const t = setTimeout(() => setProgressWidth('100%'), 100);
    return () => clearTimeout(t);
  }, []);

  const calories = useCountUp(snapshot?.calorie_target, { delay: 900, duration: 1000 });
  const protein  = useCountUp(snapshot?.protein_target,  { delay: 960, duration: 1000 });

  if (loading) return (
    <div className="sr-page">
      <div className="sr-ambient" />
      <div className="sr-content">
        <div className="sr-spinner-wrap">
          <div className="sr-spinner" />
          <p className="sr-spinner-label">Loading your snapshot…</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="sr-page">
      <div className="sr-ambient" />
      <div className="sr-content">

        <div className="sr-brand">Plus 4 Performance</div>

        <div className="sr-progress-row">
          <span className="sr-progress-label">Progress</span>
          <span className="sr-progress-label">Step 5 of 5</span>
        </div>
        <div className="sr-progress-track">
          <div className="sr-progress-fill" style={{ width: progressWidth }} />
        </div>

        <div className="sr-eyebrow">Your snapshot is ready</div>
        <h1 className="sr-heading">Here's what<br />we're working with.</h1>

        {snapshot ? (
          <>
            <div className="sr-note">
              <div className="sr-note-label">Coach's note</div>
              <div className="sr-note-body">{snapshot.coach_summary}</div>
            </div>

            <div className="sr-section-label">Estimated targets — based on your intake</div>

            <div className="sr-grid">
              <div className="sr-card" {...tiltHandlers}>
                <div className="sr-stat-num">{calories}</div>
                <div className="sr-card-meta">Daily calories</div>
              </div>
              <div className="sr-card" {...tiltHandlers}>
                <div className="sr-stat-num">{protein}g</div>
                <div className="sr-card-meta">Daily protein</div>
              </div>
              <div className="sr-card" {...tiltHandlers}>
                <div className="sr-card-text">{snapshot.split_recommendation}</div>
                <div className="sr-card-meta">Recommended split</div>
              </div>
              <div className="sr-card" {...tiltHandlers}>
                <div className="sr-card-text">{snapshot.goal_timeline}</div>
                <div className="sr-card-meta">Realistic timeline</div>
              </div>
            </div>

            <button className="sr-cta" onClick={() => navigate('/dashboard')}>
              Go to your dashboard →
            </button>

            <div className="sr-footer">
              Unlock your full plan from <strong>£9.99/month</strong> inside the dashboard.
            </div>
          </>
        ) : (
          <div className="sr-no-snapshot">
            <p>No snapshot found. Please complete the intake form first.</p>
            <button className="sr-cta" style={{ opacity: 1, animation: 'none' }} onClick={() => navigate('/intake')}>
              Go to intake form
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
