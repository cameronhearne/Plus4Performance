import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const API = import.meta.env.VITE_API_URL || '';

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
};

const h2Style = {
  fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 30,
  lineHeight: 1.05, textTransform: 'uppercase', color: C.bone, margin: '18px 0 6px',
};
const subStyle = { fontSize: 14, color: C.ash, marginBottom: 26, lineHeight: 1.5 };
const scaleEndsStyle = { display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: C.ashDim };
const inputStyle = {
  width: '100%', background: C.surface2, border: `1px solid ${C.glowLine}`,
  borderRadius: 10, padding: '14px 16px', color: C.bone,
  fontFamily: "'Inter', sans-serif", fontSize: 16, outline: 'none',
};
const taStyle = { ...inputStyle, minHeight: 90, resize: 'vertical', lineHeight: 1.5 };

function getMondayLabel() {
  const d = new Date();
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  const yyyy = monday.getFullYear();
  const mm   = String(monday.getMonth() + 1).padStart(2, '0');
  const dd   = String(monday.getDate()).padStart(2, '0');
  return `Week of ${yyyy}-${mm}-${dd}`;
}

// ─── Done screen ──────────────────────────────────────────────────────────────

function DoneScreen({ navigate }) {
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    const t = setTimeout(() => navigate('/dashboard', { replace: true }), 5000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="coaching-step" style={{ textAlign: 'center', padding: '60px 0' }}>
      <div style={{ width: 74, height: 74, borderRadius: 99, margin: '0 auto 22px', border: `2px solid ${C.glowBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, boxShadow: `0 0 28px -6px ${C.glow}` }}>✓</div>
      <h2 style={h2Style}>Check-in Sent</h2>
      <p style={{ ...subStyle, marginBottom: 32 }}>Your coach has it. You&apos;ll get a response in your Coaching tab within 24 hours.</p>
      <button
        onClick={() => navigate('/dashboard', { replace: true })}
        onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
        onMouseUp={e => { e.currentTarget.style.transform = ''; }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
        style={{ padding: '17px 32px', borderRadius: 11, background: 'linear-gradient(160deg,#18151F,#100E15)', border: `1px solid ${C.glowBorder}`, color: C.bone, fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer', boxShadow: `0 10px 26px -10px ${C.glow}`, transition: 'transform 0.1s' }}>
        Back to Dashboard &rarr;
      </button>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Scale({ value, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 6 }}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
        <button key={n} onClick={() => onChange(n)} style={{
          aspectRatio: '1', padding: 0, cursor: 'pointer',
          background: value === n ? 'linear-gradient(160deg,#1B1622,#120E18)' : C.surface2,
          border: `1px solid ${value === n ? C.glowBorder : C.glowLine}`,
          borderRadius: 8, color: value === n ? C.bone : C.ash,
          fontFamily: "'Roboto Mono', monospace", fontWeight: 600, fontSize: 14,
          boxShadow: value === n ? `0 0 0 1px ${C.glowBorder}, 0 0 14px -3px ${C.glow}` : 'none',
          transition: 'all 0.15s ease',
        }}>{n}</button>
      ))}
    </div>
  );
}

function Seg({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)} style={{
          flex: 1, cursor: 'pointer', padding: '13px', borderRadius: 9,
          background: value === opt ? 'linear-gradient(160deg,#1B1622,#120E18)' : C.surface2,
          border: `1px solid ${value === opt ? C.glowBorder : C.glowLine}`,
          color: value === opt ? C.bone : C.ash,
          fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14,
          boxShadow: value === opt ? `0 0 14px -4px ${C.glow}` : 'none',
          transition: 'all 0.15s ease',
        }}>{opt}</button>
      ))}
    </div>
  );
}

function Q({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <label style={{ display: 'block', fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: C.bone, marginBottom: 6 }}>
        {label}
      </label>
      {hint && <span style={{ display: 'block', fontSize: 13, color: C.ashDim, marginBottom: 14 }}>{hint}</span>}
      {children}
    </div>
  );
}

function Reveal({ show, children }) {
  if (!show) return null;
  return <div className="coaching-reveal" style={{ marginTop: 14 }}>{children}</div>;
}

function WithUnit({ unit, children }) {
  return (
    <div style={{ position: 'relative' }}>
      {children}
      <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: C.ashDim, fontSize: 14, fontFamily: "'Roboto Mono', monospace", pointerEvents: 'none' }}>
        {unit}
      </span>
    </div>
  );
}

function PhotoSlot({ label, file, onSelect }) {
  const ref = useRef(null);
  return (
    <div onClick={() => ref.current?.click()} style={{
      aspectRatio: '3/4', background: C.surface2, borderRadius: 10, cursor: 'pointer',
      border: `1px ${file ? 'solid' : 'dashed'} ${file ? C.glowBorder : C.glowLine}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 8, textAlign: 'center', padding: 8,
      color: file ? C.bone : C.ashDim, fontSize: 12,
      boxShadow: file ? `0 0 16px -6px ${C.glow}` : 'none',
      transition: 'border-color 0.18s',
    }}>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onSelect(f); }} />
      <span style={{ fontSize: 22 }}>{file ? '✓' : '+'}</span>
      <span>{file ? 'Ready' : label}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CoachingCheckin() {
  const navigate = useNavigate();

  const [loading,     setLoading]     = useState(true);
  const [isMonthly,   setIsMonthly]   = useState(false);
  const [stepIdx,     setStepIdx]     = useState(0);
  const [animKey,     setAnimKey]     = useState(0);
  const [done,        setDone]        = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [form, setForm] = useState({
    weight: '',
    trainingScore: null, missedTraining: null, missedTrainingDetail: '',
    cardioDetail: '', missedCardio: null, missedCardioDetail: '', avgSteps: '',
    onPlan: null, missedMeals: null, missedMealsDetail: '',
    appetite: null, digestion: null, digestionNote: '',
    alcohol: null, alcoholDetail: '',
    waterLitres: '', foodChanges: '', liquidsWaterSalt: '', offPlanMeal: '',
    sleepScore: null, energyScore: null,
    supplements: '', waistCm: '', chestCm: '', hipsCm: '', armCm: '', thighCm: '', longTermGoal: '', coachFeedback: '',
    biggestWin: '', upcomingEvents: '', questionsForCoach: '',
  });
  const upd = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const [photoFiles,       setPhotoFiles]       = useState({});
  const [posingFiles,      setPosingFiles]      = useState([]);
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const posingRef = useRef(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login', { replace: true }); return; }

      const [{ data: profile }, { count }] = await Promise.all([
        supabase.from('profiles').select('coach_id, checkin_template').eq('id', session.user.id).maybeSingle(),
        supabase.from('coaching_checkins').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id),
      ]);

      if (!profile?.coach_id) { navigate('/dashboard', { replace: true }); return; }

      const c = count ?? 0;
      setIsMonthly(c === 0 || c % 4 === 0);

      // TODO: enhanced template branch for PED/bloods variant
      // if (profile.checkin_template === 'enhanced') { ... }

      setLoading(false);
    }
    init();
  }, [navigate]);

  const STEP_DEFS = [
    { key: 'body',      label: 'Weekly Check-in' },
    { key: 'training',  label: 'Weekly Check-in' },
    { key: 'nutrition', label: 'Weekly Check-in' },
    { key: 'recovery',  label: 'Weekly Check-in' },
    { key: 'photos',    label: 'Weekly Check-in' },
    ...(isMonthly ? [{ key: 'monthly', label: 'Monthly Review' }] : []),
    { key: 'coach',     label: 'Weekly Check-in' },
  ];
  const totalSteps  = STEP_DEFS.length;
  const currentStep = STEP_DEFS[stepIdx];
  const isLastStep  = stepIdx === totalSteps - 1;

  function advance() {
    setStepIdx(i => i + 1);
    setAnimKey(k => k + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function retreat() {
    setStepIdx(i => i - 1);
    setAnimKey(k => k + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSubmitting(false); return; }
    const now = new Date().toISOString();
    const errors = [];

    // 1. Weight → weight_logs (same logic as ProgressTab)
    const kg = parseFloat(form.weight);
    if (!isNaN(kg) && kg >= 20 && kg <= 400) {
      const { error: e } = await supabase.from('weight_logs').insert({
        user_id: session.user.id, weight_kg: kg, logged_at: now,
      });
      if (e) errors.push(`Weight: ${e.message}`);
    }

    // 2. Photos → progress-photos storage + progress_photos rows (same logic as ProgressTab)
    let anyPhoto = false;
    for (const [view, file] of Object.entries(photoFiles)) {
      const path = `${session.user.id}/${Date.now()}_${view}.jpg`;
      const { error: upErr } = await supabase.storage.from('progress-photos').upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) { errors.push(`Photo ${view}: ${upErr.message}`); continue; }
      const { data: urlData } = await supabase.storage.from('progress-photos').createSignedUrl(path, 31536000);
      const { error: dbErr } = await supabase.from('progress_photos').insert({
        user_id: session.user.id, view, storage_path: path,
        photo_url: urlData?.signedUrl || '', taken_at: now,
      });
      if (!dbErr) anyPhoto = true;
      else errors.push(`Photo DB ${view}: ${dbErr.message}`);
    }
    for (const file of posingFiles) {
      const path = `${session.user.id}/${Date.now()}_posing_${Math.random().toString(36).slice(2)}.jpg`;
      const { error: upErr } = await supabase.storage.from('progress-photos').upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) { errors.push(`Posing photo: ${upErr.message}`); continue; }
      const { data: urlData } = await supabase.storage.from('progress-photos').createSignedUrl(path, 31536000);
      const { error: dbErr } = await supabase.from('progress_photos').insert({
        user_id: session.user.id, view: 'posing', storage_path: path,
        photo_url: urlData?.signedUrl || '', taken_at: now,
      });
      if (!dbErr) anyPhoto = true;
      else errors.push(`Posing photo DB: ${dbErr.message}`);
    }

    // 3. Monthly measurements → body_measurements
    if (isMonthly && (form.waistCm || form.chestCm || form.hipsCm || form.armCm || form.thighCm)) {
      const row = { user_id: session.user.id, logged_at: now };
      if (form.waistCm)  row.waist_cm      = parseFloat(form.waistCm);
      if (form.chestCm)  row.chest_cm      = parseFloat(form.chestCm);
      if (form.hipsCm)   row.hips_cm       = parseFloat(form.hipsCm);
      if (form.armCm)    row.left_arm_cm   = parseFloat(form.armCm);
      if (form.thighCm)  row.left_thigh_cm = parseFloat(form.thighCm);
      const { error: e } = await supabase.from('body_measurements').insert(row);
      if (e) errors.push(`Measurements: ${e.message}`);
    }

    // 4. Everything else → POST /api/coaching/checkins (coach_id derived server-side)
    const responses = {
      trainingScore:        form.trainingScore,
      missedTraining:       form.missedTraining,
      missedTrainingDetail: form.missedTrainingDetail || null,
      cardioDetail:         form.cardioDetail         || null,
      missedCardio:         form.missedCardio,
      missedCardioDetail:   form.missedCardioDetail   || null,
      avgSteps:             form.avgSteps ? parseInt(form.avgSteps, 10) : null,
      onPlan:               form.onPlan,
      missedMeals:          form.missedMeals,
      missedMealsDetail:    form.missedMealsDetail    || null,
      appetite:             form.appetite,
      digestion:            form.digestion,
      digestionNote:        form.digestionNote        || null,
      alcohol:              form.alcohol,
      alcoholDetail:        form.alcoholDetail        || null,
      waterLitres:          form.waterLitres ? parseFloat(form.waterLitres) : null,
      foodChanges:          form.foodChanges          || null,
      liquidsWaterSalt:     form.liquidsWaterSalt     || null,
      offPlanMeal:          form.offPlanMeal          || null,
      sleepScore:           form.sleepScore,
      energyScore:          form.energyScore,
      ...(isMonthly ? {
        supplements:   form.supplements   || null,
        longTermGoal:  form.longTermGoal  || null,
        coachFeedback: form.coachFeedback || null,
      } : {}),
      biggestWin:         form.biggestWin         || null,
      upcomingEvents:     form.upcomingEvents     || null,
      questionsForCoach:  form.questionsForCoach  || null,
    };

    try {
      const res = await fetch(`${API}/api/coaching/checkins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ period_label: getMondayLabel(), responses, photos_included: anyPhoto }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        errors.push(err.error || 'Failed to save check-in');
      }
    } catch (e) {
      errors.push(e.message);
    }

    setSubmitting(false);
    if (errors.length === 0) {
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setSubmitError(errors.join('. '));
    }
  }

  // ─── Step renderers ───────────────────────────────────────────────────────

  function renderBody() {
    return (
      <>
        <h2 style={h2Style}>Body</h2>
        <p style={subStyle}>Start with the number. Everything else is context for it.</p>
        <Q label="Current weight" hint="Same time of day, same conditions as last week if you can.">
          <WithUnit unit="kg">
            <input className="coaching-inp" type="number" inputMode="decimal" placeholder="0.0"
              value={form.weight} onChange={e => upd('weight', e.target.value)}
              style={{ ...inputStyle, paddingRight: 48 }} />
          </WithUnit>
        </Q>
      </>
    );
  }

  function renderTraining() {
    return (
      <>
        <h2 style={h2Style}>Training &amp; Cardio</h2>
        <p style={subStyle}>How the work in the gym actually went.</p>
        <Q label="How's training been?" hint="10 = hitting PBs.">
          <Scale value={form.trainingScore} onChange={v => upd('trainingScore', v)} />
          <div style={scaleEndsStyle}><span>Struggling</span><span>PBs</span></div>
        </Q>
        <Q label="Missed any sessions?">
          <Seg options={['No', 'Yes']} value={form.missedTraining} onChange={v => upd('missedTraining', v)} />
          <Reveal show={form.missedTraining === 'Yes'}>
            <textarea className="coaching-inp" style={taStyle} placeholder="Which sessions, and why?"
              value={form.missedTrainingDetail} onChange={e => upd('missedTrainingDetail', e.target.value)} />
          </Reveal>
        </Q>
        <Q label="Cardio this week" hint="What machine, what you did, how long.">
          <textarea className="coaching-inp" style={taStyle} placeholder="e.g. Stairmaster, 20 min steady, 3x this week"
            value={form.cardioDetail} onChange={e => upd('cardioDetail', e.target.value)} />
        </Q>
        <Q label="Missed any scheduled cardio?">
          <Seg options={['No', 'Yes']} value={form.missedCardio} onChange={v => upd('missedCardio', v)} />
          <Reveal show={form.missedCardio === 'Yes'}>
            <textarea className="coaching-inp" style={taStyle} placeholder="What did you miss, and why?"
              value={form.missedCardioDetail} onChange={e => upd('missedCardioDetail', e.target.value)} />
          </Reveal>
        </Q>
        <Q label="Average daily steps">
          <WithUnit unit="steps">
            <input className="coaching-inp" type="number" inputMode="numeric" placeholder="0"
              value={form.avgSteps} onChange={e => upd('avgSteps', e.target.value)}
              style={{ ...inputStyle, paddingRight: 64 }} />
          </WithUnit>
        </Q>
      </>
    );
  }

  function renderNutrition() {
    return (
      <>
        <h2 style={h2Style}>Nutrition</h2>
        <p style={subStyle}>The honest version. I can only adjust what I can see.</p>
        <Q label="Did you manage a full week on plan?">
          <Seg options={['Yes', 'Mostly', 'No']} value={form.onPlan} onChange={v => upd('onPlan', v)} />
        </Q>
        <Q label="Missed any meals?">
          <Seg options={['No', 'Yes']} value={form.missedMeals} onChange={v => upd('missedMeals', v)} />
          <Reveal show={form.missedMeals === 'Yes'}>
            <textarea className="coaching-inp" style={taStyle} placeholder="Which meals, how often?"
              value={form.missedMealsDetail} onChange={e => upd('missedMealsDetail', e.target.value)} />
          </Reveal>
        </Q>
        <Q label="Appetite this week">
          <Scale value={form.appetite} onChange={v => upd('appetite', v)} />
          <div style={scaleEndsStyle}><span>No appetite</span><span>Ravenous</span></div>
        </Q>
        <Q label="Digestion">
          <Scale value={form.digestion} onChange={v => upd('digestion', v)} />
          <div style={scaleEndsStyle}><span>Poor</span><span>Perfect</span></div>
          <div style={{ marginTop: 14 }}>
            <input className="coaching-inp" type="text" placeholder="Anything worth noting? (optional)"
              value={form.digestionNote} onChange={e => upd('digestionNote', e.target.value)}
              style={inputStyle} />
          </div>
        </Q>
        <Q label="Alcohol this week?">
          <Seg options={['No', 'Yes']} value={form.alcohol} onChange={v => upd('alcohol', v)} />
          <Reveal show={form.alcohol === 'Yes'}>
            <input className="coaching-inp" type="text" placeholder="Roughly how much, and when?"
              value={form.alcoholDetail} onChange={e => upd('alcoholDetail', e.target.value)}
              style={inputStyle} />
          </Reveal>
        </Q>
        <Q label="Water — average per day">
          <WithUnit unit="litres">
            <input className="coaching-inp" type="number" inputMode="decimal" placeholder="0.0"
              value={form.waterLitres} onChange={e => upd('waterLitres', e.target.value)}
              style={{ ...inputStyle, paddingRight: 68 }} />
          </WithUnit>
        </Q>
        <Q label="Anything change with food or condiments?">
          <textarea className="coaching-inp" style={taStyle}
            placeholder="New foods, swapped sauces, more/less salt, condiments — anything different from plan."
            value={form.foodChanges} onChange={e => upd('foodChanges', e.target.value)} />
        </Q>
        <Q label="Liquids, water &amp; salt">
          <textarea className="coaching-inp" style={taStyle}
            placeholder={"Liquids — tea, coffee, fizzy drinks, etc.\nWater intake + how much salt you're having daily."}
            value={form.liquidsWaterSalt} onChange={e => upd('liquidsWaterSalt', e.target.value)} />
        </Q>
        <Q label="Did you have an off-plan meal? When, and what was it?"
           hint="I need the actual food, not just the day — detail matters.">
          <input className="coaching-inp" type="text"
            placeholder="e.g. Friday night — pizza and a couple of beers"
            value={form.offPlanMeal} onChange={e => upd('offPlanMeal', e.target.value)}
            style={inputStyle} />
        </Q>
      </>
    );
  }

  function renderRecovery() {
    return (
      <>
        <h2 style={h2Style}>Recovery</h2>
        <p style={subStyle}>Recovery drives everything else. Be straight with me.</p>
        <Q label="Sleep quality">
          <Scale value={form.sleepScore} onChange={v => upd('sleepScore', v)} />
          <div style={scaleEndsStyle}><span>Wrecked</span><span>Fully rested</span></div>
        </Q>
        <Q label="Daytime energy">
          <Scale value={form.energyScore} onChange={v => upd('energyScore', v)} />
          <div style={scaleEndsStyle}><span>Flat</span><span>Firing</span></div>
        </Q>
      </>
    );
  }

  function renderPhotos() {
    return (
      <>
        <h2 style={h2Style}>Progress Photos</h2>
        <p style={subStyle}>Optional this week — but the camera sees what the scale can't.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {['front', 'side', 'back'].map(view => (
            <PhotoSlot key={view} label={view.charAt(0).toUpperCase() + view.slice(1)}
              file={photoFiles[view]}
              onSelect={f => setPhotoFiles(pf => ({ ...pf, [view]: f }))} />
          ))}
        </div>
        <p style={{ fontSize: 12, color: C.ashDim, marginTop: 12, lineHeight: 1.5 }}>
          Same lighting, same time of day, relaxed. These are for tracking — consistency beats quality.
        </p>

        <div style={{ height: 1, background: C.glowLine, margin: '26px 0 22px' }} />

        <label style={{ display: 'block', fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 15, color: C.bone, marginBottom: 6 }}>
          Posing shots <span style={{ color: C.ashDim, fontWeight: 400 }}>— optional</span>
        </label>
        <span style={{ display: 'block', fontSize: 13, color: C.ashDim, marginBottom: 14 }}>
          Caught good light, or hit a pump worth showing off? Drop them here. No rules — these are the ones to feel good about.
        </span>
        <div onClick={() => posingRef.current?.click()} style={{
          background: C.surface2, borderRadius: 10, padding: 20,
          border: `1px ${posingFiles.length > 0 ? 'solid' : 'dashed'} ${posingFiles.length > 0 ? C.glowBorder : C.glowLine}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          cursor: 'pointer', color: posingFiles.length > 0 ? C.bone : C.ash,
          fontSize: 14, fontWeight: 500,
          boxShadow: posingFiles.length > 0 ? `0 0 16px -6px ${C.glow}` : 'none',
          transition: 'border-color 0.18s',
        }}>
          <input ref={posingRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={e => setPosingFiles(Array.from(e.target.files || []))} />
          <span style={{ fontSize: 18 }}>{posingFiles.length > 0 ? '✓' : '+'}</span>
          {posingFiles.length > 0
            ? `${posingFiles.length} photo${posingFiles.length > 1 ? 's' : ''} selected`
            : 'Add posing photos'}
        </div>
        <p style={{ fontSize: 12, color: C.ashDim, marginTop: 12, lineHeight: 1.5 }}>
          All photos stored privately — only you and your coach ever see them.
        </p>
      </>
    );
  }

  function renderMonthly() {
    return (
      <>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 14,
          fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: '0.16em',
          fontSize: 10, textTransform: 'uppercase', color: C.ash,
          border: `1px solid ${C.glowLine}`, borderRadius: 99, padding: '5px 12px',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, display: 'inline-block',
            background: 'linear-gradient(90deg,#E8389E,#FF4FC4,#FF8FE0)',
            boxShadow: `0 0 8px ${C.glow}` }} />
          Monthly Review
        </div>
        <h2 style={h2Style}>The Bigger Picture</h2>
        <p style={subStyle}>A few extra questions once a month. Skip what doesn't apply.</p>
        <Q label="Supplements you're currently taking">
          <textarea className="coaching-inp" style={taStyle}
            placeholder="Everything — creatine, protein, vitamins, the lot."
            value={form.supplements} onChange={e => upd('supplements', e.target.value)} />
        </Q>
        <div style={{ marginBottom: 30 }}>
          <button type="button" onClick={() => setMeasurementsOpen(o => !o)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', background: C.surface2, border: `1px solid ${C.glowLine}`,
            borderRadius: measurementsOpen ? '10px 10px 0 0' : 10, padding: '14px 16px',
            cursor: 'pointer', color: C.ash, fontFamily: "'Inter', sans-serif",
            fontWeight: 600, fontSize: 14, transition: 'border-radius 0.2s',
          }}>
            <span>Add measurements <span style={{ color: C.ashDim, fontWeight: 400 }}>(optional)</span></span>
            <span style={{ display: 'inline-block', fontSize: 12, color: C.ashDim, transition: 'transform 0.2s', transform: measurementsOpen ? 'rotate(90deg)' : 'none' }}>&#9654;</span>
          </button>
          {measurementsOpen && (
            <div className="coaching-reveal" style={{ background: C.surface2, border: `1px solid ${C.glowLine}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '16px 16px 8px' }}>
              {[
                { key: 'waistCm',  label: 'Waist' },
                { key: 'chestCm',  label: 'Chest' },
                { key: 'hipsCm',   label: 'Hips'  },
                { key: 'armCm',    label: 'Arm'   },
                { key: 'thighCm',  label: 'Thigh' },
              ].map(({ key, label }) => (
                <div key={key} style={{ marginBottom: 10 }}>
                  <WithUnit unit="cm">
                    <input className="coaching-inp" type="number" inputMode="decimal" placeholder={label}
                      value={form[key]} onChange={e => upd(key, e.target.value)}
                      style={{ ...inputStyle, paddingRight: 48 }} />
                  </WithUnit>
                </div>
              ))}
            </div>
          )}
        </div>
        <Q label="Long-term goal — still the same?">
          <textarea className="coaching-inp" style={taStyle}
            placeholder="Has anything shifted in what you're chasing?"
            value={form.longTermGoal} onChange={e => upd('longTermGoal', e.target.value)} />
        </Q>
        <Q label="Anything I can do to coach you better?">
          <textarea className="coaching-inp" style={taStyle}
            placeholder="Be honest — this is how the service improves."
            value={form.coachFeedback} onChange={e => upd('coachFeedback', e.target.value)} />
        </Q>
      </>
    );
  }

  function renderCoach() {
    return (
      <>
        <h2 style={h2Style}>For Your Coach</h2>
        <p style={subStyle}>Last bit. This is what I read first.</p>
        <Q label="Biggest win this week">
          <textarea className="coaching-inp" style={taStyle}
            placeholder="Something went right. What was it?"
            value={form.biggestWin} onChange={e => upd('biggestWin', e.target.value)} />
        </Q>
        <Q label="Any upcoming social events to work around?">
          <textarea className="coaching-inp" style={taStyle}
            placeholder="Weddings, holidays, meals out — anything coming up."
            value={form.upcomingEvents} onChange={e => upd('upcomingEvents', e.target.value)} />
        </Q>
        <Q label="Questions for me">
          <textarea className="coaching-inp" style={taStyle}
            placeholder="Anything you're unsure about or want me to look at."
            value={form.questionsForCoach} onChange={e => upd('questionsForCoach', e.target.value)} />
        </Q>
      </>
    );
  }

  function renderStep() {
    const k = currentStep?.key;
    if (k === 'body')      return renderBody();
    if (k === 'training')  return renderTraining();
    if (k === 'nutrition') return renderNutrition();
    if (k === 'recovery')  return renderRecovery();
    if (k === 'photos')    return renderPhotos();
    if (k === 'monthly')   return renderMonthly();
    if (k === 'coach')     return renderCoach();
    return null;
  }

  // ─── Layout ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: C.ash, fontFamily: "'Inter', sans-serif", fontSize: 14 }}>Loading…</span>
      </div>
    );
  }

  const barPct = `${((stepIdx + 1) / totalSteps) * 100}%`;

  return (
    <div style={{ minHeight: '100vh', background: C.ink, backgroundImage: 'radial-gradient(50% 38% at 50% 0%, rgba(255,79,196,0.10) 0%, rgba(0,0,0,0) 70%)', color: C.bone, fontFamily: "'Inter', sans-serif", WebkitFontSmoothing: 'antialiased', paddingBottom: 40 }}>
      <style>{`
        @keyframes coachingFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .coaching-step    { animation: coachingFadeUp 0.4s ease; }
        .coaching-reveal  { animation: coachingFadeUp 0.3s ease; }
        .coaching-inp:focus { border-color: rgba(255,79,196,0.42) !important; box-shadow: 0 0 0 3px rgba(255,79,196,0.10) !important; outline: none; }
        @media (prefers-reduced-motion: reduce) {
          .coaching-step, .coaching-reveal { animation: none !important; }
          * { transition: none !important; }
        }
      `}</style>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 20px' }}>

        {/* ── Top bar ── */}
        {!done && (
          <div style={{ position: 'sticky', top: 0, background: 'linear-gradient(180deg,#08070A 70%,rgba(8,7,10,0) 100%)', padding: '22px 0 16px', zIndex: 5 }}>
            <div style={{ height: 4, background: C.surface, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg,#E8389E,#FF4FC4,#FF8FE0)', boxShadow: `0 0 12px -2px ${C.glow}`, borderRadius: 99, width: barPct, transition: 'width 0.35s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}>
              <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 500, letterSpacing: '0.3em', fontSize: 10, textTransform: 'uppercase', color: C.ashDim }}>
                {currentStep?.label}
              </span>
              <span style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 600, fontSize: 11, color: C.ashDim }}>
                {String(stepIdx + 1).padStart(2, '0')} / {String(totalSteps).padStart(2, '0')}
              </span>
            </div>
          </div>
        )}

        {/* ── Done state ── */}
        {done ? (
          <DoneScreen navigate={navigate} />
        ) : (
          <>
            {/* ── Step content ── */}
            <div key={animKey} className="coaching-step">
              {renderStep()}
            </div>

            {submitError && (
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#E8503A', marginBottom: 14, lineHeight: 1.5 }}>
                {submitError}
              </p>
            )}

            {/* ── Nav ── */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              {stepIdx > 0 && (
                <button onClick={retreat}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                  onMouseUp={e => e.currentTarget.style.transform = ''}
                  onMouseLeave={e => e.currentTarget.style.transform = ''}
                  style={{ flex: '0 0 92px', padding: '17px', borderRadius: 11, fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer', background: 'transparent', border: `1px solid ${C.glowLine}`, color: C.ash, transition: 'transform 0.1s' }}>
                  Back
                </button>
              )}
              <button
                onClick={isLastStep ? handleSubmit : advance}
                disabled={submitting}
                onMouseDown={e => { if (!submitting) e.currentTarget.style.transform = 'scale(0.97)'; }}
                onMouseUp={e => e.currentTarget.style.transform = ''}
                onMouseLeave={e => e.currentTarget.style.transform = ''}
                style={{ flex: 1, padding: '17px', borderRadius: 11, fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', cursor: submitting ? 'default' : 'pointer', background: 'linear-gradient(160deg,#18151F,#100E15)', border: `1px solid ${C.glowBorder}`, color: C.bone, boxShadow: `0 10px 26px -10px ${C.glow}`, opacity: submitting ? 0.6 : 1, transition: 'transform 0.1s, box-shadow 0.18s' }}>
                {submitting ? 'Sending…' : isLastStep ? 'Send Check-in' : 'Next'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
