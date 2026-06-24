import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { submitSnapshot } from '../lib/api';
import './intake-flow.css';

const TOTAL_STEPS = 5;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ─── Section 1: Your Details ─────────────────────────────────────────────────

function Section1({ data, onChange }) {
  const [heightUnit, setHeightUnit] = useState('cm');
  const [weightUnit, setWeightUnit] = useState('kg');

  return (
    <div>
      <h2 className="if-heading" style={{ animationDelay: '0s' }}>Your details</h2>

      <div className="if-form-group">
        <label className="if-label">Biological sex</label>
        <div className="if-select-wrap">
          <select
            className="if-select"
            value={data.sex || ''}
            onChange={e => onChange('sex', e.target.value)}
            required
          >
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
      </div>

      <div className="if-form-group">
        <label className="if-label">Age</label>
        <input
          className="if-input"
          type="number"
          min="16"
          max="80"
          placeholder="e.g. 28"
          value={data.age || ''}
          onChange={e => onChange('age', e.target.value)}
          required
        />
      </div>

      <div className="if-form-group">
        <label className="if-label">Height</label>
        <div className="if-unit-toggle">
          {['cm', 'ft/in'].map(u => (
            <button
              key={u}
              type="button"
              className={`if-unit-opt${heightUnit === u ? ' active' : ''}`}
              onClick={() => setHeightUnit(u)}
            >
              {u.toUpperCase()}
            </button>
          ))}
        </div>
        {heightUnit === 'cm' ? (
          <input
            className="if-input"
            type="number"
            placeholder="Height (cm)"
            value={data.heightCm || ''}
            onChange={e => onChange('heightCm', e.target.value)}
          />
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="if-input"
              type="number"
              placeholder="Feet"
              value={data.heightFeet || ''}
              onChange={e => onChange('heightFeet', e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              className="if-input"
              type="number"
              placeholder="Inches"
              min="0"
              max="11"
              value={data.heightInches || ''}
              onChange={e => onChange('heightInches', e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
        )}
      </div>

      <div className="if-form-group">
        <label className="if-label">Current weight</label>
        <div className="if-unit-toggle">
          {['kg', 'lbs'].map(u => (
            <button
              key={u}
              type="button"
              className={`if-unit-opt${weightUnit === u ? ' active' : ''}`}
              onClick={() => setWeightUnit(u)}
            >
              {u.toUpperCase()}
            </button>
          ))}
        </div>
        <input
          className="if-input"
          type="number"
          placeholder={`Weight (${weightUnit})`}
          value={weightUnit === 'kg' ? data.weightKg || '' : data.weightLbs || ''}
          onChange={e => onChange(weightUnit === 'kg' ? 'weightKg' : 'weightLbs', e.target.value)}
        />
      </div>

      <div className="if-form-group">
        <label className="if-label">Target weight ({weightUnit})</label>
        <input
          className="if-input"
          type="number"
          placeholder={`Target (${weightUnit})`}
          value={data.targetWeight || ''}
          onChange={e => onChange('targetWeight', e.target.value)}
          required
        />
        <p className="if-hint">We'll build your plan around a safe, sustainable target — up to 1 kg per week over 12 weeks.</p>
      </div>

      <div className="if-form-group">
        <label className="if-label">Activity level</label>
        <div className="if-select-wrap">
          <select
            className="if-select"
            value={data.activity || ''}
            onChange={e => onChange('activity', e.target.value)}
            required
          >
            <option value="">Select…</option>
            <option value="sedentary">Sedentary</option>
            <option value="lightly_active">Lightly Active</option>
            <option value="moderately_active">Moderately Active</option>
            <option value="very_active">Very Active</option>
            <option value="extremely_active">Extremely Active</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── Sections 2–5: content unchanged, styled in subsequent screens ────────────

function Section2({ data, onChange }) {
  const goals = [
    { value: 'fat_loss',        label: 'Fat Loss',                   desc: 'Lose body fat while preserving muscle' },
    { value: 'muscle_building', label: 'Muscle Building',            desc: 'Build size and increase strength' },
    { value: 'maintenance',     label: 'Maintenance & Recomposition', desc: 'Improve body composition at current weight' },
  ];
  return (
    <div>
      <p className="if-eyebrow" style={{ animation: 'none', opacity: 1 }}>What are you training for?</p>
      <h2 className="if-heading" style={{ animationDelay: '0s' }}>Your goal</h2>
      <div className="if-goal-grid">
        {goals.map(g => (
          <button
            key={g.value}
            type="button"
            className={`if-goal-card${data.goal === g.value ? ' selected' : ''}`}
            onClick={() => onChange('goal', g.value)}
          >
            <div className="if-goal-title">{g.label}</div>
            <div className="if-goal-desc">{g.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Section3({ data, onChange }) {
  const toggleDay = (day) => {
    const current = data.preferredDays || [];
    const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    onChange('preferredDays', next);
  };
  return (
    <div>
      <h2 className="if-heading" style={{ animationDelay: '0s' }}>Training preferences</h2>
      <div className="form-group">
        <label>Training days per week</label>
        <select value={data.trainingDays || ''} onChange={e => onChange('trainingDays', e.target.value)} required>
          <option value="">Select…</option>
          <option value="3">3 days</option>
          <option value="4">4 days — recommended sweet spot</option>
          <option value="5">5 days</option>
          <option value="6">6 days</option>
        </select>
      </div>
      <div className="form-group">
        <label>Session length</label>
        <select value={data.sessionLength || ''} onChange={e => onChange('sessionLength', e.target.value)} required>
          <option value="">Select…</option>
          <option value="45">45 minutes</option>
          <option value="60">60 minutes</option>
          <option value="90">90 minutes</option>
          <option value="120">2 hours</option>
        </select>
      </div>
      <div className="form-group">
        <label>Schedule preference</label>
        <select value={data.scheduleType || ''} onChange={e => onChange('scheduleType', e.target.value)} required>
          <option value="">Select…</option>
          <option value="fixed">Fixed schedule — same days every week</option>
          <option value="rolling">Rolling programme — follow sessions in sequence</option>
        </select>
      </div>
      {data.scheduleType === 'fixed' && (
        <div className="form-group">
          <label>Preferred training days</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {DAYS.map(day => {
              const active = (data.preferredDays || []).includes(day);
              return (
                <button key={day} type="button"
                  style={active ? oldStyles.dayActive : oldStyles.dayBtn}
                  onClick={() => toggleDay(day)}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="form-group">
        <label>Training split</label>
        <select value={data.trainingSplit || ''} onChange={e => onChange('trainingSplit', e.target.value)} required>
          <option value="">Select…</option>
          <option value="recommend">Recommend the best split for me</option>
          <option value="push_pull_legs">Push Pull Legs</option>
          <option value="upper_lower">Upper Lower</option>
          <option value="full_body">Full Body</option>
          <option value="arnold_split">Arnold Split</option>
          <option value="chest_back_shoulders_arms">Chest & Back + Shoulders & Arms</option>
          <option value="ppl_posterior">PPL + Posterior Chain</option>
          <option value="upper_lower_x">Upper Lower Plus</option>
        </select>
      </div>
      <div className="form-group">
        <label>Available equipment</label>
        <select value={data.equipment || ''} onChange={e => onChange('equipment', e.target.value)} required>
          <option value="">Select…</option>
          <option value="specialist_gym">Specialist gym — powerlifting or serious lifting gym</option>
          <option value="commercial_gym">Commercial gym — PureGym, Virgin, Fitness First</option>
          <option value="budget_gym">Budget gym — dumbbells, barbells, cables, machines</option>
          <option value="home_gym">Home gym</option>
          <option value="bodyweight">Bodyweight only</option>
        </select>
      </div>
      <div className="form-group">
        <label>Training experience</label>
        <select value={data.experience || ''} onChange={e => onChange('experience', e.target.value)} required>
          <option value="">Select…</option>
          <option value="beginner">Beginner — under 1 year consistent training</option>
          <option value="intermediate">Intermediate — 1–3 years consistent training</option>
          <option value="advanced">Advanced — 3+ years consistent training</option>
        </select>
      </div>
    </div>
  );
}

function Section4({ data, onChange }) {
  return (
    <div>
      <h2 className="if-heading" style={{ animationDelay: '0s' }}>Nutrition preferences</h2>
      <div className="form-group">
        <label>Meals per day</label>
        <select value={data.mealsPerDay || ''} onChange={e => onChange('mealsPerDay', e.target.value)} required>
          <option value="">Select…</option>
          {['3', '4', '5', '6'].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label>Meal plan type</label>
        <select value={data.mealPlanType || ''} onChange={e => onChange('mealPlanType', e.target.value)} required>
          <option value="">Select…</option>
          <option value="full">Full meal plan with grocery list</option>
          <option value="macros">Macros and targets only</option>
        </select>
      </div>
      <div className="form-group">
        <label>Dietary preference</label>
        <select value={data.dietary || ''} onChange={e => onChange('dietary', e.target.value)} required>
          <option value="">Select…</option>
          <option value="no_restrictions">No restrictions</option>
          <option value="vegetarian">Vegetarian</option>
          <option value="vegan">Vegan</option>
          <option value="pescatarian">Pescatarian</option>
          <option value="gluten_free">Gluten free</option>
          <option value="dairy_free">Dairy free</option>
        </select>
      </div>
      <div className="form-group">
        <label>Foods you will not eat</label>
        <textarea rows={3} placeholder="e.g. mushrooms, shellfish, nuts"
          value={data.foodsNotEat || ''} onChange={e => onChange('foodsNotEat', e.target.value)} />
      </div>
      <div className="form-group">
        <label>Supplement preference</label>
        <select value={data.supplements || ''} onChange={e => onChange('supplements', e.target.value)} required>
          <option value="">Select…</option>
          <option value="include">Include supplement recommendations</option>
          <option value="no">No supplements</option>
        </select>
      </div>
    </div>
  );
}

function Section5({ data, onChange }) {
  return (
    <div>
      <h2 className="if-heading" style={{ animationDelay: '0s' }}>Health & injuries</h2>
      <div className="form-group">
        <label>Any injuries or physical limitations?</label>
        <select value={data.injuries || ''} onChange={e => onChange('injuries', e.target.value)} required>
          <option value="">Select…</option>
          <option value="no">No injuries</option>
          <option value="yes">Yes — I have injuries or limitations</option>
        </select>
      </div>
      {data.injuries === 'yes' && (
        <div className="form-group">
          <label>Describe your injury, area affected, and how it limits your training</label>
          <textarea rows={4} value={data.injuryDescription || ''}
            onChange={e => onChange('injuryDescription', e.target.value)} />
        </div>
      )}
      <div className="form-group">
        <label>Medical flags — tick any that apply</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {[
            { key: 'surgery',       label: 'Recent surgery (last 6 months)' },
            { key: 'heartCondition', label: 'Heart condition or chest pain during exercise' },
            { key: 'jointPain',     label: 'Severe joint pain that stops you training' },
            { key: 'pregnant',      label: 'Currently pregnant' },
            { key: 'doctorAdvised', label: 'Advised by a doctor not to exercise' },
          ].map(({ key, label }) => (
            <label key={key} style={oldStyles.checkRow}>
              <input type="checkbox" checked={data[key] || false}
                onChange={e => onChange(key, e.target.checked)}
                style={{ width: 'auto', accentColor: '#FF4FC4' }} />
              <span style={{ fontSize: 14, color: '#CDCDC8' }}>{label}</span>
            </label>
          ))}
        </div>
      </div>
      {(data.surgery || data.heartCondition || data.jointPain || data.pregnant || data.doctorAdvised) && (
        <div style={oldStyles.redFlag}>
          Based on what you've shared, we recommend speaking with your GP or physiotherapist before starting this programme.
          Contact us at hello@plus4performance.com and we'll assist you.
        </div>
      )}
      <div className="form-group">
        <label>Additional notes</label>
        <textarea rows={3} placeholder="Anything else we should know"
          value={data.additionalNotes || ''} onChange={e => onChange('additionalNotes', e.target.value)} />
      </div>
      <div className="form-group">
        <label>Plan start date</label>
        <input type="date" value={data.startDate || ''} onChange={e => onChange('startDate', e.target.value)} required />
      </div>
    </div>
  );
}

// ─── Main Intake component ────────────────────────────────────────────────────

export default function Intake() {
  const navigate = useNavigate();
  const [step, setStep]           = useState(1);
  const [direction, setDirection] = useState('forward');
  const [data, setData]           = useState({});
  const [error, setError]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progressWidth, setProgressWidth] = useState('0%');

  // Animate progress bar fill on mount and step changes
  useEffect(() => {
    const t = setTimeout(() => {
      setProgressWidth(`${(step / TOTAL_STEPS) * 100}%`);
    }, 80);
    return () => clearTimeout(t);
  }, [step]);

  // Pre-fill name and email from auth user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setData(d => ({
          ...d,
          email: user.email,
          firstName: user.user_metadata?.first_name || '',
          lastName: user.user_metadata?.last_name || '',
        }));
      }
    });
  }, []);

  function set(field, value) {
    setData(d => ({ ...d, [field]: value }));
  }

  function validateStep() {
    setError('');
    if (step === 1) {
      if (!data.sex || !data.age || !data.activity) { setError('Please complete all required fields.'); return false; }
      if (!data.heightCm && !data.heightFeet) { setError('Please enter your height.'); return false; }
      if (!data.weightKg && !data.weightLbs)  { setError('Please enter your current weight.'); return false; }
      if (!data.targetWeight) { setError('Please enter your target weight.'); return false; }
    }
    if (step === 2 && !data.goal) { setError('Please select a goal.'); return false; }
    if (step === 3) {
      if (!data.trainingDays || !data.sessionLength || !data.scheduleType || !data.trainingSplit || !data.equipment || !data.experience) {
        setError('Please complete all required fields.'); return false;
      }
    }
    if (step === 4) {
      if (!data.mealsPerDay || !data.mealPlanType || !data.dietary || !data.supplements) {
        setError('Please complete all required fields.'); return false;
      }
    }
    if (step === 5) {
      if (!data.injuries || !data.startDate) { setError('Please complete all required fields.'); return false; }
    }
    return true;
  }

  function next() {
    if (!validateStep()) return;
    setDirection('forward');
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function back() {
    setDirection('back');
    setStep(s => s - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit() {
    if (!validateStep()) return;
    setSubmitting(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const intakePayload = {
        ...data,
        heightCm: data.heightCm
          ? Number(data.heightCm)
          : (Number(data.heightFeet || 0) * 30.48) + (Number(data.heightInches || 0) * 2.54),
        weightKg: data.weightKg
          ? Number(data.weightKg)
          : Number(data.weightLbs || 0) / 2.205,
      };

      const result = await submitSnapshot(intakePayload, session.access_token);
      navigate('/snapshot', { state: { snapshot: result.snapshot } });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="if-page if-intake">
      <div className="if-ambient" />
      <div className="if-content" style={{ paddingTop: 8 }}>

        <div className="if-brand">Plus 4 Performance</div>

        <div className="if-progress-row">
          <span className="if-progress-label">Progress</span>
          <span className="if-progress-label">Step {step} of {TOTAL_STEPS}</span>
        </div>
        <div className="if-progress-track">
          <div className="if-progress-fill" style={{ width: progressWidth }} />
        </div>

        {/* Step content — keyed so it remounts and re-triggers the slide animation */}
        <div key={step} className={`if-step-enter-${direction}`}>
          {step === 1 && <Section1 data={data} onChange={set} />}
          {step === 2 && <Section2 data={data} onChange={set} />}
          {step === 3 && <Section3 data={data} onChange={set} />}
          {step === 4 && <Section4 data={data} onChange={set} />}
          {step === 5 && <Section5 data={data} onChange={set} />}
        </div>

        {error && <div className="if-error" style={{ marginTop: 16 }}>{error}</div>}

        <div className="if-nav-row" style={{ marginTop: 28 }}>
          {step > 1 && (
            <button type="button" className="if-btn-back" onClick={back}>← Back</button>
          )}
          {step < TOTAL_STEPS ? (
            <button type="button" className="if-btn" onClick={next}>Continue →</button>
          ) : (
            <button type="button" className="if-btn" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Generating your snapshot…' : 'Generate my plan →'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

// Temporary styles for Sections 3–5 internals (replaced screen by screen)
const oldStyles = {
  dayBtn:    { padding: '12px 8px', background: '#131119', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#5C5A62', fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  dayActive: { padding: '12px 8px', background: '#131119', border: '1px solid rgba(255,79,196,0.4)', borderRadius: 8, color: '#F3F1ED', fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 16px -6px rgba(255,79,196,0.55)' },
  checkRow:  { display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' },
  redFlag:   { padding: 16, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, fontSize: 13, color: '#fca5a5', lineHeight: 1.6, marginBottom: 20 },
};
