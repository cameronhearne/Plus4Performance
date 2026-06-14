import React, { useEffect, useState } from 'react';
import {
  Dumbbell, Flame, Zap, Trophy, Flag, Medal, Hash, RefreshCw,
  Swords, Beef, ShoppingBag, Target, Pill, Scale, ArrowDown,
  Camera, LayoutTemplate, CalendarCheck, Crown, Users, Shield,
  BarChart2, Lock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── DATA ────────────────────────────────────────────────────────────────────

const LEVELS = [
  { level: 1, name: 'RECRUIT',    xpRequired: 0 },
  { level: 2, name: 'CONSISTENT', xpRequired: 500 },
  { level: 3, name: 'COMMITTED',  xpRequired: 1500 },
  { level: 4, name: 'ATHLETE',    xpRequired: 3000 },
  { level: 5, name: 'ELITE',      xpRequired: 6000 },
  { level: 6, name: 'PLUS 4',     xpRequired: 10000 },
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
  { id: 'first_rep',     name: 'First Rep',        xp: 100, icon: Dumbbell },
  { id: 'week1_warrior', name: 'Week 1 Warrior',   xp: 150, icon: CalendarCheck },
  { id: 'halfway',       name: 'Halfway',           xp: 200, icon: Flag },
  { id: 'full_campaign', name: 'Full Campaign',     xp: 500, icon: Medal },
  { id: 'on_fire',       name: 'On Fire',           xp: 100, icon: Flame },
  { id: 'unstoppable',   name: 'Unstoppable',       xp: 300, icon: Zap },
  { id: 'iron_monday',   name: 'Iron Monday',       xp: 150, icon: Zap },
  { id: 'pr_hunter',     name: 'PR Hunter',         xp: 200, icon: Trophy },
  { id: 'big_four',      name: 'Big Four',          xp: 250, icon: Dumbbell },
  { id: 'century',       name: 'Century',           xp: 500, icon: Hash },
  { id: 'back_in_game',  name: 'Back in the Game',  xp: 100, icon: RefreshCw },
  { id: 'iron_will',     name: 'Iron Will',         xp: 150, icon: Swords },
];

const NUTRITION_BADGES = [
  { id: 'protein_king',  name: 'Protein King',  xp: 100, icon: Beef },
  { id: 'perfect_week',  name: 'Perfect Week',  xp: 200, icon: Trophy },
  { id: 'meal_prepper',  name: 'Meal Prepper',  xp: 50,  icon: ShoppingBag },
  { id: 'dialled_in',    name: 'Dialled In',    xp: 300, icon: Target },
  { id: 'stacked',       name: 'Stacked',       xp: 100, icon: Pill },
];

const PROGRESS_BADGES = [
  { id: 'first_checkin',  name: 'First Check-In',  xp: 10,  icon: Scale },
  { id: 'moving_needle',  name: 'Moving Needle',   xp: 100, icon: ArrowDown },
  { id: 'halfway_home',   name: 'Halfway Home',    xp: 200, icon: Target },
  { id: 'goal_achieved',  name: 'Goal Achieved',   xp: 500, icon: Flag },
  { id: 'picture_perfect',name: 'Picture Perfect', xp: 50,  icon: Camera },
  { id: 'transformation', name: 'Transformation',  xp: 300, icon: LayoutTemplate },
  { id: 'consistent',     name: 'Consistent',      xp: 200, icon: CalendarCheck },
  { id: 'strength_surge', name: 'Strength Surge',  xp: 200, icon: BarChart2 },
];

const LEGACY_BADGES = [
  { id: 'the_p4',          name: 'The P4',          xp: 1000, icon: null, isP4: true },
  { id: 'coaches_pick',    name: "Coach's Pick",    xp: 500,  icon: Shield },
  { id: 'founding_member', name: 'Founding Member', xp: 500,  icon: Crown },
  { id: 'refer_friend',    name: 'Refer a Friend',  xp: 200,  icon: Users },
];

// Darkened fills for unlocked state — rich but not garish
const DARK_FILLS = {
  '#C0392B': '#8B1A10',
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

// Pointy-top regular hexagon. Circumradius = w / √3, height = 2r.
function hexPoly(w) {
  const r = w / Math.sqrt(3);
  const h = r * 2;
  const dy = r / 2;
  const hw = w / 2;
  return {
    points: `${hw},0 ${w},${dy} ${w},${h - dy} ${hw},${h} 0,${h - dy} 0,${dy}`,
    w,
    h,
    cx: hw,
    cy: h / 2,
  };
}

// ─── HEX BADGE ───────────────────────────────────────────────────────────────

function HexBadge({ badge, color, unlocked }) {
  const { icon: Icon, name, xp, isP4 } = badge;
  const { points, w, h, cx, cy } = hexPoly(72);
  const gradId = `lk-${badge.id}`;
  const darkFill = DARK_FILLS[color] || color;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 7,
        maxWidth: 100,
        opacity: unlocked ? 1 : 0.65,
      }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          {!unlocked && (
            <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1a1a1a" />
              <stop offset="100%" stopColor="#111111" />
            </linearGradient>
          )}
        </defs>

        {/* Outer glow — unlocked only: larger hex at category colour, 20% opacity */}
        {unlocked && (
          <polygon
            points={points}
            fill={color}
            opacity={0.2}
            transform={`translate(${cx},${cy}) scale(1.14) translate(${-cx},${-cy})`}
          />
        )}

        {/* Main hex body */}
        <polygon
          points={points}
          fill={unlocked ? darkFill : `url(#${gradId})`}
          stroke={unlocked ? color : '#2a2a2a'}
          strokeWidth={unlocked ? 2 : 0.5}
        />

        {/* Icon */}
        {isP4 ? (
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#ffffff"
            opacity={unlocked ? 1 : 0.2}
            fontFamily="'Bebas Neue', sans-serif"
            fontSize={28}
            fontWeight="bold"
          >
            P4
          </text>
        ) : Icon ? (
          <foreignObject x={0} y={0} width={w} height={h}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: `${w}px`,
                height: `${h}px`,
              }}
            >
              <div style={{ opacity: unlocked ? 1 : 0.2 }}>
                <Icon size={26} color="#ffffff" strokeWidth={1.5} />
              </div>
            </div>
          </foreignObject>
        ) : null}

        {/* Lock icon at dead centre — locked only */}
        {!unlocked && (
          <foreignObject x={cx - 8} y={cy - 8} width={16} height={16}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '16px',
                height: '16px',
              }}
            >
              <Lock size={16} color="#3a3a3a" strokeWidth={2} />
            </div>
          </foreignObject>
        )}
      </svg>

      <div
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: unlocked ? '#ffffff' : '#444444',
          textAlign: 'center',
          lineHeight: 1.3,
          maxWidth: 100,
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 9,
          color: '#494949',
          letterSpacing: '0.08em',
          marginTop: -2,
        }}
      >
        {xp} XP
      </div>
    </div>
  );
}

// ─── CATEGORY SECTION ────────────────────────────────────────────────────────

function CategorySection({ category, unlockedIds }) {
  const unlockedCount = category.badges.filter(b => unlockedIds.has(b.id)).length;

  return (
    <div style={{ marginTop: 56 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <span
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: category.color,
            whiteSpace: 'nowrap',
          }}
        >
          {category.label}
        </span>
        <div style={{ flex: 1, height: '0.5px', background: category.color, opacity: 0.4 }} />
        <span
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11,
            color: '#444',
            letterSpacing: '0.1em',
            whiteSpace: 'nowrap',
          }}
        >
          {unlockedCount}/{category.badges.length}
        </span>
      </div>

      {/* Badge grid — responsive via CSS class */}
      <div className="achv-badge-grid">
        {category.badges.map(badge => (
          <HexBadge
            key={badge.id}
            badge={badge}
            color={category.color}
            unlocked={unlockedIds.has(badge.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── XP LEVEL SECTION ────────────────────────────────────────────────────────

function XpSection({ currentXp }) {
  const currentLevel = [...LEVELS].reverse().find(l => currentXp >= l.xpRequired) || LEVELS[0];
  const nextLevel = LEVELS[currentLevel.level] || null;
  const prevXp = currentLevel.xpRequired;
  const nextXp = nextLevel ? nextLevel.xpRequired : prevXp;
  const progress = nextLevel ? (currentXp - prevXp) / (nextXp - prevXp) : 1;

  const bigHex = hexPoly(80);
  const pipHex = hexPoly(34);

  return (
    <div style={{ background: '#0a0a0a', padding: '32px 28px 28px', marginBottom: 8 }}>
      {/* Current level large hex + name */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <svg
          width={bigHex.w}
          height={bigHex.h}
          viewBox={`0 0 ${bigHex.w} ${bigHex.h}`}
          style={{ overflow: 'visible' }}
        >
          <polygon
            points={bigHex.points}
            fill="#6B0F0A"
            stroke="#C0392B"
            strokeWidth={2}
          />
          <text
            x={bigHex.cx}
            y={bigHex.cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#ffffff"
            fontFamily="'Bebas Neue', sans-serif"
            fontSize={36}
          >
            {currentLevel.level}
          </text>
        </svg>
        <div
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: '#888888',
          }}
        >
          {currentLevel.name}
        </div>
      </div>

      {/* XP progress bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 11,
              color: '#787878',
              letterSpacing: '0.1em',
            }}
          >
            {currentXp.toLocaleString()} XP
          </span>
          <span
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 11,
              color: '#444',
              letterSpacing: '0.1em',
            }}
          >
            {nextLevel ? `${nextXp.toLocaleString()} XP` : 'MAX LEVEL'}
          </span>
        </div>
        <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2 }}>
          <div
            style={{
              height: '100%',
              width: `${Math.round(progress * 100)}%`,
              background: '#C0392B',
              borderRadius: 2,
              minWidth: progress > 0 ? 4 : 0,
            }}
          />
        </div>
      </div>

      {/* Level pips */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        {LEVELS.map(lvl => {
          const isUnlocked = currentXp >= lvl.xpRequired;
          const isCurrent = lvl.level === currentLevel.level;

          const pipFill   = isCurrent ? '#6B0F0A'  : isUnlocked ? '#2a0a0a' : '#0d0d0d';
          const pipStroke = isCurrent ? '#C0392B'  : isUnlocked ? '#C0392B' : '#1a1a1a';
          const pipNum    = isCurrent ? '#ffffff'  : isUnlocked ? '#C0392B' : '#2a2a2a';
          const labelCol  = isCurrent ? '#666666'  : '#444444';

          return (
            <div key={lvl.level} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <svg width={pipHex.w} height={pipHex.h} viewBox={`0 0 ${pipHex.w} ${pipHex.h}`}>
                <polygon
                  points={pipHex.points}
                  fill={pipFill}
                  stroke={pipStroke}
                  strokeWidth={1}
                />
                <text
                  x={pipHex.cx}
                  y={pipHex.cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={pipNum}
                  fontFamily="'Bebas Neue', sans-serif"
                  fontSize={14}
                >
                  {lvl.level}
                </text>
              </svg>
              <div
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 9,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: labelCol,
                  textAlign: 'center',
                }}
              >
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
      <div
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: '#555',
          marginBottom: 10,
        }}
      >
        XP Guide
      </div>
      <div
        style={{
          background: '#0a0a0a',
          border: '0.5px solid #1e1e1e',
          padding: '18px 20px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0 32px',
        }}
      >
        {XP_ACTIONS.map(({ action, xp }) => (
          <div
            key={action}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13,
              padding: '8px 0',
              borderBottom: '1px solid #141414',
            }}
          >
            <span style={{ color: '#666' }}>{action}</span>
            <span
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: '#C0392B',
                marginLeft: 12,
                whiteSpace: 'nowrap',
              }}
            >
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

  const [unlockedIds, setUnlockedIds] = useState(new Set());
  const [currentXp,   setCurrentXp]   = useState(0);
  const [loading,     setLoading]      = useState(true);

  useEffect(() => {
    if (isPreview) { setLoading(false); return; }

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [{ data: achvRows }, { data: xpRow }] = await Promise.all([
        supabase
          .from('user_achievements')
          .select('achievement_id')
          .eq('user_id', user.id),
        supabase
          .from('user_xp')
          .select('total_xp')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (achvRows) setUnlockedIds(new Set(achvRows.map(r => r.achievement_id)));
      if (xpRow)    setCurrentXp(xpRow.total_xp || 0);
      setLoading(false);
    }

    load();
  }, [userId]); // re-fetches whenever the tab remounts or userId changes

  const allIds = CATEGORIES.flatMap(c => c.badges.map(b => b.id));
  const displayIds = isPreview ? new Set(allIds) : unlockedIds;
  const displayXp  = isPreview ? 10000 : currentXp;

  return (
    <div>
      <style>{`
        .achv-badge-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 28px 20px;
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
            <CategorySection key={cat.key} category={cat} unlockedIds={displayIds} />
          ))}

          <XpGuide />
        </>
      )}
    </div>
  );
}
