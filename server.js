const http = require('http');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cron = require('node-cron');

const anthropic = new Anthropic();
const coachingBible = fs.readFileSync(path.join(__dirname, 'coaching_bible.txt'), 'utf8');

// Two separate clients:
// - supabaseAdmin: service role key, bypasses RLS, used for all DB writes
// - supabaseAuth: anon key, used only to verify user JWTs (avoids contaminating admin client auth state)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/*
  ─── SQL — run once in Supabase SQL editor ────────────────────────────────────

  create table email_preferences (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade unique,
    session_reminders boolean not null default true,
    weigh_in_reminders boolean not null default true,
    weekly_summary boolean not null default true,
    updated_at timestamptz not null default now()
  );
  alter table email_preferences enable row level security;
  create policy "prefs_all" on email_preferences
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  grant all on email_preferences to authenticated;

  ─────────────────────────────────────────────────────────────────────────────
*/

// Startup key validation
(function validateEnv() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'ANTHROPIC_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID'];
  required.forEach(k => {
    if (!process.env[k]) console.error(`MISSING ENV VAR: ${k}`);
  });
  const roleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  try {
    const payload = JSON.parse(Buffer.from(roleKey.split('.')[1], 'base64').toString());
    console.log('Supabase service key role:', payload.role); // should print "service_role"
  } catch {
    console.error('SUPABASE_SERVICE_ROLE_KEY does not look like a valid JWT');
  }
})();

// ─── PROMPT TEMPLATES ────────────────────────────────────────────────────────

const FULL_PLAN_SCHEMA = `{
  "user_summary": {
    "name": string,
    "goal": string,
    "split": string,
    "calorie_target": number,
    "protein_g": number,
    "carb_g": number,
    "fat_g": number,
    "bmr": number,
    "tdee": number,
    "training_days_per_week": number,
    "experience": string
  },
  "personal_note": string,
  "exercise_library": {
    "<snake_case_id>": {
      "name": string,
      "cues": string,
      "common_mistakes": string,
      "injury_modifications": string
    }
  },
  "phases": [
    {
      "phase": number,
      "label": string,
      "weeks": string,
      "training_calories": number,
      "rest_calories": number,
      "sessions": [
        {
          "name": string,
          "exercises": [
            { "ex": string, "sets": number, "reps": string, "rest": string }
          ]
        }
      ]
    }
  ],
  "nutrition": {
    "training_day": { "calories": number, "protein": number, "carbs": number, "fat": number },
    "rest_day": { "calories": number, "protein": number, "carbs": number, "fat": number }
  },
  "meal_plan": {
    "training_day": [
      { "name": string, "foods": [{ "name": string, "amount": string, "cal": number, "p": number, "c": number, "f": number }] }
    ],
    "rest_day": [
      { "name": string, "foods": [{ "name": string, "amount": string, "cal": number, "p": number, "c": number, "f": number }] }
    ]
  },
  "grocery_list": {
    "proteins": [string],
    "carbs": [string],
    "veg": [string],
    "fats": [string],
    "supplements": [string]
  },
  "supplements": [string],
  "key_lifts": [string, string, string],
  "what_happens_next": string
}`;

function buildFullPlanSystemPrompt() {
  return coachingBible + `

CRITICAL INSTRUCTION: You must respond with ONLY a valid JSON object. No text before or after the JSON. No markdown. No code blocks. The JSON must exactly follow this structure:
${FULL_PLAN_SCHEMA}`;
}

function buildFullPlanUserPrompt(intakeData) {
  return `Generate a fully individualised 12-week training and nutrition plan for the client below. Be specific — generic output is a failure. Respond with ONLY a valid JSON object matching the schema exactly. No markdown, no code fences.

STEP 1 — NUTRITION (Mifflin St Jeor)
Male BMR = (10×weight) + (6.25×height) − (5×age) + 5. Female: same −161.
Multiply by activity multiplier → TDEE. Apply goal adjustment from Section 7 → calorie_target. Set macros per Section 7 split. Store bmr and tdee in user_summary.

STEP 2 — EXERCISE LIBRARY
Build exercise_library first. Include every exercise used across all sessions — each keyed by snake_case ID (e.g. "barbell_bench_press"). Each entry has:
- name: full exercise name
- cues: one sentence on correct execution
- common_mistakes: one sentence on what to avoid
- injury_modifications: specific alternative if client has a relevant injury, else ""
Select exercises from the coaching bible (Tier 1 as foundation, Tier 2 for variety). For PPL: Push A and Push B must have different exercise selections. Same for Pull A and Pull B. Apply all injury contraindications from Section 9.

STEP 3 — PHASES (3 phases, 4 weeks each)
Build 3 phases. Each phase contains the SAME sessions but with progressive overload applied — reps/sets change between phases to show progression. Use specific numbers (e.g. phase 1: 3×8, phase 2: 4×6, phase 3: 5×5). Never write vague progressions.
- phase 1: label "Foundation", weeks "1–4"
- phase 2: label "Accumulation", weeks "5–8"
- phase 3: label "Intensification", weeks "9–12"
Each session: { name, exercises: [{ ex: "<library_id>", sets, reps, rest }] }
training_calories and rest_calories increase slightly each phase as progressive overload demand rises.

STEP 4 — MEAL PLAN (2 templates only)
Build one training_day template and one rest_day template — not 7 separate days.
- Each template is an array of meals (M1–M5). M3 must be "M3 — Post Workout" on training days.
- Every food: named with gram amount (e.g. "Chicken breast 180g"). Never "lean protein" or "complex carbs".
- grocery_list reflects exactly the foods used.
- Maximum 5 supplements. One line each: name, dose, timing.

STEP 5 — PERSONAL NOTE
3 short paragraphs written directly to the client. Include:
- Full Mifflin St Jeor calculation with their actual numbers.
- Their goal, current weight, target weight, what the calorie target achieves.
- Why the split suits their days/experience/goal and how injuries are handled.

STANDARDS: key_lifts = exactly 3 compound exercise names. All fields populated. No placeholders.

Client data:
${JSON.stringify(intakeData, null, 2)}`;
}

function buildSnapshotUserPrompt(intakeData) {
  return `Based on this client's intake data, generate a brief coaching snapshot. Respond with ONLY a valid JSON object — no markdown, no code fences.

JSON structure:
{
  "split_recommendation": string,
  "calorie_target": number,
  "protein_target": number,
  "goal_timeline": string,
  "coach_summary": string
}

Rules:
- split_recommendation: e.g. "Upper/Lower 4-day split" — pick the best split for their training days and goal.
- calorie_target: calculated using Mifflin St Jeor. Male: (10×weight)+(6.25×height)−(5×age)+5. Female: same −161. Multiply by activity multiplier, apply goal adjustment.
- protein_target: in grams, based on lean body mass or bodyweight and goal.
- goal_timeline: realistic estimate, e.g. "12–16 weeks to visible recomposition".
- coach_summary: 2–3 sentences in a direct coaching voice, specific to their stats and goal. Not generic. Reference their actual weight, goal, and key variables.

Client data:
${JSON.stringify(intakeData, null, 2)}`;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function getUserIdFromToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

async function sendWelcomeEmail(email, firstName) {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Plus 4 Performance <hello@plus4performance.com>',
        to: email,
        subject: 'Welcome to Plus 4 Performance',
        html: `
          <div style="background:#0d0d0d;color:#f2f2f2;font-family:'Barlow',sans-serif;padding:40px;max-width:600px;margin:0 auto;">
            <h1 style="font-size:28px;font-weight:700;color:#fff;margin-bottom:16px;">Welcome, ${firstName}.</h1>
            <p style="color:#C8C8C8;margin-bottom:16px;">Your intake has been received and your snapshot is ready inside your dashboard.</p>
            <p style="color:#C8C8C8;margin-bottom:24px;">Unlock your full 12-week plan to get your complete training programme, nutrition targets, and meal plan.</p>
            <a href="${process.env.CLIENT_ORIGIN || 'https://plus4performance.com'}/dashboard"
               style="display:inline-block;background:#C8C8C8;color:#0d0d0d;padding:14px 28px;font-weight:700;text-decoration:none;letter-spacing:0.1em;text-transform:uppercase;">
              Go to Dashboard
            </a>
          </div>
        `
      })
    });
  } catch (err) {
    console.error('Welcome email error:', err.message);
  }
}

// ─── EMAIL HELPERS ────────────────────────────────────────────────────────────

async function sendResendEmail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Plus 4 Performance <noreply@plus4performance.com>',
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error('Resend error ' + res.status + ': ' + (err.message || ''));
  }
}

function isTrainingDayForUser(intakeData) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = dayNames[new Date().getDay()];
  const numDays = parseInt(intakeData?.trainingDays || '4', 10);
  if (intakeData?.scheduleType === 'fixed' && Array.isArray(intakeData?.preferredDays) && intakeData.preferredDays.length > 0) {
    return intakeData.preferredDays.includes(todayName);
  }
  // Rolling: assume Mon → Sat up to numDays
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    .slice(0, numDays)
    .includes(todayName);
}

// ─── EMAIL TEMPLATES ─────────────────────────────────────────────────────────

function buildWeeklyEmailHtml({ firstName, weightChange, sessionsThisWeek, targetSessions, xpThisWeek, newBadges }) {
  const weightSign  = weightChange >= 0 ? '+' : '';
  const weightColor = weightChange < 0 ? '#4CAF50' : weightChange > 0 ? '#C0392B' : '#787878';
  const motivational = sessionsThisWeek >= targetSessions
    ? "Perfect week. That's what consistency looks like."
    : sessionsThisWeek >= Math.ceil(targetSessions * 0.6)
    ? 'Solid week. Keep building the habit.'
    : sessionsThisWeek >= 1
    ? 'Every session counts. Get back on it this week.'
    : 'Missed week. This week is a fresh start.';

  const badgesHtml = newBadges.length > 0
    ? `<tr><td style="padding-bottom:28px;"><p style="font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#555;margin:0 0 12px;">BADGES UNLOCKED</p>${newBadges.map(b => `<span style="display:inline-block;background:#1a1a1a;border:1px solid #C0392B;padding:5px 12px;margin:3px 3px 3px 0;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;color:#F5F3EE;text-transform:uppercase;">${b}</span>`).join('')}</td></tr>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#080808;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#080808;">
<tr><td align="center" style="padding:40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#080808;">
  <tr><td style="padding-bottom:32px;border-bottom:1px solid #1a1a1a;">
    <span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#C0392B;">PLUS 4 PERFORMANCE</span>
  </td></tr>
  <tr><td style="padding:32px 0 24px;">
    <h1 style="margin:0;font-family:'Barlow Condensed',sans-serif;font-size:36px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#F5F3EE;line-height:1.1;">YOUR WEEK, ${firstName}.</h1>
  </td></tr>
  <tr><td style="padding-bottom:28px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="50%" style="padding:0 6px 12px 0;vertical-align:top;">
          <div style="background:#111;border:1px solid #1e1e1e;padding:20px;">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#555;margin-bottom:8px;">WEIGHT CHANGE</div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:700;color:${weightColor};line-height:1;">${weightSign}${Math.abs(weightChange).toFixed(1)}kg</div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;color:#444;margin-top:4px;letter-spacing:0.06em;">this week</div>
          </div>
        </td>
        <td width="50%" style="padding:0 0 12px 6px;vertical-align:top;">
          <div style="background:#111;border:1px solid #1e1e1e;padding:20px;">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#555;margin-bottom:8px;">SESSIONS</div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:700;color:#F5F3EE;line-height:1;">${sessionsThisWeek} <span style="font-size:16px;color:#555;">of ${targetSessions}</span></div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;color:#444;margin-top:4px;letter-spacing:0.06em;">this week</div>
          </div>
        </td>
      </tr>
      <tr>
        <td width="50%" style="padding:0 6px 0 0;vertical-align:top;">
          <div style="background:#111;border:1px solid #1e1e1e;padding:20px;">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#555;margin-bottom:8px;">XP EARNED</div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:700;color:#C0392B;line-height:1;">+${xpThisWeek}</div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;color:#444;margin-top:4px;letter-spacing:0.06em;">this week</div>
          </div>
        </td>
        <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
          <div style="background:#111;border:1px solid #1e1e1e;padding:20px;">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#555;margin-bottom:8px;">BADGES</div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:700;color:#F5F3EE;line-height:1;">${newBadges.length > 0 ? newBadges.length : '—'}</div>
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;color:#444;margin-top:4px;letter-spacing:0.06em;">${newBadges.length === 1 ? 'new badge' : newBadges.length > 1 ? 'new badges' : 'no new badges'}</div>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>
  ${badgesHtml}
  <tr><td style="padding:0 0 32px;">
    <p style="font-family:'Barlow Condensed',sans-serif;font-size:16px;color:#888;letter-spacing:0.06em;margin:0;font-style:italic;">"${motivational}"</p>
  </td></tr>
  <tr><td style="padding-bottom:40px;">
    <a href="https://plus4performance.com/dashboard" style="display:inline-block;background:#C0392B;color:#ffffff;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;padding:16px 32px;text-decoration:none;">VIEW YOUR DASHBOARD →</a>
  </td></tr>
  <tr><td style="padding-top:24px;border-top:1px solid #1a1a1a;">
    <p style="font-family:'Barlow Condensed',sans-serif;font-size:11px;color:#444;letter-spacing:0.06em;margin:0;">To unsubscribe from weekly summaries, update your notification settings in the app.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function buildSessionReminderHtml(firstName, sessionName) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#080808;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#080808;">
<tr><td align="center" style="padding:40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#080808;">
  <tr><td style="padding-bottom:32px;border-bottom:1px solid #1a1a1a;">
    <span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#C0392B;">PLUS 4 PERFORMANCE</span>
  </td></tr>
  <tr><td style="padding:32px 0 20px;">
    <h1 style="margin:0;font-family:'Barlow Condensed',sans-serif;font-size:36px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#F5F3EE;line-height:1.1;">IT'S TRAINING DAY, ${firstName}.</h1>
  </td></tr>
  <tr><td style="padding-bottom:32px;">
    <p style="font-family:'Barlow Condensed',sans-serif;font-size:16px;color:#CDCDC8;letter-spacing:0.04em;margin:0;line-height:1.6;">Your ${sessionName} session is loaded and ready. Get after it.</p>
  </td></tr>
  <tr><td style="padding-bottom:40px;">
    <a href="https://plus4performance.com/dashboard" style="display:inline-block;background:#C0392B;color:#ffffff;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;padding:16px 32px;text-decoration:none;">OPEN YOUR SESSION →</a>
  </td></tr>
  <tr><td style="padding-top:24px;border-top:1px solid #1a1a1a;">
    <p style="font-family:'Barlow Condensed',sans-serif;font-size:11px;color:#444;letter-spacing:0.06em;margin:0;">To stop receiving session reminders, update your notification settings in the app.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function buildWeighInReminderHtml(firstName) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#080808;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#080808;">
<tr><td align="center" style="padding:40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#080808;">
  <tr><td style="padding-bottom:32px;border-bottom:1px solid #1a1a1a;">
    <span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#C0392B;">PLUS 4 PERFORMANCE</span>
  </td></tr>
  <tr><td style="padding:32px 0 20px;">
    <h1 style="margin:0;font-family:'Barlow Condensed',sans-serif;font-size:36px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#F5F3EE;line-height:1.1;">MORNING CHECK-IN, ${firstName}.</h1>
  </td></tr>
  <tr><td style="padding-bottom:32px;">
    <p style="font-family:'Barlow Condensed',sans-serif;font-size:16px;color:#CDCDC8;letter-spacing:0.04em;margin:0;line-height:1.6;">Log your weight this morning to keep your progress tracking accurate. Takes 10 seconds.</p>
  </td></tr>
  <tr><td style="padding-bottom:40px;">
    <a href="https://plus4performance.com/dashboard?tab=progress" style="display:inline-block;background:#C0392B;color:#ffffff;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;padding:16px 32px;text-decoration:none;">LOG MY WEIGHT →</a>
  </td></tr>
  <tr><td style="padding-top:24px;border-top:1px solid #1a1a1a;">
    <p style="font-family:'Barlow Condensed',sans-serif;font-size:11px;color:#444;letter-spacing:0.06em;margin:0;">To stop receiving weigh-in reminders, update your notification settings in the app.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// ─── CRON RUNNERS ─────────────────────────────────────────────────────────────

async function runWeeklyProgressEmails() {
  console.log('[Cron] Running weekly progress emails');
  const { data: prefs, error } = await supabaseAdmin
    .from('email_preferences')
    .select('user_id')
    .eq('weekly_summary', true);
  if (error) { console.error('[Cron] prefs fetch error:', error.message); return; }
  if (!prefs?.length) return;

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  for (const { user_id } of prefs) {
    try {
      const { data: { user }, error: uErr } = await supabaseAdmin.auth.admin.getUserById(user_id);
      if (uErr || !user) continue;

      const firstName = user.user_metadata?.first_name || user.email.split('@')[0];

      // Weight change
      const { data: weightLogs } = await supabaseAdmin
        .from('weight_logs').select('weight_kg, logged_at')
        .eq('user_id', user_id).order('logged_at', { ascending: true });
      let weightChange = 0;
      if (weightLogs?.length >= 2) {
        const thisWeek = weightLogs.filter(l => l.logged_at >= sevenDaysAgo);
        if (thisWeek.length > 0) {
          const before = weightLogs.filter(l => l.logged_at < sevenDaysAgo);
          const baseline = before.length ? before[before.length - 1] : weightLogs[0];
          weightChange = thisWeek[thisWeek.length - 1].weight_kg - baseline.weight_kg;
        }
      }

      // Sessions this week
      const { data: sessions } = await supabaseAdmin
        .from('session_completions').select('id')
        .eq('user_id', user_id).gte('completed_at', sevenDaysAgo);
      const sessionsThisWeek = sessions?.length || 0;

      // Target sessions from intake
      const { data: intakeRow } = await supabaseAdmin
        .from('intake_submissions').select('data')
        .eq('user_id', user_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const targetSessions = parseInt(intakeRow?.data?.trainingDays || '4', 10);

      // XP: sessions × 50 + achievements this week × 100
      const { data: newAchv } = await supabaseAdmin
        .from('user_achievements').select('achievement_id')
        .eq('user_id', user_id).gte('unlocked_at', sevenDaysAgo);
      const xpThisWeek = sessionsThisWeek * 50 + (newAchv?.length || 0) * 100;
      const newBadges = (newAchv || []).map(a =>
        a.achievement_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      );

      const html = buildWeeklyEmailHtml({ firstName, weightChange, sessionsThisWeek, targetSessions, xpThisWeek, newBadges });
      await sendResendEmail(user.email, 'Your Week in Review — Plus 4 Performance', html);
      console.log('[Cron] Weekly email sent to', user.email);
    } catch (err) {
      console.error('[Cron] Weekly email error for user', user_id + ':', err.message);
    }
  }
}

async function runSessionReminderEmails() {
  console.log('[Cron] Running session reminder emails');
  const { data: prefs, error } = await supabaseAdmin
    .from('email_preferences').select('user_id').eq('session_reminders', true);
  if (error) { console.error('[Cron] prefs fetch error:', error.message); return; }
  if (!prefs?.length) return;

  for (const { user_id } of prefs) {
    try {
      const { data: intakeRow } = await supabaseAdmin
        .from('intake_submissions').select('data')
        .eq('user_id', user_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!isTrainingDayForUser(intakeRow?.data)) continue;

      const { data: { user }, error: uErr } = await supabaseAdmin.auth.admin.getUserById(user_id);
      if (uErr || !user) continue;

      const firstName = user.user_metadata?.first_name || user.email.split('@')[0];
      const { data: planRow } = await supabaseAdmin
        .from('plans').select('plan_data').eq('user_id', user_id)
        .order('generated_at', { ascending: false }).limit(1).maybeSingle();
      const sessionName = (planRow?.plan_data?.user_summary?.split || 'training').toLowerCase();

      const html = buildSessionReminderHtml(firstName, sessionName);
      await sendResendEmail(user.email, 'Training day — your session is ready', html);
      console.log('[Cron] Session reminder sent to', user.email);
    } catch (err) {
      console.error('[Cron] Session reminder error for user', user_id + ':', err.message);
    }
  }
}

async function runWeighInReminderEmails() {
  console.log('[Cron] Running weigh-in reminder emails');
  const { data: prefs, error } = await supabaseAdmin
    .from('email_preferences').select('user_id').eq('weigh_in_reminders', true);
  if (error) { console.error('[Cron] prefs fetch error:', error.message); return; }
  if (!prefs?.length) return;

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(todayStart.getTime() + 86400000);

  for (const { user_id } of prefs) {
    try {
      const { data: todayLog } = await supabaseAdmin
        .from('weight_logs').select('id').eq('user_id', user_id)
        .gte('logged_at', todayStart.toISOString()).lt('logged_at', todayEnd.toISOString())
        .limit(1).maybeSingle();
      if (todayLog) continue;

      const { data: { user }, error: uErr } = await supabaseAdmin.auth.admin.getUserById(user_id);
      if (uErr || !user) continue;

      const firstName = user.user_metadata?.first_name || user.email.split('@')[0];
      const html = buildWeighInReminderHtml(firstName);
      await sendResendEmail(user.email, "Don't forget your morning weigh-in", html);
      console.log('[Cron] Weigh-in reminder sent to', user.email);
    } catch (err) {
      console.error('[Cron] Weigh-in reminder error for user', user_id + ':', err.message);
    }
  }
}

// ─── ROUTE HANDLERS ──────────────────────────────────────────────────────────

// POST /snapshot
// Called immediately after intake form submission (before payment).
// Requires: Authorization: Bearer <supabase_jwt>
// Body: { intakeData: {...}, userId: string }
async function handleSnapshot(req, res) {
  const userId = await getUserIdFromToken(req.headers['authorization']);
  if (!userId) return json(res, 401, { error: 'Unauthorized' });

  const body = await readBody(req);
  let parsed;
  try { parsed = JSON.parse(body); } catch { return json(res, 400, { error: 'Invalid JSON' }); }

  const { intakeData } = parsed;
  if (!intakeData) return json(res, 400, { error: 'intakeData required' });

  // Ensure profile exists (handles users who signed up before the trigger was in place)
  const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (authUser) {
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: authUser.email,
      first_name: authUser.user_metadata?.first_name || '',
      last_name: authUser.user_metadata?.last_name || '',
    }, { onConflict: 'id', ignoreDuplicates: true });
  }

  // Save intake submission
  const { error: intakeErr } = await supabaseAdmin.from('intake_submissions').insert({ user_id: userId, data: intakeData });
  if (intakeErr) console.error('Intake insert error:', intakeErr.message, intakeErr.details);

  // Generate snapshot via Anthropic
  let snapshot;
  try {
    const message = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: coachingBible,
      messages: [{ role: 'user', content: buildSnapshotUserPrompt(intakeData) }]
    }).finalMessage();

    const raw = message.content[0].text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    snapshot = JSON.parse(raw);
  } catch (err) {
    console.error('Snapshot generation error:', err);
    return json(res, 500, { error: 'Snapshot generation failed' });
  }

  // Persist snapshot to Supabase
  const { error: insertErr } = await supabaseAdmin.from('snapshots').insert({
    user_id: userId,
    split_recommendation: snapshot.split_recommendation,
    calorie_target: snapshot.calorie_target,
    protein_target: snapshot.protein_target,
    goal_timeline: snapshot.goal_timeline,
    coach_summary: snapshot.coach_summary,
  });

  if (insertErr) {
    console.error('Snapshot insert error:', insertErr.message, insertErr.details, insertErr.hint);
    return json(res, 500, { error: 'Failed to save snapshot: ' + insertErr.message });
  }

  console.log(`Snapshot saved for user ${userId}:`, JSON.stringify(snapshot));

  // Send welcome email (non-blocking)
  const firstName = intakeData.firstName || intakeData.first_name || '';
  const email = intakeData.email || '';
  if (email) sendWelcomeEmail(email, firstName);

  return json(res, 200, { snapshot });
}

// POST /generate-plan
// Called by Stripe webhook after payment confirmed — NOT called directly by frontend.
// Body: { userId: string, intakeData: {...} } — assembled by the webhook handler.
async function handleGeneratePlan(userId, intakeData) {
  console.log('Generating full plan for user:', userId);

  let planData;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Plan generation attempt ${attempt}/${maxAttempts} for user:`, userId);
      const message = await anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        system: buildFullPlanSystemPrompt(),
        messages: [{ role: 'user', content: buildFullPlanUserPrompt(intakeData) }]
      }).finalMessage();

      const raw = message.content[0].text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      planData = JSON.parse(raw);
      break; // success
    } catch (err) {
      console.error(`Plan generation attempt ${attempt} failed:`, err.message);
      if (attempt === maxAttempts) throw err;
    }
  }

  const { error } = await supabaseAdmin.from('plans').insert({
    user_id: userId,
    plan_data: planData,
  });

  if (error) throw new Error('Failed to save plan: ' + error.message);

  console.log('Plan saved for user:', userId);
  return planData;
}

// POST /stripe-webhook
// Stripe sends events here. Register this URL in your Stripe dashboard:
// https://your-railway-domain.railway.app/stripe-webhook
async function handleStripeWebhook(req, res) {
  const rawBody = await readBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature error:', err.message);
    return json(res, 400, { error: 'Invalid signature' });
  }

  // Acknowledge immediately — Stripe requires a fast 2xx
  json(res, 200, { received: true });

  // Process asynchronously
  setImmediate(async () => {
    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.user_id;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (!userId) { console.error('No user_id in session metadata'); return; }

        // Upsert subscription record
        await supabaseAdmin.from('subscriptions').upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: process.env.STRIPE_PRICE_ID,
          status: 'active',
        }, { onConflict: 'stripe_subscription_id' });

        // Fetch the user's intake data to generate plan
        const { data: intakeRows } = await supabaseAdmin
          .from('intake_submissions')
          .select('data')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!intakeRows || !intakeRows.length) {
          console.error('No intake data found for user:', userId);
          return;
        }

        await handleGeneratePlan(userId, intakeRows[0].data);

      } else if (event.type === 'customer.subscription.updated') {
        const sub = event.data.object;
        await supabaseAdmin.from('subscriptions')
          .update({
            status: sub.status,
            ...(sub.current_period_end != null && { current_period_end: new Date(sub.current_period_end * 1000).toISOString() }),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);

      } else if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object;
        await supabaseAdmin.from('subscriptions')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id);
      }
    } catch (err) {
      console.error('Webhook processing error:', err);
    }
  });
}

// POST /create-checkout-session
// Called by frontend to start Stripe checkout. Returns a Stripe checkout URL.
// Requires: Authorization: Bearer <supabase_jwt>
// Body: { email: string }
async function handleCreateCheckout(req, res) {
  const userId = await getUserIdFromToken(req.headers['authorization']);
  if (!userId) return json(res, 401, { error: 'Unauthorized' });

  const body = await readBody(req);
  let parsed;
  try { parsed = JSON.parse(body); } catch { return json(res, 400, { error: 'Invalid JSON' }); }

  const { email } = parsed;
  const origin = process.env.CLIENT_ORIGIN || 'https://plus4performance.com';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      client_reference_id: userId,
      success_url: `${origin}/dashboard?payment=success`,
      cancel_url: `${origin}/dashboard`,
      metadata: { user_id: userId },
    });

    return json(res, 200, { url: session.url });
  } catch (err) {
    console.error('Checkout session error:', err);
    return json(res, 500, { error: 'Failed to create checkout session' });
  }
}

// POST /admin/activate-subscription
// Upserts a subscription row to active for a user — use to recover after webhook failure.
// Requires: Authorization: Bearer <ADMIN_SECRET>
// Body: { user_id: string }
async function handleAdminActivateSubscription(req, res) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return json(res, 500, { error: 'ADMIN_SECRET not configured' });
  const authHeader = req.headers['authorization'] || '';
  if (authHeader !== `Bearer ${secret}`) return json(res, 401, { error: 'Unauthorized' });

  const body = await readBody(req);
  let parsed;
  try { parsed = JSON.parse(body); } catch { return json(res, 400, { error: 'Invalid JSON' }); }

  const { user_id } = parsed;
  if (!user_id) return json(res, 400, { error: 'user_id required' });

  // Check current state
  const { data: existing } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', user_id)
    .maybeSingle();

  console.log(`[admin] subscription row for ${user_id}:`, JSON.stringify(existing));

  let error;
  if (existing) {
    ({ error } = await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'active', stripe_price_id: process.env.STRIPE_PRICE_ID })
      .eq('id', existing.id));
  } else {
    ({ error } = await supabaseAdmin
      .from('subscriptions')
      .insert({ user_id, stripe_price_id: process.env.STRIPE_PRICE_ID, status: 'active' }));
  }

  if (error) return json(res, 500, { error: 'Database error: ' + error.message });

  return json(res, 200, { ok: true, was: existing?.status || 'missing', message: `Subscription activated for user ${user_id}` });
}

// POST /admin/generate-plan
// Manually re-trigger plan generation for a user (e.g. after a failed webhook).
// Requires: Authorization: Bearer <ADMIN_SECRET>
async function handleAdminGeneratePlan(req, res) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return json(res, 500, { error: 'ADMIN_SECRET not configured' });

  const authHeader = req.headers['authorization'] || '';
  if (authHeader !== `Bearer ${secret}`) return json(res, 401, { error: 'Unauthorized' });

  const body = await readBody(req);
  let parsed;
  try { parsed = JSON.parse(body); } catch { return json(res, 400, { error: 'Invalid JSON' }); }

  const { user_id } = parsed;
  if (!user_id) return json(res, 400, { error: 'user_id required' });

  const { data: intakeRows, error: intakeErr } = await supabaseAdmin
    .from('intake_submissions')
    .select('data')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (intakeErr) return json(res, 500, { error: 'Failed to fetch intake: ' + intakeErr.message });
  if (!intakeRows || !intakeRows.length) return json(res, 404, { error: 'No intake data found for user' });

  // Respond immediately — generation runs async in background (same pattern as webhook)
  json(res, 202, { ok: true, message: `Plan generation started for user ${user_id}. Check Railway logs for completion.` });

  setImmediate(async () => {
    try {
      await handleGeneratePlan(user_id, intakeRows[0].data);
      console.log(`Admin plan generation complete for user ${user_id}`);
    } catch (err) {
      console.error(`Admin plan generation failed for user ${user_id}:`, err.message);
    }
  });
}

// POST /create-portal-session
// Returns a Stripe billing-portal URL for the authenticated user.
async function handleCreatePortalSession(req, res) {
  const userId = await getUserIdFromToken(req.headers['authorization']);
  if (!userId) return json(res, 401, { error: 'Unauthorized' });

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!sub?.stripe_customer_id) return json(res, 404, { error: 'No subscription found' });

  const origin = process.env.CLIENT_ORIGIN || 'https://plus4performance.com';
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/dashboard`,
    });
    return json(res, 200, { url: session.url });
  } catch (err) {
    console.error('Portal session error:', err);
    return json(res, 500, { error: 'Failed to create portal session' });
  }
}

// DELETE /delete-account
// Permanently removes all user data then deletes the auth user.
async function handleDeleteAccount(req, res) {
  const userId = await getUserIdFromToken(req.headers['authorization']);
  if (!userId) return json(res, 401, { error: 'Unauthorized' });

  try {
    for (const table of ['weight_logs', 'lift_logs', 'session_completions', 'intake_submissions', 'snapshots', 'plans', 'subscriptions']) {
      await supabaseAdmin.from(table).delete().eq('user_id', userId);
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;
    return json(res, 200, { ok: true });
  } catch (err) {
    console.error('Delete account error:', err);
    return json(res, 500, { error: 'Failed to delete account: ' + err.message });
  }
}

// GET /api/email-preferences
async function handleGetEmailPreferences(req, res) {
  const userId = await getUserIdFromToken(req.headers['authorization']);
  if (!userId) return json(res, 401, { error: 'Unauthorized' });

  const { data, error } = await supabaseAdmin
    .from('email_preferences')
    .select('session_reminders, weigh_in_reminders, weekly_summary')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return json(res, 500, { error: error.message });
  return json(res, 200, {
    sessionReminders: data?.session_reminders ?? true,
    weighInReminders: data?.weigh_in_reminders ?? true,
    weeklySummary:    data?.weekly_summary ?? true,
  });
}

// POST /api/email-preferences
async function handleSaveEmailPreferences(req, res) {
  const userId = await getUserIdFromToken(req.headers['authorization']);
  if (!userId) return json(res, 401, { error: 'Unauthorized' });

  const body = await readBody(req);
  let parsed;
  try { parsed = JSON.parse(body); } catch { return json(res, 400, { error: 'Invalid JSON' }); }

  const { sessionReminders, weighInReminders, weeklySummary } = parsed;
  const { error } = await supabaseAdmin
    .from('email_preferences')
    .upsert({
      user_id:           userId,
      session_reminders: sessionReminders !== undefined ? Boolean(sessionReminders) : true,
      weigh_in_reminders: weighInReminders !== undefined ? Boolean(weighInReminders) : true,
      weekly_summary:    weeklySummary !== undefined    ? Boolean(weeklySummary)    : true,
      updated_at:        new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) return json(res, 500, { error: error.message });
  return json(res, 200, { ok: true });
}

// POST /api/monthly-checkin
// Accepts five check-in inputs, fetches user plan/history from Supabase, calls Claude,
// saves result to monthly_checkins and returns the structured feedback.
//
// ─── SQL — run once in Supabase SQL editor ────────────────────────────────────
//
// create table monthly_checkins (
//   id uuid default gen_random_uuid() primary key,
//   user_id uuid references auth.users(id) on delete cascade,
//   week_number int not null,
//   current_weight numeric(5,2),
//   feeling text,
//   energy text,
//   nutrition_compliance text,
//   injuries text,
//   ai_feedback text not null,
//   calorie_adjustment int,
//   created_at timestamptz not null default now()
// );
// alter table monthly_checkins enable row level security;
// create policy "checkins_all" on monthly_checkins
// for all to authenticated
// using (auth.uid() = user_id)
// with check (auth.uid() = user_id);
// grant all on monthly_checkins to authenticated;
//
// ──────────────────────────────────────────────────────────────────────────────
async function handleMonthlyCheckin(req, res) {
  const userId = await getUserIdFromToken(req.headers['authorization']);
  if (!userId) return json(res, 401, { error: 'Unauthorized' });

  const body = await readBody(req);
  let parsed;
  try { parsed = JSON.parse(body); } catch { return json(res, 400, { error: 'Invalid JSON' }); }

  const { weekNumber, currentWeight, feeling, energy, nutritionCompliance, injuries } = parsed;
  if (!weekNumber || !feeling || !energy || !nutritionCompliance) {
    return json(res, 400, { error: 'weekNumber, feeling, energy and nutritionCompliance are required' });
  }

  // Fetch intake data
  const { data: intakeRow } = await supabaseAdmin
    .from('intake_submissions')
    .select('data')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const intake = intakeRow?.data || {};

  // Fetch plan data
  const { data: planRow } = await supabaseAdmin
    .from('plans')
    .select('plan_data')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const plan = planRow?.plan_data || {};

  // Session completions over last 28 days
  const fourWeeksAgo = new Date(Date.now() - 28 * 86400000).toISOString();
  const { data: completions } = await supabaseAdmin
    .from('session_completions')
    .select('completed_at')
    .eq('user_id', userId)
    .gte('completed_at', fourWeeksAgo);

  const sessionsCompleted = completions?.length || 0;
  const targetPerWeek    = parseInt(intake.trainingDays || '4', 10);
  const targetTotal      = targetPerWeek * 4;
  const completionPct    = targetTotal > 0 ? Math.round((sessionsCompleted / targetTotal) * 100) : 0;

  // Weight logs over last 28 days for trend
  const { data: weightLogs } = await supabaseAdmin
    .from('weight_logs')
    .select('weight_kg, logged_at')
    .eq('user_id', userId)
    .gte('logged_at', fourWeeksAgo)
    .order('logged_at', { ascending: true });

  let weightTrendStr = 'insufficient data to calculate trend';
  if (weightLogs?.length >= 2) {
    const diff = weightLogs[weightLogs.length - 1].weight_kg - weightLogs[0].weight_kg;
    const sign = diff > 0 ? '+' : '';
    weightTrendStr = `${sign}${diff.toFixed(1)}kg over 4 weeks`;
  }

  const startingWeight  = intake.currentWeight || weightLogs?.[0]?.weight_kg || null;
  const targetWeight    = intake.targetWeight || null;
  const goal            = intake.goal || plan?.user_summary?.goal || 'muscle_building';
  const calorieTarget   = plan?.user_summary?.calorie_target
                       || plan?.nutrition?.training_day?.calories
                       || null;

  const systemPrompt = `${coachingBible}

You are a Plus 4 Performance coach delivering a monthly check-in review. Tone: direct, honest, specific, zero fluff. Speak to the client as a coach who cares about real results — not as a cheerleader.

Respond with ONLY a valid JSON object, no markdown, no code fences:
{
  "overall_assessment": "2-3 sentences assessing overall progress and adherence based on the data",
  "doing_well": "One specific thing they are doing well with a concrete reason why it matters",
  "focus_next_4_weeks": "One specific, actionable thing to focus on or adjust in the next 4 weeks",
  "calorie_adjustment": null or integer (e.g. 150 or -100),
  "calorie_adjustment_reason": null or string explaining the adjustment with reference to their weight trend,
  "closing_line": "One short, direct motivational line in the coaching bible tone — no generic phrases"
}

Calorie adjustment rules (apply strictly):
- Fat loss goal: ideal loss is 0.5–1.0 kg per 4 weeks. If losing >1.2 kg/4 wks → +100 to +150 kcal. If losing <0.2 kg/4 wks → -100 to -150 kcal. If losing >1.8 kg → +200 kcal.
- Muscle building goal: ideal gain is 0.5–1.0 kg per 4 weeks. If gaining <0.2 kg/4 wks → +100 to +200 kcal. If gaining >1.5 kg/4 wks → -100 to -150 kcal.
- Maintenance/recomposition: if trending significantly in either direction, adjust by 100 kcal.
- No data or stable weight within goal range: set calorie_adjustment to null.
Always reference the specific weight trend numbers in the reason.`;

  const userPrompt = `Monthly check-in — Week ${weekNumber} of 12

PLAN:
- Goal: ${goal}
- Starting weight: ${startingWeight != null ? startingWeight + ' kg' : 'unknown'}
- Current weight: ${currentWeight != null ? currentWeight + ' kg' : 'unknown'}
- Target weight: ${targetWeight != null ? targetWeight + ' kg' : 'unknown'}
- Current calorie target: ${calorieTarget != null ? calorieTarget + ' kcal/day' : 'unknown'}

LAST 4 WEEKS:
- Sessions completed: ${sessionsCompleted} of ${targetTotal} (${completionPct}% completion rate)
- Weight trend: ${weightTrendStr}

CLIENT SELF-REPORT:
- Overall feeling: ${feeling}
- Session energy: ${energy}
- Nutrition compliance: ${nutritionCompliance}
- Injuries / issues: ${injuries || 'None reported'}

Apply the calorie adjustment rules precisely. Reference real numbers. Be specific.`;

  let aiResponse;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const raw = message.content[0].text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    aiResponse = JSON.parse(raw);
  } catch (err) {
    console.error('[monthly-checkin] AI error:', err);
    return json(res, 500, { error: 'AI generation failed' });
  }

  const { data: saved, error: saveErr } = await supabaseAdmin
    .from('monthly_checkins')
    .insert({
      user_id:              userId,
      week_number:          weekNumber,
      current_weight:       currentWeight != null ? currentWeight : null,
      feeling,
      energy,
      nutrition_compliance: nutritionCompliance,
      injuries:             injuries || null,
      ai_feedback:          JSON.stringify(aiResponse),
      calorie_adjustment:   aiResponse.calorie_adjustment || null,
    })
    .select()
    .single();

  if (saveErr) {
    console.error('[monthly-checkin] save error:', saveErr);
    return json(res, 500, { error: 'Failed to save check-in' });
  }

  return json(res, 200, { feedback: aiResponse, checkinId: saved.id });
}

// ─── HTTP SERVER ──────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url.split('?')[0];

  try {
    if (req.method === 'POST' && url === '/snapshot') {
      return await handleSnapshot(req, res);
    }

    if (req.method === 'POST' && url === '/stripe-webhook') {
      return await handleStripeWebhook(req, res);
    }

    if (req.method === 'POST' && url === '/create-checkout-session') {
      return await handleCreateCheckout(req, res);
    }

    if (req.method === 'POST' && url === '/admin/activate-subscription') {
      return await handleAdminActivateSubscription(req, res);
    }

    if (req.method === 'POST' && url === '/admin/generate-plan') {
      return await handleAdminGeneratePlan(req, res);
    }

    if (req.method === 'POST' && url === '/create-portal-session') {
      return await handleCreatePortalSession(req, res);
    }

    if (req.method === 'DELETE' && url === '/delete-account') {
      return await handleDeleteAccount(req, res);
    }

    if (req.method === 'GET' && url === '/api/email-preferences') {
      return await handleGetEmailPreferences(req, res);
    }
    if (req.method === 'POST' && url === '/api/email-preferences') {
      return await handleSaveEmailPreferences(req, res);
    }

    if (req.method === 'POST' && url === '/api/monthly-checkin') {
      return await handleMonthlyCheckin(req, res);
    }

    json(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('Unhandled error:', err);
    json(res, 500, { error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log('Server running on port ' + PORT));

// ─── CRON JOBS ────────────────────────────────────────────────────────────────
// Weekly progress summary — every Sunday at 8:00 AM UTC
cron.schedule('0 8 * * 0', runWeeklyProgressEmails, { timezone: 'UTC' });
// Session reminder — every day at 7:00 AM UTC
cron.schedule('0 7 * * *', runSessionReminderEmails, { timezone: 'UTC' });
// Weigh-in reminder — every day at 8:00 AM UTC
cron.schedule('0 8 * * *', runWeighInReminderEmails, { timezone: 'UTC' });
console.log('Cron jobs scheduled');
