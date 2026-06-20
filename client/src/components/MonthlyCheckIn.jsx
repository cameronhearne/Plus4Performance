import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { submitMonthlyCheckin, getEmailPreferences } from '../lib/api';

// ─── SHARED STYLES ────────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  background: '#1a1a1a',
  border: '1px solid rgba(200,200,200,0.12)',
  color: '#F5F3EE',
  fontFamily: "'Barlow', sans-serif",
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const selectStyle = {
  ...inputStyle,
  appearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%23555' d='M5 7L0 2h10z'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  paddingRight: 36,
  cursor: 'pointer',
};

const labelStyle = {
  display: 'block',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: '#555',
  marginBottom: 8,
};

const redBtnStyle = {
  width: '100%',
  background: '#C0392B',
  border: 'none',
  color: '#fff',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  padding: '16px 0',
  cursor: 'pointer',
};

const ghostBtnStyle = {
  width: '100%',
  background: 'none',
  border: '1px solid rgba(200,200,200,0.18)',
  color: '#787878',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  padding: '14px 0',
  cursor: 'pointer',
};

// ─── MODAL WRAPPER ────────────────────────────────────────────────────────────

function Modal({ onClose, children }) {
  // Close on backdrop click
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.92)',
        zIndex: 400,
        overflowY: 'auto',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 16px 60px',
      }}
    >
      <div style={{
        background: '#111',
        border: '1px solid rgba(200,200,200,0.1)',
        width: '100%',
        maxWidth: 560,
        padding: '32px 28px',
        position: 'relative',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 16,
            background: 'none', border: 'none',
            color: '#444', fontSize: 22, cursor: 'pointer',
            padding: '4px 8px', lineHeight: 1,
          }}
        >×</button>
        {children}
      </div>
    </div>
  );
}

// ─── INPUT MODAL ──────────────────────────────────────────────────────────────

function CheckInInputModal({ weekNum, prefillWeight, onClose, onSuccess }) {
  const [weight, setWeight]           = useState(prefillWeight != null ? String(prefillWeight) : '');
  const [feeling, setFeeling]         = useState('');
  const [energy, setEnergy]           = useState('');
  const [nutrition, setNutrition]     = useState('');
  const [motivationLevel, setMotivationLevel] = useState('');
  const [injuries, setInjuries]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  async function handleSubmit() {
    if (!feeling || !energy || !nutrition || !motivationLevel) {
      setError('Please answer all required questions.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const feedback = await submitMonthlyCheckin({
        weekNumber:          weekNum,
        currentWeight:       weight ? parseFloat(weight) : null,
        feeling,
        energy,
        nutritionCompliance: nutrition,
        motivationLevel,
        injuries:            injuries || null,
      }, session.access_token);

      onSuccess(feedback.feedback, feedback.updatedNutrition || null, feedback.vizData || null);
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      {/* Header */}
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 11, fontWeight: 700,
        letterSpacing: '0.3em', textTransform: 'uppercase',
        color: '#C0392B', marginBottom: 6,
      }}>
        Weekly Check-In
      </div>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 13, color: '#444', letterSpacing: '0.06em', marginBottom: 28,
      }}>
        Week {weekNum} &nbsp;·&nbsp; {dateStr}
      </div>

      {/* Weight */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Current weight (kg)</label>
        <input
          type="number" step="0.1" min="20" max="400"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          placeholder="e.g. 84.5"
          style={inputStyle}
        />
      </div>

      {/* Feeling */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>How are you feeling overall? *</label>
        <select value={feeling} onChange={e => setFeeling(e.target.value)} style={selectStyle}>
          <option value="">Select...</option>
          <option value="Excellent">Excellent</option>
          <option value="Good">Good</option>
          <option value="Okay">Okay</option>
          <option value="Struggling">Struggling</option>
        </select>
      </div>

      {/* Energy */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>How is your energy in sessions? *</label>
        <select value={energy} onChange={e => setEnergy(e.target.value)} style={selectStyle}>
          <option value="">Select...</option>
          <option value="High">High</option>
          <option value="Normal">Normal</option>
          <option value="Low">Low</option>
          <option value="Very Low">Very Low</option>
        </select>
      </div>

      {/* Nutrition */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Are you hitting your nutrition targets? *</label>
        <select value={nutrition} onChange={e => setNutrition(e.target.value)} style={selectStyle}>
          <option value="">Select...</option>
          <option value="Always">Always</option>
          <option value="Most days">Most days</option>
          <option value="Sometimes">Sometimes</option>
          <option value="Rarely">Rarely</option>
        </select>
      </div>

      {/* Motivation */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>How is your motivation right now? *</label>
        <select value={motivationLevel} onChange={e => setMotivationLevel(e.target.value)} style={selectStyle}>
          <option value="">Select...</option>
          <option value="Through the roof">Through the roof</option>
          <option value="Strong">Strong</option>
          <option value="Starting to dip">Starting to dip</option>
          <option value="Really struggling">Really struggling</option>
        </select>
      </div>

      {/* Injuries */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Any injuries or issues?</label>
        <textarea
          value={injuries}
          onChange={e => setInjuries(e.target.value)}
          placeholder="e.g. knee discomfort on squats"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {error && (
        <p style={{
          color: '#ef4444', fontSize: 12,
          fontFamily: "'Barlow Condensed', sans-serif",
          marginBottom: 12, letterSpacing: '0.04em',
        }}>
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{ ...redBtnStyle, opacity: loading ? 0.65 : 1 }}
      >
        {loading ? 'GENERATING FEEDBACK…' : 'GENERATE COACHING FEEDBACK'}
      </button>
    </Modal>
  );
}

// ─── RESULTS MODAL ────────────────────────────────────────────────────────────

function FeedbackBlock({ label, children, accent = false }) {
  return (
    <div style={{
      background: accent ? 'rgba(192,57,43,0.07)' : '#0d0d0d',
      border: `1px solid ${accent ? 'rgba(192,57,43,0.45)' : 'rgba(200,200,200,0.07)'}`,
      padding: '14px 16px',
      marginBottom: 12,
    }}>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 9, fontWeight: 700,
        letterSpacing: '0.26em', textTransform: 'uppercase',
        color: accent ? '#C0392B' : '#444',
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'Barlow', sans-serif",
        fontSize: 14, color: '#CDCDC8', lineHeight: 1.7,
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── VISUAL SUMMARY COMPONENTS ───────────────────────────────────────────────

function VizBlock({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 9, fontWeight: 700,
        letterSpacing: '0.22em', textTransform: 'uppercase',
        color: '#444', marginBottom: 8,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function SessionWeekBars({ weeklyBreakdown, targetPerWeek }) {
  if (!weeklyBreakdown) return null;
  const BAR_H = 52;
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
      {weeklyBreakdown.map((count, i) => {
        const pct  = targetPerWeek > 0 ? Math.min(1, count / targetPerWeek) : 0;
        const fill = Math.max(3, Math.round(pct * BAR_H));
        const hit  = count >= targetPerWeek;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: hit ? '#C0392B' : '#555' }}>
              {count}
            </div>
            <div style={{ width: '100%', height: BAR_H, background: 'rgba(200,200,200,0.06)', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '100%', height: fill, background: hit ? '#C0392B' : 'rgba(200,200,200,0.18)' }} />
            </div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, color: '#383838', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              W{i + 1}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeightSparkline({ weightLogs }) {
  if (!weightLogs || weightLogs.length < 2) {
    return <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#333', letterSpacing: '0.06em' }}>No weight data this period</div>;
  }
  const W = 480, H = 64, PAD = 6;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;
  const weights = weightLogs.map(l => Number(l.weight_kg));
  const times   = weightLogs.map(l => new Date(l.logged_at).getTime());
  const minW = Math.min(...weights), maxW = Math.max(...weights);
  const minT = Math.min(...times),   maxT = Math.max(...times);
  const rangeW = maxW - minW || 1;
  const rangeT = maxT - minT || 1;
  const pts = weights.map((w, i) => [
    PAD + ((times[i] - minT) / rangeT) * innerW,
    PAD + (1 - (w - minW) / rangeW) * innerH,
  ]);
  const polyPts = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block', overflow: 'visible' }}>
        <polyline points={polyPts} fill="none" stroke="#C0392B" strokeWidth="1.5" strokeLinejoin="round" />
        {pts.map(([x, y], i) => <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5" fill="#C0392B" />)}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: '#444' }}>{weights[0]}kg</div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: '#444' }}>{weights[weights.length - 1]}kg</div>
      </div>
    </div>
  );
}

function LiftDeltaCards({ lifts }) {
  if (!lifts) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      {lifts.map(lift => {
        const hasData  = lift.currentKg !== null;
        const hasDelta = lift.deltaKg !== null;
        const isUp     = lift.deltaKg > 1.0;
        const isDown   = lift.deltaKg < -1.0;
        const sign     = lift.deltaKg > 0 ? '+' : '';
        const deltaColor = isUp ? '#4CAF50' : isDown ? '#ef4444' : '#787878';
        return (
          <div key={lift.name} style={{ background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.07)', padding: '10px 12px' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#383838', marginBottom: 6 }}>
              {lift.name}
            </div>
            {!hasData ? (
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#333' }}>No data</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: '0.04em', color: '#F5F3EE', lineHeight: 1 }}>
                  {lift.currentKg}kg
                </div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, color: hasDelta ? deltaColor : '#333' }}>
                  {hasDelta
                    ? `${isUp ? '↑' : isDown ? '↓' : '→'} ${sign}${lift.deltaKg}kg`
                    : 'No comparison yet'}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NutritionBars({ nutrition }) {
  if (!nutrition) {
    return <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#333', letterSpacing: '0.06em' }}>No tracking data this week</div>;
  }
  const { daysLogged, proteinDaysHit, calorieDaysHit } = nutrition;
  function Bar({ label, value, total, color }) {
    if (value === null || !total) return null;
    const pct = Math.min(1, value / total);
    return (
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#444' }}>{label}</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, color: '#444' }}>{value}/{total}</div>
        </div>
        <div style={{ height: 3, background: 'rgba(200,200,200,0.08)' }}>
          <div style={{ height: '100%', width: `${pct * 100}%`, background: color }} />
        </div>
      </div>
    );
  }
  return (
    <div>
      <Bar label="Days logged" value={daysLogged} total={7} color="rgba(200,200,200,0.3)" />
      <Bar label="Protein target" value={proteinDaysHit} total={daysLogged} color="#C0392B" />
      <Bar label="Calorie target" value={calorieDaysHit} total={daysLogged} color="#C0392B" />
    </div>
  );
}

function CheckInResultsModal({ feedback, updatedNutrition, vizData, onClose }) {
  const adj     = feedback.calorie_adjustment;
  const hasAdj  = adj !== null && adj !== undefined && adj !== 0;
  const adjSign = adj > 0 ? '+' : '';
  const applied = updatedNutrition?.training_day != null;

  return (
    <Modal onClose={onClose}>
      {/* ── Data visuals ────────────────────────────────────────── */}
      {vizData && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.3em', textTransform: 'uppercase',
            color: '#555', marginBottom: 16,
          }}>
            This Week
          </div>

          <VizBlock label={`Sessions — ${vizData.sessions?.completed ?? 0} of ${vizData.sessions?.target ?? 0}`}>
            <SessionWeekBars
              weeklyBreakdown={vizData.sessions?.weeklyBreakdown}
              targetPerWeek={vizData.sessions?.targetPerWeek}
            />
          </VizBlock>

          <VizBlock label="Weight Trend (28 days)">
            <WeightSparkline weightLogs={vizData.weightLogs} />
          </VizBlock>

          <VizBlock label="Strength — vs 3 weeks ago">
            <LiftDeltaCards lifts={vizData.lifts} />
          </VizBlock>

          <VizBlock label="Nutrition Adherence (last 7 days)">
            <NutritionBars nutrition={vizData.nutrition} />
          </VizBlock>

          <div style={{ borderTop: '1px solid rgba(200,200,200,0.07)', margin: '18px 0' }} />
        </div>
      )}

      {/* ── AI coaching feedback ─────────────────────────────────── */}
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 11, fontWeight: 700,
        letterSpacing: '0.3em', textTransform: 'uppercase',
        color: '#C0392B', marginBottom: 24,
      }}>
        Your Coaching Feedback
      </div>

      <FeedbackBlock label="Overall Assessment">
        {feedback.overall_assessment}
      </FeedbackBlock>

      <FeedbackBlock label="What You're Doing Well">
        {feedback.doing_well}
      </FeedbackBlock>

      <FeedbackBlock label="Focus for the Next 4 Weeks">
        {feedback.focus_next_4_weeks}
      </FeedbackBlock>

      {hasAdj && (
        <FeedbackBlock
          label={applied ? `Calorie Target Updated: ${adjSign}${adj} kcal/day` : `Suggested Adjustment: ${adjSign}${adj} kcal/day`}
          accent
        >
          {feedback.calorie_adjustment_reason}
          {applied && (
            <div style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: '1px solid rgba(192,57,43,0.25)',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 12,
              letterSpacing: '0.08em',
              color: '#4CAF50',
            }}>
              ✓ Applied — training days: {updatedNutrition.training_day.calories} kcal · rest days: {updatedNutrition.rest_day?.calories} kcal
            </div>
          )}
        </FeedbackBlock>
      )}

      <FeedbackBlock label="From Your Coach">
        {feedback.closing_line}
      </FeedbackBlock>

      <button onClick={onClose} style={{ ...ghostBtnStyle, marginTop: 8 }}>
        Close
      </button>

      <p style={{
        fontFamily: "'Barlow', sans-serif",
        fontSize: 11, color: '#383838',
        lineHeight: 1.5, marginTop: 20, textAlign: 'center',
      }}>
        This feedback is generated by AI based on your logged data. Always consult a professional for medical advice.
      </p>
    </Modal>
  );
}

// ─── HISTORY MODAL ────────────────────────────────────────────────────────────

function CheckInHistoryModal({ history, onClose }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <Modal onClose={onClose}>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 11, fontWeight: 700,
        letterSpacing: '0.3em', textTransform: 'uppercase',
        color: '#C0392B', marginBottom: 20,
      }}>
        Previous Check-Ins
      </div>

      {history.length === 0 ? (
        <p style={{ color: '#444', fontFamily: "'Barlow', sans-serif", fontSize: 14 }}>
          No previous check-ins found.
        </p>
      ) : (
        history.map((item, i) => {
          let fb = {};
          try { fb = typeof item.ai_feedback === 'string' ? JSON.parse(item.ai_feedback) : item.ai_feedback; } catch {}

          const dateStr = new Date(item.created_at).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric',
          });
          const isOpen = expanded === i;

          return (
            <div
              key={item.id}
              style={{
                marginBottom: 10,
                background: '#0d0d0d',
                border: '1px solid rgba(200,200,200,0.07)',
              }}
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : i)}
                style={{
                  width: '100%', background: 'none', border: 'none',
                  padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <div>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 13, fontWeight: 700,
                    color: '#C0392B', letterSpacing: '0.12em', textTransform: 'uppercase',
                  }}>
                    Week {item.week_number}
                  </div>
                  <div style={{
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 12, color: '#444', marginTop: 3,
                  }}>
                    {dateStr}
                    {item.calorie_adjustment
                      ? ` · ${item.calorie_adjustment > 0 ? '+' : ''}${item.calorie_adjustment} kcal adj.`
                      : ''}
                  </div>
                </div>
                <span style={{ color: '#333', fontSize: 20, paddingRight: 4 }}>
                  {isOpen ? '−' : '+'}
                </span>
              </button>

              {isOpen && (
                <div style={{ padding: '0 16px 16px' }}>
                  {fb.overall_assessment && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ ...labelStyle, marginBottom: 6 }}>Assessment</div>
                      <p style={{ margin: 0, fontSize: 13, color: '#CDCDC8', lineHeight: 1.65, fontFamily: "'Barlow', sans-serif" }}>
                        {fb.overall_assessment}
                      </p>
                    </div>
                  )}
                  {fb.focus_next_4_weeks && (
                    <div>
                      <div style={{ ...labelStyle, marginBottom: 6 }}>Focus</div>
                      <p style={{ margin: 0, fontSize: 13, color: '#CDCDC8', lineHeight: 1.65, fontFamily: "'Barlow', sans-serif" }}>
                        {fb.focus_next_4_weeks}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      <button onClick={onClose} style={{ ...ghostBtnStyle, marginTop: 16 }}>
        Close
      </button>
    </Modal>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export default function MonthlyCheckIn({ weekNum, currentWeight }) {
  const [history, setHistory]             = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [showInput, setShowInput]         = useState(false);
  const [showResults, setShowResults]     = useState(false);
  const [showHistory, setShowHistory]     = useState(false);
  const [latestFeedback, setLatestFeedback]               = useState(null);
  const [latestUpdatedNutrition, setLatestUpdatedNutrition] = useState(null);
  const [latestVizData, setLatestVizData]                 = useState(null);
  const [checkinDay, setCheckinDay]       = useState(0); // default Sunday until prefs load

  const todayDow  = new Date().getDay();
  const forceShow = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('checkin');
  const showCheckIn = todayDow === checkinDay || forceShow;

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const checkinDayName = DAY_NAMES[checkinDay];

  useEffect(() => {
    async function loadPrefs() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const prefs = await getEmailPreferences(session.access_token);
        if (prefs.checkinDay != null) setCheckinDay(prefs.checkinDay);
      } catch { /* keep default */ }
    }
    loadPrefs();
  }, []);

  useEffect(() => {
    if (!showCheckIn) return;
    async function loadHistory() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('monthly_checkins')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (!error && data) setHistory(data);
      } catch (e) {
        console.error('[MonthlyCheckIn] history load error:', e);
      } finally {
        setHistoryLoaded(true);
      }
    }
    loadHistory();
  }, [showCheckIn]);

  // Hide on non-check-in days
  if (!showCheckIn) return null;

  // Check if user already completed a check-in this week (last 7 days)
  const sevenDaysAgo    = new Date(Date.now() - 7 * 86400000);
  const thisWeekCheckin = history.find(h => new Date(h.created_at) > sevenDaysAgo);

  async function reloadHistory() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('monthly_checkins')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setHistory(data);
  }

  function handleSuccess(feedback, updatedNutrition, vizData) {
    setLatestFeedback(feedback);
    setLatestUpdatedNutrition(updatedNutrition || null);
    setLatestVizData(vizData || null);
    setShowInput(false);
    setShowResults(true);
    reloadHistory();
  }

  function handleViewFeedback() {
    if (!thisWeekCheckin) return;
    let fb = {};
    try { fb = typeof thisWeekCheckin.ai_feedback === 'string' ? JSON.parse(thisWeekCheckin.ai_feedback) : thisWeekCheckin.ai_feedback; } catch {}
    setLatestFeedback(fb);
    setShowResults(true);
  }

  const completedDateStr = thisWeekCheckin
    ? new Date(thisWeekCheckin.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
    : '';

  return (
    <>
      {/* Check-in card */}
      {thisWeekCheckin ? (
        /* Already completed this week */
        <div style={{
          width: '100%',
          background: '#0d0d0d',
          border: '1px solid rgba(200,200,200,0.1)',
          padding: '18px 20px',
          marginBottom: 10,
          boxSizing: 'border-box',
        }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.22em', textTransform: 'uppercase',
            color: '#4CAF50', marginBottom: 4,
          }}>
            Check-in complete for this week
          </div>
          <div style={{
            fontFamily: "'Barlow', sans-serif",
            fontSize: 12, color: '#444', marginBottom: 10,
          }}>
            Submitted {completedDateStr}
          </div>
          <button
            type="button"
            onClick={handleViewFeedback}
            style={{
              background: 'none', border: 'none', padding: 0,
              color: '#C0392B',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 11, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            View feedback →
          </button>
        </div>
      ) : (
        /* CTA — not yet completed this week */
        <button
          type="button"
          onClick={() => setShowInput(true)}
          style={{
            width: '100%',
            background: '#0d0d0d',
            border: '1px solid #C0392B',
            padding: '18px 20px',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'block',
            marginBottom: 10,
          }}
        >
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 14, fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: '#F5F3EE', marginBottom: 5,
          }}>
            AI COACHING CHECK-IN →
          </div>
          <div style={{
            fontFamily: "'Barlow', sans-serif",
            fontSize: 12, color: '#555', fontWeight: 300,
          }}>
            Get personalised feedback on your progress
          </div>
        </button>
      )}

      {/* Check-in day hint */}
      <p style={{
        fontFamily: "'Barlow', sans-serif",
        fontSize: 11, color: '#3a3a3a',
        fontStyle: 'italic', margin: '0 0 10px',
        lineHeight: 1.5,
      }}>
        Check-in day: {checkinDayName}. Change in Account → Settings.
      </p>

      {/* History link */}
      {historyLoaded && history.length > 0 && (
        <button
          type="button"
          onClick={() => setShowHistory(true)}
          style={{
            background: 'none', border: 'none', padding: 0,
            color: '#444',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11, letterSpacing: '0.1em',
            cursor: 'pointer', display: 'block',
            marginBottom: 20,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#787878'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#444'; }}
        >
          View previous check-ins →
        </button>
      )}

      {showInput && (
        <CheckInInputModal
          weekNum={weekNum}
          prefillWeight={currentWeight}
          onClose={() => setShowInput(false)}
          onSuccess={handleSuccess}
        />
      )}

      {showResults && latestFeedback && (
        <CheckInResultsModal
          feedback={latestFeedback}
          updatedNutrition={latestUpdatedNutrition}
          vizData={latestVizData}
          onClose={() => setShowResults(false)}
        />
      )}

      {showHistory && (
        <CheckInHistoryModal
          history={history}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}
