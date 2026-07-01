import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getMyCoachingCheckins, updateCheckinDay } from '../lib/api';

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
  purple:     '#9B2FE0',
  purpleGlow: 'rgba(155,47,224,0.45)',
  green:      '#4A9968',
  greenLine:  'rgba(74,153,104,0.35)',
};

const card = {
  background: 'linear-gradient(160deg,#131119,#0C0A0F)',
  border: `1px solid ${C.glowLine}`,
  borderRadius: 16,
  padding: 26,
  marginBottom: 18,
  boxShadow: '0 12px 30px -16px rgba(0,0,0,0.55)',
};

const cardLabel = {
  fontFamily: "'Oswald', sans-serif",
  fontWeight: 600,
  letterSpacing: '0.2em',
  fontSize: 11,
  textTransform: 'uppercase',
  color: C.ashDim,
  marginBottom: 16,
};

const btnPrimary = {
  display: 'inline-block',
  marginTop: 20,
  padding: '16px 26px',
  borderRadius: 11,
  background: 'linear-gradient(160deg,#18151F,#100E15)',
  border: `1px solid ${C.glowBorder}`,
  color: C.bone,
  fontFamily: "'Oswald', sans-serif",
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  boxShadow: `0 10px 26px -10px ${C.glow}`,
  transition: 'transform 0.1s, filter 0.18s',
};

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const DAY_IDX = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };

function daysUntil(dayName) {
  const target = DAY_IDX[dayName];
  if (target === undefined) return null;
  return (target - new Date().getDay() + 7) % 7;
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7)  return `${days} days ago`;
  if (days < 14) return '1 week ago';
  return `${Math.floor(days / 7)} weeks ago`;
}

// ─── Weight chart ─────────────────────────────────────────────────────────────

function WeightChart({ logs }) {
  const recent = logs.slice(-6);
  if (recent.length < 2) {
    return (
      <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ashDim, fontSize: 12, fontFamily: "'Inter', sans-serif" }}>
        Log weight to see your trend
      </div>
    );
  }
  const vals = recent.map(l => parseFloat(l.weight_kg));
  const min  = Math.min(...vals);
  const max  = Math.max(...vals);
  const rng  = max - min || 1;
  const W = 300, H = 90, pad = 5;

  const pts = recent.map((l, i) => {
    const x = pad + (i / (recent.length - 1)) * (W - pad * 2);
    const y = H - pad - ((parseFloat(l.weight_kg) - min) / rng) * (H - pad * 2);
    return [x, y];
  });

  const line   = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const fill   = [...pts.map(([x, y]) => `${x},${y}`), `${pts[pts.length-1][0]},${H-pad}`, `${pts[0][0]},${H-pad}`].join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <defs>
        <linearGradient id="ctPurple" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.purple} stopOpacity="0.35" />
          <stop offset="100%" stopColor={C.purple} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={line} fill="none" stroke={C.purple} strokeWidth="2.5"
        style={{ filter: `drop-shadow(0 0 6px ${C.purpleGlow})` }} />
      <polygon points={fill} fill="url(#ctPurple)" />
    </svg>
  );
}

// ─── History item ─────────────────────────────────────────────────────────────

function HistoryItem({ checkin, coachName, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const r = checkin.responses || {};
  const meta = [
    r.trainingScore ? `Training ${r.trainingScore}/10` : null,
    r.energyScore   ? `Energy ${r.energyScore}/10`     : null,
  ].filter(Boolean).join(' · ');

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ padding: '16px 0', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: C.bone, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {checkin.period_label}
              {checkin.coach_response && (
                <span style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 10, padding: '3px 8px', borderRadius: 99, border: `1px solid ${C.greenLine}`, color: C.green }}>
                  Responded
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: C.ashDim, marginTop: 3 }}>
              Submitted {relativeTime(checkin.submitted_at)}{meta ? ` · ${meta}` : ''}
            </div>
          </div>
          <span style={{ color: C.ashDim, fontSize: 13, flexShrink: 0,
            transform: open ? 'rotate(90deg)' : 'none',
            display: 'inline-block', transition: 'transform 0.2s' }}>&#9654;</span>
        </div>
      </div>

      {open && (
        <div style={{ paddingBottom: 16, animation: 'ctFade 0.25s ease' }}>
          <div style={{ background: C.surface2, borderRadius: 10, border: `1px solid ${C.glowLine}`, padding: 16, fontSize: 14, lineHeight: 1.6, color: C.ash }}>
            <span style={{ display: 'block', fontFamily: "'Oswald', sans-serif", letterSpacing: '0.12em', fontSize: 10, textTransform: 'uppercase', color: C.ashDim, marginBottom: 4 }}>
              Your check-in
            </span>
            <div>
              {[
                r.biggestWin          && `Biggest win: ${r.biggestWin}`,
                r.trainingScore       && `Training: ${r.trainingScore}/10`,
                r.sleepScore          && `Sleep: ${r.sleepScore}/10`,
                r.energyScore         && `Energy: ${r.energyScore}/10`,
                r.avgSteps            && `Steps: ${Number(r.avgSteps).toLocaleString()}/day avg`,
                r.questionsForCoach   && `Questions: ${r.questionsForCoach}`,
              ].filter(Boolean).join(' · ') || 'Responses submitted.'}
            </div>

            {checkin.coach_response && (
              <>
                <span style={{ display: 'block', fontFamily: "'Oswald', sans-serif", letterSpacing: '0.12em', fontSize: 10, textTransform: 'uppercase', color: C.ashDim, margin: '12px 0 4px' }}>
                  {coachName}&apos;s response
                </span>
                <span style={{ color: C.bone }}>{checkin.coach_response}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CoachingTab({ userId }) {
  const navigate = useNavigate();

  const [loading,      setLoading]      = useState(true);
  const [checkins,     setCheckins]     = useState([]);
  const [coachName,    setCoachName]    = useState('');
  const [checkinDay,   setCheckinDay]   = useState(null);
  const [weightLogs,   setWeightLogs]   = useState([]);
  const [recentPhotos, setRecentPhotos] = useState([]);
  const [savingDay,    setSavingDay]    = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      const token = session.access_token;

      const [checkinData, { data: logs }, { data: photos }] = await Promise.all([
        getMyCoachingCheckins(token).catch(() => null),
        supabase.from('weight_logs')
          .select('weight_kg, logged_at')
          .eq('user_id', userId)
          .order('logged_at', { ascending: true }),
        supabase.from('progress_photos')
          .select('view, storage_path, taken_at')
          .eq('user_id', userId)
          .in('view', ['front', 'side', 'back'])
          .order('taken_at', { ascending: false })
          .limit(9),
      ]);

      if (cancelled) return;

      if (checkinData) {
        setCheckins(checkinData.checkins || []);
        setCoachName(checkinData.coachName || 'Your Coach');
        setCheckinDay(checkinData.checkinDay || null);
      }

      if (logs) setWeightLogs(logs);

      // For each of front/side/back, take the most recent entry
      if (photos?.length) {
        const byView = {};
        for (const p of photos) {
          if (!byView[p.view]) byView[p.view] = p;
        }
        const toSign = Object.values(byView).filter(p => p.storage_path);
        if (toSign.length) {
          const { data: signed } = await supabase.storage
            .from('progress-photos')
            .createSignedUrls(toSign.map(p => p.storage_path), 3600);
          const urlMap = Object.fromEntries((signed || []).map(s => [s.path, s.signedUrl]));
          if (!cancelled) setRecentPhotos(toSign.map(p => ({ ...p, signedUrl: urlMap[p.storage_path] || null })));
        }
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [userId]);

  async function saveCheckinDay(day) {
    if (savingDay) return;
    setSavingDay(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      try {
        await updateCheckinDay(day, session.access_token);
        setCheckinDay(day);
      } catch (e) {
        console.error('[coaching] checkin-day:', e);
      }
    }
    setSavingDay(false);
  }

  const now = new Date();
  const latestCheckin = checkins[0];
  const submittedThisCycle = latestCheckin &&
    (now - new Date(latestCheckin.submitted_at)) < 7 * 24 * 60 * 60 * 1000;
  const latestResponse = checkins.find(c => c.coach_response);

  const daysAway = checkinDay ? daysUntil(checkinDay) : null;

  // Weight stats
  const last6 = weightLogs.slice(-6);
  const currentWeight = last6.length ? parseFloat(last6[last6.length - 1].weight_kg) : null;
  const oldWeight     = last6.length >= 2 ? parseFloat(last6[0].weight_kg) : null;
  const delta         = currentWeight !== null && oldWeight !== null ? (currentWeight - oldWeight) : null;

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: C.ash, fontFamily: "'Inter', sans-serif", fontSize: 14 }}>
        Loading coaching data…
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes ctFade { from { opacity: 0; } to { opacity: 1; } }
        @media (max-width: 540px) { .ct-glance-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 500, letterSpacing: '0.32em', fontSize: 11, textTransform: 'uppercase', color: C.ashDim }}>
          1-1 Coaching
        </div>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 34, textTransform: 'uppercase', color: C.bone, marginTop: 6, lineHeight: 1 }}>
          Coaching
        </div>
        {coachName && (
          <div style={{ fontSize: 14, color: C.ash, marginTop: 10 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 99, background: C.green, boxShadow: `0 0 8px ${C.green}`, marginRight: 7, verticalAlign: 'middle' }} />
            Coached by <strong style={{ color: C.bone, fontWeight: 600 }}>{coachName}</strong> &middot; Weekly check-ins
          </div>
        )}
      </div>

      {/* ── 1. This Week's Check-in ─────────────────────────────────────── */}
      <div style={{ ...card, borderColor: C.glowBorder, boxShadow: `0 12px 30px -16px rgba(0,0,0,0.55), 0 0 26px -14px ${C.glow}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 22, textTransform: 'uppercase', color: C.bone }}>
              This Week&apos;s Check-in
            </div>
            <div style={{ fontSize: 14, color: C.ash, marginTop: 6, lineHeight: 1.5 }}>
              {checkinDay
                ? `Due ${checkinDay.charAt(0).toUpperCase() + checkinDay.slice(1)}. Takes about 5 minutes — the more honest, the better your coaching.`
                : 'Set your check-in day below so we can track your weekly rhythm.'}
            </div>
          </div>

          {/* Status pill */}
          {submittedThisCycle ? (
            <span style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 600, fontSize: 11, padding: '6px 12px', borderRadius: 99, border: `1px solid ${C.greenLine}`, color: C.green, whiteSpace: 'nowrap', flexShrink: 0 }}>
              SUBMITTED
            </span>
          ) : daysAway !== null ? (
            <span style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 600, fontSize: 11, padding: '6px 12px', borderRadius: 99, border: `1px solid ${C.glowBorder}`, color: C.bone, boxShadow: `0 0 14px -6px ${C.glow}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {daysAway === 0 ? 'DUE TODAY' : `DUE IN ${daysAway} DAY${daysAway !== 1 ? 'S' : ''}`}
            </span>
          ) : null}
        </div>

        {/* CTA or submitted state */}
        {submittedThisCycle ? (
          <div style={{ marginTop: 16, fontSize: 14, color: C.ash, lineHeight: 1.6 }}>
            Submitted {relativeTime(latestCheckin.submitted_at)}.&nbsp;
            {latestCheckin.coach_response
              ? <span style={{ color: C.green }}>Response received ✓</span>
              : <><strong style={{ color: C.bone }}>{coachName}</strong> will respond within 24 hours.</>}
          </div>
        ) : (
          <button
            onClick={() => navigate('/coaching/checkin')}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = ''; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
            style={btnPrimary}>
            Start Check-in &rarr;
          </button>
        )}

        {/* Check-in day picker */}
        <div style={{ marginTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 18 }}>
          <div style={{ ...cardLabel, marginBottom: 10 }}>My Check-in Day</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {DAYS.map(day => {
              const active = checkinDay === day;
              return (
                <button key={day} onClick={() => saveCheckinDay(day)}
                  disabled={savingDay}
                  style={{
                    padding: '7px 13px', borderRadius: 8,
                    cursor: savingDay ? 'default' : 'pointer',
                    fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600,
                    background: active ? 'linear-gradient(160deg,#18151F,#100E15)' : C.surface2,
                    border: `1px solid ${active ? C.glowBorder : C.glowLine}`,
                    color: active ? C.bone : C.ashDim,
                    boxShadow: active ? `0 0 14px -4px ${C.glow}` : 'none',
                    transition: 'all 0.15s',
                  }}>
                  {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 2. Latest Response From Your Coach ─────────────────────────── */}
      <div style={card}>
        <div style={cardLabel}>Latest Response From Your Coach</div>
        {latestResponse ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 99, background: 'linear-gradient(160deg,#1B1622,#120E18)', border: `1px solid ${C.glowBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Oswald', sans-serif", fontWeight: 700, color: C.bone, fontSize: 15, boxShadow: `0 0 14px -6px ${C.glow}`, flexShrink: 0 }}>
                {initials(coachName)}
              </div>
              <div>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.bone }}>
                  {coachName}
                </div>
                <div style={{ fontSize: 12, color: C.ashDim, marginTop: 2 }}>
                  Responded to your {latestResponse.period_label} &middot; {relativeTime(latestResponse.coach_responded_at)}
                </div>
              </div>
            </div>

            {/*
              Structured for future audio:
              When coach_response_audio_url is added to coaching_checkins,
              render an <audio controls src={latestResponse.coach_response_audio_url} />
              here before the text, without restructuring this block.
            */}
            <div style={{ fontSize: 15, lineHeight: 1.65, color: C.bone }}>
              {latestResponse.coach_response.split('\n\n').map((para, i, arr) => (
                <p key={i} style={{ marginBottom: i < arr.length - 1 ? 12 : 0 }}>{para}</p>
              ))}
            </div>
          </>
        ) : (
          <p style={{ fontSize: 14, color: C.ashDim, lineHeight: 1.6, margin: 0 }}>
            No responses yet. Once your coach responds to a check-in, their message will appear here.
          </p>
        )}
      </div>

      {/* ── 3. At A Glance ─────────────────────────────────────────────── */}
      <div style={card}>
        <div style={cardLabel}>At A Glance</div>
        <div className="ct-glance-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>

          {/* Weight trend */}
          <div style={{ background: C.surface2, border: `1px solid ${C.glowLine}`, borderRadius: 12, padding: 18 }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: '0.16em', fontSize: 10, textTransform: 'uppercase', color: C.ashDim, marginBottom: 10 }}>
              Weight — Last 6 Weeks
            </div>
            <WeightChart logs={weightLogs} />
            {currentWeight !== null && (
              <div style={{ marginTop: 12 }}>
                <span style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 600, fontSize: 26, color: C.bone }}>
                  {currentWeight}<span style={{ fontSize: 14, color: C.ashDim }}>kg</span>
                </span>
                {delta !== null && (
                  <span style={{ fontSize: 12, fontFamily: "'Roboto Mono', monospace", marginLeft: 8, color: C.green }}>
                    {delta >= 0 ? '+' : ''}{delta.toFixed(1)} kg
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Progress photos */}
          <div style={{ background: C.surface2, border: `1px solid ${C.glowLine}`, borderRadius: 12, padding: 18 }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: '0.16em', fontSize: 10, textTransform: 'uppercase', color: C.ashDim, marginBottom: 10 }}>
              Latest Photos
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['front', 'side', 'back'].map(view => {
                const photo = recentPhotos.find(p => p.view === view);
                return (
                  <div key={view} style={{ flex: 1, aspectRatio: '3/4', borderRadius: 8, background: 'linear-gradient(160deg,#1B1622,#120E18)', border: `1px solid ${C.glowLine}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ashDim, fontSize: 10, fontFamily: "'Oswald', sans-serif", letterSpacing: '0.1em' }}>
                    {photo?.signedUrl
                      ? <img src={photo.signedUrl} alt={view} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : view.toUpperCase()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Check-in History ─────────────────────────────────────────── */}
      {checkins.length > 0 && (
        <div style={card}>
          <div style={{ ...cardLabel, marginBottom: 0 }}>Check-in History</div>
          {checkins.map((c, i) => (
            <HistoryItem key={c.id} checkin={c} coachName={coachName} defaultOpen={i === 0} />
          ))}
        </div>
      )}
    </>
  );
}
