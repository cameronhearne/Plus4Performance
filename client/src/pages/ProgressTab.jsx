import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { Camera, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { unlockAchievement, hasConsecutiveDays } from '../lib/achievements';

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
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtDateFull(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ─── CHART TOOLTIP ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#111', border: '1px solid #2a2a2a', padding: '8px 14px' }}>
      <div style={{ color: '#787878', fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em', marginBottom: 4 }}>
        {fmtDate(label)}
      </div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: '#F5F3EE', lineHeight: 1 }}>
        {payload[0].value} <span style={{ fontSize: 14, color: '#787878' }}>kg</span>
      </div>
    </div>
  );
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, highlight }) {
  return (
    <div style={{
      flex: 1,
      background: '#111',
      border: `1px solid ${highlight ? '#C0392B' : 'rgba(200,200,200,0.1)'}`,
      padding: '20px 20px 18px',
    }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: '#F5F3EE', lineHeight: 1, marginBottom: 6 }}>
        {value}
      </div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#787878' }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#555', letterSpacing: '0.08em', marginTop: 6 }}>
          {sub}
        </div>
      )}
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
  const fileRefs  = useRef({});
  const blobUrls  = useRef([]);

  // Fetch last measurement row for placeholders
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('body_measurements')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(1)
        .maybeSingle();
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
    setSaving(true);
    setError('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setError('Not authenticated.'); return; }

    const now = new Date().toISOString();
    const errors = [];

    // ── Weight ──────────────────────────────────────────────────────────────
    const kg = parseFloat(weightVal);
    const validWeight = weightVal !== '' && kg >= 20 && kg <= 400;
    let isNewWeightLog = false;

    if (validWeight) {
      if (todayLog) {
        const { error: e } = await supabase
          .from('weight_logs')
          .update({ weight_kg: kg })
          .eq('id', todayLog.id)
          .eq('user_id', user.id);
        if (e) errors.push(`Weight: ${e.message}`);
      } else {
        const { error: e } = await supabase
          .from('weight_logs')
          .insert({ user_id: user.id, weight_kg: kg, logged_at: now });
        if (e) errors.push(`Weight: ${e.message}`);
        else isNewWeightLog = true;
      }
    }

    if (isNewWeightLog) {
      const { data: allLogs } = await supabase
        .from('weight_logs')
        .select('logged_at, weight_kg')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: true });
      if (allLogs) {
        if (allLogs.length === 1) await unlockAchievement(supabase, user.id, 'first_checkin', 10);
        if (allLogs.length >= 2) {
          const diff = allLogs[0].weight_kg - allLogs[allLogs.length - 1].weight_kg;
          if (diff >= 1) await unlockAchievement(supabase, user.id, 'moving_needle', 100);
        }
        if (hasConsecutiveDays(allLogs, 30)) await unlockAchievement(supabase, user.id, 'consistent', 200);
      }
    }

    // ── Measurements ────────────────────────────────────────────────────────
    const hasAny = MEASURE_FIELDS.some(f => form[f.key] != null && form[f.key] !== '');
    if (hasAny) {
      const row = { user_id: user.id, logged_at: now };
      MEASURE_FIELDS.forEach(f => {
        if (form[f.key] != null && form[f.key] !== '') row[f.key] = parseFloat(form[f.key]);
      });
      const { error: e } = await supabase.from('body_measurements').insert(row);
      if (e) errors.push(`Measurements: ${e.message}`);
    }

    // ── Photos ───────────────────────────────────────────────────────────────
    const photoEntries = Object.entries(photoFiles);
    if (photoEntries.length > 0) {
      const { count: existingCount } = await supabase
        .from('progress_photos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      let uploadedCount = 0;
      for (const [view, file] of photoEntries) {
        const path = `${user.id}/${Date.now()}_${view}.jpg`;
        const { error: upErr } = await supabase.storage
          .from('progress-photos')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) { errors.push(`Photo ${view}: ${upErr.message}`); continue; }

        const { data: urlData } = await supabase.storage
          .from('progress-photos')
          .createSignedUrl(path, 31536000);

        const { error: dbErr } = await supabase.from('progress_photos').insert({
          user_id: user.id, view, storage_path: path,
          photo_url: urlData?.signedUrl || '', taken_at: now,
        });
        if (!dbErr) uploadedCount++;
        else errors.push(`Photo DB ${view}: ${dbErr.message}`);
      }

      if (existingCount === 0 && uploadedCount > 0) {
        await unlockAchievement(supabase, user.id, 'picture_perfect', 50);
      }

      const { data: allDates } = await supabase
        .from('progress_photos')
        .select('taken_at')
        .eq('user_id', user.id)
        .order('taken_at', { ascending: true });
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
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto',
      }}
    >
      <style>{`
        .ci-wrap { width: 100%; max-width: 560px; padding: 20px; box-sizing: border-box; }
        .ci-inner { background: #0d0d0d; border: 1px solid #2a2a2a; padding: 28px; }
        @media (max-width: 600px) {
          .ci-wrap  { padding: 0; max-width: 100%; }
          .ci-inner { border: none; min-height: 100vh; padding: 20px; }
        }
      `}</style>

      <div className="ci-wrap" onClick={e => e.stopPropagation()}>
        <div className="ci-inner">

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#C0392B' }}>
              Log Check-In
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 4, minHeight: 44, minWidth: 44 }}
            >
              ✕
            </button>
          </div>

          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.12em', color: '#555', marginBottom: 28 }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>

          {/* Weight */}
          <div style={{ marginBottom: 28 }}>
            <div style={st.modalLabel}>Weight (kg)</div>
            <div style={{ position: 'relative', maxWidth: 200 }}>
              <input
                type="number" step="0.1" min="20" max="400"
                value={weightVal}
                onChange={e => setWeightVal(e.target.value)}
                placeholder="e.g. 84.5"
                style={st.weightInput}
              />
              <span style={st.kgBadge}>kg</span>
            </div>
          </div>

          {/* Body Measurements */}
          <div style={{ marginBottom: 28 }}>
            <div style={st.modalLabel}>Body Measurements</div>
            <p style={st.optionalNote}>Optional — update whenever you want to track your changes.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
              {MEASURE_FIELDS.map(f => (
                <div key={f.key}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#555', marginBottom: 5 }}>
                    {f.label}
                  </div>
                  <input
                    type="number" step="0.1" min="0"
                    value={form[f.key] || ''}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={lastMeasurements?.[f.key] != null ? String(lastMeasurements[f.key]) : '—'}
                    style={st.measureInput}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Progress Photos */}
          <div style={{ marginBottom: 28 }}>
            <div style={st.modalLabel}>Progress Photos</div>
            <p style={st.optionalNote}>Optional — update whenever you want to track your changes.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {VIEWS.map(view => {
                const preview = photoPreviews[view];
                return (
                  <div key={view} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div
                      onClick={() => fileRefs.current[view]?.click()}
                      style={{
                        width: 140, height: 186,
                        border: preview ? 'none' : '1px dashed #2a2a2a',
                        background: '#111',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', position: 'relative', overflow: 'hidden', flexShrink: 0,
                      }}
                    >
                      {preview ? (
                        <img src={preview} alt={view} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <>
                          <Camera size={28} color="#444" />
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: '#444', marginTop: 8 }}>
                            {view.toUpperCase()}
                          </div>
                        </>
                      )}
                    </div>
                    <input
                      ref={el => { fileRefs.current[view] = el; }}
                      type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(view, f); e.target.value = ''; }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {error && <p style={st.errorMsg}>{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{ ...st.logBtn, width: '100%', height: 52, opacity: saving ? 0.6 : 1, fontSize: 14 }}
          >
            {saving ? 'Saving…' : 'Save Check-In'}
          </button>

        </div>
      </div>
    </div>
  );
}

// ─── CHECK-IN HISTORY ────────────────────────────────────────────────────────

function CheckInHistory({ refreshKey }) {
  const [checkIns, setCheckIns] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(new Set());
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [
        { data: weights },
        { data: measurements },
        { data: photos },
      ] = await Promise.all([
        supabase.from('weight_logs').select('id, weight_kg, logged_at').eq('user_id', user.id).order('logged_at', { ascending: true }),
        supabase.from('body_measurements').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }),
        supabase.from('progress_photos').select('id, view, storage_path, taken_at').eq('user_id', user.id).order('taken_at', { ascending: false }),
      ]);

      // Batch sign photo URLs
      let photosWithUrls = [];
      if (photos && photos.length > 0) {
        const { data: signed } = await supabase.storage
          .from('progress-photos')
          .createSignedUrls(photos.map(p => p.storage_path), 31536000);
        const urlMap = Object.fromEntries((signed || []).map(s => [s.path, s.signedUrl]));
        photosWithUrls = photos.map(p => ({ ...p, signedUrl: urlMap[p.storage_path] || null }));
      }

      // Group all records by calendar date
      const byDate = {};
      function ensure(d) {
        if (!byDate[d]) byDate[d] = { date: d, weights: [], measurements: [], photos: [] };
      }
      (weights || []).forEach(w => { const d = new Date(w.logged_at).toISOString().split('T')[0]; ensure(d); byDate[d].weights.push(w); });
      (measurements || []).forEach(m => { const d = new Date(m.logged_at).toISOString().split('T')[0]; ensure(d); byDate[d].measurements.push(m); });
      photosWithUrls.forEach(p => { const d = new Date(p.taken_at).toISOString().split('T')[0]; ensure(d); byDate[d].photos.push(p); });

      // Sort desc (most recent first)
      const sorted = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));

      // Compute weight delta vs previous check-in that had a weight
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].weights.length > 0) {
          for (let j = i + 1; j < sorted.length; j++) {
            if (sorted[j].weights.length > 0) {
              sorted[i].weightDelta = sorted[i].weights[0].weight_kg - sorted[j].weights[0].weight_kg;
              break;
            }
          }
        }
      }

      setCheckIns(sorted);
      setLoading(false);
    }

    fetchHistory();
  }, [refreshKey]);

  function toggleExpand(date) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  }

  if (loading || checkIns.length === 0) return null;

  return (
    <div style={{ marginTop: 32 }}>
      <div style={st.sectionEyebrow}>Check-In History</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {checkIns.map(ci => {
          const isOpen       = expanded.has(ci.date);
          const weight       = ci.weights[0] || null;
          const measurement  = ci.measurements[0] || null;
          const measureCount = measurement
            ? MEASURE_FIELDS.filter(f => measurement[f.key] != null).length
            : 0;

          return (
            <div key={ci.date} style={{ background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.08)' }}>

              {/* Summary row */}
              <button
                onClick={() => toggleExpand(ci.date)}
                style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  padding: '16px 20px', textAlign: 'left',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 44,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', color: '#F5F3EE', marginBottom: 4 }}>
                    {fmtDateFull(ci.date)}
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    {weight && (
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: '#C0392B' }}>
                        {weight.weight_kg} kg
                      </span>
                    )}
                    {measureCount > 0 && (
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.08em', color: '#555' }}>
                        {measureCount} measurement{measureCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {ci.photos.length > 0 && (
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.08em', color: '#555' }}>
                        {ci.photos.length} photo{ci.photos.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ color: '#555', marginLeft: 12, flexShrink: 0 }}>
                  {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </span>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(200,200,200,0.06)' }}>

                  {weight && (
                    <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: '#F5F3EE' }}>
                        {weight.weight_kg} kg
                      </span>
                      {ci.weightDelta != null && (
                        <span style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: '0.06em',
                          color: ci.weightDelta < 0 ? '#4CAF50' : ci.weightDelta > 0 ? '#C0392B' : '#555',
                        }}>
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
                          <div key={f.key} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, letterSpacing: '0.06em' }}>
                            <span style={{ color: '#F5F3EE', fontWeight: 600 }}>{val}cm</span>
                            <span style={{ color: '#555', marginLeft: 6 }}>{f.label.split(' (')[0]}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {ci.photos.length > 0 && (
                    <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {ci.photos.map(p => (
                        <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <img
                            src={p.signedUrl}
                            alt={p.view}
                            onClick={() => setLightbox(p.signedUrl)}
                            style={{ width: 80, height: 107, objectFit: 'cover', cursor: 'pointer', display: 'block' }}
                          />
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555' }}>
                            {p.view}
                          </div>
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

      {/* Photo lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <img src={lightbox} alt="Full size" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function ProgressTab({ userId }) {
  const [logs, setLogs]               = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [targetWeight, setTargetWeight] = useState(null);

  const [inputVal, setInputVal] = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [editing, setEditing]   = useState(false);
  const [error, setError]       = useState('');

  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInMsg, setCheckInMsg]   = useState(false);
  const [historyKey, setHistoryKey]   = useState(0);

  const fetchLogs = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingLogs(false); return; }
    const { data, error: err } = await supabase
      .from('weight_logs')
      .select('id, weight_kg, logged_at')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: true });
    if (err) console.error('[ProgressTab] weight_logs:', err);
    setLogs(data || []);
    setLoadingLogs(false);
  }, []);

  useEffect(() => {
    fetchLogs();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('intake_submissions')
        .select('data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.data?.targetWeight) setTargetWeight(Number(data.data.targetWeight));
        });
    });
  }, [fetchLogs]);

  // ── Derived values ───────────────────────────────────────────────────────

  const todayLog   = logs.find(l => isToday(l.logged_at));
  const startLog   = logs[0]   || null;
  const currentLog = logs[logs.length - 1] || null;

  const chartData = logs.map(l => ({
    date:   new Date(l.logged_at).toISOString().split('T')[0],
    weight: l.weight_kg,
  }));

  const allYValues = [...logs.map(l => l.weight_kg), targetWeight].filter(v => v != null);
  const yMin = allYValues.length ? Math.floor(Math.min(...allYValues) - 3) : 60;
  const yMax = allYValues.length ? Math.ceil(Math.max(...allYValues)  + 3) : 100;

  let toGoDisplay = null;
  let toGoSub     = null;
  if (currentLog && targetWeight != null) {
    const diff = currentLog.weight_kg - targetWeight;
    if (Math.abs(diff) < 0.05) {
      toGoDisplay = '0 kg'; toGoSub = '✓ at target';
    } else if (diff > 0) {
      toGoDisplay = `${diff.toFixed(1)} kg`; toGoSub = '↓ to lose';
    } else {
      toGoDisplay = `${Math.abs(diff).toFixed(1)} kg`; toGoSub = '↑ to gain';
    }
  }

  // ── Form handlers ────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Not authenticated. Please refresh.'); return; }
    const kg = parseFloat(inputVal);
    if (!kg || kg < 20 || kg > 400) { setError('Enter a valid weight (20–400 kg).'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing && todayLog) {
        const { error: err } = await supabase
          .from('weight_logs').update({ weight_kg: kg }).eq('id', todayLog.id).eq('user_id', user.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('weight_logs').insert({ user_id: user.id, weight_kg: kg, logged_at: new Date().toISOString() });
        if (err) throw err;
      }
      await fetchLogs();

      if (!editing) {
        const { data: allLogs } = await supabase
          .from('weight_logs').select('logged_at, weight_kg').eq('user_id', user.id).order('logged_at', { ascending: true });
        if (allLogs) {
          if (allLogs.length === 1) await unlockAchievement(supabase, user.id, 'first_checkin', 10);
          if (allLogs.length >= 2) {
            const diff = allLogs[0].weight_kg - allLogs[allLogs.length - 1].weight_kg;
            if (diff >= 1) await unlockAchievement(supabase, user.id, 'moving_needle', 100);
          }
          if (hasConsecutiveDays(allLogs, 30)) await unlockAchievement(supabase, user.id, 'consistent', 200);
        }
      }

      setSaved(true);
      setEditing(false);
      setInputVal('');
      setTimeout(() => setSaved(false), 3500);
    } catch (err) {
      setError(err.message || 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit() {
    setEditing(true);
    setInputVal(todayLog?.weight_kg?.toString() || '');
    setSaved(false);
  }

  function handleCancelEdit() {
    setEditing(false);
    setInputVal('');
    setError('');
  }

  function handleCheckInSaved() {
    setShowCheckIn(false);
    setCheckInMsg(true);
    setTimeout(() => setCheckInMsg(false), 4000);
    setHistoryKey(k => k + 1);
    fetchLogs();
  }

  const showForm = !todayLog || editing;

  // ── Render ───────────────────────────────────────────────────────────────

  if (loadingLogs) {
    return <div style={{ color: '#555', padding: '60px 0', textAlign: 'center' }}>Loading…</div>;
  }

  return (
    <div>

      {showCheckIn && (
        <CheckInModal
          todayLog={todayLog}
          onClose={() => setShowCheckIn(false)}
          onSaved={handleCheckInSaved}
        />
      )}

      {/* ── Weight log input ───────────────────────────────────────── */}
      <div style={st.inputCard}>
        <div style={st.inputEyebrow}>Today's Weight</div>

        {!showForm ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={st.loggedVal}>{todayLog.weight_kg}</span>
              <span style={st.loggedUnit}>kg</span>
              <span style={st.loggedMeta}>— logged today</span>
            </div>
            <button type="button" onClick={handleEdit} style={st.editBtn}>Edit</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 200 }}>
                <input
                  type="number" step="0.1" min="20" max="400"
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  placeholder="e.g. 84.5"
                  style={st.weightInput}
                  autoFocus
                />
                <span style={st.kgBadge}>kg</span>
              </div>
              <button
                type="submit"
                disabled={saving || !inputVal}
                style={{ ...st.logBtn, opacity: saving || !inputVal ? 0.5 : 1 }}
              >
                {saving ? '…' : editing ? 'Update' : 'Log Weight'}
              </button>
              {editing && (
                <button type="button" onClick={handleCancelEdit} style={st.cancelBtn}>Cancel</button>
              )}
            </div>
            {error && <p style={st.errorMsg}>{error}</p>}
          </form>
        )}

        {saved && <div style={st.savedMsg}>✓ Weight saved</div>}
      </div>

      {/* ── LOG CHECK-IN button ────────────────────────────────────── */}
      <button onClick={() => setShowCheckIn(true)} style={st.checkInBtn}>
        LOG CHECK-IN →
      </button>

      {checkInMsg && (
        <div style={{ ...st.savedMsg, marginBottom: 16 }}>✓ Check-in saved.</div>
      )}

      {/* ── Graph ─────────────────────────────────────────────────── */}
      {chartData.length < 2 ? (
        <div style={st.emptyChart}>
          <div style={st.emptyChartIcon}>📈</div>
          <p style={st.emptyChartText}>Log your weight each morning to track your progress</p>
        </div>
      ) : (
        <div style={st.chartCard}>
          <div style={st.chartEyebrow}>Weight Over Time</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 20, right: 32, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="#1e1e1e" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date" tickFormatter={fmtDate}
                tick={{ fill: '#555', fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif" }}
                axisLine={{ stroke: '#1e1e1e' }} tickLine={false} interval="preserveStartEnd"
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fill: '#555', fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif" }}
                axisLine={false} tickLine={false} width={42} tickFormatter={v => `${v}`}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#333', strokeWidth: 1 }} />
              {startLog && (
                <ReferenceLine y={startLog.weight_kg} stroke="#333" strokeDasharray="4 3"
                  label={{ value: `Start  ${startLog.weight_kg}kg`, position: 'insideTopLeft', fill: '#555', fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif" }} />
              )}
              {currentLog && currentLog.id !== startLog?.id && (
                <ReferenceLine y={currentLog.weight_kg} stroke="#444" strokeDasharray="4 3"
                  label={{ value: `Now  ${currentLog.weight_kg}kg`, position: 'insideBottomLeft', fill: '#555', fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif" }} />
              )}
              {targetWeight != null && (
                <ReferenceLine y={targetWeight} stroke="#1E7A3E" strokeDasharray="4 3"
                  label={{ value: `Target  ${targetWeight}kg`, position: 'insideTopRight', fill: '#1E7A3E', fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif" }} />
              )}
              <Line type="monotone" dataKey="weight" stroke="#C0392B" strokeWidth={2}
                dot={{ fill: '#C0392B', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#C0392B', stroke: '#080808', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Stats row ─────────────────────────────────────────────── */}
      {logs.length > 0 && (
        <div style={st.statsRow}>
          <StatCard label="Starting Weight" value={startLog ? `${startLog.weight_kg} kg` : '—'} />
          <StatCard label="Current Weight"  value={currentLog ? `${currentLog.weight_kg} kg` : '—'} highlight />
          <StatCard label="To Go"           value={toGoDisplay ?? '—'} sub={toGoSub} />
        </div>
      )}

      {/* ── Check-In History ──────────────────────────────────────── */}
      <CheckInHistory refreshKey={historyKey} />

    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const st = {
  inputCard: {
    background: '#0d0d0d',
    border: '1px solid rgba(200,200,200,0.12)',
    padding: '24px 24px 22px',
    marginBottom: 16,
  },
  inputEyebrow: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 11, fontWeight: 700, letterSpacing: '0.28em',
    textTransform: 'uppercase', color: '#555', marginBottom: 16,
  },
  sectionEyebrow: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 11, fontWeight: 700, letterSpacing: '0.28em',
    textTransform: 'uppercase', color: '#555', marginBottom: 16,
  },
  modalLabel: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 12, fontWeight: 700, letterSpacing: '0.22em',
    textTransform: 'uppercase', color: '#787878', marginBottom: 10,
  },
  optionalNote: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 12, color: '#444', fontStyle: 'italic',
    letterSpacing: '0.04em', margin: '0 0 14px',
  },
  checkInBtn: {
    width: '100%',
    background: 'none',
    border: '1px solid #C0392B',
    color: '#C0392B',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 14, fontWeight: 700, letterSpacing: '0.2em',
    textTransform: 'uppercase',
    padding: '14px 24px',
    cursor: 'pointer',
    minHeight: 44,
    marginBottom: 16,
    display: 'block',
  },
  loggedVal: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 40, color: '#F5F3EE', lineHeight: 1,
  },
  loggedUnit: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 18, color: '#787878', fontWeight: 600,
  },
  loggedMeta: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13, color: '#444', letterSpacing: '0.06em',
  },
  editBtn: {
    background: 'none',
    border: '1px solid rgba(200,200,200,0.2)',
    color: '#787878',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 12, fontWeight: 700, letterSpacing: '0.16em',
    textTransform: 'uppercase', padding: '8px 20px', cursor: 'pointer',
  },
  weightInput: {
    width: '100%',
    padding: '14px 48px 14px 16px',
    background: '#111',
    border: '1px solid rgba(200,200,200,0.15)',
    color: '#F5F3EE',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 28, outline: 'none', boxSizing: 'border-box', lineHeight: 1,
  },
  kgBadge: {
    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', color: '#555', pointerEvents: 'none',
  },
  logBtn: {
    background: '#C0392B', border: 'none', color: '#ffffff',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13, fontWeight: 700, letterSpacing: '0.16em',
    textTransform: 'uppercase', padding: '0 28px', cursor: 'pointer',
    height: 54, whiteSpace: 'nowrap', transition: 'background 0.15s',
  },
  cancelBtn: {
    background: 'none',
    border: '1px solid rgba(200,200,200,0.15)',
    color: '#555',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 12, fontWeight: 700, letterSpacing: '0.14em',
    textTransform: 'uppercase', padding: '0 20px', cursor: 'pointer', height: 54,
  },
  errorMsg: {
    color: '#ef4444', fontSize: 12,
    fontFamily: "'Barlow Condensed', sans-serif",
    letterSpacing: '0.06em', marginTop: 8,
  },
  savedMsg: {
    marginTop: 14,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', color: '#4CAF50',
  },
  emptyChart: {
    background: '#0d0d0d',
    border: '1px solid rgba(200,200,200,0.08)',
    padding: '60px 24px', textAlign: 'center', marginBottom: 20,
  },
  emptyChartIcon: { fontSize: 32, marginBottom: 16 },
  emptyChartText: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 14, color: '#555', letterSpacing: '0.06em', maxWidth: 320, margin: '0 auto',
  },
  chartCard: {
    background: '#0d0d0d',
    border: '1px solid rgba(200,200,200,0.08)',
    padding: '24px 8px 16px 0', marginBottom: 20,
  },
  chartEyebrow: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 11, fontWeight: 700, letterSpacing: '0.28em',
    textTransform: 'uppercase', color: '#555', marginBottom: 16, paddingLeft: 24,
  },
  statsRow: { display: 'flex', gap: 12 },
  measureInput: {
    width: '100%', padding: '10px 12px',
    background: '#111', border: '1px solid rgba(200,200,200,0.15)',
    color: '#F5F3EE',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 16, outline: 'none', boxSizing: 'border-box',
  },
};
