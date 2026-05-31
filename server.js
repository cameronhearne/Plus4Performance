const http = require('http');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
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

    json(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('Unhandled error:', err);
    json(res, 500, { error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log('Server running on port ' + PORT));
