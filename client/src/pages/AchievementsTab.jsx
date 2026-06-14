import React, { useEffect, useState } from 'react';
import {
  Dumbbell, Flame, Zap, Trophy, Flag, Medal, Hash, RefreshCw,
  Swords, Beef, ShoppingBag, Target, Pill, Scale, ArrowDown,
  Camera, LayoutTemplate, CalendarCheck, Crown, Users, Shield,
  BarChart2, Lock,
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

// ─── DATA ────────────────────────────────────────────────────────────────────

const LEVELS = [
  { level: 1, name: 'RECRUIT',    xpRequired: 0 },
  { level: 2, name: 'CONSISTENT', xpRequired: 2000 },
  { level: 3, name: 'COMMITTED',  xpRequired: 5000 },
  { level: 4, name: 'ATHLETE',    xpRequired: 12000 },
  { level: 5, name: 'ELITE',      xpRequired: 25000 },
  { level: 6, name: 'PLUS 4',     xpRequired: 50000 },
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
  { id: 'first_rep',     name: 'First Rep',        xp: 100, icon: Dumbbell,     description: 'Complete your first training session' },
  { id: 'week1_warrior', name: 'Week 1 Warrior',   xp: 150, icon: CalendarCheck, description: 'Complete all sessions in Week 1' },
  { id: 'halfway',       name: 'Halfway',           xp: 200, icon: Flag,          description: 'Reach Week 6 of your 12-week plan' },
  { id: 'full_campaign', name: 'Full Campaign',     xp: 500, icon: Medal,         description: 'Complete all 12 weeks' },
  { id: 'on_fire',       name: 'On Fire',           xp: 100, icon: Flame,         description: 'Complete sessions 7 days in a row' },
  { id: 'unstoppable',   name: 'Unstoppable',       xp: 300, icon: Zap,           description: 'Complete sessions 30 days in a row' },
  { id: 'iron_monday',   name: 'Iron Monday',       xp: 150, icon: Zap,           description: 'Never miss a Monday across 12 weeks' },
  { id: 'pr_hunter',     name: 'PR Hunter',         xp: 200, icon: Trophy,        description: 'Log a personal record on any exercise' },
  { id: 'big_four',      name: 'Big Four',          xp: 250, icon: Dumbbell,      description: 'Log a 1RM on all four key lifts' },
  { id: 'century',       name: 'Century',           xp: 500, icon: Hash,          description: 'Complete 100 total training sessions' },
  { id: 'back_in_game',  name: 'Back in the Game',  xp: 100, icon: RefreshCw,     description: 'Complete the return to training protocol' },
  { id: 'iron_will',     name: 'Iron Will',         xp: 150, icon: Swords,        description: 'Complete a session on a day you logged as tough' },
];

const NUTRITION_BADGES = [
  { id: 'protein_king',  name: 'Protein King',  xp: 100, icon: Beef,       description: 'Hit your protein target 7 days in a row' },
  { id: 'perfect_week',  name: 'Perfect Week',  xp: 200, icon: Trophy,     description: 'Hit all macro targets every day for a full week' },
  { id: 'meal_prepper',  name: 'Meal Prepper',  xp: 50,  icon: ShoppingBag, description: 'Log your weekly grocery shop as complete' },
  { id: 'dialled_in',    name: 'Dialled In',    xp: 300, icon: Target,     description: 'Hit all nutrition targets every day for a month' },
  { id: 'stacked',       name: 'Stacked',       xp: 100, icon: Pill,       description: 'Log your supplements every day for 30 days' },
];

const PROGRESS_BADGES = [
  { id: 'first_checkin',  name: 'First Check-In',  xp: 10,  icon: Scale,        description: 'Log your first weight entry' },
  { id: 'moving_needle',  name: 'Moving Needle',   xp: 100, icon: ArrowDown,    description: 'Lose your first kilogram from starting weight' },
  { id: 'halfway_home',   name: 'Halfway Home',    xp: 200, icon: Target,       description: 'Reach 50% of your target weight change' },
  { id: 'goal_achieved',  name: 'Goal Achieved',   xp: 500, icon: Flag,         description: 'Hit your target weight' },
  { id: 'picture_perfect',name: 'Picture Perfect', xp: 50,  icon: Camera,       description: 'Upload your first progress photo' },
  { id: 'transformation', name: 'Transformation',  xp: 300, icon: LayoutTemplate, description: 'Upload photos at Week 1 and Week 12' },
  { id: 'consistent',     name: 'Consistent',      xp: 200, icon: CalendarCheck, description: 'Log your weight every day for 30 days' },
  { id: 'strength_surge', name: 'Strength Surge',  xp: 200, icon: BarChart2,    description: 'Improve your 1RM on any lift for 3 weeks running' },
];

const LEGACY_BADGES = [
  { id: 'the_p4',          name: 'The P4',          xp: 1000, icon: null,   isP4: true,  description: 'Reach Level 6 and complete two full 12-week plans' },
  { id: 'coaches_pick',    name: "Coach's Pick",    xp: 500,  icon: Shield,              description: 'Manually awarded by the Plus 4 coaching team' },
  { id: 'founding_member', name: 'Founding Member', xp: 500,  icon: Crown,               description: 'One of the first 50 customers ever' },
  { id: 'refer_friend',    name: 'Refer a Friend',  xp: 200,  icon: Users,               description: 'Refer someone who signs up to Plus 4 Performance' },
];

// Front-face hex fill (darkened category colour)
const DARK_FILLS = {
  '#C0392B': '#8B1A10',
  '#1E7A3E': '#0F4D26',
  '#1A4E7A': '#0D2E4A',
  '#B8860B': '#6B4E00',
};

// Back-face background for unlocked badges (per spec)
const BACK_FILLS = {
  '#C0392B': '#6B0F0A',
  '#1E7A3E': '#0F4D26',
  '#1A4E7A': '#0D2E4A',
  '#B8860B': '#6B4E00',
};

const CATEGORIES = [
  { key: 'training',  label: 'Training',  color: '#C0392B', badges: TRAINING_BADGES },
  { key: 'nutrition', label: 'Nutrition', color: '#1E7A3E', badges: NUTRITION_BADGES },
  { key: 'progress',  label: 'Progress',  color: '#1A4E7A', badges: PROGRESS_BADGES },
  { key: 'legacy',    label: 'Legacy',    color: '#B8860B', badges: LEGACY_BADGES },
];

// ─── HEXAGON UTILITY ─────────────────────────────────────────────────────────

function hexPoly(w) {
  const r = w / Math.sqrt(3);
  const h = r * 2;
  const dy = r / 2;
  const hw = w / 2;
  return {
    points: `${hw},0 ${w},${dy} ${w},${h - dy} ${hw},${h} 0,${h - dy} 0,${dy}`,
    w, h, cx: hw, cy: h / 2,
  };
}

function fmtUnlockDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── HEX BADGE (with flip) ───────────────────────────────────────────────────

function HexBadge({ badge, color, unlocked, unlockDate, isFlipped, onFlip }) {
  const { icon: Icon, name, xp, isP4, description } = badge;
  const { points, w, h, cx, cy } = hexPoly(72);
  const gradId   = `lk-${badge.id}`;
  const darkFill = DARK_FILLS[color] || color;
  const backFill = unlocked ? (BACK_FILLS[color] || '#1a1a1a') : '#1a1a1a';
  const backBorder = unlocked ? color : '#2a2a2a';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isFlipped}
      onClick={() => onFlip(badge.id)}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onFlip(badge.id)}
      style={{ width: 100, height: 168, perspective: 700, cursor: 'pointer', outline: 'none' }}
    >
      {/* Rotating inner */}
      <div style={{
        width: '100%', height: '100%',
        position: 'relative',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.42s ease',
        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>

        {/* ── FRONT FACE ── */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          paddingTop: 4,
          gap: 7,
          opacity: unlocked ? 1 : 0.65,
        }}>
          <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible', flexShrink: 0 }}>
            <defs>
              {!unlocked && (
                <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1a1a1a" />
                  <stop offset="100%" stopColor="#111111" />
                </linearGradient>
              )}
            </defs>

            {unlocked && (
              <polygon
                points={points}
                fill={color}
                opacity={0.2}
                transform={`translate(${cx},${cy}) scale(1.14) translate(${-cx},${-cy})`}
              />
            )}

            <polygon
              points={points}
              fill={unlocked ? darkFill : `url(#${gradId})`}
              stroke={unlocked ? color : '#2a2a2a'}
              strokeWidth={unlocked ? 2 : 0.5}
            />

            {isP4 ? (
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                fill="#ffffff" opacity={unlocked ? 1 : 0.2}
                fontFamily="'Bebas Neue', sans-serif" fontSize={28} fontWeight="bold">
                P4
              </text>
            ) : Icon ? (
              <foreignObject x={0} y={0} width={w} height={h}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: `${w}px`, height: `${h}px` }}>
                  <div style={{ opacity: unlocked ? 1 : 0.2 }}>
                    <Icon size={26} color="#ffffff" strokeWidth={1.5} />
                  </div>
                </div>
              </foreignObject>
            ) : null}

            {!unlocked && (
              <foreignObject x={cx - 8} y={cy - 8} width={16} height={16}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px' }}>
                  <Lock size={16} color="#3a3a3a" strokeWidth={2} />
                </div>
              </foreignObject>
            )}
          </svg>

          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: unlocked ? '#ffffff' : '#444444',
            textAlign: 'center', lineHeight: 1.3, maxWidth: 100,
          }}>
            {name}
          </div>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 9, color: '#494949', letterSpacing: '0.08em', marginTop: -2,
          }}>
            {xp} XP
          </div>
        </div>

        {/* ── BACK FACE ── */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: backFill,
          border: `1px solid ${backBorder}`,
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center',
          padding: '10px 9px',
          gap: 4,
        }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: '#F5F3EE', lineHeight: 1.2,
          }}>
            {name}
          </div>

          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 10, color: '#888', letterSpacing: '0.04em', lineHeight: 1.35,
          }}>
            {description}
          </div>

          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#C0392B',
          }}>
            +{xp} XP
          </div>

          {unlocked ? (
            <>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: '#4CAF50',
              }}>
                Unlocked
              </div>
              {unlockDate && (
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 9, color: '#555', letterSpacing: '0.06em',
                }}>
                  {fmtUnlockDate(unlockDate)}
                </div>
              )}
            </>
          ) : (
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 10, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#444',
            }}>
              Locked
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── CATEGORY SECTION ────────────────────────────────────────────────────────

function CategorySection({ category, unlockedIds, unlockedDates, flippedId, onFlip }) {
  const unlockedCount = category.badges.filter(b => unlockedIds.has(b.id)).length;

  return (
    <div style={{ marginTop: 56 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11, fontWeight: 700, letterSpacing: '0.3em',
          textTransform: 'uppercase', color: category.color, whiteSpace: 'nowrap',
        }}>
          {category.label}
        </span>
        <div style={{ flex: 1, height: '0.5px', background: category.color, opacity: 0.4 }} />
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11, color: '#444', letterSpacing: '0.1em', whiteSpace: 'nowrap',
        }}>
          {unlockedCount}/{category.badges.length}
        </span>
      </div>

      <div className="achv-badge-grid">
        {category.badges.map(badge => (
          <HexBadge
            key={badge.id}
            badge={badge}
            color={category.color}
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

// ─── XP LEVEL SECTION ────────────────────────────────────────────────────────

function XpSection({ currentXp }) {
  const currentLevel = [...LEVELS].reverse().find(l => currentXp >= l.xpRequired) || LEVELS[0];
  const nextLevel    = LEVELS[currentLevel.level] || null;
  const prevXp       = currentLevel.xpRequired;
  const nextXp       = nextLevel ? nextLevel.xpRequired : prevXp;
  const progress     = nextLevel ? (currentXp - prevXp) / (nextXp - prevXp) : 1;

  const bigHex = hexPoly(80);
  const pipHex = hexPoly(34);

  return (
    <div style={{ background: '#0a0a0a', padding: '32px 28px 28px', marginBottom: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <svg width={bigHex.w} height={bigHex.h} viewBox={`0 0 ${bigHex.w} ${bigHex.h}`} style={{ overflow: 'visible' }}>
          <polygon points={bigHex.points} fill="#6B0F0A" stroke="#C0392B" strokeWidth={2} />
          <text x={bigHex.cx} y={bigHex.cy} textAnchor="middle" dominantBaseline="middle"
            fill="#ffffff" fontFamily="'Bebas Neue', sans-serif" fontSize={36}>
            {currentLevel.level}
          </text>
        </svg>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 13, fontWeight: 700, letterSpacing: '0.24em',
          textTransform: 'uppercase', color: '#888888',
        }}>
          {currentLevel.name}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#787878', letterSpacing: '0.1em' }}>
            {currentXp.toLocaleString()} XP
          </span>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: '#444', letterSpacing: '0.1em' }}>
            {nextLevel ? `${nextXp.toLocaleString()} XP` : 'MAX LEVEL'}
          </span>
        </div>
        <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2 }}>
          <div style={{
            height: '100%',
            width: `${Math.round(progress * 100)}%`,
            background: '#C0392B', borderRadius: 2,
            minWidth: progress > 0 ? 4 : 0,
          }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        {LEVELS.map(lvl => {
          const isUnlocked = currentXp >= lvl.xpRequired;
          const isCurrent  = lvl.level === currentLevel.level;
          const pipFill    = isCurrent ? '#6B0F0A' : isUnlocked ? '#2a0a0a' : '#0d0d0d';
          const pipStroke  = isCurrent ? '#C0392B' : isUnlocked ? '#C0392B' : '#1a1a1a';
          const pipNum     = isCurrent ? '#ffffff' : isUnlocked ? '#C0392B' : '#2a2a2a';
          const labelCol   = isCurrent ? '#666666' : '#444444';

          return (
            <div key={lvl.level} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <svg width={pipHex.w} height={pipHex.h} viewBox={`0 0 ${pipHex.w} ${pipHex.h}`}>
                <polygon points={pipHex.points} fill={pipFill} stroke={pipStroke} strokeWidth={1} />
                <text x={pipHex.cx} y={pipHex.cy} textAnchor="middle" dominantBaseline="middle"
                  fill={pipNum} fontFamily="'Bebas Neue', sans-serif" fontSize={14}>
                  {lvl.level}
                </text>
              </svg>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: labelCol, textAlign: 'center',
              }}>
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
  return (
    <div style={{ marginTop: 52 }}>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 11, fontWeight: 700, letterSpacing: '0.24em',
        textTransform: 'uppercase', color: '#555', marginBottom: 10,
      }}>
        XP Guide
      </div>
      <div style={{
        background: '#0a0a0a', border: '0.5px solid #1e1e1e',
        padding: '18px 20px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px',
      }}>
        {XP_ACTIONS.map(({ action, xp }) => (
          <div key={action} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 13, padding: '8px 0', borderBottom: '1px solid #141414',
          }}>
            <span style={{ color: '#666' }}>{action}</span>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
              color: '#C0392B', marginLeft: 12, whiteSpace: 'nowrap',
            }}>
              +{xp} XP
            </span>
          </div>
        ))}
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

  const allIds     = CATEGORIES.flatMap(c => c.badges.map(b => b.id));
  const displayIds = isPreview ? new Set(allIds) : unlockedIds;
  const displayDates = isPreview
    ? new Map(allIds.map(id => [id, new Date().toISOString()]))
    : unlockedDates;
  const displayXp  = isPreview ? 10000 : currentXp;

  return (
    <div>
      <style>{`
        .achv-badge-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 28px 20px;
          align-items: start;
        }
        @media (max-width: 540px) {
          .achv-badge-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>

      {loading ? (
        <div style={{ color: '#555', padding: '60px 0', textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em' }}>
          Loading…
        </div>
      ) : (
        <>
          <XpSection currentXp={displayXp} />

          {CATEGORIES.map(cat => (
            <CategorySection
              key={cat.key}
              category={cat}
              unlockedIds={displayIds}
              unlockedDates={displayDates}
              flippedId={flippedId}
              onFlip={handleFlip}
            />
          ))}

          <XpGuide />
        </>
      )}
    </div>
  );
}
