import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { createCheckoutSession, getExerciseSubstitutions, swapExercise } from '../lib/api';
import AchievementsTab from './AchievementsTab';
import ProgressTab from './ProgressTab';
import TodayTab from './TodayTab';
import Logbook from './Logbook';
import AccountTab from './AccountTab';
import NutritionTab from './NutritionTab';
import CommunityTab from './CommunityTab';
import ShopTab from './ShopTab';
import { useBranding } from '../lib/BrandingContext';
import { getWeekNum } from '../lib/schedule';

const TABS = [
  { id: 'today',        label: 'Today' },
  { id: 'plan',         label: 'Plan' },
  { id: 'nutrition',    label: 'Nutrition' },
  { id: 'progress',     label: 'Progress' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'logbook',      label: 'Logbook' },
  { id: 'community',    label: 'Community' },
  { id: 'shop',         label: 'Shop',         mainSiteOnly: true },
  { id: 'account',      label: 'Account' },
];

// ─── LOCKED OVERLAY ──────────────────────────────────────────────────────────

function LockedOverlay({ onUnlock }) {
  return (
    <div style={styles.lockedOverlay}>
      <div style={styles.lockIcon}>🔒</div>
      <h3 style={styles.lockTitle}>Unlock your full plan</h3>
      <p style={styles.lockDesc}>Get your complete 12-week training programme, nutrition targets, meal plan, and coaching guide.</p>
      <div style={styles.lockPrice}>£9.99<span style={styles.lockPer}>/month</span></div>
      <button className="btn-primary" onClick={onUnlock} style={{ minWidth: 220 }}>
        Unlock now
      </button>
    </div>
  );
}

function BlurredCard({ children, onUnlock }) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none' }}>
        {children}
      </div>
      <div style={styles.blurCTA}>
        <button className="btn-primary" onClick={onUnlock} style={{ fontSize: 12, padding: '10px 20px' }}>
          Unlock — £9.99/month
        </button>
      </div>
    </div>
  );
}

// ─── TAB CONTENT ─────────────────────────────────────────────────────────────


function TabPlan({ plan, isUnlocked, onUnlock }) {
  const [selectedPhase, setSelectedPhase] = useState(0);
  const [startDate,     setStartDate]     = useState(null);
  const [lockedMsg,     setLockedMsg]     = useState('');
  const [overrides,     setOverrides]     = useState(plan?.exercise_overrides || {});

  useEffect(() => { setOverrides(plan?.exercise_overrides || {}); }, [plan]);

  useEffect(() => {
    if (!isUnlocked) return;
    async function loadStartDate() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('intake_submissions')
        .select('data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.data?.startDate) setStartDate(data.data.startDate);
    }
    loadStartDate();
  }, [isUnlocked]);

  function handleSwap(phaseIdx, sessionIdx, exId, newName) {
    const key      = `${phaseIdx}:${sessionIdx}:${exId}`;
    const origName = plan?.exercise_library?.[exId]?.name;
    setOverrides(prev => {
      if (newName === origName || newName === null) {
        const { [key]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: newName };
    });
  }

  if (!isUnlocked) return (
    <div>
      <LockedOverlay onUnlock={onUnlock} />
      <BlurredCard onUnlock={onUnlock}>
        <div style={styles.mockCard}>
          <div style={styles.mockTitle}>Phase 1 — Foundation (Weeks 1–4)</div>
          {['Upper A', 'Lower A', 'Upper B', 'Lower B'].map(s => (
            <div key={s} style={styles.mockRow}><span>{s}</span><span>6 exercises</span></div>
          ))}
        </div>
      </BlurredCard>
    </div>
  );

  const phases  = plan?.phases || [];
  const library = plan?.exercise_library || {};
  const phase   = phases[selectedPhase];
  const weekNum = getWeekNum(startDate);

  // Phase i unlocks at week (i * 4 + 1): Phase 1→wk 1, Phase 2→wk 5, Phase 3→wk 9
  const unlockAt      = (i) => i * 4 + 1;
  const isUnlockedAt  = (i) => weekNum >= unlockAt(i);

  function handlePhaseClick(i) {
    if (!isUnlockedAt(i)) {
      setLockedMsg(`Phase ${i + 1} unlocks at week ${unlockAt(i)}`);
      setTimeout(() => setLockedMsg(''), 3000);
      return;
    }
    setLockedMsg('');
    setSelectedPhase(i);
  }

  return (
    <div>
      <div style={styles.weekNav}>
        {phases.map((p, i) => {
          const unlocked = isUnlockedAt(i);
          const active   = unlocked && selectedPhase === i;
          return (
            <button key={i} type="button"
              style={active ? styles.weekBtnActive : unlocked ? styles.weekBtn : styles.weekBtnLocked}
              onClick={() => handlePhaseClick(i)}>
              Phase {p.phase}
              {!unlocked && <span style={styles.lockLabel}> · Wk {unlockAt(i)}</span>}
            </button>
          );
        })}
      </div>
      {lockedMsg && <div style={styles.lockedMsg}>{lockedMsg}</div>}
      {phase && isUnlockedAt(selectedPhase) && (
        <div>
          <div style={styles.phaseTag}>{phase.label} — Weeks {phase.weeks}</div>
          {(phase.sessions || []).map((s, i) => (
            <SessionCard key={i} session={s} library={library} defaultOpen={i === 0}
              phaseIndex={selectedPhase} sessionIndex={i}
              overrides={overrides} onSwap={handleSwap} />
          ))}
        </div>
      )}
    </div>
  );
}

// TabNutrition replaced by NutritionTab (imported above) which adds food logging



// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function SessionCard({ session, library = {}, defaultOpen = false, phaseIndex, sessionIndex, overrides = {}, onSwap }) {
  const [open,       setOpen]       = useState(defaultOpen);
  const [expandedEx, setExpandedEx] = useState(null);
  const [swappingEx, setSwappingEx] = useState(null);
  const [altLoading, setAltLoading] = useState(false);
  const [altList,    setAltList]    = useState([]);

  function findLibraryByName(name) {
    const lc = name.toLowerCase();
    return Object.values(library).find(e => e.name && e.name.toLowerCase() === lc) || null;
  }

  async function handleSwapClick(i, originalName) {
    if (swappingEx === i) { setSwappingEx(null); return; }
    setSwappingEx(i);
    setAltLoading(true);
    setAltList([]);
    try {
      const { data: { session: authSess } } = await supabase.auth.getSession();
      const { substitutions } = await getExerciseSubstitutions(originalName, authSess.access_token);
      setAltList(substitutions || []);
    } catch {
      setAltList([]);
    } finally {
      setAltLoading(false);
    }
  }

  async function handleSelectSwap(exId, newName, originalName) {
    try {
      const { data: { session: authSess } } = await supabase.auth.getSession();
      await swapExercise(phaseIndex, sessionIndex, exId, newName, authSess.access_token);
      onSwap?.(phaseIndex, sessionIndex, exId, newName === originalName ? null : newName);
      setSwappingEx(null);
    } catch (e) {
      console.error('[swap]', e);
    }
  }

  return (
    <div style={styles.sessionCard}>
      <button type="button" style={styles.sessionHeader} onClick={() => setOpen(o => !o)}>
        <span style={styles.sessionName}>{session.name}</span>
        <span style={{ color: '#787878', fontSize: 20 }}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 20px 20px' }}>
          <table style={styles.exTable}>
            <thead>
              <tr>
                {['Exercise', 'Sets', 'Reps', 'Rest'].map(h => (
                  <th key={h} style={{ ...styles.th, textAlign: h === 'Exercise' ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(session.exercises || []).map((ex, i) => {
                const overrideKey  = `${phaseIndex}:${sessionIndex}:${ex.ex}`;
                const overrideName = overrides[overrideKey];
                const isOverridden = !!overrideName;
                const originalInfo = library[ex.ex] || {};
                const originalName = originalInfo.name || ex.ex;
                const displayName  = overrideName || originalName;
                const displayInfo  = overrideName ? (findLibraryByName(overrideName) || {}) : originalInfo;
                const isCuesOpen   = expandedEx === i;
                const isSwapOpen   = swappingEx === i;

                return (
                  <React.Fragment key={i}>
                    <tr
                      style={{ background: i % 2 === 0 ? '#111' : '#0d0d0d', cursor: displayInfo.cues ? 'pointer' : 'default' }}
                      onClick={() => displayInfo.cues && setExpandedEx(isCuesOpen ? null : i)}
                    >
                      <td style={styles.td}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <span style={{ flex: 1 }}>
                            {displayName}
                            {displayInfo.cues && (
                              <span style={{ color: '#555', fontSize: 11, marginLeft: 6 }}>{isCuesOpen ? '▲' : '▼'}</span>
                            )}
                            {isOverridden && (
                              <span style={{ color: '#C0392B', fontSize: 9, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginLeft: 8 }}>swapped</span>
                            )}
                          </span>
                          <button
                            type="button"
                            title="Swap exercise"
                            onClick={e => { e.stopPropagation(); handleSwapClick(i, originalName); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 14, lineHeight: 1, color: isSwapOpen ? '#C0392B' : '#3a3a3a', flexShrink: 0 }}
                          >
                            ⇄
                          </button>
                        </div>
                      </td>
                      <td style={styles.tdCenter}>{ex.sets}</td>
                      <td style={styles.tdCenter}>{ex.reps}</td>
                      <td style={styles.tdCenter}>{ex.rest}</td>
                    </tr>

                    {isCuesOpen && displayInfo.cues && (
                      <tr style={{ background: '#0a0a0a' }}>
                        <td colSpan={4} style={{ padding: '10px 0 14px', fontSize: 12, color: '#CDCDC8', lineHeight: 1.6 }}>
                          <div style={{ marginBottom: 4 }}><span style={{ color: '#787878', fontWeight: 700 }}>Cue: </span>{displayInfo.cues}</div>
                          {displayInfo.common_mistakes && <div style={{ marginBottom: 4 }}><span style={{ color: '#787878', fontWeight: 700 }}>Avoid: </span>{displayInfo.common_mistakes}</div>}
                          {displayInfo.injury_modifications && <div><span style={{ color: '#787878', fontWeight: 700 }}>Modification: </span>{displayInfo.injury_modifications}</div>}
                        </td>
                      </tr>
                    )}

                    {isSwapOpen && (
                      <tr style={{ background: '#0a0a0a' }}>
                        <td colSpan={4} style={{ padding: '12px 0 16px' }}>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#555', marginBottom: 10 }}>
                            Swap with
                          </div>
                          {altLoading ? (
                            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#444', letterSpacing: '0.06em' }}>
                              Loading alternatives…
                            </div>
                          ) : altList.length === 0 ? (
                            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#444', letterSpacing: '0.06em' }}>
                              No alternatives available for this exercise.
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {altList.map(alt => {
                                const isActive = overrideName === alt || (!isOverridden && alt === originalName);
                                return (
                                  <button
                                    key={alt}
                                    type="button"
                                    onClick={() => handleSelectSwap(ex.ex, alt, originalName)}
                                    style={{
                                      background: isActive ? 'rgba(192,57,43,0.12)' : 'none',
                                      border: isActive ? '1px solid rgba(192,57,43,0.4)' : '1px solid transparent',
                                      color: isActive ? '#C0392B' : '#CDCDC8',
                                      fontFamily: "'Barlow Condensed', sans-serif",
                                      fontSize: 13,
                                      letterSpacing: '0.04em',
                                      textAlign: 'left',
                                      padding: '7px 10px',
                                      cursor: 'pointer',
                                      width: '100%',
                                    }}
                                  >
                                    {alt}
                                    {isActive && <span style={{ float: 'right', fontSize: 11 }}>✓</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {isOverridden && (
                            <div style={{ marginTop: 10, borderTop: '1px solid #1a1a1a', paddingTop: 10 }}>
                              <button
                                type="button"
                                onClick={() => handleSelectSwap(ex.ex, originalName, originalName)}
                                style={{ background: 'none', border: 'none', color: '#555', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.06em', cursor: 'pointer', padding: 0 }}
                              >
                                ↺ Restore original — {originalName}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NutritionCard({ nutrition }) {
  const td = nutrition?.training_day;
  if (!td) return null;
  return (
    <div style={styles.infoCard}>
      {[['Calories', td.calories + ' kcal'], ['Protein', td.protein + 'g'], ['Carbs', td.carbs + 'g'], ['Fat', td.fat + 'g']].map(([k, v]) => (
        <div key={k} style={styles.mockRow}><span style={{ color: '#787878' }}>{k}</span><span style={{ color: '#F5F3EE', fontWeight: 600 }}>{v}</span></div>
      ))}
    </div>
  );
}

function MacroCard({ title, data, accent }) {
  return (
    <div style={{ ...styles.infoCard, borderTop: `2px solid ${accent}` }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent, marginBottom: 12 }}>{title}</div>
      {[['Calories', data?.calories + ' kcal'], ['Protein', data?.protein + 'g'], ['Carbs', data?.carbs + 'g'], ['Fat', data?.fat + 'g']].map(([k, v]) => (
        <div key={k} style={styles.mockRow}><span style={{ color: '#787878', fontSize: 13 }}>{k}</span><span style={{ color: '#F5F3EE', fontWeight: 600 }}>{v}</span></div>
      ))}
    </div>
  );
}

function MealTemplateCard({ label, meals }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ ...styles.sessionCard, marginBottom: 8 }}>
      <button type="button" style={styles.sessionHeader} onClick={() => setOpen(o => !o)}>
        <span style={styles.sessionName}>{label}</span>
        <span style={{ color: '#787878', fontSize: 20 }}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 20px 20px' }}>
          {(meals || []).map((meal, i) => {
            const foods = meal.foods || meal.items || [];
            return (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, color: '#C8C8C8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                  {meal.name || meal.title || `Meal ${i + 1}`}
                </div>
                {foods.length > 0 ? foods.map((food, j) => (
                  typeof food === 'string' ? (
                    <div key={j} style={{ fontSize: 13, color: '#CDCDC8', padding: '4px 0', borderBottom: '1px solid #1a1a1a' }}>{food}</div>
                  ) : (
                    <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#CDCDC8', padding: '4px 0', borderBottom: '1px solid #1a1a1a' }}>
                      <span>{food.name}</span>
                      <span style={{ color: '#787878' }}>
                        {[food.amount, food.cal != null ? `${food.cal} kcal` : null].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  )
                )) : (
                  <div style={{ fontSize: 12, color: '#444', padding: '4px 0' }}>No items listed.</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GroceryList({ list }) {
  const KNOWN = [
    { key: 'proteins',    label: 'Proteins' },
    { key: 'carbs',       label: 'Carbs' },
    { key: 'veg',         label: 'Vegetables & Fruit' },
    { key: 'fats',        label: 'Fats' },
    { key: 'supplements', label: 'Supplements' },
  ];
  const knownKeys = new Set(KNOWN.map(s => s.key));
  const extraKeys = Object.keys(list || {})
    .filter(k => !knownKeys.has(k) && Array.isArray(list[k]) && list[k].length > 0)
    .map(k => ({ key: k, label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }));
  const sections = [...KNOWN, ...extraKeys];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {sections.map(({ key, label }) => (list[key]?.length ? (
        <div key={key} style={styles.infoCard}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#787878', marginBottom: 10 }}>{label}</div>
          {list[key].map((item, i) => (
            <div key={i} style={{ fontSize: 13, color: '#CDCDC8', padding: '3px 0', borderBottom: '1px solid #1a1a1a' }}>{item}</div>
          ))}
        </div>
      ) : null))}
    </div>
  );
}

// ─── PLAN GENERATING OVERLAY ─────────────────────────────────────────────────

const GEN_STEPS = [
  'Calculating your nutrition targets…',
  'Structuring your 12-week phases…',
  'Programming your progressive overload…',
  'Selecting exercises for your split…',
  'Finalising your meal plan…',
  'Almost there…',
];

function PlanGeneratingOverlay({ error, onRetry }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (error) return;
    const t = setInterval(() => setStep(s => (s + 1) % GEN_STEPS.length), 4000);
    return () => clearInterval(t);
  }, [error]);

  return (
    <div style={styles.genOverlay}>
      <style>{`@keyframes planSpin{to{transform:rotate(360deg)}}`}</style>
      <div style={styles.genCard}>
        {error ? (
          <>
            <div style={styles.genTitle}>Taking longer than expected</div>
            <p style={styles.genBody}>
              Your plan is still generating — give it another minute, then reload.
              If this keeps happening, reach us at{' '}
              <a href="mailto:hello@plus4performance.com" style={{ color: '#C0392B' }}>hello@plus4performance.com</a>.
            </p>
            <button onClick={onRetry} style={styles.genRetryBtn}>Reload and check →</button>
          </>
        ) : (
          <>
            <div style={styles.genSpinner} />
            <div style={styles.genTitle}>Building your plan.</div>
            <div style={styles.genStep}>{GEN_STEPS[step]}</div>
            <div style={styles.genNote}>Usually takes 60–90 seconds. Keep this tab open.</div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate  = useNavigate();
  const branding  = useBranding();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('today');
  const [user, setUser] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [plan, setPlan]                       = useState(null);
  const [planGeneratedAt, setPlanGeneratedAt] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [subRow, setSubRow] = useState(null);
  const [loadingUnlock, setLoadingUnlock] = useState(false);
  const [planGenerating, setPlanGenerating] = useState(false);
  const [planGenError,   setPlanGenError]   = useState(false);
  const [logbookSession, setLogbookSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  function handleOpenLogbook(sessionName) {
    setLogbookSession(sessionName);
    setActiveTab('logbook');
  }

  function handleSwitchTab(tab, withCheckinParam = false) {
    setActiveTab(tab);
    if (withCheckinParam) {
      navigate('/dashboard?checkin=true', { replace: true });
    }
  }

  useEffect(() => {
    async function load() {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) console.error('[Dashboard] getUser error:', userErr);
      if (!user) { navigate('/login'); return; }
      setUser(user);

      supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
        .then(({ data }) => { if (data?.is_admin) setIsAdmin(true); });

      const { data: snap, error: snapErr } = await supabase
        .from('snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (snapErr) console.error('[Dashboard] snapshots error:', snapErr);
      if (snap) setSnapshot(snap);

      const { data: sub, error: subErr } = await supabase
        .from('subscriptions')
        .select('status, current_period_end, stripe_customer_id, stripe_subscription_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (subErr) console.error('[Dashboard] subscriptions error:', subErr);

      const subscribed = sub && (!sub.current_period_end || new Date(sub.current_period_end) > new Date());
      setIsUnlocked(!!subscribed);
      if (sub) setSubRow(sub);

      if (subscribed) {
        const { data: planRow, error: planErr } = await supabase
          .from('plans')
          .select('plan_data, generated_at')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
        if (planErr) console.error('[Dashboard] plans error:', planErr);
        if (planRow) { setPlan(planRow.plan_data); setPlanGeneratedAt(planRow.generated_at); }
      }
    }
    load();
  }, [navigate]);

  // Handle return from Stripe — poll until subscription AND generated plan are both ready
  useEffect(() => {
    if (searchParams.get('payment') !== 'success') return;
    setPlanGenerating(true);
    let attempts = 0;
    const MAX = 50; // 50 × 3 s = 150 s max
    const poll = setInterval(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: sub } = await supabase
          .from('subscriptions').select('status')
          .eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle();
        if (sub) {
          setIsUnlocked(true);
          const { data: planRow } = await supabase
            .from('plans').select('plan_data, generated_at')
            .eq('user_id', user.id).eq('is_active', true).maybeSingle();
          if (planRow) {
            setPlan(planRow.plan_data);
            setPlanGeneratedAt(planRow.generated_at);
            setPlanGenerating(false);
            clearInterval(poll);
            return;
          }
        }
      } catch (e) { console.error('[plan poll]', e); }
      if (++attempts >= MAX) {
        clearInterval(poll);
        setPlanGenError(true); // overlay stays visible in error mode
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [searchParams]);

  async function refreshActivePlan() {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;
    const { data: planRow } = await supabase
      .from('plans').select('plan_data, generated_at')
      .eq('user_id', currentUser.id).eq('is_active', true).maybeSingle();
    if (planRow) { setPlan(planRow.plan_data); setPlanGeneratedAt(planRow.generated_at); }
  }

  async function handleUnlock() {
    if (!user) return;
    setLoadingUnlock(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { url } = await createCheckoutSession(user.email, session.access_token);
      window.location.href = url;
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setLoadingUnlock(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  const firstName = user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'Athlete';

  return (
    <div style={styles.page}>
      {planGenerating && (
        <PlanGeneratingOverlay
          error={planGenError}
          onRetry={() => window.location.reload()}
        />
      )}
      {/* Nav */}
      <nav style={styles.nav}>
        {branding.logo_url
          ? <img src={branding.logo_url} alt={branding.name} style={{ height: 32, objectFit: 'contain' }} />
          : <div style={styles.navLogo}>{branding.name.toUpperCase()}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {isAdmin && (
            <a href="/admin" style={{ color: '#555', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none' }}>
              Admin
            </a>
          )}
          {!isUnlocked && (
            <button className="btn-primary" onClick={handleUnlock} disabled={loadingUnlock}
              style={{ fontSize: 12, padding: '10px 20px' }}>
              {loadingUnlock ? '…' : 'Unlock — £9.99/month'}
            </button>
          )}
          <button type="button" onClick={handleSignOut} style={styles.signOut}>Sign out</button>
        </div>
      </nav>

      <div style={styles.inner}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.heading}>
            {isUnlocked ? `Welcome back, ${firstName}.` : `Ready to start, ${firstName}.`}
          </h1>
          {!isUnlocked && snapshot && (
            <p style={styles.headingSub}>Your snapshot is ready below. Unlock to access your full 12-week plan.</p>
          )}
          {!snapshot && (
            <p style={styles.headingSub}>Complete your <a href="/intake" style={{ color: '#C8C8C8' }}>intake form</a> to generate your snapshot.</p>
          )}
        </div>

        {/* Tabs — marketplace only shown on main site (branding.slug === null) */}
        <div style={styles.tabBar}>
          {TABS.filter(t => !t.mainSiteOnly || branding.slug === null).map(tab => (
            <button key={tab.id} type="button"
              style={activeTab === tab.id ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={styles.content}>
          {activeTab === 'today' && <TodayTab snapshot={snapshot} plan={plan} isUnlocked={isUnlocked} onUnlock={handleUnlock} onOpenLogbook={handleOpenLogbook} planGeneratedAt={planGeneratedAt} onGoToAccount={() => setActiveTab('account')} />}
          {activeTab === 'plan' && <TabPlan plan={plan} isUnlocked={isUnlocked} onUnlock={handleUnlock} />}
          {activeTab === 'nutrition' && <NutritionTab plan={plan} isUnlocked={isUnlocked} onUnlock={handleUnlock} />}
          {activeTab === 'progress' && <ProgressTab userId={user?.id} plan={plan} onSwitchTab={handleSwitchTab} />}
          {activeTab === 'achievements' && <AchievementsTab userId={user?.id} />}
          {activeTab === 'logbook' && <Logbook userId={user?.id} plan={plan} preselectedSession={logbookSession} />}
          {activeTab === 'community'   && <CommunityTab />}
          {activeTab === 'shop'         && <ShopTab />}
          {activeTab === 'account' && <AccountTab user={user} plan={plan} isUnlocked={isUnlocked} subRow={subRow} onUnlock={handleUnlock} onPlanSwitch={refreshActivePlan} planGeneratedAt={planGeneratedAt} />}
        </div>
      </div>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = {
  page: { minHeight: '100vh', background: '#080808' },
  nav: { position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 40px', background: 'rgba(8,8,8,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(200,200,200,0.1)' },
  navLogo: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.16em', color: '#C8C8C8' },
  signOut: { background: 'none', border: 'none', color: '#787878', fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', padding: 0 },
  inner: { maxWidth: 860, margin: '0 auto', padding: '40px 24px 80px' },
  header: { marginBottom: 40 },
  heading: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(24px, 3.5vw, 40px)', letterSpacing: '0.03em', color: '#F5F3EE', marginBottom: 8 },
  headingSub: { fontSize: 15, color: '#787878', fontWeight: 300 },
  tabBar: { display: 'flex', gap: 2, marginBottom: 32, background: '#101010', padding: 4, borderRadius: 2, overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  tab: { flex: '0 0 auto', padding: '10px 14px', background: 'none', border: 'none', color: '#787878', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', transition: 'color 0.15s', borderRadius: 2, whiteSpace: 'nowrap' },
  tabActive: { flex: '0 0 auto', padding: '10px 14px', background: '#1a1a1a', border: 'none', color: '#F5F3EE', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 2, whiteSpace: 'nowrap' },
  content: { minHeight: 400 },

  genOverlay:  { position: 'fixed', inset: 0, background: 'rgba(8,8,8,0.97)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' },
  genCard:     { maxWidth: 440, width: '100%', textAlign: 'center' },
  genSpinner:  { width: 40, height: 40, border: '2px solid #1a1a1a', borderTopColor: '#C0392B', borderRadius: '50%', animation: 'planSpin 0.9s linear infinite', margin: '0 auto 32px' },
  genTitle:    { fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(32px, 6vw, 48px)', letterSpacing: '0.04em', color: '#F5F3EE', lineHeight: 1, marginBottom: 20 },
  genStep:     { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#555', marginBottom: 28, minHeight: 20 },
  genNote:     { fontFamily: "'Barlow', sans-serif", fontSize: 13, color: '#333', fontWeight: 300 },
  genBody:     { fontFamily: "'Barlow', sans-serif", fontSize: 14, color: '#787878', fontWeight: 300, lineHeight: 1.7, marginBottom: 24 },
  genRetryBtn: { background: 'none', border: '1px solid rgba(200,200,200,0.2)', color: '#787878', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '12px 24px', cursor: 'pointer' },
  snapshotCard: { background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.15)', padding: '28px 28px 24px', marginBottom: 28 },
  snapshotEyebrow: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#787878', marginBottom: 12 },
  snapshotSummary: { fontSize: 15, color: '#CDCDC8', lineHeight: 1.7, marginBottom: 20, fontStyle: 'italic' },
  snapshotStats: { display: 'flex', gap: 24, marginBottom: 16 },
  stat: { textAlign: 'center' },
  statVal: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: '#C8C8C8', lineHeight: 1 },
  statLabel: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#787878', marginTop: 4 },
  timeline: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C8C8C8', borderTop: '1px solid rgba(200,200,200,0.1)', paddingTop: 14, marginTop: 4 },

  sectionHead: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.06em', color: '#F5F3EE', marginBottom: 14, marginTop: 28 },
  infoCard: { background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.12)', padding: '20px 20px' },
  mockCard: { background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.12)', padding: '20px 20px' },
  mockTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, color: '#C8C8C8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 },
  mockRow: { display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#CDCDC8', padding: '8px 0', borderBottom: '1px solid #1a1a1a' },

  blurCTA: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,8,8,0.5)' },

  lockedOverlay: { textAlign: 'center', padding: '48px 24px', background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.15)', marginBottom: 24 },
  lockIcon: { fontSize: 36, marginBottom: 16 },
  lockTitle: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#F5F3EE', marginBottom: 10 },
  lockDesc: { fontSize: 14, color: '#787878', maxWidth: 340, margin: '0 auto 20px', lineHeight: 1.6 },
  lockPrice: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: '#C8C8C8', marginBottom: 24, lineHeight: 1 },
  lockPer: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 600, color: '#787878', letterSpacing: '0.1em' },

  sessionCard: { background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.12)', marginBottom: 12 },
  sessionHeader: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' },
  sessionName: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#F5F3EE' },
  exTable: { width: '100%', borderCollapse: 'collapse', marginTop: 12 },
  th: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#787878', padding: '8px 8px 8px 0', textAlign: 'left', borderBottom: '1px solid #222' },
  td: { fontSize: 13, color: '#CDCDC8', padding: '10px 8px 10px 0', verticalAlign: 'top' },
  tdCenter: { fontSize: 13, color: '#CDCDC8', padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' },

  weekNav: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 },
  weekBtn: { padding: '6px 10px', background: '#101010', border: '1px solid rgba(200,200,200,0.15)', color: '#787878', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  weekBtnActive: { padding: '6px 10px', background: '#1a1a1a', border: '1px solid #C8C8C8', color: '#C8C8C8', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  weekBtnLocked: { padding: '6px 10px', background: '#0a0a0a', border: '1px solid rgba(200,200,200,0.06)', color: '#2e2e2e', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, cursor: 'default' },
  lockLabel: { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#2e2e2e' },
  lockedMsg: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#444', marginBottom: 16 },
  phaseTag: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#787878', marginBottom: 14 },

  comingSoon: { textAlign: 'center', padding: '80px 24px', color: '#787878' },
  comingSoonIcon: { fontSize: 48, marginBottom: 20 },
  comingSoonTitle: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#F5F3EE', marginBottom: 10 },
  comingSoonDesc: { fontSize: 14, lineHeight: 1.6, maxWidth: 320, margin: '0 auto' },
};
