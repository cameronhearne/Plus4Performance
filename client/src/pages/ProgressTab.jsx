import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { unlockAchievement, hasConsecutiveDays } from '../lib/achievements';

/*
  ─── SQL — run once in Supabase SQL editor ────────────────────────────────────

  -- Weight logs (existing)
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
    view text not null, -- 'front', 'side', 'back'
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

function fmtDateLong(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── CUSTOM TOOLTIP ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#111',
      border: '1px solid #2a2a2a',
      padding: '8px 14px',
    }}>
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
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 32,
        color: '#F5F3EE',
        lineHeight: 1,
        marginBottom: 6,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: '#787878',
      }}>
        {label}
      </div>
      {sub && (
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 12,
          color: '#555',
          letterSpacing: '0.08em',
          marginTop: 6,
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── PROGRESS PHOTOS ─────────────────────────────────────────────────────────

const VIEWS = ['front', 'side', 'back'];

function ProgressPhotos() {
  const [allPhotos, setAllPhotos]   = useState([]);
  const [uploading, setUploading]   = useState({});
  const [uploadErr, setUploadErr]   = useState({});
  const [historyView, setHistoryView] = useState(null);
  const [compareLeft, setCompareLeft]   = useState('');
  const [compareRight, setCompareRight] = useState('');
  const fileRefs = useRef({});

  useEffect(() => { fetchPhotos(); }, []);

  async function fetchPhotos() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('progress_photos')
      .select('id, view, storage_path, taken_at')
      .eq('user_id', user.id)
      .order('taken_at', { ascending: false });

    if (error || !data || data.length === 0) {
      setAllPhotos([]);
      return;
    }

    // Batch-sign all storage paths
    const { data: signed } = await supabase.storage
      .from('progress-photos')
      .createSignedUrls(data.map(p => p.storage_path), 31536000);

    const urlMap = Object.fromEntries((signed || []).map(s => [s.path, s.signedUrl]));
    const withUrls = data.map(p => ({ ...p, signedUrl: urlMap[p.storage_path] || null }));

    setAllPhotos(withUrls);

    // Set compare defaults (oldest left, newest right) on first load only
    const sorted = [...withUrls].sort((a, b) => new Date(a.taken_at) - new Date(b.taken_at));
    const ids = new Set(withUrls.map(p => p.id));
    if (!ids.has(compareLeft)) setCompareLeft(sorted[0]?.id || '');
    if (!ids.has(compareRight)) setCompareRight(sorted[sorted.length - 1]?.id || '');
  }

  async function handlePhotoUpload(view, file) {
    if (!file) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUploading(u => ({ ...u, [view]: true }));
    setUploadErr(e => ({ ...e, [view]: null }));

    try {
      // Count existing photos before insert for picture_perfect check
      const { count: existingCount } = await supabase
        .from('progress_photos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const path = `${user.id}/${Date.now()}_${view}.jpg`;

      const { error: upErr } = await supabase.storage
        .from('progress-photos')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: urlData } = await supabase.storage
        .from('progress-photos')
        .createSignedUrl(path, 31536000);

      const { error: dbErr } = await supabase
        .from('progress_photos')
        .insert({
          user_id: user.id,
          view,
          storage_path: path,
          photo_url: urlData?.signedUrl || '',
          taken_at: new Date().toISOString(),
        });
      if (dbErr) throw dbErr;

      await fetchPhotos();

      // picture_perfect — first ever photo
      if (existingCount === 0) {
        await unlockAchievement(supabase, user.id, 'picture_perfect', 50);
      }

      // transformation — photos spanning 77+ days (week 1 → week 12)
      const { data: allDates } = await supabase
        .from('progress_photos')
        .select('taken_at')
        .eq('user_id', user.id)
        .order('taken_at', { ascending: true });

      if (allDates && allDates.length >= 2) {
        const earliest = new Date(allDates[0].taken_at);
        const latest   = new Date(allDates[allDates.length - 1].taken_at);
        if ((latest - earliest) / 86400000 >= 77) {
          await unlockAchievement(supabase, user.id, 'transformation', 300);
        }
      }
    } catch (e) {
      console.error('[ProgressPhotos] upload error:', e);
      setUploadErr(err => ({ ...err, [view]: 'Upload failed. Try again.' }));
    } finally {
      setUploading(u => ({ ...u, [view]: false }));
    }
  }

  const photosByView = VIEWS.reduce((acc, v) => {
    acc[v] = allPhotos.filter(p => p.view === v);
    return acc;
  }, {});

  const photoMap = Object.fromEntries(allPhotos.map(p => [p.id, p]));
  const compareOptions = [...allPhotos]
    .sort((a, b) => new Date(a.taken_at) - new Date(b.taken_at))
    .map(p => ({ value: p.id, label: `${p.view.toUpperCase()} — ${fmtDate(p.taken_at)}` }));

  return (
    <div style={{ marginTop: 32 }}>
      <div style={st.sectionEyebrow}>Progress Photos</div>

      {/* Three view slots */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
        {VIEWS.map(view => {
          const viewPhotos = photosByView[view];
          const latest     = viewPhotos[0] || null;
          const isUp       = uploading[view];
          const err        = uploadErr[view];

          return (
            <div key={view} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div
                onClick={() => !isUp && fileRefs.current[view]?.click()}
                style={{
                  width: 180,
                  height: 240,
                  border: latest ? 'none' : '1px dashed #2a2a2a',
                  background: '#0d0d0d',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isUp ? 'default' : 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {latest ? (
                  <>
                    <img
                      src={latest.signedUrl}
                      alt={view}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'rgba(0,0,0,0.65)', padding: '4px 8px',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 10, letterSpacing: '0.08em', color: '#aaa', textAlign: 'center',
                    }}>
                      {fmtDate(latest.taken_at)}
                    </div>
                  </>
                ) : isUp ? (
                  <div style={{ color: '#555', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.1em' }}>
                    Uploading…
                  </div>
                ) : (
                  <>
                    <Camera size={32} color="#444" />
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#444', marginTop: 10 }}>
                      {view.toUpperCase()}
                    </div>
                  </>
                )}
              </div>

              <input
                ref={el => { fileRefs.current[view] = el; }}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handlePhotoUpload(view, f);
                  e.target.value = '';
                }}
              />

              {err && (
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#ef4444', letterSpacing: '0.06em', textAlign: 'center', maxWidth: 180 }}>
                  {err}
                </div>
              )}

              {viewPhotos.length > 0 && (
                <button
                  onClick={() => setHistoryView(view)}
                  style={{ background: 'none', border: 'none', color: '#555', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.12em', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                >
                  View History ({viewPhotos.length})
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Compare section */}
      {allPhotos.length >= 2 && (
        <div style={{ marginTop: 32 }}>
          <div style={st.sectionEyebrow}>Compare</div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <select value={compareLeft} onChange={e => setCompareLeft(e.target.value)} style={st.compareSelect}>
              {compareOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={compareRight} onChange={e => setCompareRight(e.target.value)} style={st.compareSelect}>
              {compareOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[compareLeft, compareRight].map((id, i) => {
              const p = photoMap[id];
              return p?.signedUrl ? (
                <img key={i} src={p.signedUrl} alt={p.view}
                  style={{ width: '50%', aspectRatio: '3/4', objectFit: 'cover' }} />
              ) : null;
            })}
          </div>
        </div>
      )}

      {/* History modal */}
      {historyView && (
        <div
          onClick={() => setHistoryView(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#111', border: '1px solid #2a2a2a', padding: 24, maxWidth: 480, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={st.sectionEyebrow}>{historyView.toUpperCase()} History</div>
              <button onClick={() => setHistoryView(null)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {photosByView[historyView].map(p => (
                <div key={p.id} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <img src={p.signedUrl} alt={p.view} style={{ width: 80, height: 107, objectFit: 'cover', flexShrink: 0 }} />
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: '#787878', letterSpacing: '0.08em' }}>
                    {fmtDateLong(p.taken_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BODY MEASUREMENTS ───────────────────────────────────────────────────────

const MEASURE_FIELDS = [
  { key: 'chest_cm',       label: 'Chest (cm)'       },
  { key: 'waist_cm',       label: 'Waist (cm)'       },
  { key: 'hips_cm',        label: 'Hips (cm)'        },
  { key: 'left_arm_cm',    label: 'Left Arm (cm)'    },
  { key: 'right_arm_cm',   label: 'Right Arm (cm)'   },
  { key: 'left_thigh_cm',  label: 'Left Thigh (cm)'  },
  { key: 'right_thigh_cm', label: 'Right Thigh (cm)' },
];

function BodyMeasurements() {
  const [history, setHistory] = useState([]);
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => { fetchMeasurements(); }, []);

  async function fetchMeasurements() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false });
    setHistory(data || []);
  }

  async function handleSave() {
    setError('');
    const hasAny = MEASURE_FIELDS.some(f => form[f.key] != null && form[f.key] !== '');
    if (!hasAny) { setError('Enter at least one measurement.'); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    const row = { user_id: user.id, logged_at: new Date().toISOString() };
    MEASURE_FIELDS.forEach(f => {
      if (form[f.key] !== '' && form[f.key] != null) row[f.key] = parseFloat(form[f.key]);
    });

    const { error: err } = await supabase.from('body_measurements').insert(row);
    setSaving(false);
    if (err) { setError(err.message); return; }

    await fetchMeasurements();
    setForm({});
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const latest = history[0] || null;
  const first  = history[history.length - 1] || null;

  return (
    <div style={{ marginTop: 32 }}>
      <div style={st.sectionEyebrow}>Body Measurements</div>

      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#555', fontStyle: 'italic', letterSpacing: '0.06em', margin: '0 0 20px' }}>
        Take measurements every 4 weeks for the most accurate tracking. Week 1, 4, 8 and 12.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 16 }}>
        {MEASURE_FIELDS.map(f => (
          <div key={f.key}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>
              {f.label}
            </div>
            <input
              type="number"
              step="0.1"
              min="0"
              value={form[f.key] || ''}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={latest?.[f.key] != null ? String(latest[f.key]) : '—'}
              style={st.measureInput}
            />
          </div>
        ))}
      </div>

      {error && <p style={st.errorMsg}>{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{ ...st.logBtn, width: '100%', height: 48, opacity: saving ? 0.6 : 1 }}
      >
        {saving ? '…' : 'Save Measurements'}
      </button>

      {saved && <div style={st.savedMsg}>✓ Measurements saved</div>}

      {/* Latest entry + change since first */}
      {latest && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555', marginBottom: 16 }}>
            Latest — {fmtDateLong(latest.logged_at)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {MEASURE_FIELDS.map(f => {
              const val = latest[f.key];
              if (val == null) return null;
              const firstVal = (first && first.id !== latest.id) ? first[f.key] : null;
              const diff = firstVal != null ? Number((val - firstVal).toFixed(1)) : null;
              return (
                <div key={f.key} style={{ background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.08)', padding: '14px 16px' }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: '#F5F3EE', lineHeight: 1 }}>
                    {val}cm
                  </div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.1em', color: '#555', marginTop: 5 }}>
                    {f.label.split(' (')[0]}
                  </div>
                  {diff !== null && (
                    <div style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 11,
                      letterSpacing: '0.06em',
                      marginTop: 3,
                      color: diff < 0 ? '#4CAF50' : diff > 0 ? '#C0392B' : '#555',
                    }}>
                      {diff > 0 ? '+' : ''}{diff}cm since start
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
          if (data?.data?.targetWeight) {
            setTargetWeight(Number(data.data.targetWeight));
          }
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

  const allYValues = [
    ...logs.map(l => l.weight_kg),
    targetWeight,
  ].filter(v => v != null);

  const yMin = allYValues.length ? Math.floor(Math.min(...allYValues) - 3) : 60;
  const yMax = allYValues.length ? Math.ceil(Math.max(...allYValues)  + 3) : 100;

  let toGoDisplay = null;
  let toGoSub     = null;
  if (currentLog && targetWeight != null) {
    const diff = currentLog.weight_kg - targetWeight;
    if (Math.abs(diff) < 0.05) {
      toGoDisplay = '0 kg';
      toGoSub     = '✓ at target';
    } else if (diff > 0) {
      toGoDisplay = `${diff.toFixed(1)} kg`;
      toGoSub     = '↓ to lose';
    } else {
      toGoDisplay = `${Math.abs(diff).toFixed(1)} kg`;
      toGoSub     = '↑ to gain';
    }
  }

  // ── Form handlers ────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Not authenticated. Please refresh.'); return; }
    const kg = parseFloat(inputVal);
    if (!kg || kg < 20 || kg > 400) {
      setError('Enter a valid weight (20–400 kg).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing && todayLog) {
        const { error: err } = await supabase
          .from('weight_logs')
          .update({ weight_kg: kg })
          .eq('id', todayLog.id)
          .eq('user_id', user.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('weight_logs')
          .insert({ user_id: user.id, weight_kg: kg, logged_at: new Date().toISOString() });
        if (err) throw err;
      }
      await fetchLogs();

      // Achievement checks — only on new logs, not edits
      if (!editing) {
        const { data: allLogs } = await supabase
          .from('weight_logs')
          .select('logged_at, weight_kg')
          .eq('user_id', user.id)
          .order('logged_at', { ascending: true });

        if (allLogs) {
          if (allLogs.length === 1) {
            await unlockAchievement(supabase, user.id, 'first_checkin', 10);
          }
          if (allLogs.length >= 2) {
            const startKg   = allLogs[0].weight_kg;
            const currentKg = allLogs[allLogs.length - 1].weight_kg;
            if (startKg - currentKg >= 1) {
              await unlockAchievement(supabase, user.id, 'moving_needle', 100);
            }
          }
          if (hasConsecutiveDays(allLogs, 30)) {
            await unlockAchievement(supabase, user.id, 'consistent', 200);
          }
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

  const showForm = !todayLog || editing;

  // ── Render ───────────────────────────────────────────────────────────────

  if (loadingLogs) {
    return <div style={{ color: '#555', padding: '60px 0', textAlign: 'center' }}>Loading…</div>;
  }

  return (
    <div>

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
            <button type="button" onClick={handleEdit} style={st.editBtn}>
              Edit
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 200 }}>
                <input
                  type="number"
                  step="0.1"
                  min="20"
                  max="400"
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
                <button type="button" onClick={handleCancelEdit} style={st.cancelBtn}>
                  Cancel
                </button>
              )}
            </div>
            {error && <p style={st.errorMsg}>{error}</p>}
          </form>
        )}

        {saved && (
          <div style={st.savedMsg}>✓ Weight saved</div>
        )}
      </div>

      {/* ── Graph ─────────────────────────────────────────────────── */}
      {chartData.length < 2 ? (
        <div style={st.emptyChart}>
          <div style={st.emptyChartIcon}>📈</div>
          <p style={st.emptyChartText}>
            Log your weight each morning to track your progress
          </p>
        </div>
      ) : (
        <div style={st.chartCard}>
          <div style={st.chartEyebrow}>Weight Over Time</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 32, bottom: 4, left: 0 }}
            >
              <CartesianGrid
                stroke="#1e1e1e"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fill: '#555', fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif" }}
                axisLine={{ stroke: '#1e1e1e' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fill: '#555', fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif" }}
                axisLine={false}
                tickLine={false}
                width={42}
                tickFormatter={v => `${v}`}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#333', strokeWidth: 1 }} />

              {startLog && (
                <ReferenceLine
                  y={startLog.weight_kg}
                  stroke="#333"
                  strokeDasharray="4 3"
                  label={{
                    value: `Start  ${startLog.weight_kg}kg`,
                    position: 'insideTopLeft',
                    fill: '#555',
                    fontSize: 10,
                    fontFamily: "'Barlow Condensed', sans-serif",
                  }}
                />
              )}

              {currentLog && currentLog.id !== startLog?.id && (
                <ReferenceLine
                  y={currentLog.weight_kg}
                  stroke="#444"
                  strokeDasharray="4 3"
                  label={{
                    value: `Now  ${currentLog.weight_kg}kg`,
                    position: 'insideBottomLeft',
                    fill: '#555',
                    fontSize: 10,
                    fontFamily: "'Barlow Condensed', sans-serif",
                  }}
                />
              )}

              {targetWeight != null && (
                <ReferenceLine
                  y={targetWeight}
                  stroke="#1E7A3E"
                  strokeDasharray="4 3"
                  label={{
                    value: `Target  ${targetWeight}kg`,
                    position: 'insideTopRight',
                    fill: '#1E7A3E',
                    fontSize: 10,
                    fontFamily: "'Barlow Condensed', sans-serif",
                  }}
                />
              )}

              <Line
                type="monotone"
                dataKey="weight"
                stroke="#C0392B"
                strokeWidth={2}
                dot={{ fill: '#C0392B', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#C0392B', stroke: '#080808', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Stats row ─────────────────────────────────────────────── */}
      {logs.length > 0 && (
        <div style={st.statsRow}>
          <StatCard
            label="Starting Weight"
            value={startLog ? `${startLog.weight_kg} kg` : '—'}
          />
          <StatCard
            label="Current Weight"
            value={currentLog ? `${currentLog.weight_kg} kg` : '—'}
            highlight
          />
          <StatCard
            label="To Go"
            value={toGoDisplay ?? '—'}
            sub={toGoSub}
          />
        </div>
      )}

      {/* ── Progress Photos ───────────────────────────────────────── */}
      <ProgressPhotos />

      {/* ── Body Measurements ─────────────────────────────────────── */}
      <BodyMeasurements />

    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const st = {
  inputCard: {
    background: '#0d0d0d',
    border: '1px solid rgba(200,200,200,0.12)',
    padding: '24px 24px 22px',
    marginBottom: 20,
  },
  inputEyebrow: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.28em',
    textTransform: 'uppercase',
    color: '#555',
    marginBottom: 16,
  },
  sectionEyebrow: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.28em',
    textTransform: 'uppercase',
    color: '#555',
    marginBottom: 20,
  },
  loggedVal: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 40,
    color: '#F5F3EE',
    lineHeight: 1,
  },
  loggedUnit: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 18,
    color: '#787878',
    fontWeight: 600,
  },
  loggedMeta: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13,
    color: '#444',
    letterSpacing: '0.06em',
  },
  editBtn: {
    background: 'none',
    border: '1px solid rgba(200,200,200,0.2)',
    color: '#787878',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    padding: '8px 20px',
    cursor: 'pointer',
  },
  weightInput: {
    width: '100%',
    padding: '14px 48px 14px 16px',
    background: '#111',
    border: '1px solid rgba(200,200,200,0.15)',
    color: '#F5F3EE',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 28,
    outline: 'none',
    boxSizing: 'border-box',
    lineHeight: 1,
  },
  kgBadge: {
    position: 'absolute',
    right: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#555',
    pointerEvents: 'none',
  },
  logBtn: {
    background: '#C0392B',
    border: 'none',
    color: '#ffffff',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    padding: '0 28px',
    cursor: 'pointer',
    height: 54,
    whiteSpace: 'nowrap',
    transition: 'background 0.15s',
  },
  cancelBtn: {
    background: 'none',
    border: '1px solid rgba(200,200,200,0.15)',
    color: '#555',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    padding: '0 20px',
    cursor: 'pointer',
    height: 54,
  },
  errorMsg: {
    color: '#ef4444',
    fontSize: 12,
    fontFamily: "'Barlow Condensed', sans-serif",
    letterSpacing: '0.06em',
    marginTop: 8,
  },
  savedMsg: {
    marginTop: 14,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: '#4CAF50',
  },
  emptyChart: {
    background: '#0d0d0d',
    border: '1px solid rgba(200,200,200,0.08)',
    padding: '60px 24px',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyChartIcon: {
    fontSize: 32,
    marginBottom: 16,
  },
  emptyChartText: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 14,
    color: '#555',
    letterSpacing: '0.06em',
    maxWidth: 320,
    margin: '0 auto',
  },
  chartCard: {
    background: '#0d0d0d',
    border: '1px solid rgba(200,200,200,0.08)',
    padding: '24px 8px 16px 0',
    marginBottom: 20,
  },
  chartEyebrow: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.28em',
    textTransform: 'uppercase',
    color: '#555',
    marginBottom: 16,
    paddingLeft: 24,
  },
  statsRow: {
    display: 'flex',
    gap: 12,
  },
  compareSelect: {
    flex: 1,
    minWidth: 0,
    background: '#111',
    border: '1px solid rgba(200,200,200,0.15)',
    color: '#F5F3EE',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 13,
    letterSpacing: '0.08em',
    padding: '10px 12px',
    outline: 'none',
    cursor: 'pointer',
  },
  measureInput: {
    width: '100%',
    padding: '10px 12px',
    background: '#111',
    border: '1px solid rgba(200,200,200,0.15)',
    color: '#F5F3EE',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 16,
    outline: 'none',
    boxSizing: 'border-box',
  },
};
