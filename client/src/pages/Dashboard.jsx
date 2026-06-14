import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { createCheckoutSession } from '../lib/api';
import AchievementsTab from './AchievementsTab';
import ProgressTab from './ProgressTab';
import TodayTab from './TodayTab';
import Logbook from './Logbook';

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'plan', label: 'Plan' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'progress', label: 'Progress' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'logbook', label: 'Logbook' },
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

  const phases = plan?.phases || [];
  const library = plan?.exercise_library || {};
  const phase = phases[selectedPhase];

  return (
    <div>
      <div style={styles.weekNav}>
        {phases.map((p, i) => (
          <button key={i} type="button"
            style={selectedPhase === i ? styles.weekBtnActive : styles.weekBtn}
            onClick={() => setSelectedPhase(i)}>
            Phase {p.phase}
          </button>
        ))}
      </div>
      {phase && (
        <div>
          <div style={styles.phaseTag}>{phase.label} — Weeks {phase.weeks}</div>
          {(phase.sessions || []).map((s, i) => (
            <SessionCard key={i} session={s} library={library} defaultOpen={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function TabNutrition({ plan, isUnlocked, onUnlock }) {
  if (!isUnlocked) return (
    <div>
      <LockedOverlay onUnlock={onUnlock} />
      <BlurredCard onUnlock={onUnlock}>
        <div style={styles.mockCard}>
          <div style={styles.mockTitle}>Training Day</div>
          <div style={styles.mockRow}><span>Calories</span><span>2,800 kcal</span></div>
          <div style={styles.mockRow}><span>Protein</span><span>180g</span></div>
        </div>
      </BlurredCard>
    </div>
  );

  const nut = plan?.nutrition;
  return (
    <div>
      {nut && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <MacroCard title="Training Day" data={nut.training_day} accent="#C8C8C8" />
          <MacroCard title="Rest Day" data={nut.rest_day} accent="#787878" />
        </div>
      )}
      {plan?.meal_plan && (
        <div>
          <div style={styles.sectionHead}>Meal Templates</div>
          {plan.meal_plan.training_day?.length > 0 && (
            <MealTemplateCard label="Training Day" meals={plan.meal_plan.training_day} />
          )}
          {plan.meal_plan.rest_day?.length > 0 && (
            <MealTemplateCard label="Rest Day" meals={plan.meal_plan.rest_day} />
          )}
        </div>
      )}
      {plan?.grocery_list && (
        <div style={{ marginTop: 24 }}>
          <div style={styles.sectionHead}>Grocery List</div>
          <GroceryList list={plan.grocery_list} />
        </div>
      )}
    </div>
  );
}



// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function SessionCard({ session, library = {}, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [expandedEx, setExpandedEx] = useState(null);
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
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(session.exercises || []).map((ex, i) => {
                const info = library[ex.ex] || {};
                const name = info.name || ex.ex;
                const isOpen = expandedEx === i;
                return (
                  <React.Fragment key={i}>
                    <tr style={{ background: i % 2 === 0 ? '#111' : '#0d0d0d', cursor: info.cues ? 'pointer' : 'default' }}
                      onClick={() => info.cues && setExpandedEx(isOpen ? null : i)}>
                      <td style={styles.td}>
                        {name}
                        {info.cues && <span style={{ color: '#555', fontSize: 11, marginLeft: 6 }}>{isOpen ? '▲' : '▼'}</span>}
                      </td>
                      <td style={styles.tdCenter}>{ex.sets}</td>
                      <td style={styles.tdCenter}>{ex.reps}</td>
                      <td style={styles.tdCenter}>{ex.rest}</td>
                    </tr>
                    {isOpen && info.cues && (
                      <tr style={{ background: '#0a0a0a' }}>
                        <td colSpan={4} style={{ padding: '10px 0 14px', fontSize: 12, color: '#CDCDC8', lineHeight: 1.6 }}>
                          <div style={{ marginBottom: 4 }}><span style={{ color: '#787878', fontWeight: 700 }}>Cue: </span>{info.cues}</div>
                          {info.common_mistakes && <div style={{ marginBottom: 4 }}><span style={{ color: '#787878', fontWeight: 700 }}>Avoid: </span>{info.common_mistakes}</div>}
                          {info.injury_modifications && <div><span style={{ color: '#787878', fontWeight: 700 }}>Modification: </span>{info.injury_modifications}</div>}
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
          {(meals || []).map((meal, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, color: '#C8C8C8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{meal.name}</div>
              {(meal.foods || []).map((food, j) => (
                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#CDCDC8', padding: '4px 0', borderBottom: '1px solid #1a1a1a' }}>
                  <span>{food.name}</span>
                  <span style={{ color: '#787878' }}>{food.amount} · {food.cal} kcal</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GroceryList({ list }) {
  const sections = [
    { key: 'proteins', label: 'Proteins' },
    { key: 'carbs', label: 'Carbs' },
    { key: 'veg', label: 'Vegetables & Fruit' },
    { key: 'fats', label: 'Fats' },
    { key: 'supplements', label: 'Supplements' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {sections.map(({ key, label }) => list[key]?.length ? (
        <div key={key} style={styles.infoCard}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#787878', marginBottom: 10 }}>{label}</div>
          {list[key].map((item, i) => (
            <div key={i} style={{ fontSize: 13, color: '#CDCDC8', padding: '3px 0', borderBottom: '1px solid #1a1a1a' }}>{item}</div>
          ))}
        </div>
      ) : null)}
    </div>
  );
}

// ─── MAIN DASHBOARD ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('today');
  const [user, setUser] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [plan, setPlan] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loadingUnlock, setLoadingUnlock] = useState(false);
  const [logbookSession, setLogbookSession] = useState(null);

  function handleOpenLogbook(sessionName) {
    setLogbookSession(sessionName);
    setActiveTab('logbook');
  }

  useEffect(() => {
    async function load() {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) console.error('[Dashboard] getUser error:', userErr);
      if (!user) { navigate('/login'); return; }
      setUser(user);

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
        .select('status, current_period_end')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (subErr) console.error('[Dashboard] subscriptions error:', subErr);

      const subscribed = sub && (!sub.current_period_end || new Date(sub.current_period_end) > new Date());
      setIsUnlocked(!!subscribed);

      if (subscribed) {
        const { data: planRow, error: planErr } = await supabase
          .from('plans')
          .select('plan_data')
          .eq('user_id', user.id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (planErr) console.error('[Dashboard] plans error:', planErr);
        if (planRow) setPlan(planRow.plan_data);
      }
    }
    load();
  }, [navigate]);

  // Handle return from Stripe
  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      // Poll for subscription — Stripe webhook may take a few seconds
      let attempts = 0;
      const poll = setInterval(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('status')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        if (sub) {
          setIsUnlocked(true);
          clearInterval(poll);
          // Load plan
          const { data: planRow } = await supabase.from('plans').select('plan_data').eq('user_id', user.id).order('generated_at', { ascending: false }).limit(1).maybeSingle();
          if (planRow) setPlan(planRow.plan_data);
        }
        if (++attempts >= 20) clearInterval(poll);
      }, 3000);
      return () => clearInterval(poll);
    }
  }, [searchParams]);

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
      {/* Nav */}
      <nav style={styles.nav}>
        <div style={styles.navLogo}>PLUS 4 PERFORMANCE</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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

        {/* Tabs */}
        <div style={styles.tabBar}>
          {TABS.map(tab => (
            <button key={tab.id} type="button"
              style={activeTab === tab.id ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={styles.content}>
          {activeTab === 'today' && <TodayTab snapshot={snapshot} plan={plan} isUnlocked={isUnlocked} onUnlock={handleUnlock} onOpenLogbook={handleOpenLogbook} />}
          {activeTab === 'plan' && <TabPlan plan={plan} isUnlocked={isUnlocked} onUnlock={handleUnlock} />}
          {activeTab === 'nutrition' && <TabNutrition plan={plan} isUnlocked={isUnlocked} onUnlock={handleUnlock} />}
          {activeTab === 'progress' && <ProgressTab userId={user?.id} />}
          {activeTab === 'achievements' && <AchievementsTab userId={user?.id} />}
          {activeTab === 'logbook' && <Logbook userId={user?.id} plan={plan} preselectedSession={logbookSession} />}
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
  heading: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(32px, 5vw, 56px)', letterSpacing: '0.03em', color: '#F5F3EE', marginBottom: 8 },
  headingSub: { fontSize: 15, color: '#787878', fontWeight: 300 },
  tabBar: { display: 'flex', gap: 2, marginBottom: 32, background: '#101010', padding: 4, borderRadius: 2, overflowX: 'auto' },
  tab: { flex: '0 0 auto', padding: '10px 20px', background: 'none', border: 'none', color: '#787878', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', transition: 'color 0.15s', borderRadius: 2 },
  tabActive: { flex: '0 0 auto', padding: '10px 20px', background: '#1a1a1a', border: 'none', color: '#F5F3EE', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 2 },
  content: { minHeight: 400 },

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
  phaseTag: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#787878', marginBottom: 14 },

  comingSoon: { textAlign: 'center', padding: '80px 24px', color: '#787878' },
  comingSoonIcon: { fontSize: 48, marginBottom: 20 },
  comingSoonTitle: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#F5F3EE', marginBottom: 10 },
  comingSoonDesc: { fontSize: 14, lineHeight: 1.6, maxWidth: 320, margin: '0 auto' },
};
