import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { createPortalSession, deleteAccount, createCheckoutSession, getEmailPreferences, saveEmailPreferences, sendTestWeeklyEmail, requestRenewalPlan, listPlans, activatePlan } from '../lib/api';

/*
  ─── NO NEW SQL TABLES REQUIRED ────────────────────────────────────────────────
  User preferences are stored in Supabase auth user_metadata via updateUser().
  Account deletion is handled server-side at DELETE /delete-account, which
  cascades through: weight_logs, lift_logs, session_completions,
  intake_submissions, snapshots, plans, subscriptions — then deletes the
  auth.users row via the admin client.
  ───────────────────────────────────────────────────────────────────────────────
*/

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const CHECKIN_DAYS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
];

// ─── LABEL MAPS ──────────────────────────────────────────────────────────────

const GOAL_LABELS = {
  fat_loss:        'Fat Loss',
  muscle_building: 'Lean Bulk',
  maintenance:     'Recomp',
};
const EXP_LABELS = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
  elite:        'Elite',
};
const EQUIP_LABELS = {
  specialist_gym: 'Specialist Gym',
  commercial_gym: 'Commercial Gym',
  budget_gym:     'Budget Gym',
  home_gym:       'Home Gym',
  bodyweight:     'Bodyweight',
};
const SPLIT_LABELS = {
  push_pull_legs:             'Push / Pull / Legs',
  upper_lower:                'Upper / Lower',
  full_body:                  'Full Body',
  arnold_split:               'Arnold Split',
  chest_back_shoulders_arms:  'Chest & Back / Shoulders & Arms',
  ppl_posterior:              'PPL + Posterior Chain',
  upper_lower_x:              'Upper Lower Plus',
  recommend:                  'AI Recommended',
};
const SESSION_LABELS = { '45': '45 min', '60': '60 min', '90': '90 min', '120': '2 hours' };

// ─── SHARED STYLE TOKENS ─────────────────────────────────────────────────────

const cardStyle   = { background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.12)', marginBottom: 20 };
const eyebrowStyle = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#555' };
const rowStyle    = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1a1a1a', fontSize: 13 };

function inp(extra = {}) {
  return { padding: '10px 12px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#F5F3EE', fontFamily: "'Barlow', sans-serif", fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', ...extra };
}
function primaryBtn(disabled = false, extra = {}) {
  return { background: disabled ? '#444' : '#C0392B', border: 'none', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '13px 24px', cursor: disabled ? 'default' : 'pointer', minHeight: 44, opacity: disabled ? 0.6 : 1, ...extra };
}
function ghostBtn(extra = {}) {
  return { background: 'none', border: '1px solid rgba(200,200,200,0.2)', color: '#787878', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '13px 20px', cursor: 'pointer', minHeight: 44, ...extra };
}

// ─── SMALL ATOMS ─────────────────────────────────────────────────────────────

function SectionCard({ title, children }) {
  return (
    <div style={cardStyle}>
      <div style={{ padding: '20px 20px 0', borderBottom: '1px solid rgba(200,200,200,0.08)', marginBottom: 0 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.1em', color: '#F5F3EE', paddingBottom: 14 }}>{title}</div>
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );
}

function LabelPill({ children }) {
  return (
    <span style={{ display: 'inline-block', border: '1px solid rgba(192,57,43,0.5)', padding: '4px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#C0392B' }}>
      {children}
    </span>
  );
}

function FieldLabel({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
      <span style={{ ...eyebrowStyle, fontSize: 10 }}>{label}</span>
      {children}
    </label>
  );
}

function SkeletonLine({ width = '60%', height = 14 }) {
  return <div style={{ width, height, background: '#1a1a1a', borderRadius: 2, marginBottom: 8 }} />;
}

function Toggle({ label, checked, onChange, saved }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid #1a1a1a', minHeight: 44 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: '#CDCDC8', letterSpacing: '0.04em' }}>{label}</span>
        {saved && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#4CAF50', letterSpacing: '0.08em' }}>✓ Saved</span>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-checked={checked}
        role="switch"
        style={{ width: 44, height: 24, borderRadius: 12, background: checked ? '#C0392B' : '#2a2a2a', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
      >
        <span style={{ position: 'absolute', top: 2, left: checked ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#F5F3EE', transition: 'left 0.2s', display: 'block' }} />
      </button>
    </div>
  );
}

function ProgressBar({ progress }) {
  return (
    <div style={{ width: '100%', height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden', margin: '10px 0 4px' }}>
      <div style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%`, height: '100%', background: '#C0392B', borderRadius: 3, transition: 'width 0.6s ease' }} />
    </div>
  );
}

// ─── DELETE CONFIRMATION MODAL ────────────────────────────────────────────────

function DeleteModal({ onClose, onConfirm, deleting }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      <div style={{ background: '#111', border: '1px solid rgba(200,200,200,0.12)', padding: '32px 28px', maxWidth: 400, width: '100%' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#C0392B', marginBottom: 16 }}>
          Delete Account
        </div>
        <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: '#CDCDC8', lineHeight: 1.7, margin: '0 0 24px', fontWeight: 300 }}>
          This will permanently delete your account and all associated data including your plan, progress logs and logbook entries. This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} disabled={deleting} style={ghostBtn({ flex: 1 })}>Cancel</button>
          <button onClick={onConfirm} disabled={deleting} style={{ ...primaryBtn(deleting, { flex: 1 }), background: deleting ? '#444' : '#6B0F0A' }}>
            {deleting ? '…' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SECTION 1: PROFILE ──────────────────────────────────────────────────────

function ProfileSection({ user, intake, intakeLoading }) {
  const meta        = user?.user_metadata || {};
  const firstName   = meta.first_name || '';
  const lastName    = meta.last_name  || '';
  const fullName    = [firstName, lastName].filter(Boolean).join(' ') || user?.email?.split('@')[0] || 'Athlete';
  const initials    = ([firstName[0], lastName[0]].filter(Boolean).join('') || (user?.email?.[0] || 'A')).toUpperCase();

  const [displayName, setDisplayName] = useState(meta.display_name || firstName || '');
  const [username,    setUsername]    = useState('');
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [err, setErr]                 = useState('');

  // Load username from profiles table on mount
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.username) setUsername(data.username); });
  }, [user?.id]);

  async function handleSave() {
    const trimmed = username.trim();
    if (trimmed && !/^[a-zA-Z0-9_]{3,30}$/.test(trimmed)) {
      setErr('Username must be 3–30 characters: letters, numbers and underscores only.');
      return;
    }
    setSaving(true); setErr(''); setSaved(false);
    const { error: authErr } = await supabase.auth.updateUser({ data: { display_name: displayName } });
    if (authErr) { setSaving(false); setErr(authErr.message); return; }
    const { error: profileErr } = await supabase
      .from('profiles').update({ username: trimmed || null }).eq('id', user.id);
    setSaving(false);
    if (profileErr) {
      setErr(profileErr.message.includes('unique') ? 'That username is already taken.' : profileErr.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <SectionCard title="PROFILE">
      {/* Avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#6B0F0A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: '#F5F3EE', letterSpacing: '0.04em' }}>{initials}</span>
        </div>
        <div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: '#F5F3EE', letterSpacing: '0.04em', lineHeight: 1.1 }}>{fullName}</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#787878', marginTop: 4 }}>{user?.email}</div>
        </div>
      </div>

      {/* Intake pills */}
      {intakeLoading ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <SkeletonLine width={80} height={24} />
          <SkeletonLine width={100} height={24} />
          <SkeletonLine width={90} height={24} />
        </div>
      ) : intake && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {intake.goal      && <LabelPill>{GOAL_LABELS[intake.goal]      || intake.goal}</LabelPill>}
          {intake.experience && <LabelPill>{EXP_LABELS[intake.experience]  || intake.experience}</LabelPill>}
          {intake.equipment  && <LabelPill>{EQUIP_LABELS[intake.equipment]  || intake.equipment}</LabelPill>}
        </div>
      )}

      {/* Editable fields */}
      <FieldLabel label="Display Name">
        <input
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          style={inp()}
        />
      </FieldLabel>
      <FieldLabel label="Username — optional">
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="e.g. cam_lifts"
          style={inp()}
        />
      </FieldLabel>
      <FieldLabel label="Email">
        <input type="email" value={user?.email || ''} readOnly style={inp({ color: '#555', cursor: 'default' })} />
      </FieldLabel>

      {err && <p style={{ color: '#ef4444', fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 10 }}>{err}</p>}

      <button onClick={handleSave} disabled={saving} style={primaryBtn(saving)}>
        {saving ? '…' : saved ? '✓ Saved' : 'Save Changes'}
      </button>
    </SectionCard>
  );
}

// ─── SECTION 2: MY PLAN ──────────────────────────────────────────────────────

const RENEWAL_GOALS = [
  { value: 'fat_loss',        label: 'Fat Loss' },
  { value: 'muscle_building', label: 'Lean Bulk' },
  { value: 'maintenance',     label: 'Recomposition' },
];

function MyPlanSection({ plan, intake, intakeLoading, planGeneratedAt }) {
  const [step,      setStep]      = useState('idle'); // idle | picking | new_direction | submitting | queued | error
  const [err,       setErr]       = useState('');
  const [newGoal,   setNewGoal]   = useState('fat_loss');
  const [newTarget, setNewTarget] = useState('');

  if (intakeLoading || !intake) {
    return (
      <SectionCard title="MY PLAN">
        <SkeletonLine width="50%" />
        <SkeletonLine width="40%" />
        <SkeletonLine width="30%" />
      </SectionCard>
    );
  }

  const startDate = intake.startDate ? new Date(intake.startDate) : null;
  if (startDate) startDate.setHours(0, 0, 0, 0);
  const endDate   = startDate ? new Date(startDate.getTime() + 84 * 86400000) : null;

  const today         = new Date(); today.setHours(0, 0, 0, 0);
  const daysElapsed   = startDate ? Math.max(0, Math.floor((today - startDate) / 86400000)) : 0;
  const weeksComplete = Math.min(12, Math.floor(daysElapsed / 7));
  const weeksRemaining = Math.max(0, 12 - weeksComplete);
  // Use planGeneratedAt (how long *this specific plan* has run) so renewal resets the clock.
  // Falls back to the intake-startDate calculation if planGeneratedAt isn't loaded yet.
  const planComplete  = planGeneratedAt
    ? Math.floor((Date.now() - new Date(planGeneratedAt)) / 86400000) >= 84
    : weeksComplete >= 12;

  const fmt = d => d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const splitKey   = intake.trainingSplit || '';
  const splitLabel = plan?.user_summary?.split || SPLIT_LABELS[splitKey] || splitKey.replace(/_/g, ' ') || '—';
  const sessionLen = SESSION_LABELS[String(intake.sessionLength)] || (intake.sessionLength ? `${intake.sessionLength} min` : '—');
  const trainingDays = intake.trainingDays ? `${intake.trainingDays} days / week` : '—';

  async function submitRenewal(option) {
    setStep('submitting');
    setErr('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const newIntake = option === 2
        ? { goal: newGoal, targetWeight: newTarget ? Number(newTarget) : undefined }
        : null;
      await requestRenewalPlan(option, newIntake, session.access_token);
      setStep('queued');
    } catch (e) {
      setErr(e.message || 'Something went wrong. Please try again.');
      setStep(option === 2 ? 'new_direction' : 'picking');
    }
  }

  const optionCardStyle = {
    background: '#111', border: '1px solid rgba(200,200,200,0.12)', padding: '20px',
    cursor: 'pointer', transition: 'border-color 0.15s', marginBottom: 8,
  };

  return (
    <SectionCard title="MY PLAN">
      {startDate ? (
        <>
          {/* Progress bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ ...eyebrowStyle, fontSize: 10 }}>Progress — Week {weeksComplete} of 12</span>
              <span style={{ ...eyebrowStyle, fontSize: 10, color: '#C0392B' }}>{weeksRemaining > 0 ? `${weeksRemaining} weeks remaining` : 'Complete'}</span>
            </div>
            <ProgressBar progress={weeksComplete / 12} />
          </div>

          <div style={{ marginBottom: 20 }}>
            {[
              ['Started',        fmt(startDate)],
              ['Ends',           fmt(endDate)],
              ['Training Days',  trainingDays],
              ['Split',          splitLabel],
              ['Session Length', sessionLen],
            ].map(([k, v]) => (
              <div key={k} style={rowStyle}>
                <span style={{ color: '#787878', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em' }}>{k}</span>
                <span style={{ color: '#F5F3EE', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.04em' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Renewal flow */}
          {step === 'idle' && (
            <>
              <button
                disabled={!planComplete}
                title={!planComplete ? 'Available after Week 12' : 'Generate a new 12-week plan'}
                style={primaryBtn(!planComplete)}
                onClick={() => planComplete && setStep('picking')}
              >
                Generate New Plan
              </button>
              {!planComplete && (
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555', marginTop: 8, letterSpacing: '0.08em' }}>
                  Available after Week 12
                </p>
              )}
            </>
          )}

          {step === 'picking' && (
            <div style={{ marginTop: 4 }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#787878', letterSpacing: '0.08em', marginBottom: 16 }}>
                Choose how you want your next plan built:
              </p>

              <div
                style={optionCardStyle}
                onClick={() => submitRenewal(1)}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#C0392B'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(200,200,200,0.12)'}
              >
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.06em', color: '#F5F3EE', marginBottom: 6 }}>
                  Continue &amp; Evolve
                </div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#787878', letterSpacing: '0.04em', margin: 0, lineHeight: 1.5 }}>
                  Same goal, new structure. Exercises, split, and loading based on your 12 weeks of documented progress.
                </p>
              </div>

              <div
                style={optionCardStyle}
                onClick={() => setStep('new_direction')}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#C0392B'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(200,200,200,0.12)'}
              >
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.06em', color: '#F5F3EE', marginBottom: 6 }}>
                  New Direction
                </div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#787878', letterSpacing: '0.04em', margin: 0, lineHeight: 1.5 }}>
                  Change your goal. Set a new target and get a plan built around where you want to go next.
                </p>
              </div>

              <button onClick={() => setStep('idle')} style={{ ...ghostBtn(), marginTop: 4, fontSize: 11 }}>
                Cancel
              </button>
            </div>
          )}

          {step === 'new_direction' && (
            <div style={{ marginTop: 4 }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#787878', letterSpacing: '0.08em', marginBottom: 16 }}>
                Set your new goal:
              </p>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                <span style={{ ...eyebrowStyle, fontSize: 10 }}>New Goal</span>
                <select
                  value={newGoal}
                  onChange={e => setNewGoal(e.target.value)}
                  style={{ ...inp(), appearance: 'none' }}
                >
                  {RENEWAL_GOALS.map(g => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                <span style={{ ...eyebrowStyle, fontSize: 10 }}>Target Weight (kg) — optional</span>
                <input
                  type="number"
                  min="30" max="250" step="0.5"
                  value={newTarget}
                  onChange={e => setNewTarget(e.target.value)}
                  placeholder="e.g. 85"
                  style={inp()}
                />
              </label>

              {err && <p style={{ color: '#ef4444', fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 10 }}>{err}</p>}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => submitRenewal(2)} style={primaryBtn(false)}>
                  Generate Plan
                </button>
                <button onClick={() => setStep('picking')} style={ghostBtn()}>
                  Back
                </button>
              </div>
            </div>
          )}

          {step === 'submitting' && (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#787878', letterSpacing: '0.08em', marginTop: 4 }}>
              Starting generation…
            </p>
          )}

          {step === 'queued' && (
            <div style={{ background: '#0d1a0d', border: '1px solid rgba(76,175,80,0.3)', padding: '16px 20px', marginTop: 4 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', color: '#4CAF50', marginBottom: 6 }}>
                ✓ Plan generation started
              </div>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#787878', letterSpacing: '0.04em', margin: 0, lineHeight: 1.5 }}>
                Your new 12-week plan will be ready in 1–2 minutes. Reload the app to see it under the Plan tab.
              </p>
            </div>
          )}

          {step === 'error' && (
            <p style={{ color: '#ef4444', fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", marginTop: 4 }}>{err}</p>
          )}
        </>
      ) : (
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#555', letterSpacing: '0.06em' }}>
          No start date set. Complete your intake form to begin.
        </p>
      )}
    </SectionCard>
  );
}

// ─── SECTION 3: MY PLANS ─────────────────────────────────────────────────────

const PLAN_GOAL_LABELS = { fat_loss: 'Fat Loss', muscle_building: 'Lean Bulk', maintenance: 'Recomposition' };
const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const planEndDate = d => new Date(new Date(d).getTime() + 84 * 86400000);

function MyPlansSection({ isUnlocked, onPlanSwitch }) {
  const [plans,      setPlans]      = useState(null); // null = loading
  const [activating, setActivating] = useState(null); // id being switched
  const [plansErr,   setPlansErr]   = useState('');

  useEffect(() => {
    if (!isUnlocked) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const result = await listPlans(session.access_token);
        setPlans(result.plans || []);
      } catch (e) {
        setPlansErr(e.message || 'Failed to load plans.');
      }
    })();
  }, [isUnlocked]);

  async function handleActivate(planId) {
    setActivating(planId);
    setPlansErr('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await activatePlan(planId, session.access_token);
      setPlans(prev => prev.map(p => ({ ...p, is_active: p.id === planId })));
      onPlanSwitch?.();
    } catch (e) {
      setPlansErr(e.message || 'Failed to switch plan.');
    } finally {
      setActivating(null);
    }
  }

  if (!isUnlocked) return null;

  return (
    <SectionCard title="MY PLANS">
      {plans === null && !plansErr ? (
        <>
          <SkeletonLine width="60%" />
          <SkeletonLine width="50%" />
        </>
      ) : plansErr ? (
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#ef4444', letterSpacing: '0.06em' }}>{plansErr}</p>
      ) : plans.length === 0 ? (
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#555', letterSpacing: '0.06em' }}>No plans yet.</p>
      ) : (
        <>
          {[...plans].reverse().map(p => (
            <div key={p.id} style={{ borderBottom: '1px solid #1a1a1a', padding: '16px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.06em', color: '#F5F3EE', lineHeight: 1, marginBottom: 4 }}>
                    Plan {p.plan_number}
                  </div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#555', letterSpacing: '0.06em' }}>
                    {fmtDate(p.generated_at)} – {fmtDate(planEndDate(p.generated_at))}
                  </div>
                </div>
                {p.is_active && (
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#C0392B', border: '1px solid rgba(192,57,43,0.5)', padding: '3px 8px', flexShrink: 0 }}>
                    Active
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: p.is_active ? 0 : 12 }}>
                {p.goal && (
                  <div>
                    <div style={{ ...eyebrowStyle, fontSize: 9, marginBottom: 2 }}>Goal</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#CDCDC8', letterSpacing: '0.04em' }}>
                      {PLAN_GOAL_LABELS[p.goal] || p.goal}
                    </div>
                  </div>
                )}
                {p.split && (
                  <div>
                    <div style={{ ...eyebrowStyle, fontSize: 9, marginBottom: 2 }}>Split</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#CDCDC8', letterSpacing: '0.04em' }}>
                      {p.split}
                    </div>
                  </div>
                )}
                {p.training_days && (
                  <div>
                    <div style={{ ...eyebrowStyle, fontSize: 9, marginBottom: 2 }}>Days / Week</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#CDCDC8', letterSpacing: '0.04em' }}>
                      {p.training_days}
                    </div>
                  </div>
                )}
              </div>

              {!p.is_active && (
                <button
                  onClick={() => handleActivate(p.id)}
                  disabled={!!activating}
                  style={{ ...ghostBtn({ fontSize: 11, padding: '8px 16px' }), opacity: activating === p.id ? 0.55 : 1 }}
                >
                  {activating === p.id ? '…' : 'Make Active'}
                </button>
              )}
            </div>
          ))}
          {plansErr && (
            <p style={{ color: '#ef4444', fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", marginTop: 10 }}>{plansErr}</p>
          )}
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#444', letterSpacing: '0.06em', marginTop: 12 }}>
            Switching takes effect immediately across Today, Plan, and Nutrition tabs.
          </p>
        </>
      )}
    </SectionCard>
  );
}

// ─── SECTION 4: SUBSCRIPTION ─────────────────────────────────────────────────

function SubscriptionSection({ isUnlocked, subRow, user, onUnlock }) {
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalErr, setPortalErr]         = useState('');

  const billingDate = subRow?.current_period_end
    ? new Date(subRow.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  async function handlePortal() {
    setPortalErr(''); setPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { url } = await createPortalSession(session.access_token);
      window.location.href = url;
    } catch (e) {
      setPortalErr(e.message || 'Could not open billing portal.');
      setPortalLoading(false);
    }
  }

  return (
    <SectionCard title="SUBSCRIPTION &amp; BILLING">
      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: '#F5F3EE', letterSpacing: '0.06em', lineHeight: 1 }}>
            {isUnlocked ? 'Monthly Subscriber' : 'Free'}
          </div>
          <div style={{ marginTop: 6 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: isUnlocked ? '#4CAF50' : '#555', border: `1px solid ${isUnlocked ? '#4CAF50' : '#333'}`, padding: '3px 8px' }}>
              {isUnlocked ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
        </div>
      </div>

      {isUnlocked ? (
        <>
          {billingDate && (
            <div style={{ ...rowStyle, marginBottom: 16 }}>
              <span style={{ color: '#787878', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em' }}>Next billing date</span>
              <span style={{ color: '#F5F3EE', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{billingDate}</span>
            </div>
          )}

          {portalErr && <p style={{ color: '#ef4444', fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 10 }}>{portalErr}</p>}

          <button onClick={handlePortal} disabled={portalLoading} style={ghostBtn()}>
            {portalLoading ? '…' : 'Manage Billing →'}
          </button>

          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555', marginTop: 14, letterSpacing: '0.06em', lineHeight: 1.6 }}>
            To cancel your subscription, use the Manage Billing link above.
          </p>
        </>
      ) : (
        <div style={{ background: '#111', border: '1px solid rgba(192,57,43,0.25)', padding: '20px' }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, color: '#CDCDC8', letterSpacing: '0.06em', marginBottom: 8 }}>
            Unlock Progress Tracking, Achievements, Logbook and more
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: '#F5F3EE', letterSpacing: '0.04em', lineHeight: 1, marginBottom: 16 }}>
            £9.99<span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 600, color: '#787878', letterSpacing: '0.1em' }}>/month</span>
          </div>
          <button onClick={onUnlock} style={primaryBtn()}>Upgrade Now</button>
        </div>
      )}
    </SectionCard>
  );
}

// ─── EMAIL TESTING CARD ───────────────────────────────────────────────────────

function EmailTestingCard() {
  const [status, setStatus] = useState(null); // null | 'sending' | 'ok' | 'error'
  const [msg, setMsg]       = useState('');

  async function handleSend() {
    setStatus('sending');
    setMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const result = await sendTestWeeklyEmail(session.access_token);
      setStatus('ok');
      setMsg(result.email || 'Email sent.');
    } catch (e) {
      setStatus('error');
      setMsg(e.message || 'Failed to send.');
    }
  }

  return (
    <div style={{ background: '#0d0d0d', border: '1px solid #2a2a2a', padding: '20px', marginBottom: 20 }}>
      <div style={{ ...eyebrowStyle, marginBottom: 14 }}>Email Testing</div>
      <button
        onClick={handleSend}
        disabled={status === 'sending'}
        style={{ ...ghostBtn(), opacity: status === 'sending' ? 0.55 : 1 }}
      >
        {status === 'sending' ? 'Sending…' : 'Send Test Weekly Email'}
      </button>
      {status === 'ok' && (
        <p style={{ margin: '12px 0 0', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.06em', color: '#4CAF50' }}>
          ✓ Test email sent — check your inbox ({msg})
        </p>
      )}
      {status === 'error' && (
        <p style={{ margin: '12px 0 0', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.06em', color: '#ef4444' }}>
          {msg}
        </p>
      )}
    </div>
  );
}

// ─── SECTION 4: SETTINGS & PRIVACY ───────────────────────────────────────────

function SettingsSection({ user }) {
  const [reminders,     setReminders]     = useState(true);
  const [weighIn,       setWeighIn]       = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [checkinDay,    setCheckinDay]    = useState(0); // 0 = Sunday default
  const [units,         setUnits]         = useState('kg');
  const [savedKey,      setSavedKey]      = useState(null);
  const [showDelete,    setShowDelete]    = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  // Load email preferences from API on mount
  useEffect(() => {
    async function loadPrefs() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const prefs = await getEmailPreferences(session.access_token);
        setReminders(prefs.sessionReminders);
        setWeighIn(prefs.weighInReminders);
        setWeeklySummary(prefs.weeklySummary);
        if (prefs.checkinDay != null) setCheckinDay(prefs.checkinDay);
      } catch { /* use defaults */ }
    }
    // Also load units from user_metadata
    const meta = user?.user_metadata || {};
    const storedPrefs = meta.preferences || {};
    setUnits(storedPrefs.units || 'kg');
    loadPrefs();
  }, [user]);

  async function handleToggle(key, setter, value) {
    setter(value);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await saveEmailPreferences({
        sessionReminders: key === 'session_reminders' ? value : reminders,
        weighInReminders: key === 'daily_weigh_in'    ? value : weighIn,
        weeklySummary:    key === 'weekly_summary'    ? value : weeklySummary,
        checkinDay,
      }, session.access_token);
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2500);
    } catch { /* silent */ }
  }

  async function handleCheckinDayChange(day) {
    setCheckinDay(day);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await saveEmailPreferences({
        sessionReminders: reminders,
        weighInReminders: weighIn,
        weeklySummary,
        checkinDay: day,
      }, session.access_token);
      setSavedKey('checkin_day');
      setTimeout(() => setSavedKey(null), 2500);
    } catch { /* silent */ }
  }

  function handleUnits(u) {
    setUnits(u);
    const current = user?.user_metadata?.preferences || {};
    supabase.auth.updateUser({ data: { preferences: { ...current, units: u } } });
  }

  async function handleDeleteConfirm() {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await deleteAccount(session.access_token);
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (e) {
      console.error('Delete account error:', e);
      setDeleting(false);
    }
  }

  return (
    <>
      <SectionCard title="SETTINGS">
        {/* Notification toggles */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ ...eyebrowStyle, marginBottom: 4 }}>Notifications</div>
          <Toggle label="Session reminders"             checked={reminders}     onChange={v => handleToggle('session_reminders', setReminders,     v)} saved={savedKey === 'session_reminders'} />
          <Toggle label="Daily weigh-in reminder"       checked={weighIn}       onChange={v => handleToggle('daily_weigh_in',    setWeighIn,       v)} saved={savedKey === 'daily_weigh_in'} />
          <Toggle label="Weekly progress summary email" checked={weeklySummary} onChange={v => handleToggle('weekly_summary',    setWeeklySummary, v)} saved={savedKey === 'weekly_summary'} />
        </div>

        {/* Check-in day picker */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={eyebrowStyle}>Weekly Check-In Day</div>
            {savedKey === 'checkin_day' && (
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#4CAF50', letterSpacing: '0.08em' }}>✓ Saved</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CHECKIN_DAYS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => handleCheckinDayChange(value)}
                style={{
                  padding: '8px 12px',
                  minHeight: 36,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  cursor: 'pointer',
                  border: checkinDay === value ? 'none' : '1px solid rgba(200,200,200,0.15)',
                  background: checkinDay === value ? '#C0392B' : 'transparent',
                  color: checkinDay === value ? '#fff' : '#555',
                  transition: 'background 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: '#444', fontStyle: 'italic', margin: '10px 0 0', lineHeight: 1.5 }}>
            This is the day your AI coaching check-in and weekly progress summary will appear. You can change this any time.
          </p>
        </div>

        {/* Unit preference */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ ...eyebrowStyle, marginBottom: 10 }}>Weight units</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['kg', 'lbs'].map(u => (
              <button
                key={u}
                onClick={() => handleUnits(u)}
                style={{ padding: '10px 24px', minHeight: 44, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', border: 'none', background: units === u ? '#C0392B' : '#1a1a1a', color: units === u ? '#fff' : '#787878', transition: 'background 0.15s' }}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* Support & legal */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ ...eyebrowStyle, marginBottom: 10 }}>Support & Legal</div>
          {[
            { label: 'Privacy Policy',    href: '/privacy' },
            { label: 'Terms of Service',  href: '/terms' },
            { label: 'Contact Support',   href: 'mailto:support@plus4performance.com' },
          ].map(({ label, href }) => (
            <div key={label} style={{ ...rowStyle }}>
              <a href={href} style={{ color: '#CDCDC8', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, letterSpacing: '0.04em', textDecoration: 'none' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#F5F3EE'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#CDCDC8'; }}
              >
                {label}
              </a>
              <span style={{ color: '#444', fontSize: 12 }}>→</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Email testing — only in dev or when ?debug=true */}
      {(import.meta.env.DEV || new URLSearchParams(window.location.search).get('debug') === 'true') && (
        <EmailTestingCard />
      )}

      {/* Danger zone */}
      <div style={{ background: '#0d0d0d', border: '1px solid rgba(192,57,43,0.3)', padding: '20px', marginBottom: 20 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#C0392B', marginBottom: 10 }}>
          Danger Zone
        </div>
        <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: '#787878', lineHeight: 1.6, margin: '0 0 16px', fontWeight: 300 }}>
          Permanently delete your account and all associated data. This cannot be undone.
        </p>
        <button onClick={() => setShowDelete(true)} style={{ ...primaryBtn(), background: '#6B0F0A' }}>
          Delete Account
        </button>
      </div>

      {showDelete && (
        <DeleteModal
          onClose={() => setShowDelete(false)}
          onConfirm={handleDeleteConfirm}
          deleting={deleting}
        />
      )}
    </>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export default function AccountTab({ user, plan, isUnlocked, subRow, onUnlock, onPlanSwitch, planGeneratedAt }) {
  const [intake,        setIntake]        = useState(null);
  const [intakeLoading, setIntakeLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('intake_submissions')
        .select('data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setIntake(data?.data || null);
      setIntakeLoading(false);
    })();
  }, [user]);

  if (!user) {
    return (
      <div style={{ padding: '40px 0' }}>
        <SkeletonLine width="60%" height={20} />
        <SkeletonLine width="40%" />
        <SkeletonLine width="80%" />
      </div>
    );
  }

  return (
    <div>
      <ProfileSection      user={user} intake={intake} intakeLoading={intakeLoading} />
      <MyPlanSection       plan={plan} intake={intake} intakeLoading={intakeLoading} planGeneratedAt={planGeneratedAt} />
      <MyPlansSection      isUnlocked={isUnlocked} onPlanSwitch={onPlanSwitch} />
      <SubscriptionSection isUnlocked={isUnlocked} subRow={subRow} user={user} onUnlock={onUnlock} />
      <SettingsSection    user={user} />
    </div>
  );
}
