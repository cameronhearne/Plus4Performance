import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { foodSearch, foodLog, foodGetDay, foodDeleteEntry, getWeekSchedule } from '../lib/api';
import { getSessionForToday } from '../lib/schedule';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

function getMealSlots(plan, defaultCount = 4) {
  const meals = plan?.meal_plan?.training_day;
  if (meals?.length) {
    return meals.map((m, i) => {
      const rawName = m.name || `Meal ${i + 1}`;
      const label   = rawName.replace(/\s*[—–-]+\s*.+$/, '').trim() || rawName;
      return { key: rawName, label };
    });
  }
  return Array.from({ length: defaultCount }, (_, i) => ({
    key:   `Meal ${i + 1}`,
    label: `Meal ${i + 1}`,
  }));
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
// Values taken verbatim from SnapshotResult.css / intake-flow.css

const C = {
  surface:  '#131119',
  surface2: '#0C0A0F',
  bone:     '#F3F1ED',
  ash:      '#87858E',
  ashDim:   '#5C5A62',
  glow:     'rgba(255,79,196,0.55)',
  glowLine: 'rgba(255,79,196,0.22)',
  ease:     'cubic-bezier(0.16,1,0.3,1)',
};

const card = {
  background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
  border: '1px solid rgba(255,79,196,0.1)',
  borderRadius: 14,
  boxShadow: `0 8px 18px -10px rgba(0,0,0,0.55), 0 0 22px -14px ${C.glow}, 0 1px 0 rgba(255,255,255,0.03) inset`,
  padding: '20px',
  marginBottom: 12,
};

const secHead = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: 18, fontWeight: 700,
  letterSpacing: '0.3px',
  textTransform: 'uppercase',
  color: C.bone,
  marginBottom: 14, marginTop: 28,
};

const eyebrow = {
  fontFamily: "'Oswald', sans-serif",
  fontSize: 10.5, fontWeight: 600,
  letterSpacing: '1.8px',
  textTransform: 'uppercase',
  color: C.ash,
};

const ctaBtn = {
  background: 'linear-gradient(160deg, #18151F, #100E15)',
  border: `1px solid ${C.glowLine}`,
  color: C.bone,
  borderRadius: 9, padding: '13px 20px',
  fontFamily: "'Oswald', sans-serif",
  fontWeight: 600, fontSize: 12.5,
  letterSpacing: '1.2px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  boxShadow: `0 0 18px -10px ${C.glow}`,
};

const ghostBtn = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.1)',
  color: C.ash,
  borderRadius: 9, padding: '10px 16px',
  fontFamily: "'Oswald', sans-serif",
  fontWeight: 600, fontSize: 12,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  cursor: 'pointer',
};

const addBtn = {
  background: 'none',
  border: '1px dashed rgba(255,79,196,0.2)',
  color: C.ash,
  fontFamily: "'Oswald', sans-serif",
  fontSize: 11, fontWeight: 600,
  letterSpacing: '1.2px',
  textTransform: 'uppercase',
  padding: '10px 0',
  cursor: 'pointer',
  width: '100%', textAlign: 'center',
  display: 'block', marginTop: 8,
  borderRadius: 6,
};

const inputStyle = {
  width: '100%', padding: '11px 14px',
  background: C.surface,
  border: '1px solid rgba(255,255,255,0.1)',
  color: C.bone,
  fontFamily: "'Inter', sans-serif",
  fontSize: 13, outline: 'none',
  boxSizing: 'border-box', borderRadius: 6,
};

// ─── LOCKED STATE ─────────────────────────────────────────────────────────────

function LockedState({ onUnlock }) {
  return (
    <div style={{ ...card, textAlign: 'center', padding: '48px 24px', marginTop: 8 }}>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: C.bone, marginBottom: 12 }}>
        Unlock Nutrition Tracking
      </div>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: C.ash, maxWidth: 340, margin: '0 auto 24px', lineHeight: 1.6 }}>
        Log meals, track macros against your plan targets, and get AI coaching feedback on your nutrition adherence.
      </p>
      <button onClick={onUnlock} style={{ ...ctaBtn, boxShadow: `0 12px 36px -6px rgba(255,79,196,0.4)` }}>
        Unlock — £9.99/month
      </button>
    </div>
  );
}

// ─── MACRO PROGRESS BAR ───────────────────────────────────────────────────────

function MacroBar({ label, actual, target, unit }) {
  const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ ...eyebrow, fontSize: 10.5 }}>{label}</span>
        <span style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 12, color: C.bone }}>
          {Math.round(actual * 10) / 10}{unit}
          {target > 0 && <span style={{ color: C.ashDim }}> / {target}{unit}</span>}
        </span>
      </div>
      <div style={{ height: 3, background: 'rgba(255,79,196,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: 'linear-gradient(90deg, #E8389E, #FF4FC4)',
          borderRadius: 2,
          transition: `width 0.6s ${C.ease}`,
          boxShadow: '0 0 6px rgba(255,79,196,0.4)',
        }} />
      </div>
    </div>
  );
}

// ─── FOOD ENTRY ROW ───────────────────────────────────────────────────────────

function FoodEntry({ entry, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  async function handleDelete() { setDeleting(true); await onDelete(entry.id); }
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#C4C2C9' }}>
          {entry.food_name}
          {entry.brand && <span style={{ color: C.ash, fontSize: 12, marginLeft: 6 }}>· {entry.brand}</span>}
          <span style={{ color: C.ashDim, fontSize: 12, marginLeft: 8 }}>({entry.quantity})</span>
        </div>
        <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 11, color: C.ash, marginTop: 3 }}>
          {Math.round(entry.calories)} kcal · {Math.round(entry.protein * 10) / 10}g P · {Math.round(entry.carbs * 10) / 10}g C · {Math.round(entry.fat * 10) / 10}g F
        </div>
      </div>
      <button
        onClick={handleDelete} disabled={deleting}
        style={{ background: 'none', border: 'none', color: C.ashDim, cursor: 'pointer', fontSize: 18, padding: '4px 8px', flexShrink: 0, lineHeight: 1 }}
        title="Remove"
      >×</button>
    </div>
  );
}

// ─── PLAN TARGETS ─────────────────────────────────────────────────────────────

function PlanTargets({ nutrition }) {
  if (!nutrition) return null;
  const days = [
    ['Training Day', nutrition.training_day],
    ['Rest Day',     nutrition.rest_day],
  ].filter(([, d]) => d);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${days.length}, 1fr)`, gap: 12, marginBottom: 8 }}>
      {days.map(([label, d]) => (
        <div key={label} style={card}>
          <div style={{ ...eyebrow, marginBottom: 14 }}>{label}</div>
          {[['Calories', d.calories, ' kcal'], ['Protein', d.protein, 'g'], ['Carbs', d.carbs, 'g'], ['Fat', d.fat, 'g']].map(([k, v, u]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash }}>{k}</span>
              <span style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 14, fontWeight: 600, color: C.bone }}>{v != null ? `${v}${u}` : '—'}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── MEAL TEMPLATES ───────────────────────────────────────────────────────────

function MealTemplates({ mealPlan }) {
  const [activeDay, setActiveDay] = useState('Training Day');

  const dayMap = {
    'Training Day': mealPlan?.training_day || [],
    'Rest Day':     mealPlan?.rest_day     || [],
  };
  const availableDays = Object.keys(dayMap).filter(k => dayMap[k]?.length > 0);
  if (!availableDays.length) return null;

  const meals = dayMap[activeDay] || dayMap[availableDays[0]] || [];

  return (
    <div>
      {/* Day toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {availableDays.map(label => {
          const isActive = activeDay === label;
          return (
            <button key={label} type="button" onClick={() => setActiveDay(label)} style={{
              padding: '8px 14px',
              background: isActive ? 'linear-gradient(160deg, #18151F, #100E15)' : C.surface,
              border: isActive ? '1px solid rgba(255,79,196,0.25)' : '1px solid rgba(255,255,255,0.08)',
              color: isActive ? C.bone : C.ash,
              fontFamily: "'Oswald', sans-serif",
              fontSize: 12, fontWeight: 600, letterSpacing: '1px',
              textTransform: 'uppercase', cursor: 'pointer', borderRadius: 7,
              boxShadow: isActive ? '0 0 16px -4px rgba(255,79,196,0.5), 0 1px 0 rgba(255,255,255,0.04) inset' : 'none',
            }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Meals — always expanded */}
      <div style={card}>
        {meals.map((meal, i) => {
          const foods    = meal.foods || meal.items || [];
          const totalCal = foods.reduce((sum, f) => sum + (Number(f.cal) || 0), 0);
          return (
            <div key={i} style={{ borderBottom: i < meals.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingBottom: 12, marginBottom: i < meals.length - 1 ? 12 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: C.bone }}>
                  {meal.meal || meal.name || `Meal ${i + 1}`}
                </span>
                {totalCal > 0 && (
                  <span style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 12, color: C.ash }}>{totalCal} kcal</span>
                )}
              </div>
              {foods.map((food, j) => (
                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0 4px 8px' }}>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#C4C2C9', flex: 1 }}>
                    {food.name}{food.amount ? ` — ${food.amount}` : ''}
                  </span>
                  {food.cal != null && (
                    <span style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 11, color: C.ash, flexShrink: 0, marginLeft: 12 }}>
                      {food.cal} kcal
                    </span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── GROCERY LIST ─────────────────────────────────────────────────────────────

function GroceryListCard({ groceryList }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(groceryList || {}).filter(([, items]) => Array.isArray(items) && items.length > 0);
  if (!entries.length) return null;

  return (
    <div style={{ ...card, padding: 0 }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '18px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: C.bone }}>
          Grocery List
        </span>
        <span style={{ color: C.ashDim, fontSize: 22, fontWeight: 600 }}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {entries.map(([category, items]) => (
            <div key={category} style={{ marginTop: 16 }}>
              <div style={{ ...eyebrow, marginBottom: 8 }}>{category}</div>
              {items.map((item, i) => (
                <div key={i} style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#C4C2C9', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SEARCH MODAL ─────────────────────────────────────────────────────────────

function SearchModal({ defaultMealType, mealSlots, date, onClose, onSaved }) {
  const [step,       setStep]      = useState('search');
  const [query,      setQuery]     = useState('');
  const [results,    setResults]   = useState([]);
  const [searching,  setSearching] = useState(false);
  const [noResults,  setNoResults] = useState(false);
  const [searchWarn, setSearchWarn]= useState('');
  const [selected,   setSelected]  = useState(null);
  const [mealType,   setMealType]  = useState(defaultMealType);
  const [quantityG,  setQuantityG] = useState('100');
  const [saving,     setSaving]    = useState(false);
  const [saveError,  setSaveError] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) { setResults([]); setNoResults(false); return; }
    debounceRef.current = setTimeout(() => runSearch(q), 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  async function runSearch(q) {
    setSearching(true); setNoResults(false); setSearchWarn('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await foodSearch(session.access_token, q);
      setResults(resp.results || []);
      if (resp.warning) setSearchWarn(resp.warning);
      setNoResults((resp.results || []).length === 0 && !resp.warning);
    } catch { setResults([]); setSearchWarn('Search unavailable, please try again.'); }
    setSearching(false);
  }

  const grams = parseFloat(quantityG) || 0;
  const calc = selected ? {
    calories: Math.round((grams / 100) * selected.calories * 10) / 10,
    protein:  Math.round((grams / 100) * selected.protein  * 10) / 10,
    carbs:    Math.round((grams / 100) * selected.carbs    * 10) / 10,
    fat:      Math.round((grams / 100) * selected.fat      * 10) / 10,
  } : null;

  async function handleSave() {
    if (!selected || grams <= 0) return;
    setSaving(true); setSaveError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await foodLog(session.access_token, {
        date, mealType,
        foodName: selected.name,
        brand:    selected.brand || null,
        quantity: `${grams}g`,
        calories: calc.calories, protein: calc.protein,
        carbs: calc.carbs, fat: calc.fat,
      });
      onSaved();
    } catch (e) { setSaveError(e.message || 'Failed to save. Try again.'); }
    setSaving(false);
  }

  function handleBackdrop(e) { if (e.target === e.currentTarget) onClose(); }

  const modalCard = {
    background: `linear-gradient(160deg, #131119 0%, #0C0A0F 100%)`,
    border: '1px solid rgba(255,79,196,0.1)',
    borderRadius: 14,
    width: '100%', maxWidth: 520,
    padding: '28px 24px',
    position: 'relative',
    boxShadow: `0 24px 48px -16px rgba(0,0,0,0.8), 0 0 30px -16px ${C.glow}`,
  };

  function MealSelector() {
    return (
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {mealSlots.map(slot => {
          const isActive = mealType === slot.key;
          return (
            <button key={slot.key} onClick={() => setMealType(slot.key)} style={{
              padding: '6px 12px',
              fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600,
              letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
              background: isActive ? 'linear-gradient(160deg, #18151F, #100E15)' : 'transparent',
              color: isActive ? C.bone : C.ash,
              border: isActive ? '1px solid rgba(255,79,196,0.25)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6,
              boxShadow: isActive ? `0 0 12px -4px ${C.glow}` : 'none',
            }}>
              {slot.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 16px 60px' }}
      onClick={handleBackdrop}
    >
      <div style={modalCard}>
        <button
          style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', color: C.ashDim, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '4px 8px' }}
          onClick={onClose}
        >×</button>

        {step === 'search' ? (
          <>
            <div style={{ ...eyebrow, marginBottom: 18 }}>Log Food</div>
            <MealSelector />
            <input
              autoFocus type="search"
              placeholder="Search food (e.g. chicken breast, oat milk…)"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={inputStyle}
            />
            <div style={{ marginTop: 12, minHeight: 120 }}>
              {searching && (
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.ashDim, padding: '16px 0' }}>Searching…</div>
              )}
              {searchWarn && !searching && (
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.ash, padding: '16px 0' }}>{searchWarn}</div>
              )}
              {noResults && !searching && (
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.ashDim, padding: '16px 0' }}>
                  No results found — try a different search term.
                </div>
              )}
              {!searching && results.map((r, i) => (
                <div
                  key={r.id || i}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
                  onClick={() => { setSelected(r); setQuantityG(r.servingG ? String(r.servingG) : '100'); setStep('quantity'); }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#C4C2C9', fontWeight: 500 }}>{r.name}</div>
                    {r.brand && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: C.ash, marginTop: 3 }}>{r.brand}</div>}
                  </div>
                  <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 11, color: C.ash, textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <div>{Math.round(r.calories)} kcal</div>
                    <div>{r.protein}g P · {r.carbs}g C · {r.fat}g F</div>
                    <div style={{ color: C.ashDim, fontSize: 10 }}>per 100g</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ ...eyebrow, marginBottom: 18 }}>Confirm Quantity</div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: C.bone, marginBottom: 4 }}>{selected.name}</div>
              {selected.brand && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.ash }}>{selected.brand}</div>}
            </div>
            <label style={{ display: 'block', fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '1.8px', textTransform: 'uppercase', color: C.ash, marginBottom: 8 }}>
              Quantity (grams){selected?.servingG ? <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: C.ashDim, marginLeft: 8 }}>— defaulted to serving size</span> : null}
            </label>
            <div style={{ position: 'relative', maxWidth: 180, marginBottom: 20 }}>
              <input
                autoFocus type="number" min="1" max="5000" step="5"
                value={quantityG}
                onChange={e => setQuantityG(e.target.value)}
                style={{ ...inputStyle, paddingRight: 36 }}
              />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: C.ash, fontFamily: "'Oswald', sans-serif", fontSize: 12 }}>g</span>
            </div>

            {calc && grams > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
                <div style={{ ...eyebrow, marginBottom: 10 }}>For {grams}g</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[['Calories', `${Math.round(calc.calories)} kcal`], ['Protein', `${calc.protein}g`], ['Carbs', `${calc.carbs}g`], ['Fat', `${calc.fat}g`]].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.ashDim, marginBottom: 3 }}>{k}</div>
                      <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 16, fontWeight: 600, color: C.bone, lineHeight: 1 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <MealSelector />
            {saveError && <p style={{ color: '#fca5a5', fontFamily: "'Inter', sans-serif", fontSize: 11, marginBottom: 12 }}>{saveError}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setStep('search'); setSaveError(''); }} style={ghostBtn}>← Back</button>
              <button
                onClick={handleSave}
                disabled={saving || grams <= 0}
                style={{ ...ctaBtn, flex: 1, textAlign: 'center', opacity: saving || grams <= 0 ? 0.5 : 1, boxShadow: `0 10px 28px -8px ${C.glow}` }}
              >
                {saving ? 'Saving…' : `Save to ${mealSlots.find(s => s.key === mealType)?.label || mealType}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export default function NutritionTab({ plan, isUnlocked, onUnlock }) {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [entries,      setEntries]      = useState([]);
  const [totals,       setTotals]       = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [dayLoading,   setDayLoading]   = useState(false);
  const [showSearch,   setShowSearch]   = useState(false);
  const [searchMeal,   setSearchMeal]   = useState('lunch');
  const [isRestDay,    setIsRestDay]    = useState(false);

  useEffect(() => {
    if (!plan) return;
    let cancelled = false;
    async function computeRestDay() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      const { data: intake } = await supabase
        .from('intake_submissions').select('data')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      const { isRestDay: baseRestDay } = getSessionForToday(plan, intake?.data || {});
      if (cancelled) return;
      try {
        const today  = new Date(); today.setHours(0, 0, 0, 0);
        const dow    = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow));
        const weekStart = monday.toISOString().split('T')[0];
        const result = await getWeekSchedule(weekStart, session.access_token);
        if (!cancelled && result.schedule) {
          const todayIdx = dow === 0 ? 6 : dow - 1;
          if (String(todayIdx) in result.schedule) {
            setIsRestDay(result.schedule[String(todayIdx)] === null);
            return;
          }
        }
      } catch { /* fall back */ }
      if (!cancelled) setIsRestDay(baseRestDay);
    }
    computeRestDay();
    return () => { cancelled = true; };
  }, [plan]);

  const targets   = isRestDay ? (plan?.nutrition?.rest_day || null) : (plan?.nutrition?.training_day || null);
  const mealSlots = getMealSlots(plan);

  const loadDay = useCallback(async () => {
    setDayLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setDayLoading(false); return; }
    try {
      const resp = await foodGetDay(session.access_token, selectedDate);
      setEntries(resp.entries || []);
      setTotals(resp.totals  || { calories: 0, protein: 0, carbs: 0, fat: 0 });
    } catch (e) { console.error('[NutritionTab] loadDay:', e); }
    setDayLoading(false);
  }, [selectedDate]);

  useEffect(() => { loadDay(); }, [loadDay]);

  async function handleDelete(id) {
    const { data: { session } } = await supabase.auth.getSession();
    try { await foodDeleteEntry(session.access_token, id); loadDay(); }
    catch (e) { console.error('[NutritionTab] delete:', e); }
  }

  function prevDay() { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().slice(0, 10)); }
  function nextDay() {
    const d = new Date(selectedDate); d.setDate(d.getDate() + 1);
    const next = d.toISOString().slice(0, 10);
    if (next <= todayStr()) setSelectedDate(next);
  }
  const isToday     = selectedDate === todayStr();
  const displayDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  if (!isUnlocked) return <LockedState onUnlock={onUnlock} />;

  const entriesByMeal = mealSlots.reduce((acc, slot) => {
    acc[slot.key] = entries.filter(e => e.meal_type === slot.key);
    return acc;
  }, {});

  return (
    <div>

      {/* ── Plan Targets ─────────────────────────────────────────── */}
      {plan?.nutrition && (
        <>
          <div style={secHead}>Plan Targets</div>
          <PlanTargets nutrition={plan.nutrition} />
        </>
      )}

      {/* ── Meal Templates ───────────────────────────────────────── */}
      {plan?.meal_plan && (
        <>
          <div style={secHead}>Meal Templates</div>
          <MealTemplates mealPlan={plan.meal_plan} />
        </>
      )}

      {/* ── Grocery List ─────────────────────────────────────────── */}
      {plan?.grocery_list && (
        <>
          <div style={secHead}>Grocery List</div>
          <GroceryListCard groceryList={plan.grocery_list} />
        </>
      )}

      {/* ── Daily Food Log ───────────────────────────────────────── */}
      <div style={secHead}>Daily Food Log</div>

      {/* Date navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={prevDay} style={{ ...ghostBtn, padding: '8px 14px' }}>←</button>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: '#C4C2C9', flex: 1, textAlign: 'center' }}>
          {displayDate}{isToday && <span style={{ color: C.ashDim, marginLeft: 8 }}>— Today</span>}
        </span>
        <button onClick={nextDay} disabled={isToday} style={{ ...ghostBtn, padding: '8px 14px', opacity: isToday ? 0.3 : 1, cursor: isToday ? 'default' : 'pointer' }}>→</button>
      </div>

      {/* Macro progress */}
      {targets && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ ...eyebrow, marginBottom: 14 }}>
            {dayLoading ? 'Loading…' : `${entries.length} item${entries.length !== 1 ? 's' : ''} logged`}
          </div>
          <MacroBar label="Calories" actual={totals.calories} target={targets.calories || 0} unit=" kcal" />
          <MacroBar label="Protein"  actual={totals.protein}  target={targets.protein  || 0} unit="g" />
          <MacroBar label="Carbs"    actual={totals.carbs}    target={targets.carbs    || 0} unit="g" />
          <MacroBar label="Fat"      actual={totals.fat}      target={targets.fat      || 0} unit="g" />
        </div>
      )}

      {/* Meal slots */}
      {mealSlots.map(slot => (
        <div key={slot.key} style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: entriesByMeal[slot.key]?.length > 0 ? 12 : 0 }}>
            <div style={eyebrow}>{slot.label}</div>
            {entriesByMeal[slot.key]?.length > 0 && (
              <span style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 11, color: C.ash }}>
                {Math.round(entriesByMeal[slot.key].reduce((s, e) => s + Number(e.calories), 0))} kcal
              </span>
            )}
          </div>
          {(entriesByMeal[slot.key] || []).map(entry => (
            <FoodEntry key={entry.id} entry={entry} onDelete={handleDelete} />
          ))}
          <button style={addBtn} onClick={() => { setSearchMeal(slot.key); setShowSearch(true); }}>
            + Add food to {slot.label.toLowerCase()}
          </button>
        </div>
      ))}

      {/* Search modal */}
      {showSearch && (
        <SearchModal
          defaultMealType={searchMeal}
          mealSlots={mealSlots}
          date={selectedDate}
          onClose={() => setShowSearch(false)}
          onSaved={() => { setShowSearch(false); loadDay(); }}
        />
      )}
    </div>
  );
}
