'use strict';

const fs   = require('fs');
const path = require('path');

// ─── ALIAS TABLE ─────────────────────────────────────────────────────────────
// Keys are lowercased versions of how an exercise appears in substitution lists.
// Values are the exact canonical name as it appears in the "Exercise N:" header.
//
// Three categories:
//   (A) Em-dash variants — "Exercise — Variant" appears without the dash in subs
//   (B) Ambiguous generic refs — no variant specified, defaulted (marked DEFAULT)
//   (C) Reformatted / paraphrased — word order changed, qualifier stripped, etc.

const ALIASES = {
  // ── (A) Em-dash variants ──────────────────────────────────────────────────
  'lateral raise dumbbell':                         'Lateral Raise — Dumbbell',
  'lateral raise machine':                          'Lateral Raise — Machine',
  'tricep pushdown rope':                           'Tricep Pushdown — Rope',
  'tricep pushdown v bar':                          'Tricep Pushdown — V Bar',
  'tricep pushdown ez bar':                         'Tricep Pushdown — EZ Bar',
  'overhead cable extension':                       'Overhead Tricep Extension — Cable',
  'overhead tricep extension dumbbell':             'Overhead Tricep Extension — Dumbbell',
  'barbell hip thrust':                             'Hip Thrust — Barbell',
  'hip thrust machine':                             'Hip Thrust — Machine',
  'weighted dips on dip bars':                      'Dips — Weighted',
  'dips with forward lean':                         'Dips — Weighted',

  // ── (B) Ambiguous generic refs — DEFAULT choices ──────────────────────────
  // "Tricep pushdown" with no attachment → Rope (most common cable attachment;
  //   listed as primary in all three pushdown entries' subs)
  'tricep pushdown':                                'Tricep Pushdown — Rope',
  'cable tricep pushdown':                          'Tricep Pushdown — Rope',
  'tricep pushdown if overhead position is uncomfortable': 'Tricep Pushdown — Rope',

  // "Hip thrust" with no equipment → Barbell (primary entry, listed first in bible;
  //   Machine is the upgrade/alternative, not the default)
  'hip thrust':                                     'Hip Thrust — Barbell',
  'hip thrust barbell or machine':                  'Hip Thrust — Barbell',

  // "Lateral raise" with no implement → Dumbbell (most accessible version;
  //   listed first in bible as Ex 15 before Machine Ex 16 and Cable Ex 17)
  'lateral raise':                                  'Lateral Raise — Dumbbell',

  // ── (C) Reformatted / paraphrased ────────────────────────────────────────
  // Qualifiers stripped
  'flat dumbbell press':                            'Dumbbell Press',
  'dumbbell press when equipment becomes available':'Dumbbell Press',
  'cable curl with cable set low':                  'Cable Curl',
  'cable fly with cables set high':                 'Cable Fly',
  'cable fly with high cables':                     'Cable Fly',
  'cable crossover':                                'Cable Fly',
  'standard lat pulldown':                          'Lat Pulldown',
  'standard crunches':                              'Crunches',
  'decline sit ups with weight':                    'Decline Sit Ups',
  'leg raises on a bench':                          'Leg Raises',
  'barbell curl if ez bar unavailable':             'Barbell Curl',
  't bar row chest supported variation':            'T Bar Row',
  'bilateral leg press':                            'Leg Press',

  // Reordered / renamed
  'smith machine incline press':                    'Incline Smith Bench Press',

  // Implement/setup variants → closest canonical entry
  'cable front raise':                              'Front Raise',
  'plate front raise':                              'Front Raise',
  'cable hammer curl with rope attachment':         'Hammer Curl',
  'cross body hammer curl':                         'Hammer Curl',
  'dumbbell row on incline bench':                  'Dumbbell Single Arm Row',
  'seated barbell press':                           'Overhead Barbell Press',
  'resistance band lateral raise':                  'Cable Lateral Raise',

  // Functional equivalents (no exact entry; mapped to closest in library)
  'reverse cable fly':                              'Rear Delt Fly',
  'reverse pec deck':                               'Rear Delt Fly',
};

// ─── GENUINELY MISSING (no canonical entry, resolve to empty) ────────────────
// These are referenced in the bible but have no Exercise N: header:
//   Ab wheel rollout, Assisted pull up machine, Band assisted pull ups,
//   Band pull apart, Cable abduction, Cable adduction, Cable chest press,
//   Cable crunch, Cable shrug, Dumbbell fly, Goblet squat, Incline barbell
//   bench press, Incline cable press, Lateral band walk, Machine shoulder press,
//   Nordic curl, Resistance band fly, Smith machine bench press, Smith machine
//   shoulder press, Sumo squat, Terminal knee extension with band, Trap bar shrug.
// No action needed — they fall through the alias lookup and are silently skipped.

// ─── PARSER ──────────────────────────────────────────────────────────────────

function parseSubstitutionLine(line, lcToCanonical, parentName) {
  const parts = line.split(' / ');
  const result = [];

  for (const part of parts) {
    let name = part
      .replace(/\s*\(.*?\)\s*$/, '')   // strip parenthetical notes
      .replace(/\s*—.*$/, '')           // strip em-dash qualifiers
      .trim();
    if (!name) continue;

    // 1. Case-insensitive exact match (covers 71% of references)
    const canonical = lcToCanonical[name.toLowerCase()];
    if (canonical) {
      if (canonical !== parentName && !result.includes(canonical)) result.push(canonical);
      continue;
    }

    // 2. Alias table (covers em-dash variants, reformatted names, defaults)
    const aliased = ALIASES[name.toLowerCase()];
    if (aliased) {
      if (aliased !== parentName && !result.includes(aliased)) result.push(aliased);
      continue;
    }

    // 3. No match — genuinely missing entry, skip silently
  }

  return result;
}

function buildSubstitutionMap(biblePath) {
  const text = fs.readFileSync(biblePath, 'utf8');

  // Build lowercase → canonical name lookup from all "Exercise N: Name" headers
  const headerRe = /^Exercise \d+: (.+)$/gm;
  const canonicalNames = [];
  let m;
  while ((m = headerRe.exec(text)) !== null) {
    canonicalNames.push(m[1].trim());
  }
  const lcToCanonical = Object.fromEntries(canonicalNames.map(n => [n.toLowerCase(), n]));

  // Split text into per-exercise blocks on "Exercise N:" boundaries
  const blocks = text.split(/^(?=Exercise \d+:)/m);

  const map = new Map();

  for (const block of blocks) {
    const nameMatch = block.match(/^Exercise \d+: (.+)$/m);
    if (!nameMatch) continue;
    const canonicalName = nameMatch[1].trim();

    const subMatch = block.match(/^Substitutions: (.+)$/m);
    const alternatives = subMatch
      ? parseSubstitutionLine(subMatch[1], lcToCanonical, canonicalName)
      : [];

    map.set(canonicalName, alternatives);
  }

  return map;
}

// ─── MODULE SINGLETON ─────────────────────────────────────────────────────────
// Built once at startup. server.js calls initSubstitutions() during boot.

let substitutionMap = null;

function initSubstitutions(biblePath) {
  substitutionMap = buildSubstitutionMap(biblePath);
  const total    = substitutionMap.size;
  const withSubs = [...substitutionMap.values()].filter(v => v.length > 0).length;
  console.log(`[substitutions] loaded ${total} exercises, ${withSubs} with substitutions`);
}

/**
 * Returns an array of canonical exercise names that can substitute for the
 * given exercise. Returns [] if the exercise has no substitutions or is unknown.
 * @param {string} exerciseName — the canonical name (e.g. "Dumbbell Press")
 *   or any casing variant (lookup is case-insensitive against the canonical set)
 */
function getSubstitutions(exerciseName) {
  if (!substitutionMap) throw new Error('exerciseSubstitutions not initialised — call initSubstitutions() first');
  if (!exerciseName) return [];

  // Try exact match first, then case-insensitive scan
  if (substitutionMap.has(exerciseName)) return substitutionMap.get(exerciseName);

  const lc = exerciseName.toLowerCase();
  for (const [key, val] of substitutionMap) {
    if (key.toLowerCase() === lc) return val;
  }
  return [];
}

/**
 * Returns the full map for inspection / bulk use.
 * Keys are canonical exercise names; values are arrays of canonical alternatives.
 */
function getAllSubstitutions() {
  if (!substitutionMap) throw new Error('exerciseSubstitutions not initialised — call initSubstitutions() first');
  return substitutionMap;
}

module.exports = { initSubstitutions, getSubstitutions, getAllSubstitutions };
