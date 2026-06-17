import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { foodSearch, foodLog, foodGetDay, foodDeleteEntry } from '../lib/api';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

function todayStr() { return new Date().toISOString().slice(0, 10); }

// ─── STYLE TOKENS ─────────────────────────────────────────────────────────────

const S = {
  card:       { background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.12)', padding: '20px', marginBottom: 16 },
  eyebrow:    { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#555' },
  sectionHead:{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.06em', color: '#F5F3EE', marginBottom: 14, marginTop: 28 },
  row:        { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #111', fontSize: 13 },
  rowLabel:   { color: '#787878', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em' },
  rowVal:     { color: '#CDCDC8', fontFamily: "'Barlow', sans-serif", fontWeight: 300 },
  redBtn:     { background: '#C0392B', border: 'none', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '12px 20px', cursor: 'pointer' },
  ghostBtn:   { background: 'none', border: '1px solid rgba(200,200,200,0.18)', color: '#787878', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '10px 16px', cursor: 'pointer' },
  addBtn:     { background: 'none', border: '1px dashed rgba(200,200,200,0.15)', color: '#444', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '10px 0', cursor: 'pointer', width: '100%', textAlign: 'center', display: 'block', marginTop: 8 },
  input:      { width: '100%', padding: '11px 14px', background: '#111', border: '1px solid rgba(200,200,200,0.15)', color: '#F5F3EE', fontFamily: "'Barlow', sans-serif", fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  // modal
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 16px 60px' },
  modal:      { background: '#111', border: '1px solid rgba(200,200,200,0.1)', width: '100%', maxWidth: 520, padding: '28px 24px', position: 'relative' },
  mClose:     { position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', color: '#444', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '4px 8px' },
  mTitle:     { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#C0392B', marginBottom: 18 },
  resultItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid #1a1a1a', cursor: 'pointer' },
  resultName: { fontFamily: "'Barlow', sans-serif", fontSize: 13, color: '#CDCDC8', fontWeight: 500 },
  resultBrand:{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555', letterSpacing: '0.06em', marginTop: 3 },
  resultMac:  { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555', letterSpacing: '0.04em', textAlign: 'right', flexShrink: 0, marginLeft: 12 },
};

// ─── LOCKED STATE ─────────────────────────────────────────────────────────────

function LockedState({ onUnlock }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.15)', marginBottom: 24 }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: '0.04em', color: '#F5F3EE', marginBottom: 10 }}>
        Unlock Nutrition Tracking
      </div>
      <p style={{ fontSize: 14, color: '#787878', maxWidth: 340, margin: '0 auto 20px', lineHeight: 1.6 }}>
        Log meals, track macros against your plan targets, and get AI coaching feedback on your nutrition adherence.
      </p>
      <button onClick={onUnlock} style={S.redBtn}>Unlock — £9.99/month</button>
    </div>
  );
}

// ─── MACRO PROGRESS ───────────────────────────────────────────────────────────

function MacroBar({ label, actual, target, unit }) {
  const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
  const over = target > 0 && actual > target * 1.1;
  const barColor = over ? '#FF9800' : '#C0392B';
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#555' }}>
          {label}
        </span>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: pct >= 90 ? '#4CAF50' : '#CDCDC8', letterSpacing: '0.04em' }}>
          {Math.round(actual * 10) / 10}{unit} {target > 0 && <span style={{ color: '#444' }}>/ {target}{unit}</span>}
        </span>
      </div>
      <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 2, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ─── FOOD ENTRY ROW ───────────────────────────────────────────────────────────

function FoodEntry({ entry, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  async function handleDelete() {
    setDeleting(true);
    await onDelete(entry.id);
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #111' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: '#CDCDC8' }}>
          {entry.food_name}
          {entry.brand && <span style={{ color: '#444', fontSize: 12, marginLeft: 6 }}>· {entry.brand}</span>}
          <span style={{ color: '#555', fontSize: 12, marginLeft: 8 }}>({entry.quantity})</span>
        </div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#555', letterSpacing: '0.04em', marginTop: 3 }}>
          {Math.round(entry.calories)} kcal · {Math.round(entry.protein * 10) / 10}g P · {Math.round(entry.carbs * 10) / 10}g C · {Math.round(entry.fat * 10) / 10}g F
        </div>
      </div>
      <button
        onClick={handleDelete}
        disabled={deleting}
        style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: 16, padding: '4px 8px', flexShrink: 0 }}
        title="Remove"
      >
        ×
      </button>
    </div>
  );
}

// ─── SEARCH MODAL ─────────────────────────────────────────────────────────────

function SearchModal({ defaultMealType, date, onClose, onSaved }) {
  const [step,          setStep]         = useState('search'); // 'search' | 'quantity'
  const [query,         setQuery]        = useState('');
  const [results,       setResults]      = useState([]);
  const [searching,     setSearching]    = useState(false);
  const [noResults,     setNoResults]    = useState(false);
  const [searchWarn,    setSearchWarn]   = useState('');
  const [selected,      setSelected]     = useState(null);
  const [mealType,      setMealType]     = useState(defaultMealType);
  const [quantityG,     setQuantityG]    = useState('100');
  const [saving,        setSaving]       = useState(false);
  const [saveError,     setSaveError]    = useState('');
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
        calories: calc.calories,
        protein:  calc.protein,
        carbs:    calc.carbs,
        fat:      calc.fat,
      });
      onSaved();
    } catch (e) { setSaveError(e.message || 'Failed to save. Try again.'); }
    setSaving(false);
  }

  function handleBackdrop(e) { if (e.target === e.currentTarget) onClose(); }

  return (
    <div style={S.overlay} onClick={handleBackdrop}>
      <div style={S.modal}>
        <button style={S.mClose} onClick={onClose}>×</button>

        {step === 'search' ? (
          <>
            <div style={S.mTitle}>Log Food</div>

            {/* Meal type selector */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {MEALS.map(m => (
                <button key={m} onClick={() => setMealType(m)} style={{
                  padding: '6px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer',
                  background: mealType === m ? '#C0392B' : 'transparent',
                  color: mealType === m ? '#fff' : '#555',
                  border: mealType === m ? 'none' : '1px solid rgba(200,200,200,0.12)',
                }}>
                  {MEAL_LABELS[m]}
                </button>
              ))}
            </div>

            <input
              autoFocus
              type="search"
              placeholder="Search food (e.g. chicken breast, oat milk…)"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={S.input}
            />

            <div style={{ marginTop: 12, minHeight: 120 }}>
              {searching && (
                <div style={{ color: '#444', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.1em', padding: '16px 0' }}>Searching…</div>
              )}
              {searchWarn && !searching && (
                <div style={{ color: '#555', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.08em', padding: '16px 0' }}>{searchWarn}</div>
              )}
              {noResults && !searching && (
                <div style={{ color: '#444', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: '0.08em', padding: '16px 0' }}>
                  No results found — try a different search term.
                </div>
              )}
              {!searching && results.map((r, i) => (
                <div
                  key={r.id || i}
                  style={S.resultItem}
                  onClick={() => { setSelected(r); setStep('quantity'); }}
                  onMouseEnter={e => e.currentTarget.style.background = '#0d0d0d'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <div style={S.resultName}>{r.name}</div>
                    {r.brand && <div style={S.resultBrand}>{r.brand}</div>}
                  </div>
                  <div style={S.resultMac}>
                    <div>{Math.round(r.calories)} kcal</div>
                    <div>{r.protein}g P · {r.carbs}g C · {r.fat}g F</div>
                    <div style={{ color: '#333', fontSize: 10 }}>per 100g</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Step 2: quantity + confirm */
          <>
            <div style={S.mTitle}>Confirm Quantity</div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: '#F5F3EE', marginBottom: 4 }}>{selected.name}</div>
              {selected.brand && <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#555' }}>{selected.brand}</div>}
            </div>

            <label style={{ display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#555', marginBottom: 8 }}>
              Quantity (grams)
            </label>
            <div style={{ position: 'relative', maxWidth: 180, marginBottom: 20 }}>
              <input
                autoFocus type="number" min="1" max="5000" step="5"
                value={quantityG}
                onChange={e => setQuantityG(e.target.value)}
                style={{ ...S.input, paddingRight: 36 }}
              />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#555', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12 }}>g</span>
            </div>

            {calc && grams > 0 && (
              <div style={{ background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.08)', padding: '12px 14px', marginBottom: 20 }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555', marginBottom: 8 }}>
                  For {grams}g
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[['Calories', `${Math.round(calc.calories)} kcal`], ['Protein', `${calc.protein}g`], ['Carbs', `${calc.carbs}g`], ['Fat', `${calc.fat}g`]].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#444', marginBottom: 3 }}>{k}</div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: '#F5F3EE', lineHeight: 1 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meal type (re-selectable on step 2) */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
              {MEALS.map(m => (
                <button key={m} onClick={() => setMealType(m)} style={{
                  padding: '6px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer',
                  background: mealType === m ? '#C0392B' : 'transparent',
                  color: mealType === m ? '#fff' : '#555',
                  border: mealType === m ? 'none' : '1px solid rgba(200,200,200,0.12)',
                }}>
                  {MEAL_LABELS[m]}
                </button>
              ))}
            </div>

            {saveError && <p style={{ color: '#ef4444', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.06em', marginBottom: 12 }}>{saveError}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setStep('search'); setSaveError(''); }} style={S.ghostBtn}>← Back</button>
              <button
                onClick={handleSave}
                disabled={saving || grams <= 0}
                style={{ ...S.redBtn, flex: 1, opacity: saving || grams <= 0 ? 0.6 : 1 }}
              >
                {saving ? 'Saving…' : `Save to ${MEAL_LABELS[mealType]}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── PLAN TARGETS GRID ────────────────────────────────────────────────────────

function PlanTargets({ nutrition }) {
  if (!nutrition) return null;
  const rows = [
    ['Training Day', nutrition.training_day],
    ['Rest Day',     nutrition.rest_day],
  ].filter(([, d]) => d);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rows.length}, 1fr)`, gap: 12, marginBottom: 8 }}>
      {rows.map(([label, d]) => (
        <div key={label} style={S.card}>
          <div style={{ ...S.eyebrow, marginBottom: 12 }}>{label}</div>
          {[['Calories', d.calories, 'kcal'], ['Protein', d.protein, 'g'], ['Carbs', d.carbs, 'g'], ['Fat', d.fat, 'g']].map(([k, v, u]) => (
            <div key={k} style={S.row}>
              <span style={S.rowLabel}>{k}</span>
              <span style={S.rowVal}>{v != null ? `${v}${u}` : '—'}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export default function NutritionTab({ plan, isUnlocked, onUnlock }) {
  const [selectedDate,  setSelectedDate]  = useState(todayStr);
  const [entries,       setEntries]       = useState([]);
  const [totals,        setTotals]        = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [dayLoading,    setDayLoading]    = useState(false);
  const [showSearch,    setShowSearch]    = useState(false);
  const [searchMeal,    setSearchMeal]    = useState('lunch');

  const targets = plan?.nutrition?.training_day || null;

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
  const isToday = selectedDate === todayStr();
  const displayDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  if (!isUnlocked) return <LockedState onUnlock={onUnlock} />;

  const entriesByMeal = MEALS.reduce((acc, m) => {
    acc[m] = entries.filter(e => e.meal_type === m);
    return acc;
  }, {});

  return (
    <div>
      {/* Plan targets */}
      {plan?.nutrition && (
        <>
          <div style={S.sectionHead}>Plan Targets</div>
          <PlanTargets nutrition={plan.nutrition} />
        </>
      )}

      {/* Meal templates */}
      {plan?.meal_plan && (
        <>
          <div style={S.sectionHead}>Meal Templates</div>
          {[['Training Day', plan.meal_plan.training_day], ['Rest Day', plan.meal_plan.rest_day]]
            .filter(([, meals]) => meals?.length)
            .map(([label, meals]) => (
              <div key={label} style={{ ...S.card, marginBottom: 12 }}>
                <div style={{ ...S.eyebrow, marginBottom: 12 }}>{label}</div>
                {meals.map((meal, i) => (
                  <div key={i} style={S.row}>
                    <span style={S.rowLabel}>{meal.meal || meal.name || `Meal ${i + 1}`}</span>
                    <span style={S.rowVal}>{meal.calories ? `${meal.calories} kcal` : ''}</span>
                  </div>
                ))}
              </div>
            ))
          }
        </>
      )}

      {/* Grocery list */}
      {plan?.grocery_list && (
        <>
          <div style={S.sectionHead}>Grocery List</div>
          <div style={S.card}>
            {Object.entries(plan.grocery_list).map(([category, items]) => (
              <div key={category} style={{ marginBottom: 14 }}>
                <div style={{ ...S.eyebrow, marginBottom: 6 }}>{category}</div>
                {Array.isArray(items) ? items.map((item, i) => (
                  <div key={i} style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: '#CDCDC8', padding: '4px 0' }}>{item}</div>
                )) : null}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ─── Daily Food Log ─────────────────────────────────────────────── */}
      <div style={S.sectionHead}>Daily Food Log</div>

      {/* Date navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={prevDay} style={{ ...S.ghostBtn, padding: '8px 14px' }}>←</button>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: '#CDCDC8', letterSpacing: '0.06em', flex: 1, textAlign: 'center' }}>
          {displayDate}{isToday && <span style={{ color: '#555', marginLeft: 8 }}>— Today</span>}
        </span>
        <button onClick={nextDay} disabled={isToday} style={{ ...S.ghostBtn, padding: '8px 14px', opacity: isToday ? 0.3 : 1, cursor: isToday ? 'default' : 'pointer' }}>→</button>
      </div>

      {/* Macro progress */}
      {targets && (
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={{ ...S.eyebrow, marginBottom: 14 }}>
            {dayLoading ? 'Loading…' : `${entries.length} item${entries.length !== 1 ? 's' : ''} logged`}
          </div>
          <MacroBar label="Calories" actual={totals.calories} target={targets.calories || 0} unit=" kcal" />
          <MacroBar label="Protein"  actual={totals.protein}  target={targets.protein  || 0} unit="g" />
          <MacroBar label="Carbs"    actual={totals.carbs}    target={targets.carbs    || 0} unit="g" />
          <MacroBar label="Fat"      actual={totals.fat}      target={targets.fat      || 0} unit="g" />
        </div>
      )}

      {/* Meals */}
      {MEALS.map(meal => (
        <div key={meal} style={{ ...S.card, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: entriesByMeal[meal].length > 0 ? 12 : 0 }}>
            <div style={S.eyebrow}>{MEAL_LABELS[meal]}</div>
            {entriesByMeal[meal].length > 0 && (
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#444', letterSpacing: '0.04em' }}>
                {Math.round(entriesByMeal[meal].reduce((s, e) => s + Number(e.calories), 0))} kcal
              </span>
            )}
          </div>
          {entriesByMeal[meal].map(entry => (
            <FoodEntry key={entry.id} entry={entry} onDelete={handleDelete} />
          ))}
          <button
            style={S.addBtn}
            onClick={() => { setSearchMeal(meal); setShowSearch(true); }}
          >
            + Add food to {MEAL_LABELS[meal].toLowerCase()}
          </button>
        </div>
      ))}

      {/* Search modal */}
      {showSearch && (
        <SearchModal
          defaultMealType={searchMeal}
          date={selectedDate}
          onClose={() => setShowSearch(false)}
          onSaved={() => { setShowSearch(false); loadDay(); }}
        />
      )}
    </div>
  );
}
