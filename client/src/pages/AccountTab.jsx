import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { createPortalSession, deleteAccount, createCheckoutSession } from '../lib/api';

/*
  ─── NO NEW SQL TABLES REQUIRED ────────────────────────────────────────────────
  User preferences are stored in Supabase auth user_metadata via updateUser().
  Account deletion is handled server-side at DELETE /delete-account, which
  cascades through: weight_logs, lift_logs, session_completions,
  intake_submissions, snapshots, plans, subscriptions — then deletes the
  auth.users row via the admin client.
  ───────────────────────────────────────────────────────────────────────────────
*/

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

function Toggle({ label, checked, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid #1a1a1a', minHeight: 44 }}>
      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: '#CDCDC8', letterSpacing: '0.04em' }}>{label}</span>
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
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [err, setErr]                 = useState('');

  async function handleSave() {
    setSaving(true); setErr(''); setSaved(false);
    const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
    setSaving(false);
    if (error) { setErr(error.message); return; }
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

function MyPlanSection({ plan, intake, intakeLoading }) {
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

  const today       = new Date(); today.setHours(0, 0, 0, 0);
  const daysElapsed = startDate ? Math.max(0, Math.floor((today - startDate) / 86400000)) : 0;
  const weeksComplete = Math.min(12, Math.floor(daysElapsed / 7));
  const weeksRemaining = Math.max(0, 12 - weeksComplete);
  const planComplete   = weeksComplete >= 12;

  const fmt = d => d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const splitKey   = intake.trainingSplit || '';
  const splitLabel = plan?.user_summary?.split || SPLIT_LABELS[splitKey] || splitKey.replace(/_/g, ' ') || '—';
  const sessionLen = SESSION_LABELS[String(intake.sessionLength)] || (intake.sessionLength ? `${intake.sessionLength} min` : '—');
  const trainingDays = intake.trainingDays ? `${intake.trainingDays} days / week` : '—';

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
              ['Started',            fmt(startDate)],
              ['Ends',               fmt(endDate)],
              ['Training Days',      trainingDays],
              ['Split',              splitLabel],
              ['Session Length',     sessionLen],
            ].map(([k, v]) => (
              <div key={k} style={rowStyle}>
                <span style={{ color: '#787878', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em' }}>{k}</span>
                <span style={{ color: '#F5F3EE', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.04em' }}>{v}</span>
              </div>
            ))}
          </div>

          <button
            disabled={!planComplete}
            title={!planComplete ? 'Available after Week 12' : 'Generate a new 12-week plan'}
            style={primaryBtn(!planComplete)}
          >
            Generate New Plan
          </button>
          {!planComplete && (
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555', marginTop: 8, letterSpacing: '0.08em' }}>
              Available after Week 12
            </p>
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

// ─── SECTION 3: SUBSCRIPTION ─────────────────────────────────────────────────

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

// ─── SECTION 4: SETTINGS & PRIVACY ───────────────────────────────────────────

function SettingsSection({ user }) {
  const meta        = user?.user_metadata || {};
  const prefs       = meta.preferences   || {};

  const [reminders,  setReminders]  = useState(!!prefs.session_reminders);
  const [weighIn,    setWeighIn]    = useState(!!prefs.daily_weigh_in);
  const [weeklySummary, setWeeklySummary] = useState(!!prefs.weekly_summary);
  const [units,      setUnits]      = useState(prefs.units || 'kg');
  const [saving,     setSaving]     = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  async function savePrefs(patch) {
    setSaving(true);
    const current = (await supabase.auth.getUser()).data?.user?.user_metadata?.preferences || {};
    await supabase.auth.updateUser({ data: { preferences: { ...current, ...patch } } });
    setSaving(false);
  }

  function handleToggle(key, setter, value) {
    setter(value);
    savePrefs({ [key]: value });
  }

  function handleUnits(u) {
    setUnits(u);
    savePrefs({ units: u });
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
          <Toggle label="Session reminders"              checked={reminders}     onChange={v => handleToggle('session_reminders', setReminders,     v)} />
          <Toggle label="Daily weigh-in reminder"        checked={weighIn}       onChange={v => handleToggle('daily_weigh_in',    setWeighIn,       v)} />
          <Toggle label="Weekly progress summary email"  checked={weeklySummary} onChange={v => handleToggle('weekly_summary',    setWeeklySummary, v)} />
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

export default function AccountTab({ user, plan, isUnlocked, subRow, onUnlock }) {
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
      <ProfileSection     user={user} intake={intake} intakeLoading={intakeLoading} />
      <MyPlanSection      plan={plan} intake={intake} intakeLoading={intakeLoading} />
      <SubscriptionSection isUnlocked={isUnlocked} subRow={subRow} user={user} onUnlock={onUnlock} />
      <SettingsSection    user={user} />
    </div>
  );
}
