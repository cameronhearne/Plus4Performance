import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { Camera, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { unlockAchievement, hasConsecutiveDays } from '../lib/achievements';
import { logOneRm } from '../lib/api';

/*
  ─── SQL — run once in Supabase SQL editor ────────────────────────────────────

  -- Weight logs
  create table weight_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    weight_kg numeric(5,2) not null,
    logged_at timestamptz not null default now()
  );
  alter table weight_logs enable row level security;
  create policy "Users manage own logs" on weight_logs
    for all using (auth.uid() = user_id);

  -- Progress photos
  create table progress_photos (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    view text not null,
    storage_path text not null,
    photo_url text not null,
    taken_at timestamptz not null default now()
  );
  alter table progress_photos enable row level security;
  create policy "photos_all" on progress_photos
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  grant all on progress_photos to authenticated;

  -- Storage bucket (private)
  insert into storage.buckets (id, name, public)
    values ('progress-photos', 'progress-photos', false);

  -- Storage object policies
  create policy "Users can upload own photos"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1]);

  create policy "Users can view own photos"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1]);

  -- Body measurements
  create table body_measurements (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    chest_cm numeric(5,1),
    waist_cm numeric(5,1),
    hips_cm numeric(5,1),
    left_arm_cm numeric(5,1),
    right_arm_cm numeric(5,1),
    left_thigh_cm numeric(5,1),
    right_thigh_cm numeric(5,1),
    logged_at timestamptz not null default now()
  );
  alter table body_measurements enable row level security;
  create policy "measurements_all" on body_measurements
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  grant all on body_measurements to authenticated;

  -- 1RM tracker
  create table one_rep_maxes (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    lift text not null, -- 'bench_press', 'squat', 'deadlift', 'overhead_press'
    weight_kg numeric(5,2) not null,
    is_calculated boolean not null default false,
    logged_at timestamptz not null default now()
  );
  alter table one_rep_maxes enable row level security;
  create policy "orm_all" on one_rep_maxes
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  grant all on one_rep_maxes to authenticated;

  ─────────────────────────────────────────────────────────────────────────────
*/

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const VIEWS = ['front', 'side', 'back'];

const MEASURE_FIELDS = [
  { key: 'chest_cm',       label: 'Chest (cm)'       },
  { key: 'waist_cm',       label: 'Waist (cm)'       },
  { key: 'hips_cm',        label: 'Hips (cm)'        },
  { key: 'left_arm_cm',    label: 'Left Arm (cm)'    },
  { key: 'right_arm_cm',   label: 'Right Arm (cm)'   },
  { key: 'left_thigh_cm',  label: 'Left Thigh (cm)'  },
  { key: 'right_thigh_cm', label: 'Right Thigh (cm)' },
];

const LIFTS = [
  { key: 'bench_press',    name: 'Bench Press'    },
  { key: 'squat',          name: 'Squat'          },
  { key: 'deadlift',       name: 'Deadlift'       },
  { key: 'overhead_press', name: 'Overhead Press' },
];

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
// Taken from p4p-progress-prototype-v2.html.
//
// Three accent colours — each used in exactly one role:
//   Pink  → buttons, card borders/glow (never text)
//   Purple → chart line + dots only     (never text)
//   Green  → To Go stat card border/glow only (never text)

const C = {
  surface:     '#131119',
  surface2:    '#0C0A0F',
  bone:        '#F3F1ED',
  ash:         '#ABA9B0',     // prototype --ash
  ashDim:      '#7A7880',     // prototype --ash-dim
  pinkGlow:    'rgba(255,79,196,0.5)',
  pinkLine:    'rgba(255,79,196,0.22)',
  pinkBorder:  'rgba(255,79,196,0.1)',
  purple:      '#C961F5',     // prototype --purple-bright
  purpleGlow:  'rgba(155,47,224,0.28)',
  greenBorder: 'rgba(74,153,104,0.35)',
  greenGlow:   'rgba(74,153,104,0.4)',
};

// Standard dark-gradient card with pink border
const card = {
  background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
  border: `1px solid ${C.pinkBorder}`,
  borderRadius: 16,
  boxShadow: `0 12px 30px -16px rgba(0,0,0,0.55), 0 0 22px -14px ${C.pinkGlow}, 0 1px 0 rgba(255,255,255,0.03) inset`,
  padding: 22,
  marginBottom: 18,
};

// CTA button — matches prototype .cta
const ctaBtn = {
  background: 'linear-gradient(160deg, #18151F, #100E15)',
  border: `1px solid ${C.pinkLine}`,
  color: C.bone,
  borderRadius: 10,
  padding: '14px 24px',
  fontFamily: "'Oswald', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: '1.4px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  boxShadow: `0 8px 22px -8px ${C.pinkGlow}`,
  whiteSpace: 'nowrap',
};

// Secondary / quiet button — matches prototype .pr-btn.secondary
const secondaryBtn = {
  width: '100%',
  background: C.surface2,
  border: '1px solid rgba(255,255,255,0.08)',
  color: C.ash,
  borderRadius: 9,
  padding: '11px 0',
  fontFamily: "'Oswald', sans-serif",
  fontWeight: 600,
  fontSize: 11,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  boxShadow: 'none',
  display: 'block',
  textAlign: 'center',
};

// Ghost / tertiary button (cancel, edit)
const ghostBtn = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.12)',
  color: C.ash,
  borderRadius: 9,
  padding: '10px 20px',
  fontFamily: "'Oswald', sans-serif",
  fontWeight: 600,
  fontSize: 11,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  cursor: 'pointer',
};

// Eyebrow / card-label (11px ash-dim uppercase)
const cardLabel = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '1.6px',
  textTransform: 'uppercase',
  color: C.ashDim,
  marginBottom: 16,
};

// Field input (prototype .pr-field input)
const numInput = {
  width: '100%',
  background: C.surface2,
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  padding: '11px 12px',
  color: C.bone,
  fontSize: 14,
  fontFamily: "'Roboto Mono', monospace",
  outline: 'none',
  boxSizing: 'border-box',
};

// ─── GOAL-AWARE DELTA COLOUR ─────────────────────────────────────────────────

// Returns a text colour for a weight-change label.
// Per spec: no pink, no red, no green as text — only bone/grey.
function deltaColor(delta, goal) {
  if (delta == null || Math.abs(delta) < 0.05) return C.ashDim;
  const gained = delta > 0;
  if (goal === 'lean_bulk' || goal === 'muscle_building') return gained ? C.bone : C.ash;
  if (goal === 'maintenance') return Math.abs(delta) <= 1 ? C.bone : C.ash;
  return gained ? C.ash : C.bone; // fat_loss: loss = good = bone, gain = ash
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function isToday(timestamptz) {
  const d = new Date(timestamptz);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtDateFull(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function hasThreeConsecutiveWeekImprovement(entries) {
  if (!entries || entries.length < 3) return false;
  const weekBest = {};
  entries.forEach(e => {
    const d = new Date(e.logged_at);
    const daysSinceMonday = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - daysSinceMonday);
    const key = monday.toISOString().split('T')[0];
    if (!weekBest[key] || e.weight_kg > weekBest[key]) weekBest[key] = e.weight_kg;
  });
  const weeks = Object.entries(weekBest)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, kg]) => kg);
  if (weeks.length < 3) return false;
  const last = weeks.slice(-3);
  return last[1] > last[0] && last[2] > last[1];
}

// ─── CHART TOOLTIP ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
      border: `1px solid ${C.pinkBorder}`,
      borderRadius: 8, padding: '10px 16px',
      boxShadow: '0 8px 18px -8px rgba(0,0,0,0.7)',
    }}>
      <div style={{ ...cardLabel, marginBottom: 4, fontSize: 10 }}>{fmtDate(label)}</div>
      <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 22, fontWeight: 600, color: C.bone, lineHeight: 1 }}>
        {payload[0].value} <span style={{ fontSize: 13, color: C.ash, fontWeight: 400 }}>kg</span>
      </div>
    </div>
  );
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, variant = 'default' }) {
  const styles = {
    default: {
      flex: 1, borderRadius: 14, padding: 18,
      background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
      border: '1px solid rgba(255,255,255,0.07)',
      boxShadow: '0 10px 24px -14px rgba(0,0,0,0.5)',
    },
    current: {
      flex: 1, borderRadius: 14, padding: 18,
      background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
      border: `1px solid ${C.pinkLine}`,
      boxShadow: `0 10px 24px -14px rgba(0,0,0,0.5), 0 0 20px -10px ${C.pinkGlow}`,
    },
    toGo: {
      flex: 1, borderRadius: 14, padding: 18,
      background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
      border: `1px solid ${C.greenBorder}`,
      boxShadow: `0 10px 24px -14px rgba(0,0,0,0.5), 0 0 22px -10px ${C.greenGlow}, 0 1px 0 rgba(255,255,255,0.03) inset`,
    },
  };
  return (
    <div style={styles[variant]}>
      <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 22, fontWeight: 600, color: C.bone, lineHeight: 1, marginBottom: 6 }}>
        {value}
      </div>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 10.5, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: C.ashDim }}>
        {label}
      </div>
      {sub && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: C.ashDim, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── CHECK-IN MODAL ──────────────────────────────────────────────────────────

function CheckInModal({ todayLog, onClose, onSaved }) {
  const [lastMeasurements, setLastMeasurements] = useState(null);
  const [weightVal, setWeightVal]               = useState(todayLog?.weight_kg?.toString() || '');
  const [form, setForm]                         = useState({});
  const [photoFiles, setPhotoFiles]             = useState({});
  const [photoPreviews, setPhotoPreviews]       = useState({});
  const [saving, setSaving]                     = useState(false);
  const [error, setError]                       = useState('');
  const fileRefs = useRef({});
  const blobUrls = useRef([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('body_measurements').select('*').eq('user_id', user.id)
        .order('logged_at', { ascending: false }).limit(1).maybeSingle();
      setLastMeasurements(data);
    }
    load();
    return () => { blobUrls.current.forEach(u => URL.revokeObjectURL(u)); };
  }, []);

  function handleFileChange(view, file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    blobUrls.current.push(url);
    setPhotoPreviews(prev => ({ ...prev, [view]: url }));
    setPhotoFiles(prev => ({ ...prev, [view]: file }));
  }

  async function handleSave() {
    setSaving(true); setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setError('Not authenticated.'); return; }
    const now = new Date().toISOString();
    const errors = [];

    const kg = parseFloat(weightVal);
    const validWeight = weightVal !== '' && kg >= 20 && kg <= 400;
    let isNewWeightLog = false;
    if (validWeight) {
      if (todayLog) {
        const { error: e } = await supabase.from('weight_logs').update({ weight_kg: kg }).eq('id', todayLog.id).eq('user_id', user.id);
        if (e) errors.push(`Weight: ${e.message}`);
      } else {
        const { error: e } = await supabase.from('weight_logs').insert({ user_id: user.id, weight_kg: kg, logged_at: now });
        if (e) errors.push(`Weight: ${e.message}`);
        else isNewWeightLog = true;
      }
    }
    if (isNewWeightLog) {
      const { data: allLogs } = await supabase.from('weight_logs').select('logged_at, weight_kg').eq('user_id', user.id).order('logged_at', { ascending: true });
      if (allLogs) {
        if (allLogs.length === 1) await unlockAchievement(supabase, user.id, 'first_checkin', 10);
        if (allLogs.length >= 2) {
          const diff = allLogs[0].weight_kg - allLogs[allLogs.length - 1].weight_kg;
          if (diff >= 1) await unlockAchievement(supabase, user.id, 'moving_needle', 100);
        }
        if (hasConsecutiveDays(allLogs, 30)) await unlockAchievement(supabase, user.id, 'consistent', 200);
      }
    }

    const hasAny = MEASURE_FIELDS.some(f => form[f.key] != null && form[f.key] !== '');
    if (hasAny) {
      const row = { user_id: user.id, logged_at: now };
      MEASURE_FIELDS.forEach(f => { if (form[f.key] != null && form[f.key] !== '') row[f.key] = parseFloat(form[f.key]); });
      const { error: e } = await supabase.from('body_measurements').insert(row);
      if (e) errors.push(`Measurements: ${e.message}`);
    }

    const photoEntries = Object.entries(photoFiles);
    if (photoEntries.length > 0) {
      const { count: existingCount } = await supabase.from('progress_photos').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      let uploadedCount = 0;
      for (const [view, file] of photoEntries) {
        const path = `${user.id}/${Date.now()}_${view}.jpg`;
        const { error: upErr } = await supabase.storage.from('progress-photos').upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) { errors.push(`Photo ${view}: ${upErr.message}`); continue; }
        const { data: urlData } = await supabase.storage.from('progress-photos').createSignedUrl(path, 31536000);
        const { error: dbErr } = await supabase.from('progress_photos').insert({ user_id: user.id, view, storage_path: path, photo_url: urlData?.signedUrl || '', taken_at: now });
        if (!dbErr) uploadedCount++;
        else errors.push(`Photo DB ${view}: ${dbErr.message}`);
      }
      if (existingCount === 0 && uploadedCount > 0) await unlockAchievement(supabase, user.id, 'picture_perfect', 50);
      const { data: allDates } = await supabase.from('progress_photos').select('taken_at').eq('user_id', user.id).order('taken_at', { ascending: true });
      if (allDates && allDates.length >= 2) {
        const span = (new Date(allDates[allDates.length - 1].taken_at) - new Date(allDates[0].taken_at)) / 86400000;
        if (span >= 77) await unlockAchievement(supabase, user.id, 'transformation', 300);
      }
    }

    setSaving(false);
    if (errors.length > 0) setError(errors.join('. '));
    else onSaved();
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto' }}
    >
      <style>{`
        .ci-wrap { width: 100%; max-width: 560px; padding: 20px; box-sizing: border-box; }
        .ci-inner {
          background: linear-gradient(160deg, #131119 0%, #0C0A0F 100%);
          border: 1px solid rgba(255,79,196,0.1);
          border-radius: 16px; padding: 28px;
          box-shadow: 0 24px 48px -16px rgba(0,0,0,0.8), 0 0 30px -16px rgba(255,79,196,0.5);
        }
        @media (max-width: 600px) {
          .ci-wrap  { padding: 0; max-width: 100%; }
          .ci-inner { border: none; border-radius: 0; min-height: 100vh; padding: 20px; box-shadow: none; }
        }
      `}</style>

      <div className="ci-wrap" onClick={e => e.stopPropagation()}>
        <div className="ci-inner">

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ ...cardLabel, marginBottom: 0 }}>Log Check-In</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.ashDim, cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 4, minHeight: 44, minWidth: 44 }}>✕</button>
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.ashDim, marginBottom: 28 }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>

          {/* Weight */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '1.6px', textTransform: 'uppercase', color: C.ashDim, marginBottom: 10 }}>Weight (kg)</div>
            <div style={{ position: 'relative', maxWidth: 200 }}>
              <input
                type="number" step="0.1" min="20" max="400"
                value={weightVal} onChange={e => setWeightVal(e.target.value)}
                placeholder="e.g. 84.5"
                style={{ ...numInput, fontSize: 22, padding: '12px 48px 12px 14px' }}
              />
              <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: C.ashDim, fontFamily: "'Oswald', sans-serif", fontSize: 12, pointerEvents: 'none' }}>kg</span>
            </div>
          </div>

          {/* Body Measurements */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '1.6px', textTransform: 'uppercase', color: C.ashDim, marginBottom: 6 }}>Body Measurements</div>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.ashDim, fontStyle: 'italic', margin: '0 0 14px' }}>Optional — update whenever you want to track your changes.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
              {MEASURE_FIELDS.map(f => (
                <div key={f.key}>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '1.4px', textTransform: 'uppercase', color: C.ashDim, marginBottom: 5 }}>{f.label}</div>
                  <input
                    type="number" step="0.1" min="0"
                    value={form[f.key] || ''}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={lastMeasurements?.[f.key] != null ? String(lastMeasurements[f.key]) : '—'}
                    style={{ ...numInput, fontSize: 15 }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Progress Photos */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '1.6px', textTransform: 'uppercase', color: C.ashDim, marginBottom: 6 }}>Progress Photos</div>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.ashDim, fontStyle: 'italic', margin: '0 0 14px' }}>Optional — update whenever you want to track your changes.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {VIEWS.map(view => {
                const preview = photoPreviews[view];
                return (
                  <div key={view} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div
                      onClick={() => fileRefs.current[view]?.click()}
                      style={{ width: 140, height: 186, border: preview ? 'none' : '1px dashed rgba(255,79,196,0.2)', background: C.surface2, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden', flexShrink: 0 }}
                    >
                      {preview
                        ? <img src={preview} alt={view} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <>
                            <Camera size={28} color={C.ashDim} />
                            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.ashDim, marginTop: 8 }}>{view.toUpperCase()}</div>
                          </>
                      }
                    </div>
                    <input ref={el => { fileRefs.current[view] = el; }} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(view, f); e.target.value = ''; }} />
                  </div>
                );
              })}
            </div>
          </div>

          {error && <p style={{ color: '#fca5a5', fontSize: 12, fontFamily: "'Inter', sans-serif", marginBottom: 12 }}>{error}</p>}

          <button onClick={handleSave} disabled={saving}
            style={{ ...ctaBtn, width: '100%', textAlign: 'center', padding: '16px 20px', opacity: saving ? 0.6 : 1, boxShadow: `0 10px 28px -8px ${C.pinkGlow}` }}>
            {saving ? 'Saving…' : 'Save Check-In'}
          </button>

        </div>
      </div>
    </div>
  );
}

// ─── CHECK-IN HISTORY ────────────────────────────────────────────────────────

function CheckInHistory({ refreshKey, goal }) {
  const [checkIns, setCheckIns] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(new Set());
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [{ data: weights }, { data: measurements }, { data: photos }] = await Promise.all([
        supabase.from('weight_logs').select('id, weight_kg, logged_at').eq('user_id', user.id).order('logged_at', { ascending: true }),
        supabase.from('body_measurements').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }),
        supabase.from('progress_photos').select('id, view, storage_path, taken_at').eq('user_id', user.id).order('taken_at', { ascending: false }),
      ]);

      let photosWithUrls = [];
      if (photos && photos.length > 0) {
        const { data: signed } = await supabase.storage.from('progress-photos').createSignedUrls(photos.map(p => p.storage_path), 31536000);
        const urlMap = Object.fromEntries((signed || []).map(s => [s.path, s.signedUrl]));
        photosWithUrls = photos.map(p => ({ ...p, signedUrl: urlMap[p.storage_path] || null }));
      }

      const byDate = {};
      function ensure(d) { if (!byDate[d]) byDate[d] = { date: d, weights: [], measurements: [], photos: [] }; }
      (weights || []).forEach(w => { const d = new Date(w.logged_at).toISOString().split('T')[0]; ensure(d); byDate[d].weights.push(w); });
      (measurements || []).forEach(m => { const d = new Date(m.logged_at).toISOString().split('T')[0]; ensure(d); byDate[d].measurements.push(m); });
      photosWithUrls.forEach(p => { const d = new Date(p.taken_at).toISOString().split('T')[0]; ensure(d); byDate[d].photos.push(p); });

      const sorted = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].weights.length > 0) {
          for (let j = i + 1; j < sorted.length; j++) {
            if (sorted[j].weights.length > 0) { sorted[i].weightDelta = sorted[i].weights[0].weight_kg - sorted[j].weights[0].weight_kg; break; }
          }
        }
      }

      setCheckIns(sorted);
      setLoading(false);
    }
    fetchHistory();
  }, [refreshKey]);

  function toggleExpand(date) {
    setExpanded(prev => { const next = new Set(prev); if (next.has(date)) next.delete(date); else next.add(date); return next; });
  }

  if (loading || checkIns.length === 0) return null;

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: C.bone, marginBottom: 14 }}>
        Check-In History
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {checkIns.map(ci => {
          const isOpen      = expanded.has(ci.date);
          const weight      = ci.weights[0] || null;
          const measurement = ci.measurements[0] || null;
          const measureCount = measurement ? MEASURE_FIELDS.filter(f => measurement[f.key] != null).length : 0;

          return (
            <div key={ci.date} style={{ background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`, border: `1px solid ${C.pinkBorder}`, borderRadius: 14, overflow: 'hidden' }}>

              <button
                onClick={() => toggleExpand(ci.date)}
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '18px 22px', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, fontWeight: 600, color: C.bone, marginBottom: 4 }}>
                    {fmtDateFull(ci.date)}
                  </div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash }}>
                    {weight && <><strong style={{ color: C.bone }}>{weight.weight_kg} KG</strong>{(measureCount > 0 || ci.photos.length > 0) ? ' · ' : ''}</>}
                    {measureCount > 0 && <>{measureCount} measurement{measureCount !== 1 ? 's' : ''}</>}
                    {measureCount > 0 && ci.photos.length > 0 && ' · '}
                    {ci.photos.length > 0 && <>{ci.photos.length} photo{ci.photos.length !== 1 ? 's' : ''}</>}
                  </div>
                </div>
                <span style={{ color: C.ashDim, marginLeft: 12, flexShrink: 0 }}>
                  {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </span>
              </button>

              {isOpen && (
                <div style={{ padding: '0 22px 22px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>

                  {weight && (
                    <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 32, fontWeight: 600, color: C.bone, lineHeight: 1 }}>
                        {weight.weight_kg} kg
                      </span>
                      {ci.weightDelta != null && (
                        <span style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 15, fontWeight: 500, color: deltaColor(ci.weightDelta, goal) }}>
                          {ci.weightDelta > 0 ? '+' : ''}{ci.weightDelta.toFixed(1)} kg
                        </span>
                      )}
                    </div>
                  )}

                  {measurement && measureCount > 0 && (
                    <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                      {MEASURE_FIELDS.map(f => {
                        const val = measurement[f.key];
                        if (val == null) return null;
                        return (
                          <div key={f.key} style={{ fontFamily: "'Inter', sans-serif", fontSize: 13 }}>
                            <span style={{ color: C.bone, fontWeight: 600 }}>{val}cm</span>
                            <span style={{ color: C.ash, marginLeft: 6 }}>{f.label.split(' (')[0]}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {ci.photos.length > 0 && (
                    <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {ci.photos.map(p => (
                        <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <img src={p.signedUrl} alt={p.view} onClick={() => setLightbox(p.signedUrl)}
                            style={{ width: 80, height: 107, objectFit: 'cover', cursor: 'pointer', display: 'block', borderRadius: 4 }} />
                          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.ashDim }}>{p.view}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <img src={lightbox} alt="Full size" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}

// ─── 1RM LIFT CARD ───────────────────────────────────────────────────────────

function LiftCard({ liftName, liftKey }) {
  const [entries,     setEntries]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [maxInput,    setMaxInput]    = useState('');
  const [calcWeight,  setCalcWeight]  = useState('');
  const [calcReps,    setCalcReps]    = useState('');
  const [calcResult,  setCalcResult]  = useState(null);
  const [savingManual, setSavingManual] = useState(false);
  const [savingCalc,   setSavingCalc]   = useState(false);
  const [feedback,    setFeedback]    = useState(null);
  const [glowing,     setGlowing]     = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [deletingId,  setDeletingId]  = useState(null);

  useEffect(() => { fetchEntries(); }, []);

  async function fetchEntries() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from('one_rep_maxes')
      .select('id, weight_kg, is_calculated, logged_at, flagged_for_review')
      .eq('user_id', user.id).eq('lift', liftKey).order('logged_at', { ascending: true });
    setEntries(data || []);
    setLoading(false);
  }

  function handleCalculate() {
    const w = parseFloat(calcWeight);
    const r = parseInt(calcReps, 10);
    if (!w || !r || w <= 0 || r <= 0 || r > 50) { setCalcResult(null); return; }
    setCalcResult(Math.round(w * (1 + r / 30) * 2) / 2);
  }

  async function handleLog(kg, isCalculated) {
    if (!kg || isNaN(kg) || kg < 1) return;
    if (kg > 500) {
      setFeedback({ msg: 'Weight exceeds 500 kg — if this is correct, contact support.', isError: true });
      setTimeout(() => setFeedback(null), 5000); return;
    }
    const setSaving = isCalculated ? setSavingCalc : setSavingManual;
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }
    const { user, access_token: token } = session;
    let result;
    try {
      result = await logOneRm(token, { lift: liftKey, weight_kg: kg, is_calculated: isCalculated });
    } catch (e) {
      setSaving(false);
      setFeedback({ msg: e.message || 'Error saving', isError: true });
      setTimeout(() => setFeedback(null), 5000); return;
    }
    setSaving(false);
    await fetchEntries();
    const { is_new_pr: isNewPr, entry } = result;
    const flagged = entry?.flagged_for_review;
    if (isNewPr) {
      await unlockAchievement(supabase, user.id, 'pr_hunter', 200);
      setFeedback({ msg: flagged ? 'NEW PR — pending review' : 'NEW PR', isPr: true });
      setGlowing(true);
      setTimeout(() => setGlowing(false), 2000);
    } else {
      setFeedback({ msg: flagged ? 'Saved — pending review' : '✓ Logged', isPr: false });
    }
    setTimeout(() => setFeedback(null), 4000);
    const { data: allLifts } = await supabase.from('one_rep_maxes').select('lift').eq('user_id', user.id);
    if (allLifts) {
      const covered = new Set(allLifts.map(r => r.lift));
      if (LIFTS.every(l => covered.has(l.key))) await unlockAchievement(supabase, user.id, 'big_four', 250);
    }
    const { data: history } = await supabase.from('one_rep_maxes').select('weight_kg, logged_at').eq('user_id', user.id).eq('lift', liftKey).order('logged_at', { ascending: true });
    if (history && hasThreeConsecutiveWeekImprovement(history)) await unlockAchievement(supabase, user.id, 'strength_surge', 200);
    if (isCalculated) { setCalcWeight(''); setCalcReps(''); setCalcResult(null); }
    else { setMaxInput(''); }
  }

  async function deleteEntry(id) {
    setDeletingId(id);
    const { error } = await supabase.from('one_rep_maxes').delete().eq('id', id);
    setDeletingId(null);
    if (!error) await fetchEntries();
  }

  const allTimeBest    = entries.length > 0 ? Math.max(...entries.map(e => e.weight_kg)) : null;
  const mostRecent     = entries.length > 0 ? entries[entries.length - 1] : null;
  const isPersonalBest = mostRecent && allTimeBest != null && mostRecent.weight_kg >= allTimeBest;
  const chartData      = entries.map(e => ({ date: new Date(e.logged_at).toISOString().split('T')[0], weight: e.weight_kg }));
  const gradId         = `prg-${liftKey}`;

  return (
    <div style={{
      background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
      border: glowing ? '1px solid rgba(201,97,245,0.5)' : `1px solid ${C.pinkBorder}`,
      boxShadow: glowing
        ? `0 12px 28px -16px rgba(0,0,0,0.55), 0 0 28px -8px rgba(201,97,245,0.5)`
        : `0 12px 28px -16px rgba(0,0,0,0.55), 0 0 22px -14px ${C.pinkGlow}, 0 1px 0 rgba(255,255,255,0.03) inset`,
      transition: 'border-color 0.4s, box-shadow 0.4s',
      borderRadius: 16, padding: 20,
      display: 'flex', flexDirection: 'column',
    }}>

      <div style={{ ...cardLabel, marginBottom: 8 }}>{liftName}</div>

      {loading ? (
        <div style={{ color: C.ashDim, fontSize: 12, fontFamily: "'Inter', sans-serif", minHeight: 60 }}>Loading…</div>
      ) : (
        <>
          {/* Current 1RM */}
          <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 30, fontWeight: 600, color: C.bone, lineHeight: 1, marginBottom: 2 }}>
            {mostRecent ? `${mostRecent.weight_kg} KG` : '— KG'}
          </div>

          {isPersonalBest && (
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: C.bone, marginBottom: 2 }}>
              Personal Best
            </div>
          )}

          {mostRecent && (
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: C.ashDim, marginBottom: 14 }}>
              {new Date(mostRecent.logged_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          )}

          {/* Purple mini-chart — same colour role as the main Weight Over Time chart */}
          {chartData.length > 1 && (
            <div style={{ marginBottom: 10 }}>
              <ResponsiveContainer width="100%" height={60}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -32 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6B1FB8" />
                      <stop offset="100%" stopColor="#C961F5" />
                    </linearGradient>
                  </defs>
                  <YAxis domain={['auto', 'auto']} tick={false} axisLine={false} tickLine={false} />
                  <Line type="monotone" dataKey="weight" stroke="rgba(155,47,224,0.2)" strokeWidth={5} dot={false} activeDot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="weight" stroke={`url(#${gradId})`} strokeWidth={2} dot={false} activeDot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: feedback.isError ? '#fca5a5' : C.bone, marginBottom: 8 }}>
              {feedback.msg}
            </div>
          )}

          {/* History toggle */}
          {entries.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <button
                onClick={() => setShowHistory(h => !h)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.ash, textAlign: 'left' }}
              >
                {showHistory ? '▲ Hide history' : `▼ History (${entries.length})`}
              </button>
              {showHistory && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[...entries].reverse().slice(0, 10).map(e => (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: e.flagged_for_review ? '#F59E0B' : C.ashDim }}>
                        {new Date(e.logged_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {e.is_calculated ? ' (est.)' : ''}
                        {e.flagged_for_review ? ' ⚑' : ''}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 12, color: C.ash, fontWeight: 500 }}>{e.weight_kg} kg</span>
                        <button onClick={() => deleteEntry(e.id)} disabled={deletingId === e.id} title="Delete"
                          style={{ background: 'none', border: 'none', cursor: deletingId === e.id ? 'default' : 'pointer', color: C.ashDim, fontSize: 14, padding: '2px 4px', lineHeight: 1, opacity: deletingId === e.id ? 0.4 : 1 }}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: 12 }} />

          {/* Input grid — matches prototype .pr-inputs layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px', marginBottom: 10 }}>

            {/* Manual entry */}
            <div>
              <label style={{ display: 'block', fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: C.ashDim, marginBottom: 6 }}>Max (kg)</label>
              <input type="number" step="0.5" min="1" max="1000" value={maxInput}
                onChange={e => setMaxInput(e.target.value)} placeholder="e.g. 120"
                style={numInput} />
            </div>

            {/* Epley calculator */}
            <div>
              <label style={{ display: 'block', fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: C.ashDim, marginBottom: 6 }}>Calculator</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="number" step="0.5" min="1" value={calcWeight}
                  onChange={e => setCalcWeight(e.target.value)} placeholder="KG"
                  style={{ ...numInput, flex: 1 }} />
                <input type="number" step="1" min="1" max="50" value={calcReps}
                  onChange={e => setCalcReps(e.target.value)} placeholder="Reps"
                  style={{ ...numInput, flex: 1 }} />
              </div>
            </div>
          </div>

          {/* Action buttons — matches prototype .pr-actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              onClick={() => !savingManual && handleLog(parseFloat(maxInput), false)}
              disabled={savingManual || !maxInput}
              style={{ ...ctaBtn, padding: '11px 0', fontSize: 12, width: '100%', textAlign: 'center', opacity: savingManual || !maxInput ? 0.45 : 1, whiteSpace: 'nowrap' }}
            >
              {savingManual ? '…' : 'Log PR'}
            </button>
            <button
              onClick={handleCalculate}
              disabled={!calcWeight || !calcReps}
              style={{ ...secondaryBtn, opacity: !calcWeight || !calcReps ? 0.45 : 1 }}
            >
              Calculate
            </button>
          </div>

          {calcResult !== null && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: C.ash, marginBottom: 8 }}>
                Est. 1RM: <span style={{ fontFamily: "'Roboto Mono', monospace", color: C.bone, fontWeight: 600 }}>{calcResult} kg</span>
              </div>
              <button
                onClick={() => !savingCalc && handleLog(calcResult, true)}
                disabled={savingCalc}
                style={{ ...ctaBtn, padding: '11px 0', fontSize: 12, width: '100%', textAlign: 'center', opacity: savingCalc ? 0.45 : 1, whiteSpace: 'nowrap' }}
              >
                {savingCalc ? '…' : 'Log Estimated'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── 1RM TRACKER SECTION ─────────────────────────────────────────────────────

function OneRmTracker() {
  return (
    <div style={{ marginTop: 32 }}>
      <style>{`
        .orm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 600px) { .orm-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: C.bone, marginBottom: 8 }}>
        1RM Tracker
      </div>

      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash, fontStyle: 'italic', margin: '0 0 20px', lineHeight: 1.5 }}>
        Always lift with a spotter or safety equipment when testing your max. When in doubt, use the calculator to estimate from your working weight — it's safer and just as useful.
      </p>

      <div className="orm-grid">
        {LIFTS.map(l => <LiftCard key={l.key} liftName={l.name} liftKey={l.key} />)}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function ProgressTab({ userId, plan, onSwitchTab }) {
  const [logs, setLogs]                       = useState([]);
  const [loadingLogs, setLoadingLogs]         = useState(true);
  const [targetWeight, setTargetWeight]       = useState(null);
  const [goal, setGoal]                       = useState(null);
  const [inputVal, setInputVal]               = useState('');
  const [saving, setSaving]                   = useState(false);
  const [saved, setSaved]                     = useState(false);
  const [editing, setEditing]                 = useState(false);
  const [error, setError]                     = useState('');
  const [showCheckIn, setShowCheckIn]         = useState(false);
  const [checkInMsg, setCheckInMsg]           = useState(false);
  const [showCheckinPrompt, setShowCheckinPrompt] = useState(false);
  const [historyKey, setHistoryKey]           = useState(0);
  const checkinPromptTimer                    = useRef(null);

  const fetchLogs = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingLogs(false); return; }
    const { data, error: err } = await supabase.from('weight_logs').select('id, weight_kg, logged_at').eq('user_id', user.id).order('logged_at', { ascending: true });
    if (err) console.error('[ProgressTab] weight_logs:', err);
    setLogs(data || []);
    setLoadingLogs(false);
  }, []);

  useEffect(() => {
    fetchLogs();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('intake_submissions').select('data').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        .then(({ data }) => {
          if (data?.data?.targetWeight) setTargetWeight(Number(data.data.targetWeight));
          if (data?.data?.goal) setGoal(data.data.goal);
        });
    });
  }, [fetchLogs]);

  const effectiveGoal = plan?.user_summary?.goal || goal;
  const isBulkGoal    = effectiveGoal === 'lean_bulk' || effectiveGoal === 'muscle_building';
  const todayLog      = logs.find(l => isToday(l.logged_at));
  const startLog      = logs[0] || null;
  const currentLog    = logs[logs.length - 1] || null;

  const chartData  = logs.map(l => ({ date: new Date(l.logged_at).toISOString().split('T')[0], weight: l.weight_kg }));
  const allYValues = [...logs.map(l => l.weight_kg), targetWeight].filter(v => v != null);
  const yMin       = allYValues.length ? Math.floor(Math.min(...allYValues) - 3) : 60;
  const yMax       = allYValues.length ? Math.ceil(Math.max(...allYValues)  + 3) : 100;

  let toGoDisplay = null;
  let toGoSub     = null;
  if (currentLog && targetWeight != null) {
    const diff = currentLog.weight_kg - targetWeight;
    if (Math.abs(diff) < 0.05) {
      toGoDisplay = '0 kg'; toGoSub = '✓ at target';
    } else if (isBulkGoal) {
      if (diff < 0) { toGoDisplay = `${Math.abs(diff).toFixed(1)} kg`; toGoSub = '↑ to go'; }
      else          { toGoDisplay = `${diff.toFixed(1)} kg`;           toGoSub = '↑ past target'; }
    } else {
      if (diff > 0) { toGoDisplay = `${diff.toFixed(1)} kg`;           toGoSub = '↓ to lose'; }
      else          { toGoDisplay = `${Math.abs(diff).toFixed(1)} kg`; toGoSub = '↑ to gain'; }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Not authenticated. Please refresh.'); return; }
    const kg = parseFloat(inputVal);
    if (!kg || kg < 20 || kg > 400) { setError('Enter a valid weight (20–400 kg).'); return; }
    setSaving(true); setError('');
    try {
      if (editing && todayLog) {
        const { error: err } = await supabase.from('weight_logs').update({ weight_kg: kg }).eq('id', todayLog.id).eq('user_id', user.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('weight_logs').insert({ user_id: user.id, weight_kg: kg, logged_at: new Date().toISOString() });
        if (err) throw err;
      }
      await fetchLogs();
      if (!editing) {
        const { data: allLogs } = await supabase.from('weight_logs').select('logged_at, weight_kg').eq('user_id', user.id).order('logged_at', { ascending: true });
        if (allLogs) {
          if (allLogs.length === 1) await unlockAchievement(supabase, user.id, 'first_checkin', 10);
          if (allLogs.length >= 2) {
            const diff = allLogs[0].weight_kg - allLogs[allLogs.length - 1].weight_kg;
            if (diff >= 1) await unlockAchievement(supabase, user.id, 'moving_needle', 100);
          }
          if (hasConsecutiveDays(allLogs, 30)) await unlockAchievement(supabase, user.id, 'consistent', 200);
        }
      }
      setSaved(true); setEditing(false); setInputVal('');
      setTimeout(() => setSaved(false), 3500);
    } catch (err) {
      setError(err.message || 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit()       { setEditing(true); setInputVal(todayLog?.weight_kg?.toString() || ''); setSaved(false); }
  function handleCancelEdit() { setEditing(false); setInputVal(''); setError(''); }

  function handleCheckInSaved() {
    setShowCheckIn(false); setCheckInMsg(true);
    setTimeout(() => setCheckInMsg(false), 4000);
    setHistoryKey(k => k + 1); fetchLogs();
    setShowCheckinPrompt(true);
    if (checkinPromptTimer.current) clearTimeout(checkinPromptTimer.current);
    checkinPromptTimer.current = setTimeout(() => setShowCheckinPrompt(false), 60000);
  }

  useEffect(() => () => { if (checkinPromptTimer.current) clearTimeout(checkinPromptTimer.current); }, []);

  const showForm = !todayLog || editing;

  if (loadingLogs) {
    return <div style={{ color: C.ashDim, padding: '60px 0', textAlign: 'center', fontFamily: "'Inter', sans-serif", fontSize: 13 }}>Loading…</div>;
  }

  return (
    <div>
      {showCheckIn && <CheckInModal todayLog={todayLog} onClose={() => setShowCheckIn(false)} onSaved={handleCheckInSaved} />}

      {/* ── Today's Weight ───────────────────────────────────────── */}
      <div style={card}>
        <div style={cardLabel}>Today's Weight</div>

        {!showForm ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, background: C.surface2, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 22, fontWeight: 600, color: C.bone }}>{todayLog.weight_kg}</span>
                <span style={{ color: C.ashDim, fontSize: 13, fontFamily: "'Oswald', sans-serif" }}>kg</span>
              </div>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.ashDim }}>logged today</span>
            </div>
            <button type="button" onClick={handleEdit} style={ghostBtn}>Edit</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, background: C.surface2, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 220 }}>
                <input
                  type="number" step="0.1" min="20" max="400"
                  value={inputVal} onChange={e => setInputVal(e.target.value)}
                  placeholder="e.g. 84.5" autoFocus
                  style={{ background: 'none', border: 'none', color: C.bone, fontFamily: "'Roboto Mono', monospace", fontSize: 18, width: '100%', outline: 'none' }}
                />
                <span style={{ color: C.ashDim, fontSize: 13, fontFamily: "'Oswald', sans-serif", flexShrink: 0 }}>kg</span>
              </div>
              <button type="submit" disabled={saving || !inputVal}
                style={{ ...ctaBtn, height: 54, opacity: saving || !inputVal ? 0.5 : 1 }}>
                {saving ? '…' : editing ? 'Update' : 'Log Weight'}
              </button>
              {editing && <button type="button" onClick={handleCancelEdit} style={{ ...ghostBtn, height: 54, padding: '0 20px' }}>Cancel</button>}
            </div>
            {error && <p style={{ color: '#fca5a5', fontSize: 12, fontFamily: "'Inter', sans-serif", marginTop: 8 }}>{error}</p>}
          </form>
        )}

        {saved && <div style={{ marginTop: 14, fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#4A9968' }}>✓ Weight saved</div>}
      </div>

      {/* ── Log Check-In ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 18 }}>
        <button onClick={() => setShowCheckIn(true)}
          style={{ ...ctaBtn, width: '100%', display: 'block', textAlign: 'center', padding: '16px 24px', boxShadow: `0 10px 28px -8px ${C.pinkGlow}` }}>
          Log Check-In →
        </button>
      </div>

      {checkInMsg && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#4A9968', marginBottom: 16 }}>✓ Check-in saved.</div>}

      {/* ── Weekly coaching prompt ────────────────────────────────── */}
      {showCheckinPrompt && (
        <div style={{ position: 'relative', background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`, border: `1px solid ${C.pinkLine}`, borderRadius: 12, padding: '18px 20px', marginBottom: 18, boxShadow: `0 0 22px -10px ${C.pinkGlow}` }}>
          <button type="button"
            onClick={() => { setShowCheckinPrompt(false); if (checkinPromptTimer.current) clearTimeout(checkinPromptTimer.current); }}
            style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', color: C.ashDim, fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '4px 6px' }}>×</button>
          <div style={{ ...cardLabel, marginBottom: 6 }}>Next Step</div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: C.bone, marginBottom: 6 }}>
            Get your weekly coaching feedback
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash, lineHeight: 1.5, marginBottom: 16 }}>
            Your data is logged. Now let your AI coach review your week.
          </div>
          <button type="button"
            onClick={() => { setShowCheckinPrompt(false); if (checkinPromptTimer.current) clearTimeout(checkinPromptTimer.current); if (onSwitchTab) onSwitchTab('today', true); }}
            style={{ ...ctaBtn, boxShadow: `0 10px 28px -8px ${C.pinkGlow}` }}>
            Open Weekly Check-In →
          </button>
        </div>
      )}

      {/* ── Weight Over Time chart ───────────────────────────────── */}
      {chartData.length < 2 ? (
        <div style={{ ...card, textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>📈</div>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: C.ash, maxWidth: 320, margin: '0 auto' }}>
            Log your weight each morning to track your progress
          </p>
        </div>
      ) : (
        <div style={{ ...card, padding: '22px 8px 16px 0' }}>
          <div style={{ ...cardLabel, paddingLeft: 24 }}>Weight Over Time</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 16, right: 32, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="mainPurpleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6B1FB8" />
                  <stop offset="100%" stopColor="#C961F5" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtDate}
                tick={{ fill: C.ashDim, fontSize: 10, fontFamily: "'Inter', sans-serif" }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} interval="preserveStartEnd" />
              <YAxis domain={[yMin, yMax]}
                tick={{ fill: C.ashDim, fontSize: 10, fontFamily: "'Inter', sans-serif" }}
                axisLine={false} tickLine={false} width={42} tickFormatter={v => `${v}`} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
              {startLog && (
                <ReferenceLine y={startLog.weight_kg} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3"
                  label={{ value: `Start ${startLog.weight_kg}kg`, position: 'insideTopLeft', fill: C.ashDim, fontSize: 10, fontFamily: "'Inter', sans-serif" }} />
              )}
              {currentLog && currentLog.id !== startLog?.id && (
                <ReferenceLine y={currentLog.weight_kg} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3"
                  label={{ value: `Now ${currentLog.weight_kg}kg`, position: 'insideBottomLeft', fill: C.ashDim, fontSize: 10, fontFamily: "'Inter', sans-serif" }} />
              )}
              {targetWeight != null && (
                <ReferenceLine y={targetWeight} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3"
                  label={{ value: `Target ${targetWeight}kg`, position: 'insideTopRight', fill: C.ash, fontSize: 10, fontFamily: "'Inter', sans-serif" }} />
              )}
              {/* Glow layer — soft purple halo behind the line */}
              <Line type="monotone" dataKey="weight" stroke="rgba(155,47,224,0.22)" strokeWidth={8} dot={false} activeDot={false} isAnimationActive={false} />
              {/* Sharp purple gradient line + dots */}
              <Line type="monotone" dataKey="weight" stroke="url(#mainPurpleGrad)" strokeWidth={3}
                dot={{ fill: C.purple, r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: C.purple, stroke: 'rgba(201,97,245,0.35)', strokeWidth: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Stat cards ───────────────────────────────────────────── */}
      {logs.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          <StatCard label="Starting Weight" value={startLog   ? `${startLog.weight_kg} kg`   : '—'} variant="default" />
          <StatCard label="Current Weight"  value={currentLog ? `${currentLog.weight_kg} kg` : '—'} variant="current" />
          <StatCard label="To Go" value={toGoDisplay ?? '—'} sub={toGoSub} variant={toGoDisplay != null ? 'toGo' : 'default'} />
        </div>
      )}

      {/* ── Check-In History ─────────────────────────────────────── */}
      <CheckInHistory refreshKey={historyKey} goal={effectiveGoal} />

      {/* ── 1RM Tracker ──────────────────────────────────────────── */}
      <OneRmTracker />
    </div>
  );
}
