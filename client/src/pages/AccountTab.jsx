import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { createPortalSession, deleteAccount, createCheckoutSession, getEmailPreferences, saveEmailPreferences, sendTestWeeklyEmail, requestRenewalPlan, listPlans, activatePlan, updateNutritionPreferences } from '../lib/api';
import { FAQ_SECTIONS } from '../lib/faqData';

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

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────

const C = {
  surface:    '#131119',
  surface2:   '#0C0A0F',
  bone:       '#F3F1ED',
  ash:        '#ABA9B0',
  ashDim:     '#7A7880',
  pinkGlow:   'rgba(255,79,196,0.5)',
  pinkLine:   'rgba(255,79,196,0.25)',
  green:      '#4A9968',
  greenGlow:  'rgba(74,153,104,0.4)',
  greenLine:  'rgba(74,153,104,0.35)',
  red:        '#C0392B',
  redGlow:    'rgba(192,57,43,0.3)',
  redLine:    'rgba(192,57,43,0.4)',
};

// ─── SHARED STYLE TOKENS ─────────────────────────────────────────────────────

const cardStyle = {
  background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 16,
  boxShadow: '0 12px 30px -16px rgba(0,0,0,0.55)',
  marginBottom: 22,
};

const fieldEyebrow = {
  fontFamily: "'Inter', sans-serif",
  fontSize: 11,
  letterSpacing: '1.3px',
  color: C.ashDim,
  textTransform: 'uppercase',
};

const planRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '13px 0',
  borderTop: '1px solid rgba(255,255,255,0.05)',
  fontSize: 14,
};

function inp(extra = {}) {
  return {
    padding: '13px 15px',
    background: C.surface2,
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    color: C.bone,
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.25s, box-shadow 0.25s',
    ...extra,
  };
}

function primaryBtn(disabled = false, extra = {}) {
  return {
    background: disabled ? C.surface2 : 'linear-gradient(160deg, #18151F, #100E15)',
    border: disabled ? '1px solid rgba(255,255,255,0.08)' : `1px solid ${C.pinkLine}`,
    color: disabled ? C.ashDim : C.bone,
    borderRadius: 10,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 12.5,
    fontWeight: 600,
    letterSpacing: '1.2px',
    textTransform: 'uppercase',
    padding: '14px 26px',
    cursor: disabled ? 'default' : 'pointer',
    minHeight: 44,
    opacity: disabled ? 0.6 : 1,
    boxShadow: disabled ? 'none' : `0 10px 26px -8px ${C.pinkGlow}`,
    ...extra,
  };
}

function ghostBtn(extra = {}) {
  return {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    color: C.ash,
    borderRadius: 10,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 12.5,
    fontWeight: 600,
    letterSpacing: '1.2px',
    textTransform: 'uppercase',
    padding: '13px 20px',
    cursor: 'pointer',
    minHeight: 44,
    ...extra,
  };
}

// ─── SMALL ATOMS ─────────────────────────────────────────────────────────────

function SectionCard({ title, children }) {
  return (
    <div style={cardStyle}>
      <div style={{ padding: '22px 26px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 18, textTransform: 'uppercase', color: C.bone }}>
          {title}
        </div>
      </div>
      <div style={{ padding: '22px 26px' }}>{children}</div>
    </div>
  );
}

function LabelPill({ children }) {
  return (
    <span style={{
      display: 'inline-block',
      background: C.surface2,
      border: `1px solid ${C.pinkLine}`,
      borderRadius: 8,
      padding: '9px 16px',
      fontFamily: "'Oswald', sans-serif",
      fontSize: 11.5,
      fontWeight: 600,
      letterSpacing: '0.8px',
      textTransform: 'uppercase',
      color: C.bone,
      boxShadow: `0 0 12px -6px ${C.pinkGlow}`,
    }}>
      {children}
    </span>
  );
}

function FieldLabel({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
      <span style={{ ...fieldEyebrow }}>{label}</span>
      {children}
    </label>
  );
}

function SkeletonLine({ width = '60%', height = 14 }) {
  return <div style={{ width, height, background: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 8 }} />;
}

// ─── TOGGLE SWITCH ────────────────────────────────────────────────────────────

function Toggle({ label, checked, onChange, saved }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid rgba(255,255,255,0.05)', minHeight: 44 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14.5, color: C.bone }}>{label}</span>
        {saved && (
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: C.green }}>✓ Saved</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-checked={checked}
        role="switch"
        style={{
          width: 44, height: 25, borderRadius: 13,
          background: C.surface2,
          border: checked ? `1px solid ${C.pinkLine}` : '1px solid rgba(255,255,255,0.1)',
          boxShadow: checked ? `0 0 12px -2px ${C.pinkGlow}` : 'none',
          cursor: 'pointer', position: 'relative', flexShrink: 0,
          transition: 'border-color 0.25s, box-shadow 0.25s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2,
          left: checked ? 22 : 2,
          width: 19, height: 19, borderRadius: '50%',
          background: checked ? 'rgba(255,79,196,0.9)' : C.ashDim,
          boxShadow: checked ? '0 0 6px rgba(255,79,196,0.7)' : 'none',
          transition: 'left 0.25s, background 0.25s, box-shadow 0.25s',
          display: 'block',
        }} />
      </button>
    </div>
  );
}

// ─── PROGRESS BAR ────────────────────────────────────────────────────────────

function ProgressBar({ progress }) {
  return (
    <div style={{ width: '100%', height: 4, background: C.surface2, borderRadius: 3, overflow: 'hidden', marginBottom: 22 }}>
      <div style={{
        width: `${Math.min(100, Math.max(0, progress * 100))}%`, height: '100%',
        background: 'linear-gradient(90deg, #E8389E, #FF4FC4)',
        borderRadius: 3,
        boxShadow: `0 0 8px ${C.pinkGlow}`,
        transition: 'width 0.6s ease',
      }} />
    </div>
  );
}

// ─── DELETE CONFIRMATION MODAL ────────────────────────────────────────────────

function DeleteModal({ onClose, onConfirm, deleting }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      <div style={{
        background: `linear-gradient(160deg, #1A0F0E, #120A09)`,
        border: `1px solid ${C.redLine}`,
        borderRadius: 16,
        padding: '32px 28px',
        maxWidth: 400, width: '100%',
        boxShadow: `0 0 24px -12px ${C.redGlow}`,
      }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#E05A4A', marginBottom: 16 }}>
          Delete Account
        </div>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash, lineHeight: 1.7, margin: '0 0 24px' }}>
          This will permanently delete your account and all associated data including your plan, progress logs and logbook entries. This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} disabled={deleting} style={ghostBtn({ flex: 1 })}>Cancel</button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            style={{
              flex: 1, background: `linear-gradient(160deg, #6B1F18, #4A140F)`,
              border: `1px solid ${C.redLine}`,
              color: '#F0D5D0', borderRadius: 10,
              fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 12.5,
              letterSpacing: '1.2px', textTransform: 'uppercase',
              padding: '14px 24px', cursor: deleting ? 'default' : 'pointer', minHeight: 44,
              opacity: deleting ? 0.6 : 1,
              boxShadow: `0 8px 20px -8px ${C.redGlow}`,
            }}
          >
            {deleting ? '…' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SECTION 1: PROFILE ──────────────────────────────────────────────────────

const DEFAULT_PRIVACY = { bio: 'friends', avatar: 'friends', one_rep_max: 'friends', weight: 'friends' };
const BIO_MAX = 200;

function PrivacySelect({ value, onChange }) {
  return (
    <select
      value={value || 'friends'}
      onChange={e => onChange(e.target.value)}
      style={{
        background: C.surface2, border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 7, padding: '6px 10px', fontSize: 10.5,
        color: C.ash, textTransform: 'uppercase', letterSpacing: '0.5px',
        cursor: 'pointer', outline: 'none',
      }}
    >
      <option value="public">Public</option>
      <option value="friends">Friends Only</option>
      <option value="private">Private</option>
    </select>
  );
}

function PrivacyFieldLabel({ label, privacyKey, privacy, onPrivacyChange, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ ...fieldEyebrow }}>{label}</span>
        <PrivacySelect value={privacy[privacyKey]} onChange={v => onPrivacyChange(privacyKey, v)} />
      </div>
      {children}
    </div>
  );
}

function inpWithFocus(extra = {}) {
  return inp({ ...extra });
}

function ProfileSection({ user, intake, intakeLoading }) {
  const meta        = user?.user_metadata || {};
  const firstName   = meta.first_name || '';
  const lastName    = meta.last_name  || '';
  const fullName    = [firstName, lastName].filter(Boolean).join(' ') || user?.email?.split('@')[0] || 'Athlete';
  const initials    = ([firstName[0], lastName[0]].filter(Boolean).join('') || (user?.email?.[0] || 'A')).toUpperCase();

  const [displayName,  setDisplayName]  = useState(meta.display_name || firstName || '');
  const [username,     setUsername]     = useState('');
  const [bio,          setBio]          = useState('');
  const [avatarUrl,    setAvatarUrl]    = useState('');
  const [avatarFile,   setAvatarFile]   = useState(null);
  const [avatarPreview,setAvatarPreview]= useState('');
  const [walkoutSong,  setWalkoutSong]  = useState('');
  const [privacy,      setPrivacy]      = useState(DEFAULT_PRIVACY);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [err,          setErr]          = useState('');

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles')
      .select('username, bio, avatar_url, walkout_song, privacy_settings')
      .eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (data.username)         setUsername(data.username);
        if (data.bio)              setBio(data.bio);
        if (data.avatar_url)       setAvatarUrl(data.avatar_url);
        if (data.walkout_song)     setWalkoutSong(data.walkout_song);
        if (data.privacy_settings) setPrivacy({ ...DEFAULT_PRIVACY, ...data.privacy_settings });
      });
  }, [user?.id]);

  function handleAvatarSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function setPrivacyField(key, val) {
    setPrivacy(p => ({ ...p, [key]: val }));
  }

  async function handleSave() {
    const trimmedUsername = username.trim();
    if (trimmedUsername && !/^[a-zA-Z0-9_]{3,30}$/.test(trimmedUsername)) {
      setErr('Username must be 3–30 characters: letters, numbers and underscores only.');
      return;
    }
    if (bio.length > BIO_MAX) { setErr(`Bio must be ${BIO_MAX} characters or fewer.`); return; }

    setSaving(true); setErr(''); setSaved(false);

    let newAvatarUrl = avatarUrl;
    if (avatarFile) {
      const ext  = avatarFile.type === 'image/png' ? 'png' : 'jpg';
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars').upload(path, avatarFile, { contentType: avatarFile.type, upsert: true });
      if (upErr) { setSaving(false); setErr('Avatar upload failed: ' + upErr.message); return; }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      newAvatarUrl = pub.publicUrl;
      setAvatarUrl(newAvatarUrl);
      setAvatarFile(null);
    }

    const { error: authErr } = await supabase.auth.updateUser({ data: { display_name: displayName } });
    if (authErr) { setSaving(false); setErr(authErr.message); return; }

    const { error: profileErr } = await supabase.from('profiles').update({
      username:         trimmedUsername || null,
      bio:              bio.trim()      || null,
      avatar_url:       newAvatarUrl    || null,
      walkout_song:     walkoutSong.trim() || null,
      privacy_settings: privacy,
    }).eq('id', user.id);

    setSaving(false);
    if (profileErr) {
      setErr(profileErr.message.includes('unique') ? 'That username is already taken.' : profileErr.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const avatarSrc = avatarPreview || avatarUrl;

  return (
    <SectionCard title="Profile">
      <style>{`
        .acct-inp { width: 100%; background: #0C0A0F; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 13px 15px; color: #F3F1ED; font-size: 14px; font-family: 'Inter', sans-serif; transition: border-color 0.25s, box-shadow 0.25s; outline: none; box-sizing: border-box; }
        .acct-inp:focus { border-color: rgba(255,79,196,0.25); box-shadow: 0 0 18px -8px rgba(255,79,196,0.5); }
        .acct-inp[readonly], .acct-inp[disabled] { color: #7A7880; cursor: default; }
        textarea.acct-inp { resize: vertical; min-height: 80px; line-height: 1.5; }
        select.acct-inp { appearance: none; cursor: pointer; }
      `}</style>

      {/* Avatar + name header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22 }}>
        {avatarSrc ? (
          <img src={avatarSrc} alt="Avatar" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${C.pinkLine}` }} />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(160deg, #2A2010, #1A1408)', border: `2px solid ${C.pinkLine}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 20, color: C.bone }}>{initials}</span>
          </div>
        )}
        <div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 19, textTransform: 'uppercase', color: C.bone, marginBottom: 4, lineHeight: 1.1 }}>
            {fullName}
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: C.ashDim }}>{user?.email}</div>
        </div>
      </div>

      {/* Intake pills */}
      {intakeLoading ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
          <SkeletonLine width={80} height={34} />
          <SkeletonLine width={100} height={34} />
          <SkeletonLine width={90} height={34} />
        </div>
      ) : intake && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
          {intake.goal       && <LabelPill>{GOAL_LABELS[intake.goal]        || intake.goal}</LabelPill>}
          {intake.experience && <LabelPill>{EXP_LABELS[intake.experience]   || intake.experience}</LabelPill>}
          {intake.equipment  && <LabelPill>{EQUIP_LABELS[intake.equipment]  || intake.equipment}</LabelPill>}
        </div>
      )}

      {/* Profile photo */}
      <PrivacyFieldLabel label="Profile Photo" privacyKey="avatar" privacy={privacy} onPrivacyChange={setPrivacyField}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 4 }}>
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarSelect} />
          <span style={{
            background: 'transparent', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 10,
            padding: '12px 20px', color: C.ashDim,
            fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase',
            cursor: 'pointer', display: 'inline-block',
          }}>
            {avatarSrc ? 'Change photo' : 'Upload photo'}
          </span>
          {avatarFile && (
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: C.ashDim }}>{avatarFile.name}</span>
          )}
        </label>
      </PrivacyFieldLabel>

      {/* Display name */}
      <FieldLabel label="Display Name">
        <input className="acct-inp" type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()} />
      </FieldLabel>

      {/* Username */}
      <FieldLabel label="Username — optional">
        <input className="acct-inp" type="text" value={username} onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()} placeholder="e.g. cam_lifts" />
      </FieldLabel>

      {/* Bio */}
      <PrivacyFieldLabel label={`Bio — optional (${bio.length}/${BIO_MAX})`} privacyKey="bio" privacy={privacy} onPrivacyChange={setPrivacyField}>
        <textarea className="acct-inp"
          value={bio} onChange={e => setBio(e.target.value)}
          maxLength={BIO_MAX} rows={3}
          placeholder="A short description about you and your training..." />
      </PrivacyFieldLabel>

      {/* Walkout song */}
      <FieldLabel label="Walkout Song — optional">
        <input className="acct-inp" type="text" value={walkoutSong} onChange={e => setWalkoutSong(e.target.value)}
          placeholder="e.g. Lose Yourself — Eminem" />
      </FieldLabel>

      {/* Email (read-only) */}
      <FieldLabel label="Email">
        <input className="acct-inp" type="email" value={user?.email || ''} readOnly />
      </FieldLabel>

      {/* Data Privacy */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 8, paddingTop: 18, marginBottom: 18 }}>
        <div style={{ ...fieldEyebrow, fontSize: 10, marginBottom: 14 }}>Data Privacy</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { key: 'one_rep_max', label: '1RM records' },
            { key: 'weight',      label: 'Weight logs'  },
          ].map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.bone }}>{label}</span>
              <PrivacySelect value={privacy[key]} onChange={v => setPrivacyField(key, v)} />
            </div>
          ))}
        </div>
      </div>

      {err && <p style={{ color: '#fca5a5', fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 12 }}>{err}</p>}

      <button onClick={handleSave} disabled={saving} style={primaryBtn(saving)}>
        {saving ? '…' : saved ? '✓ Saved' : 'Save Changes'}
      </button>
    </SectionCard>
  );
}

// ─── SECTION 2: NUTRITION PREFERENCES ───────────────────────────────────────

const DIETARY_OPTIONS = [
  { value: 'no_restrictions', label: 'No restrictions' },
  { value: 'vegetarian',      label: 'Vegetarian' },
  { value: 'vegan',           label: 'Vegan' },
  { value: 'pescatarian',     label: 'Pescatarian' },
  { value: 'gluten_free',     label: 'Gluten free' },
  { value: 'dairy_free',      label: 'Dairy free' },
];
const MEAL_PLAN_OPTIONS = [
  { value: 'full',   label: 'Full meal plan with grocery list' },
  { value: 'macros', label: 'Macros and targets only' },
];
const SUPPLEMENTS_OPTIONS = [
  { value: 'include', label: 'Include supplement recommendations' },
  { value: 'no',      label: 'No supplements' },
];

function NutritionPreferencesSection({ intake, intakeLoading }) {
  const [dietary,      setDietary]      = useState('');
  const [foodsNotEat,  setFoodsNotEat]  = useState('');
  const [mealsPerDay,  setMealsPerDay]  = useState('');
  const [mealPlanType, setMealPlanType] = useState('');
  const [supplements,  setSupplements]  = useState('');
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [err,          setErr]          = useState('');

  useEffect(() => {
    if (!intake) return;
    setDietary(intake.dietary       || '');
    setFoodsNotEat(intake.foodsNotEat || '');
    setMealsPerDay(String(intake.mealsPerDay || ''));
    setMealPlanType(intake.mealPlanType || '');
    setSupplements(intake.supplements  || '');
  }, [intake]);

  async function handleSave() {
    setSaving(true); setErr(''); setSaved(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await updateNutritionPreferences(
        { dietary, foodsNotEat, mealsPerDay, mealPlanType, supplements },
        session.access_token,
      );
      setSaved(true);
    } catch (e) {
      setErr(e.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (intakeLoading) {
    return (
      <SectionCard title="Nutrition Preferences">
        <SkeletonLine width="50%" />
        <SkeletonLine width="60%" />
        <SkeletonLine width="40%" />
      </SectionCard>
    );
  }

  if (!intake) {
    return (
      <SectionCard title="Nutrition Preferences">
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash }}>
          Complete the intake form to set your nutrition preferences.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Nutrition Preferences">
      <FieldLabel label="Dietary preference">
        <select className="acct-inp" value={dietary} onChange={e => setDietary(e.target.value)}>
          <option value="">Select…</option>
          {DIETARY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </FieldLabel>

      <FieldLabel label="Meal plan type">
        <select className="acct-inp" value={mealPlanType} onChange={e => setMealPlanType(e.target.value)}>
          <option value="">Select…</option>
          {MEAL_PLAN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </FieldLabel>

      <FieldLabel label="Meals per day">
        <select className="acct-inp" value={mealsPerDay} onChange={e => setMealsPerDay(e.target.value)}>
          <option value="">Select…</option>
          {['3', '4', '5', '6'].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </FieldLabel>

      <FieldLabel label="Foods you will not eat">
        <textarea className="acct-inp"
          value={foodsNotEat} onChange={e => setFoodsNotEat(e.target.value)}
          rows={3} placeholder="e.g. mushrooms, shellfish, nuts" />
      </FieldLabel>

      <FieldLabel label="Supplement preference">
        <select className="acct-inp" value={supplements} onChange={e => setSupplements(e.target.value)}>
          <option value="">Select…</option>
          {SUPPLEMENTS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </FieldLabel>

      {saved && (
        <div style={{ background: 'rgba(74,153,104,0.08)', border: '1px solid rgba(74,153,104,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.8px', textTransform: 'uppercase', color: C.green, marginBottom: 4 }}>
            ✓ Preferences saved
          </div>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.ash, margin: 0, lineHeight: 1.5 }}>
            Your updated preferences will apply to your next 12-week plan — your current meal plan is unchanged.
          </p>
        </div>
      )}

      {err && <p style={{ color: '#fca5a5', fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 12 }}>{err}</p>}

      <button onClick={handleSave} disabled={saving} style={primaryBtn(saving)}>
        {saving ? '…' : saved ? '✓ Saved' : 'Save Preferences'}
      </button>
    </SectionCard>
  );
}

// ─── SECTION 3: MY PLAN ──────────────────────────────────────────────────────

const RENEWAL_GOALS = [
  { value: 'fat_loss',        label: 'Fat Loss' },
  { value: 'muscle_building', label: 'Lean Bulk' },
  { value: 'maintenance',     label: 'Recomposition' },
];

function MyPlanSection({ plan, intake, intakeLoading, planGeneratedAt, onPlanSwitch }) {
  const [step,      setStep]      = useState('idle');
  const [err,       setErr]       = useState('');
  const [newGoal,   setNewGoal]   = useState('fat_loss');
  const [newTarget, setNewTarget] = useState('');

  if (intakeLoading || !intake) {
    return (
      <SectionCard title="My Plan">
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
    background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12, padding: 20,
    cursor: 'pointer', transition: 'border-color 0.15s', marginBottom: 8,
  };

  return (
    <SectionCard title="My Plan">
      {startDate ? (
        <>
          {/* Progress bar */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ ...fieldEyebrow, fontSize: 10 }}>Progress — Week {weeksComplete} of 12</span>
              <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 12, letterSpacing: '0.8px', textTransform: 'uppercase', color: C.bone }}>
                {weeksRemaining > 0 ? `${weeksRemaining} Weeks Remaining` : 'Complete'}
              </span>
            </div>
            <ProgressBar progress={weeksComplete / 12} />
          </div>

          <div style={{ marginBottom: 22 }}>
            {[
              ['Started',        fmt(startDate)],
              ['Ends',           fmt(endDate)],
              ['Training Days',  trainingDays],
              ['Split',          splitLabel],
              ['Session Length', sessionLen],
            ].map(([k, v]) => (
              <div key={k} style={planRowStyle}>
                <span style={{ color: C.ash, fontFamily: "'Inter', sans-serif" }}>{k}</span>
                <span style={{ color: C.bone, fontFamily: "'Inter', sans-serif", fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{v}</span>
              </div>
            ))}
          </div>

          {step === 'idle' && (
            <>
              <button
                disabled={!planComplete}
                title={!planComplete ? 'Available after Week 12' : 'Generate a new 12-week plan'}
                style={ghostBtn({ opacity: planComplete ? 1 : 0.5, cursor: planComplete ? 'pointer' : 'default' })}
                onClick={() => planComplete && setStep('picking')}
              >
                Generate New Plan
              </button>
              {!planComplete && (
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: C.ashDim, marginTop: 8, fontStyle: 'italic' }}>
                  Available after Week 12
                </p>
              )}
            </>
          )}

          {step === 'picking' && (
            <div style={{ marginTop: 4 }}>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.ash, marginBottom: 16 }}>
                Choose how you want your next plan built:
              </p>

              <div
                style={optionCardStyle}
                onClick={() => submitRenewal(1)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.pinkLine; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
              >
                <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 18, color: C.bone, marginBottom: 6 }}>
                  Continue &amp; Evolve
                </div>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash, margin: 0, lineHeight: 1.5 }}>
                  Same goal, new structure. Exercises, split, and loading based on your 12 weeks of documented progress.
                </p>
              </div>

              <div
                style={optionCardStyle}
                onClick={() => setStep('new_direction')}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.pinkLine; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
              >
                <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 18, color: C.bone, marginBottom: 6 }}>
                  New Direction
                </div>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash, margin: 0, lineHeight: 1.5 }}>
                  Change your goal. Set a new target and get a plan built around where you want to go next.
                </p>
              </div>

              <button onClick={() => setStep('idle')} style={{ ...ghostBtn({ fontSize: 11, padding: '10px 18px' }), marginTop: 4 }}>
                Cancel
              </button>
            </div>
          )}

          {step === 'new_direction' && (
            <div style={{ marginTop: 4 }}>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.ash, marginBottom: 16 }}>
                Set your new goal:
              </p>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                <span style={{ ...fieldEyebrow, fontSize: 10 }}>New Goal</span>
                <select className="acct-inp" value={newGoal} onChange={e => setNewGoal(e.target.value)}>
                  {RENEWAL_GOALS.map(g => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                <span style={{ ...fieldEyebrow, fontSize: 10 }}>Target Weight (kg) — optional</span>
                <input className="acct-inp" type="number" min="30" max="250" step="0.5"
                  value={newTarget} onChange={e => setNewTarget(e.target.value)} placeholder="e.g. 85" />
              </label>

              {err && <p style={{ color: '#fca5a5', fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 12 }}>{err}</p>}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => submitRenewal(2)} style={primaryBtn(false)}>Generate Plan</button>
                <button onClick={() => setStep('picking')} style={ghostBtn()}>Back</button>
              </div>
            </div>
          )}

          {step === 'submitting' && (
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash, marginTop: 4 }}>
              Starting generation…
            </p>
          )}

          {step === 'queued' && (
            <div style={{ background: 'rgba(74,153,104,0.08)', border: '1px solid rgba(74,153,104,0.25)', borderRadius: 10, padding: '16px 20px', marginTop: 4 }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.8px', textTransform: 'uppercase', color: C.green, marginBottom: 6 }}>
                ✓ Your new plan is being built
              </div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash, margin: '0 0 12px', lineHeight: 1.5 }}>
                This takes 60–90 seconds. Come back to the Plan tab in a moment — it'll be there.
              </p>
              <button
                onClick={() => { onPlanSwitch?.(); setStep('idle'); }}
                style={{ background: 'none', border: '1px solid rgba(74,153,104,0.4)', color: C.green, fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', padding: '8px 16px', cursor: 'pointer', borderRadius: 8 }}
              >
                Check for my plan →
              </button>
            </div>
          )}

          {step === 'error' && (
            <p style={{ color: '#fca5a5', fontSize: 12, fontFamily: "'Inter', sans-serif", marginTop: 4 }}>{err}</p>
          )}
        </>
      ) : (
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash }}>
          No start date set. Complete your intake form to begin.
        </p>
      )}
    </SectionCard>
  );
}

// ─── SECTION 4: MY PLANS ─────────────────────────────────────────────────────

const PLAN_GOAL_LABELS = { fat_loss: 'Fat Loss', muscle_building: 'Lean Bulk', maintenance: 'Recomposition' };
const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const planEndDate = d => new Date(new Date(d).getTime() + 84 * 86400000);

function MyPlansSection({ isUnlocked, onPlanSwitch }) {
  const [plans,      setPlans]      = useState(null);
  const [activating, setActivating] = useState(null);
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
    <SectionCard title="My Plans">
      {plans === null && !plansErr ? (
        <>
          <SkeletonLine width="60%" />
          <SkeletonLine width="50%" />
        </>
      ) : plansErr ? (
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#fca5a5' }}>{plansErr}</p>
      ) : plans.length === 0 ? (
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash }}>No plans yet.</p>
      ) : (
        <>
          {[...plans].reverse().map(p => (
            <div key={p.id} style={{ padding: '18px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 15, textTransform: 'uppercase', color: C.bone, lineHeight: 1, marginBottom: 4 }}>
                    Plan {p.plan_number}
                  </div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.ashDim, marginBottom: 10 }}>
                    {fmtDate(p.generated_at)} – {fmtDate(planEndDate(p.generated_at))}
                  </div>
                </div>
                {p.is_active && (
                  <span style={{
                    background: C.surface2, border: `1px solid ${C.pinkLine}`, borderRadius: 7,
                    padding: '5px 11px', fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700,
                    letterSpacing: '1px', textTransform: 'uppercase', color: C.bone,
                    boxShadow: `0 0 12px -4px ${C.pinkGlow}`, flexShrink: 0,
                  }}>
                    Active
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 13, marginBottom: p.is_active ? 0 : 12 }}>
                {p.goal && (
                  <div>
                    <div style={{ ...fieldEyebrow, fontSize: 9, marginBottom: 3 }}>Goal</div>
                    <div style={{ fontFamily: "'Inter', sans-serif", color: C.ash }}>{PLAN_GOAL_LABELS[p.goal] || p.goal}</div>
                  </div>
                )}
                {p.split && (
                  <div>
                    <div style={{ ...fieldEyebrow, fontSize: 9, marginBottom: 3 }}>Split</div>
                    <div style={{ fontFamily: "'Inter', sans-serif", color: C.ash }}>{p.split}</div>
                  </div>
                )}
                {p.training_days && (
                  <div>
                    <div style={{ ...fieldEyebrow, fontSize: 9, marginBottom: 3 }}>Days / Week</div>
                    <div style={{ fontFamily: "'Inter', sans-serif", color: C.ash }}>{p.training_days}</div>
                  </div>
                )}
              </div>

              {!p.is_active && (
                <button
                  onClick={() => handleActivate(p.id)}
                  disabled={!!activating}
                  style={{ ...ghostBtn({ fontSize: 11, padding: '10px 18px' }), opacity: activating === p.id ? 0.55 : 1 }}
                >
                  {activating === p.id ? '…' : 'Make Active'}
                </button>
              )}
            </div>
          ))}
          {plansErr && (
            <p style={{ color: '#fca5a5', fontSize: 12, fontFamily: "'Inter', sans-serif", marginTop: 10 }}>{plansErr}</p>
          )}
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: C.ashDim, marginTop: 12, fontStyle: 'italic' }}>
            Switching takes effect immediately across Today, Plan, and Nutrition tabs.
          </p>
        </>
      )}
    </SectionCard>
  );
}

// ─── SECTION 5: SUBSCRIPTION ─────────────────────────────────────────────────

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
    <SectionCard title="Subscription &amp; Billing">
      {/* Status row */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 17, textTransform: 'uppercase', color: C.bone, marginBottom: 10, lineHeight: 1 }}>
          {isUnlocked ? 'Monthly Subscriber' : 'Free'}
        </div>
        {/* Green badge for active — intentional, matches 'positive status' meaning */}
        <span style={{
          display: 'inline-block', borderRadius: 7,
          padding: '6px 14px',
          fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700,
          letterSpacing: '1px', textTransform: 'uppercase',
          background: isUnlocked ? 'rgba(74,153,104,0.1)' : 'rgba(255,255,255,0.05)',
          border: isUnlocked ? `1px solid ${C.greenLine}` : '1px solid rgba(255,255,255,0.08)',
          color: isUnlocked ? C.green : C.ashDim,
          boxShadow: isUnlocked ? `0 0 14px -6px ${C.greenGlow}` : 'none',
        }}>
          {isUnlocked ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </div>

      {isUnlocked ? (
        <>
          {billingDate && (
            <div style={{ ...planRowStyle, marginBottom: 16 }}>
              <span style={{ color: C.ash, fontFamily: "'Inter', sans-serif" }}>Next billing date</span>
              <span style={{ color: C.bone, fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>{billingDate}</span>
            </div>
          )}

          {portalErr && <p style={{ color: '#fca5a5', fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 12 }}>{portalErr}</p>}

          <button onClick={handlePortal} disabled={portalLoading} style={ghostBtn()}>
            {portalLoading ? '…' : 'Manage Billing →'}
          </button>

          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: C.ashDim, marginTop: 14, lineHeight: 1.6 }}>
            To cancel your subscription, use the Manage Billing link above.
          </p>
        </>
      ) : (
        <div style={{
          background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
          border: `1px solid ${C.pinkLine}`,
          borderRadius: 12, padding: 20,
          boxShadow: `0 0 18px -12px ${C.pinkGlow}`,
        }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, color: C.ash, marginBottom: 8 }}>
            Unlock Progress Tracking, Achievements, Logbook and more
          </div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 32, color: C.bone, lineHeight: 1, marginBottom: 16 }}>
            £9.99<span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500, color: C.ash }}>/month</span>
          </div>
          <button onClick={onUnlock} style={primaryBtn()}>Upgrade Now</button>
        </div>
      )}
    </SectionCard>
  );
}

// ─── EMAIL TESTING CARD ───────────────────────────────────────────────────────

function EmailTestingCard() {
  const [status, setStatus] = useState(null);
  const [msg, setMsg]       = useState('');

  async function handleSend() {
    setStatus('sending'); setMsg('');
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
    <div style={{ ...cardStyle, padding: '20px 26px' }}>
      <div style={{ ...fieldEyebrow, marginBottom: 14 }}>Email Testing</div>
      <button onClick={handleSend} disabled={status === 'sending'}
        style={{ ...ghostBtn({ opacity: status === 'sending' ? 0.55 : 1 }) }}>
        {status === 'sending' ? 'Sending…' : 'Send Test Weekly Email'}
      </button>
      {status === 'ok' && (
        <p style={{ margin: '12px 0 0', fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.green }}>
          ✓ Test email sent — check your inbox ({msg})
        </p>
      )}
      {status === 'error' && (
        <p style={{ margin: '12px 0 0', fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#fca5a5' }}>{msg}</p>
      )}
    </div>
  );
}

// ─── SECTION 6: SETTINGS & PRIVACY ───────────────────────────────────────────

function SettingsSection({ user }) {
  const [reminders,     setReminders]     = useState(true);
  const [weighIn,       setWeighIn]       = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [checkinDay,    setCheckinDay]    = useState(0);
  const [units,         setUnits]         = useState('kg');
  const [savedKey,      setSavedKey]      = useState(null);
  const [showDelete,    setShowDelete]    = useState(false);
  const [deleting,      setDeleting]      = useState(false);

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

  // Active state for day pills and unit toggle — pink lift+glow
  const activeOptStyle = {
    background: 'linear-gradient(160deg, #1A1722, #100E15)',
    color: C.bone,
    border: `1px solid ${C.pinkLine}`,
    boxShadow: `0 0 14px -4px ${C.pinkGlow}`,
  };
  const inactiveOptStyle = {
    background: C.surface2,
    color: C.ash,
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: 'none',
  };

  return (
    <>
      <SectionCard title="Settings">
        {/* Notification toggles */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ ...fieldEyebrow, marginBottom: 0 }}>Notifications</div>
          <Toggle label="Session reminders"             checked={reminders}     onChange={v => handleToggle('session_reminders', setReminders,     v)} saved={savedKey === 'session_reminders'} />
          <Toggle label="Daily weigh-in reminder"       checked={weighIn}       onChange={v => handleToggle('daily_weigh_in',    setWeighIn,       v)} saved={savedKey === 'daily_weigh_in'} />
          <Toggle label="Weekly progress summary email" checked={weeklySummary} onChange={v => handleToggle('weekly_summary',    setWeeklySummary, v)} saved={savedKey === 'weekly_summary'} />
        </div>

        {/* Check-in day picker */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 0 }}>
            <div style={{ ...fieldEyebrow }}>Weekly Check-In Day</div>
            {savedKey === 'checkin_day' && (
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: C.green }}>✓ Saved</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {CHECKIN_DAYS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => handleCheckinDayChange(value)}
                style={{
                  padding: '11px 16px', borderRadius: 8,
                  fontFamily: "'Oswald', sans-serif", fontWeight: 600,
                  fontSize: 12, letterSpacing: '0.8px', textTransform: 'uppercase',
                  cursor: 'pointer', minHeight: 36, transition: 'all 0.2s',
                  ...(checkinDay === value ? activeOptStyle : inactiveOptStyle),
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: C.ashDim, fontStyle: 'italic', margin: '12px 0 0', lineHeight: 1.5 }}>
            This is the day your AI coaching check-in and weekly progress summary will appear. You can change this any time.
          </p>
        </div>

        {/* Unit preference */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ ...fieldEyebrow, marginBottom: 14 }}>Weight Units</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['kg', 'lbs'].map(u => (
              <button
                key={u}
                onClick={() => handleUnits(u)}
                style={{
                  flex: 1, textAlign: 'center', padding: 13, borderRadius: 9,
                  fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 13,
                  textTransform: 'uppercase', letterSpacing: '0.8px', cursor: 'pointer',
                  transition: 'all 0.2s',
                  ...(units === u ? activeOptStyle : inactiveOptStyle),
                }}
              >
                {u.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Support & legal links */}
        <div>
          <div style={{ ...fieldEyebrow, marginBottom: 0 }}>Support &amp; Legal</div>
          {[
            { label: 'Privacy Policy',   href: '/privacy' },
            { label: 'Terms of Service', href: '/terms' },
            { label: 'Contact Support',  href: 'mailto:support@plus4performance.com' },
          ].map(({ label, href }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 14.5, cursor: 'pointer' }}>
              <a
                href={href}
                style={{ color: C.ash, fontFamily: "'Inter', sans-serif", textDecoration: 'none' }}
                onMouseEnter={e => { e.currentTarget.style.color = C.bone; }}
                onMouseLeave={e => { e.currentTarget.style.color = C.ash; }}
              >
                {label}
              </a>
              <span style={{ color: C.ashDim, fontSize: 12 }}>→</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Email testing — dev / ?debug=true only */}
      {(import.meta.env.DEV || new URLSearchParams(window.location.search).get('debug') === 'true') && (
        <EmailTestingCard />
      )}

      {/* Danger Zone — intentional red exception, reserved for destructive action */}
      <div style={{
        background: 'linear-gradient(160deg, #1A0F0E, #120A09)',
        border: `1px solid ${C.redLine}`,
        borderRadius: 16, padding: 24, marginBottom: 22,
        boxShadow: `0 0 24px -12px ${C.redGlow}`,
      }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#E05A4A', marginBottom: 10 }}>
          Danger Zone
        </div>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: C.ash, lineHeight: 1.5, margin: '0 0 18px' }}>
          Permanently delete your account and all associated data. This cannot be undone.
        </p>
        <button
          onClick={() => setShowDelete(true)}
          style={{
            background: 'linear-gradient(160deg, #6B1F18, #4A140F)',
            border: `1px solid ${C.redLine}`,
            color: '#F0D5D0', borderRadius: 10,
            fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 12.5,
            letterSpacing: '1.2px', textTransform: 'uppercase',
            padding: '14px 24px', cursor: 'pointer', minHeight: 44,
            boxShadow: `0 8px 20px -8px ${C.redGlow}`,
          }}
        >
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

// ─── SECTION 7: HELP & FAQ ───────────────────────────────────────────────────

function HelpSection() {
  const [openKeys, setOpenKeys] = useState(new Set());

  function toggle(key) {
    setOpenKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <SectionCard title="Help &amp; FAQ">
      {FAQ_SECTIONS.map((section, si) => (
        <div key={si} style={{ marginBottom: si < FAQ_SECTIONS.length - 1 ? 24 : 0 }}>
          {/* Category label — grey */}
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, letterSpacing: '1.5px', color: C.ashDim, textTransform: 'uppercase', margin: si === 0 ? '0 0 8px' : '22px 0 8px' }}>
            {section.heading}
          </div>
          {section.items.map((item, qi) => {
            const key    = `${si}:${qi}`;
            const isOpen = openKeys.has(key);
            return (
              <div key={qi} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-expanded={isOpen}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, background: 'none', border: 'none', cursor: 'pointer', padding: '15px 0', textAlign: 'left', minHeight: 44 }}
                >
                  {/* Question text — white/bone */}
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14.5, color: C.bone, flex: 1, lineHeight: 1.4 }}>
                    {item.q}
                  </span>
                  {/* Plus/minus icon — grey */}
                  <span style={{ color: C.ashDim, fontSize: 20, lineHeight: 1, flexShrink: 0, fontWeight: 300, marginTop: 1, transition: 'transform 0.25s' }}>
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
                {isOpen && (
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash, lineHeight: 1.7, paddingBottom: 14, paddingRight: 24 }}>
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16, marginTop: 20, textAlign: 'center' }}>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ashDim, margin: 0 }}>
          Still have a question?{' '}
          <a href="mailto:hello@plus4performance.com" style={{ color: C.bone, textDecoration: 'none' }}>
            hello@plus4performance.com
          </a>
        </p>
      </div>
    </SectionCard>
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
      <ProfileSection             user={user} intake={intake} intakeLoading={intakeLoading} />
      <NutritionPreferencesSection intake={intake} intakeLoading={intakeLoading} />
      <MyPlanSection              plan={plan} intake={intake} intakeLoading={intakeLoading} planGeneratedAt={planGeneratedAt} onPlanSwitch={onPlanSwitch} />
      <MyPlansSection      isUnlocked={isUnlocked} onPlanSwitch={onPlanSwitch} />
      <SubscriptionSection isUnlocked={isUnlocked} subRow={subRow} user={user} onUnlock={onUnlock} />
      <SettingsSection    user={user} />
      <HelpSection />
    </div>
  );
}
