import React, { useEffect, useState } from 'react';
import {
  Dumbbell, Flame, Zap, Trophy, Flag, Medal, Hash, RefreshCw,
  Swords, Beef, ShoppingBag, Target, Pill, Scale, ArrowDown,
  Camera, LayoutTemplate, CalendarCheck, Crown, Users, Shield,
  BarChart2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { unlockAchievement } from '../lib/achievements';

/*
  ─── SQL — run once in Supabase SQL editor ────────────────────────────────────

  -- RPC used by founding_member check (counts total users via security definer)
  create or replace function get_user_count()
  returns bigint language sql security definer as $$
    select count(distinct user_id) from intake_submissions
  $$;
  grant execute on function get_user_count() to authenticated;

  ─────────────────────────────────────────────────────────────────────────────
*/

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
// From p4p-achievements-prototype.html.
// Four accents — each strictly scoped:
//   Pink   → Training category borders/lines (existing UI accent)
//   Green  → Nutrition category borders/lines
//   Purple → Progress category borders/lines
//   Gold   → Legacy category + unlocked badge fill/border/glow (NEVER body text)

const C = {
  surface:     '#131119',
  surface2:    '#0C0A0F',
  bone:        '#F3F1ED',
  ash:         '#ABA9B0',
  ashDim:      '#7A7880',
  pinkGlow:    'rgba(255,79,196,0.5)',
  pinkLine:    'rgba(255,79,196,0.3)',
  purpleLine:  'rgba(155,47,224,0.35)',
  greenLine:   'rgba(74,153,104,0.35)',
  gold:        '#D4A537',
  goldBright:  '#F0C75E',
  goldGlow:    'rgba(212,165,55,0.5)',
};

// Prototype hex polygon (pointy-top, viewBox 0 0 100 100)
const HEX = "50,3 93,26 93,74 50,97 7,74 7,26";

// ─── DATA ────────────────────────────────────────────────────────────────────

const LEVELS = [
  { level: 1, name: 'Recruit',    xpRequired: 0 },
  { level: 2, name: 'Consistent', xpRequired: 2000 },
  { level: 3, name: 'Committed',  xpRequired: 5000 },
  { level: 4, name: 'Athlete',    xpRequired: 12000 },
  { level: 5, name: 'Elite',      xpRequired: 25000 },
  { level: 6, name: 'Plus 4',     xpRequired: 50000 },
];

const XP_ACTIONS = [
  { action: 'Complete a session',    xp: 50 },
  { action: 'Hit protein target',    xp: 20 },
  { action: 'Log weight',            xp: 10 },
  { action: 'Unlock an achievement', xp: 100 },
  { action: 'Complete a full week',  xp: 150 },
  { action: 'Log a personal record', xp: 200 },
];

const TRAINING_BADGES = [
  { id: 'first_rep',     name: 'First Rep',        xp: 100, icon: Dumbbell,      description: 'Complete your first training session' },
  { id: 'week1_warrior', name: 'Week 1 Warrior',   xp: 150, icon: CalendarCheck,  description: 'Complete all sessions in Week 1' },
  { id: 'halfway',       name: 'Halfway',           xp: 200, icon: Flag,           description: 'Reach Week 6 of your 12-week plan' },
  { id: 'full_campaign', name: 'Full Campaign',     xp: 500, icon: Medal,          description: 'Complete all 12 weeks' },
  { id: 'on_fire',       name: 'On Fire',           xp: 100, icon: Flame,          description: 'Complete sessions 7 days in a row' },
  { id: 'unstoppable',   name: 'Unstoppable',       xp: 300, icon: Zap,            description: 'Complete sessions 30 days in a row' },
  { id: 'iron_monday',   name: 'Iron Monday',       xp: 150, icon: Zap,            description: 'Never miss a Monday across 12 weeks' },
  { id: 'pr_hunter',     name: 'PR Hunter',         xp: 200, icon: Trophy,         description: 'Log a personal record on any exercise' },
  { id: 'big_four',      name: 'Big Four',          xp: 250, icon: Dumbbell,       description: 'Log a 1RM on all four key lifts' },
  { id: 'century',       name: 'Century',           xp: 500, icon: Hash,           description: 'Complete 100 total training sessions' },
  { id: 'back_in_game',  name: 'Back in the Game',  xp: 100, icon: RefreshCw,      description: 'Complete the return to training protocol' },
  { id: 'iron_will',     name: 'Iron Will',         xp: 150, icon: Swords,         description: 'Complete a session on a day you logged as tough' },
];

const NUTRITION_BADGES = [
  { id: 'protein_king',  name: 'Protein King',  xp: 100, icon: Beef,        description: 'Hit your protein target 7 days in a row' },
  { id: 'perfect_week',  name: 'Perfect Week',  xp: 200, icon: Trophy,      description: 'Hit all macro targets every day for a full week' },
  { id: 'meal_prepper',  name: 'Meal Prepper',  xp: 50,  icon: ShoppingBag, description: 'Log your weekly grocery shop as complete' },
  { id: 'dialled_in',    name: 'Dialled In',    xp: 300, icon: Target,      description: 'Hit all nutrition targets every day for a month' },
  { id: 'stacked',       name: 'Stacked',       xp: 100, icon: Pill,        description: 'Log your supplements every day for 30 days' },
];

const PROGRESS_BADGES = [
  { id: 'first_checkin',   name: 'First Check-In',  xp: 10,  icon: Scale,         description: 'Log your first weight entry' },
  { id: 'moving_needle',   name: 'Moving Needle',   xp: 100, icon: ArrowDown,     description: 'Lose your first kilogram from starting weight' },
  { id: 'halfway_home',    name: 'Halfway Home',    xp: 200, icon: Target,        description: 'Reach 50% of your target weight change' },
  { id: 'goal_achieved',   name: 'Goal Achieved',   xp: 500, icon: Flag,          description: 'Hit your target weight' },
  { id: 'picture_perfect', name: 'Picture Perfect', xp: 50,  icon: Camera,        description: 'Upload your first progress photo' },
  { id: 'transformation',  name: 'Transformation',  xp: 300, icon: LayoutTemplate, description: 'Upload photos at Week 1 and Week 12' },
  { id: 'consistent',      name: 'Consistent',      xp: 200, icon: CalendarCheck, description: 'Log your weight every day for 30 days' },
  { id: 'strength_surge',  name: 'Strength Surge',  xp: 200, icon: BarChart2,     description: 'Improve your 1RM on any lift for 3 weeks running' },
];

const LEGACY_BADGES = [
  { id: 'the_p4',          name: 'The P4',          xp: 1000, icon: null,   isP4: true, description: 'Reach Level 6 and complete two full 12-week plans' },
  { id: 'coaches_pick',    name: "Coach's Pick",    xp: 500,  icon: Shield,             description: 'Manually awarded by the Plus 4 coaching team' },
  { id: 'founding_member', name: 'Founding Member', xp: 500,  icon: Crown,              description: 'One of the first 50 customers ever' },
  { id: 'refer_friend',    name: 'Refer a Friend',  xp: 200,  icon: Users,              description: 'Refer someone who signs up to Plus 4 Performance' },
];

// Category config — stroke = locked hex outline, line = category rule color
const CATEGORIES = [
  { key: 'training',  label: 'Training',  catStroke: C.pinkLine,   catLine: C.pinkLine,          badges: TRAINING_BADGES  },
  { key: 'nutrition', label: 'Nutrition', catStroke: C.greenLine,  catLine: C.greenLine,          badges: NUTRITION_BADGES },
  { key: 'progress',  label: 'Progress',  catStroke: C.purpleLine, catLine: C.purpleLine,         badges: PROGRESS_BADGES  },
  { key: 'legacy',    label: 'Legacy',    catStroke: 'rgba(212,165,55,0.25)', catLine: 'rgba(212,165,55,0.3)', badges: LEGACY_BADGES, isLegacy: true },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function fmtUnlockDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── HEX BADGE ───────────────────────────────────────────────────────────────

function HexBadge({ badge, catStroke, unlocked, unlockDate, isFlipped, onFlip }) {
  const { icon: Icon, name, xp, isP4, description } = badge;
  const gradId = `gf-${badge.id}`;

  const frontFace = (
    <div style={{
      position: 'absolute', inset: 0,
      backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 6, gap: 8,
    }}>
      {/* Hex icon */}
      <div style={{
        width: 90, height: 90, flexShrink: 0,
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...(unlocked ? { filter: `drop-shadow(0 0 18px ${C.goldGlow})` } : {}),
      }}>
        <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <defs>
            {unlocked && (
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2A2010" />
                <stop offset="100%" stopColor="#1A1408" />
              </linearGradient>
            )}
          </defs>
          <polygon
            points={HEX}
            fill={unlocked ? `url(#${gradId})` : C.surface}
            stroke={unlocked ? C.gold : catStroke}
            strokeWidth={unlocked ? 2 : 1.5}
          />
        </svg>
        <div style={{ position: 'relative', zIndex: 1 }}>
          {isP4 ? (
            <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 22, color: unlocked ? C.goldBright : C.ashDim, lineHeight: 1 }}>P4</span>
          ) : Icon ? (
            <Icon size={24} color={unlocked ? C.goldBright : C.ashDim} strokeWidth={1.5} />
          ) : null}
        </div>
      </div>

      {/* Name */}
      <div style={{
        fontFamily: "'Oswald', sans-serif",
        fontSize: 12, fontWeight: unlocked ? 700 : 600,
        letterSpacing: '0.5px', textTransform: 'uppercase',
        color: unlocked ? C.bone : C.ash,
        textAlign: 'center', lineHeight: 1.3, maxWidth: 100,
      }}>
        {name}
      </div>

      {/* XP */}
      <div style={{ fontSize: 10.5, color: C.ashDim, fontFamily: "'Inter', sans-serif" }}>
        {xp} XP
      </div>
    </div>
  );

  const backFace = (
    <div style={{
      position: 'absolute', inset: 0,
      backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
      transform: 'rotateY(180deg)',
      background: unlocked
        ? 'linear-gradient(160deg, #1A1408 0%, #100C06 100%)'
        : `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
      border: `1px solid ${unlocked ? C.gold : catStroke}`,
      borderRadius: 8,
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: '10px 9px', gap: 5,
    }}>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: C.bone, lineHeight: 1.2 }}>
        {name}
      </div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: C.ash, lineHeight: 1.4 }}>
        {description}
      </div>
      <div style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 600, fontSize: 11, color: C.bone, letterSpacing: '0.5px' }}>
        +{xp} XP
      </div>
      {unlocked ? (
        <>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: C.goldBright }}>✓ Unlocked</div>
          {unlockDate && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, color: C.ashDim }}>{fmtUnlockDate(unlockDate)}</div>}
        </>
      ) : (
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: C.ashDim }}>Locked</div>
      )}
    </div>
  );

  return (
    <div
      role="button" tabIndex={0} aria-pressed={isFlipped}
      onClick={() => onFlip(badge.id)}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onFlip(badge.id)}
      style={{ width: 100, height: 172, perspective: 700, cursor: 'pointer', outline: 'none' }}
    >
      <div style={{
        width: '100%', height: '100%', position: 'relative',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.42s ease',
        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        {frontFace}
        {backFace}
      </div>
    </div>
  );
}

// ─── CATEGORY SECTION ────────────────────────────────────────────────────────

function CategorySection({ category, unlockedIds, unlockedDates, flippedId, onFlip, first }) {
  const { label, catStroke, catLine, badges, isLegacy } = category;
  const unlockedCount = badges.filter(b => unlockedIds.has(b.id)).length;

  return (
    <div style={{ marginTop: first ? 8 : 44 }}>
      {/* Category header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <span style={{
          fontFamily: "'Oswald', sans-serif",
          fontSize: 13, fontWeight: 700, letterSpacing: '2px',
          textTransform: 'uppercase', whiteSpace: 'nowrap',
          color: isLegacy ? C.goldBright : C.bone,
        }}>
          {label}
        </span>
        <div style={{ flex: 1, height: 1, background: catLine, opacity: 0.3 }} />
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.ashDim, whiteSpace: 'nowrap' }}>
          {unlockedCount}/{badges.length}
        </span>
      </div>

      {/* Badge grid */}
      <div className="achv-badge-grid">
        {badges.map(badge => (
          <HexBadge
            key={badge.id}
            badge={badge}
            catStroke={catStroke}
            unlocked={unlockedIds.has(badge.id)}
            unlockDate={unlockedDates.get(badge.id) || null}
            isFlipped={flippedId === badge.id}
            onFlip={onFlip}
          />
        ))}
      </div>
    </div>
  );
}

// ─── XP / LEVEL SECTION ──────────────────────────────────────────────────────

function XpSection({ currentXp }) {
  const currentLevel = [...LEVELS].reverse().find(l => currentXp >= l.xpRequired) || LEVELS[0];
  const nextLevel    = LEVELS[currentLevel.level] || null;
  const prevXp       = currentLevel.xpRequired;
  const nextXp       = nextLevel ? nextLevel.xpRequired : prevXp;
  const progress     = nextLevel ? (currentXp - prevXp) / (nextXp - prevXp) : 1;

  return (
    <div style={{ textAlign: 'center', marginBottom: 36 }}>

      {/* Big level hex */}
      <div style={{ width: 160, height: 160, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: `drop-shadow(0 0 20px ${C.pinkGlow})` }}>
          <polygon points={HEX} fill="#18151F" stroke="#E8389E" strokeWidth="2.5" />
        </svg>
        <div style={{ position: 'relative', zIndex: 1, fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 48, color: C.bone, lineHeight: 1 }}>
          {currentLevel.level}
        </div>
      </div>

      {/* Level name */}
      <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 16, letterSpacing: '2px', textTransform: 'uppercase', color: C.bone, marginBottom: 22 }}>
        {currentLevel.name}
      </div>

      {/* XP progress bar */}
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.ashDim, marginBottom: 8 }}>
          <span>{currentXp.toLocaleString()} XP</span>
          <span>{nextLevel ? `${nextXp.toLocaleString()} XP` : 'MAX LEVEL'}</span>
        </div>
        <div style={{ height: 4, background: C.surface, borderRadius: 3, overflow: 'hidden', marginBottom: 26 }}>
          <div style={{
            height: '100%',
            width: `${Math.min(Math.round(progress * 100), 100)}%`,
            background: 'linear-gradient(90deg, #E8389E, #FF4FC4)',
            borderRadius: 3,
            boxShadow: `0 0 8px ${C.pinkGlow}`,
            minWidth: progress > 0 ? 4 : 0,
          }} />
        </div>
      </div>

      {/* Level pip row */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
        {LEVELS.map(lvl => {
          const isUnlocked = currentXp >= lvl.xpRequired;
          const isCurrent  = lvl.level === currentLevel.level;

          const pipFill   = isCurrent ? '#18151F' : isUnlocked ? '#131119' : C.surface2;
          const pipStroke = isCurrent ? '#FF4FC4' : isUnlocked ? '#E8389E' : 'rgba(255,255,255,0.1)';
          const pipSW     = isCurrent ? 2.5 : 2;
          const labelCol  = isCurrent ? C.bone : C.ashDim;

          return (
            <div key={lvl.level} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 46, height: 46 }}>
                <svg viewBox="0 0 100 100" width="100%" height="100%">
                  <polygon points={HEX} fill={pipFill} stroke={pipStroke} strokeWidth={pipSW} />
                </svg>
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: labelCol }}>
                {lvl.name.split(' ')[0]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── XP GUIDE ────────────────────────────────────────────────────────────────

function XpGuide() {
  const left  = XP_ACTIONS.slice(0, 3);
  const right = XP_ACTIONS.slice(3);

  return (
    <div style={{ marginTop: 50 }}>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, letterSpacing: '2px', color: C.ashDim, textTransform: 'uppercase', marginBottom: 16 }}>
        XP Guide
      </div>
      <div style={{
        background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16, padding: '6px 0',
        boxShadow: '0 12px 30px -16px rgba(0,0,0,0.55)',
      }}>
        <div className="xp-guide-grid">
          {[left, right].map((col, ci) => (
            <div key={ci}>
              {col.map(({ action, xp }) => (
                <div key={action} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: C.bone }}>{action}</span>
                  <span style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 600, fontSize: 13, color: C.bone, marginLeft: 16, whiteSpace: 'nowrap' }}>
                    +{xp} XP
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export default function AchievementsTab({ userId }) {
  const isPreview =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('preview') === 'true';

  const [unlockedIds,   setUnlockedIds]   = useState(new Set());
  const [unlockedDates, setUnlockedDates] = useState(new Map());
  const [currentXp,     setCurrentXp]     = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [flippedId,     setFlippedId]     = useState(null);

  function handleFlip(id) {
    setFlippedId(prev => (prev === id ? null : id));
  }

  useEffect(() => {
    if (isPreview) { setLoading(false); return; }

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [{ data: achvRows }, { data: xpRow }] = await Promise.all([
        supabase
          .from('user_achievements')
          .select('achievement_id, unlocked_at')
          .eq('user_id', user.id),
        supabase
          .from('user_xp')
          .select('total_xp')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      // Founding member: auto-unlock for first 50 users
      const rows = [...(achvRows || [])];
      const alreadyFoundingMember = rows.some(r => r.achievement_id === 'founding_member');
      if (!alreadyFoundingMember) {
        const { data: userCount } = await supabase.rpc('get_user_count');
        if (typeof userCount === 'number' && userCount <= 50) {
          await unlockAchievement(supabase, user.id, 'founding_member', 500);
          rows.push({ achievement_id: 'founding_member', unlocked_at: new Date().toISOString() });
        }
      }

      setUnlockedIds(new Set(rows.map(r => r.achievement_id)));
      setUnlockedDates(new Map(rows.map(r => [r.achievement_id, r.unlocked_at])));
      if (xpRow) setCurrentXp(xpRow.total_xp || 0);
      setLoading(false);
    }

    load();
  }, [userId]);

  const allIds       = CATEGORIES.flatMap(c => c.badges.map(b => b.id));
  const displayIds   = isPreview ? new Set(allIds) : unlockedIds;
  const displayDates = isPreview
    ? new Map(allIds.map(id => [id, new Date().toISOString()]))
    : unlockedDates;
  const displayXp    = isPreview ? 10000 : currentXp;

  return (
    <div>
      <style>{`
        .achv-badge-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 28px 20px;
          align-items: start;
        }
        .xp-guide-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        @media (max-width: 600px) {
          .achv-badge-grid { grid-template-columns: repeat(2, 1fr); }
          .xp-guide-grid   { grid-template-columns: 1fr; }
        }
      `}</style>

      {loading ? (
        <div style={{ color: C.ashDim, padding: '60px 0', textAlign: 'center', fontFamily: "'Inter', sans-serif", fontSize: 13 }}>
          Loading…
        </div>
      ) : (
        <>
          <XpSection currentXp={displayXp} />

          {CATEGORIES.map((cat, i) => (
            <CategorySection
              key={cat.key}
              category={cat}
              unlockedIds={displayIds}
              unlockedDates={displayDates}
              flippedId={flippedId}
              onFlip={handleFlip}
              first={i === 0}
            />
          ))}

          <XpGuide />
        </>
      )}
    </div>
  );
}
