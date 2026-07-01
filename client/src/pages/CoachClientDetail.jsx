import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { coachGetClientCheckins, coachRespond } from '../lib/api';

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

const card = {
  background: `linear-gradient(160deg,${C.surface},${C.surface2})`,
  border: `1px solid ${C.glowLine}`,
  borderRadius: 16,
  boxShadow: '0 12px 30px -16px rgba(0,0,0,0.55)',
};

const secLabel = {
  fontFamily: "'Oswald', sans-serif",
  fontWeight: 600,
  letterSpacing: '0.2em',
  fontSize: 11,
  textTransform: 'uppercase',
  color: C.ashDim,
  marginBottom: 18,
};

function initials(first, last) {
  return [(first || '')[0], (last || '')[0]].filter(Boolean).join('').toUpperCase() || '?';
}

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (hours < 1)  return 'just now';
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

function fmtSteps(n) {
  if (!n) return '—';
  const v = Number(n);
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function Stat({ value, label }) {
  return (
    <div style={{ background: C.surface2, border: `1px solid ${C.glowLine}`, borderRadius: 11, padding: 14, textAlign: 'center' }}>
      <div style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 600, fontSize: 22, color: C.bone }}>{value || '—'}</div>
      <div style={{ fontFamily: "'Oswald', sans-serif", letterSpacing: '0.14em', fontSize: 9, textTransform: 'uppercase', color: C.ashDim, marginTop: 5 }}>{label}</div>
    </div>
  );
}

// ─── Q&A row ──────────────────────────────────────────────────────────────────

function QA({ q, a }) {
  if (!a) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: '0.08em', fontSize: 11, textTransform: 'uppercase', color: C.ashDim, marginBottom: 5 }}>{q}</div>
      <div style={{ fontSize: 14, lineHeight: 1.55, color: C.bone }}>{a}</div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CoachClientDetail() {
  const { userId } = useParams();
  const navigate   = useNavigate();

  const [loading,    setLoading]    = useState(true);
  const [clientData, setClientData] = useState(null); // { client, checkins, weightLogs, photos }
  const [response,   setResponse]   = useState('');
  const [sending,    setSending]    = useState(false);
  const [sent,       setSent]       = useState(false);
  const [sendError,  setSendError]  = useState('');
  const tokenRef = useRef(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login', { replace: true }); return; }
      tokenRef.current = session.access_token;
      try {
        const data = await coachGetClientCheckins(session.access_token, userId);
        setClientData(data);
        // If the latest check-in already has a response, pre-fill sent state
        if (data.checkins?.[0]?.coach_response) setSent(true);
      } catch (e) {
        console.error('[CoachClientDetail]', e);
      }
      setLoading(false);
    }
    load();
  }, [userId, navigate]);

  async function handleSend() {
    if (!response.trim() || sending) return;
    const latest = clientData?.checkins?.[0];
    if (!latest) return;
    setSending(true);
    setSendError('');
    try {
      await coachRespond(tokenRef.current, latest.id, response.trim());
      setSent(true);
      // Patch local state so history reflects the new response without refetch
      setClientData(prev => ({
        ...prev,
        checkins: prev.checkins.map((c, i) =>
          i === 0 ? { ...c, coach_response: response.trim(), coach_responded_at: new Date().toISOString() } : c
        ),
      }));
    } catch (e) {
      setSendError(e.message || 'Failed to send response.');
    }
    setSending(false);
  }

  if (loading) {
    return (
      <div style={{ background: C.ink, minHeight: '100vh', color: C.ash, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  if (!clientData) {
    return (
      <div style={{ background: C.ink, minHeight: '100vh', color: C.ash, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", fontSize: 14 }}>
        Client not found or not assigned to you.
      </div>
    );
  }

  const { client, checkins, weightLogs, photos } = clientData;
  const latest   = checkins[0] || null;
  const history  = checkins.slice(1);
  const r        = latest?.responses || {};
  const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ') || 'Client';

  // Weight: use from responses if present, else last weight_log
  const weightVal = r.weight || (weightLogs.length ? parseFloat(weightLogs[weightLogs.length - 1].weight_kg).toFixed(1) : null);

  const photoByView = {};
  for (const p of photos) photoByView[p.view] = p;

  return (
    <div style={{ background: C.ink, minHeight: '100vh', color: C.bone, fontFamily: "'Inter', sans-serif", WebkitFontSmoothing: 'antialiased', backgroundImage: 'radial-gradient(46% 26% at 50% 0%, rgba(255,79,196,0.06), rgba(0,0,0,0) 70%)', padding: '26px 20px 60px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>

        {/* Topbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: '0.14em', fontSize: 16, textTransform: 'uppercase' }}>
              Plus 4 Performance
            </div>
            <div style={{ fontSize: 10, color: C.ashDim, letterSpacing: '0.3em', marginTop: 3 }}>Coach Portal</div>
          </div>
        </div>

        {/* Back link */}
        <button onClick={() => navigate('/coach')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: C.ash, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500, marginBottom: 20, fontFamily: "'Inter', sans-serif" }}
          onMouseEnter={e => { e.currentTarget.style.color = C.bone; }}
          onMouseLeave={e => { e.currentTarget.style.color = C.ash; }}>
          &larr; All clients
        </button>

        {/* Detail head */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <div style={{ width: 52, height: 52, borderRadius: 99, background: 'linear-gradient(160deg,#1B1622,#120E18)', border: `1px solid ${C.glowLine}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 19, flexShrink: 0 }}>
            {initials(client.first_name, client.last_name)}
          </div>
          <div>
            <h1 style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 32, textTransform: 'uppercase', margin: 0 }}>
              {clientName}
            </h1>
            {latest && (
              <p style={{ fontSize: 14, color: C.ash, margin: '4px 0 0' }}>
                {latest.period_label} · submitted {relativeTime(latest.submitted_at)}
              </p>
            )}
          </div>
        </div>

        {!latest ? (
          <div style={{ ...card, padding: '32px 24px', marginTop: 20, color: C.ashDim, fontSize: 14 }}>
            No check-ins submitted yet.
          </div>
        ) : (
          <>
            {/* This Week section */}
            <div style={{ ...card, padding: 24, marginTop: 20, marginBottom: 16 }}>
              <div style={secLabel}>This Week</div>

              {/* Stat grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
                <Stat value={weightVal} label="Weight kg" />
                <Stat value={r.trainingScore ? `${r.trainingScore}` : null} label="Training /10" />
                <Stat value={r.sleepScore   ? `${r.sleepScore}`   : null} label="Sleep /10" />
                <Stat value={fmtSteps(r.avgSteps)} label="Avg Steps" />
              </div>

              {/* Q&A */}
              <QA q="On plan this week?" a={
                r.onPlan === true  ? `Yes${r.missedMealsDetail ? ` — ${r.missedMealsDetail}` : ''}` :
                r.onPlan === false ? `No${r.missedMealsDetail  ? ` — ${r.missedMealsDetail}`  : ''}` :
                null
              } />
              <QA q="Off-plan meal"           a={r.offPlanMeal        || null} />
              <QA q="Liquids, water & salt"   a={r.liquidsWaterSalt   || null} />
              <QA q="Biggest win"             a={r.biggestWin         || null} />
              <QA q="Questions for coach"     a={r.questionsForCoach  || null} />
              {r.digestionNote && <QA q="Digestion note" a={r.digestionNote} />}
              {r.alcoholDetail && <QA q="Alcohol"        a={r.alcoholDetail} />}

              {/* Health disclosure — only appears when enhanced template data is present */}
              {(r.lastBloodPressure || r.lastBloodWork || r.compounds) && (
                <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${C.glowLine}` }}>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: '0.12em', fontSize: 11, textTransform: 'uppercase', color: C.ashDim, marginBottom: 14 }}>
                    Health Disclosure
                  </div>
                  <QA q="Blood pressure"    a={r.lastBloodPressure || null} />
                  <QA q="Blood work"        a={r.lastBloodWork     || null} />
                  <QA q="Compounds / cycle" a={r.compounds         || null} />
                  <QA q="Doses & frequency" a={r.doseFrequency     || null} />
                  {r.weeksIntoCycle != null && <QA q="Weeks into cycle" a={String(r.weeksIntoCycle)} />}
                </div>
              )}

              {/* Progress photos */}
              <div style={{ marginBottom: 0 }}>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: '0.08em', fontSize: 11, textTransform: 'uppercase', color: C.ashDim, marginBottom: 5 }}>
                  Progress photos
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  {['front', 'side', 'back'].map(view => {
                    const p = photoByView[view];
                    return (
                      <div key={view} style={{ flex: 1, aspectRatio: '3/4', maxWidth: 120, borderRadius: 9, background: 'linear-gradient(160deg,#1B1622,#120E18)', border: `1px solid ${C.glowLine}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ashDim, fontSize: 10, fontFamily: "'Oswald', sans-serif", letterSpacing: '0.1em', overflow: 'hidden' }}>
                        {p?.signedUrl
                          ? <img src={p.signedUrl} alt={view} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : view.toUpperCase()}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Response card */}
            <div style={{ ...card, border: `1px solid ${C.glowBorder}`, boxShadow: `0 12px 30px -16px rgba(0,0,0,0.55), 0 0 26px -14px ${C.glow}`, padding: 24, marginBottom: 16 }}>
              <div style={secLabel}>Your Response</div>

              {sent ? (
                <div>
                  <div style={{ fontSize: 14, color: C.ash, marginBottom: 12 }}>
                    Response sent {relativeTime(clientData.checkins[0]?.coach_responded_at)}.
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.65, color: C.bone, background: C.surface2, border: `1px solid ${C.glowLine}`, borderRadius: 11, padding: 16 }}>
                    {clientData.checkins[0]?.coach_response}
                  </div>
                </div>
              ) : (
                <>
                  <textarea
                    value={response}
                    onChange={e => setResponse(e.target.value)}
                    placeholder={`Write back to ${client.first_name || clientName} — feedback, adjustments, next week's focus…`}
                    style={{ width: '100%', background: C.surface2, border: `1px solid ${C.glowLine}`, borderRadius: 11, padding: 16, color: C.bone, fontFamily: "'Inter', sans-serif", fontSize: 15, lineHeight: 1.6, minHeight: 130, resize: 'vertical', outline: 'none', transition: 'border-color 0.18s, box-shadow 0.18s', boxSizing: 'border-box' }}
                    onFocus={e => { e.target.style.borderColor = C.glowBorder; e.target.style.boxShadow = 'inset 0 0 0 3px rgba(255,79,196,0.10)'; }}
                    onBlur={e => { e.target.style.borderColor = C.glowLine; e.target.style.boxShadow = 'none'; }}
                  />
                  {/*
                    Audio reply slot:
                    When coach_response_audio_url is ready, add an audio recorder here above the
                    send button. On submit include audio_url alongside coach_response in the PATCH body.
                    The "Voice-note replies coming soon." note below marks this slot.
                  */}
                  <div style={{ fontSize: 12, color: C.ashDim, marginTop: 10, fontStyle: 'italic' }}>
                    Voice-note replies coming soon.
                  </div>
                  {sendError && (
                    <div style={{ fontSize: 13, color: '#e05c5c', marginTop: 8 }}>{sendError}</div>
                  )}
                  <button
                    onClick={handleSend}
                    disabled={!response.trim() || sending}
                    onMouseDown={e => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
                    onMouseUp={e => { e.currentTarget.style.transform = ''; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
                    style={{ marginTop: 16, padding: '16px 30px', border: `1px solid ${C.glowBorder}`, borderRadius: 11, background: 'linear-gradient(160deg,#18151F,#100E15)', color: response.trim() && !sending ? C.bone : C.ashDim, fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', cursor: response.trim() && !sending ? 'pointer' : 'default', boxShadow: `0 10px 26px -10px ${C.glow}`, transition: 'transform 0.1s, filter 0.18s' }}>
                    {sending ? 'Sending…' : 'Send Response →'}
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {/* History */}
        {history.length > 0 && (
          <div style={{ ...card, padding: 24 }}>
            <div style={secLabel}>Previous Check-ins</div>
            {history.map((c, i) => {
              const hr = c.responses || {};
              const summary = [
                hr.trainingScore && `Training ${hr.trainingScore}/10`,
                hr.weight        ? `${hr.weight}kg` : (weightLogs.length && i === history.length - 1 ? null : null),
                hr.biggestWin    && hr.biggestWin.slice(0, 60),
              ].filter(Boolean).join(' · ');

              return (
                <div key={c.id} style={{ padding: '14px 0', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: C.ash }}>
                  <strong style={{ color: C.bone, fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: '0.04em' }}>
                    {c.period_label}
                  </strong>
                  {c.coach_response && (
                    <span style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 10, padding: '2px 7px', borderRadius: 99, border: `1px solid ${C.greenLine}`, color: C.green, marginLeft: 8 }}>
                      Responded
                    </span>
                  )}
                  {summary && <span> — {summary}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 600px) {
          .cp-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
