const http = require('http');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const anthropic = new Anthropic();
const coachingBible = fs.readFileSync(path.join(__dirname, 'coaching_bible.txt'), 'utf8');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── PROMPT TEMPLATES ────────────────────────────────────────────────────────

const FULL_PLAN_SCHEMA = `{
  "user_summary": {
    "name": string,
    "goal": string,
    "split": string,
    "start_date": string,
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
  "how_to_use": string,
  "weeks": [
    {
      "week": number,
      "phase": string,
      "training_calorie_target": number,
      "rest_calorie_target": number,
      "sessions": [
        {
          "day": number,
          "name": string,
          "exercises": [
            {
              "name": string,
              "sets": number,
              "reps": string,
              "rest": string,
              "cues": string,
              "common_mistakes": string,
              "progression": string,
              "injury_modifications": string
            }
          ]
        }
      ]
    }
  ],
  "nutrition": {
    "training_day": { "calories": number, "protein": number, "carbs": number, "fat": number },
    "rest_day": { "calories": number, "protein": number, "carbs": number, "fat": number },
    "weekly_progression": [{ "week": number, "training_calories": number, "rest_calories": number }]
  },
  "meal_plan": {
    "days": [
      {
        "day": string,
        "type": "training" | "rest",
        "meals": [
          {
            "name": string,
            "foods": [{ "name": string, "amount": string, "cal": number, "p": number, "c": number, "f": number }],
            "totals": { "cal": number, "p": number, "c": number, "f": number }
          }
        ]
      }
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
  return `You are generating a fully individualised 12-week training and nutrition plan. Every field must be populated with specific, client-accurate content drawn directly from the coaching bible and the client data below. Generic output is a failure. This is a paid product.

STEP 1 — READ THE CLIENT DATA CAREFULLY.
Extract and use: name, age, sex, height (cm), current weight (kg), goal, experience level, training days per week, preferred split, session length, equipment, injuries, dietary preferences. Every one of these must influence the output.

STEP 2 — CALCULATE NUTRITION USING MIFFLIN ST JEOR.
Male: BMR = (10 × weight) + (6.25 × height) - (5 × age) + 5
Female: BMR = (10 × weight) + (6.25 × height) - (5 × age) - 161
Multiply BMR by the client's activity multiplier to get TDEE. Apply the goal adjustment from Section 7 to get calorie_target. Set macros using the split from Section 7. Store BMR and TDEE in user_summary.

STEP 3 — BUILD 12 WEEKS OF TRAINING.
Generate all 12 weeks in the weeks array. Each week contains the full session list for that week with progressive overload applied — increasing sets, reps, or load vs the previous week. Do not write "repeat week 1". Every session must be fully written out.
- Select exercises from the exercise library in the coaching bible. Tier 1 as foundation, Tier 2 for variety.
- For PPL splits: generate Push A and Push B as separate sessions with different exercise selections. Same for Pull A and Pull B.
- Apply all injury contraindications from Section 9 for any injuries the client has stated.
- cues: one sentence on how to execute the movement correctly.
- common_mistakes: one sentence on what to avoid.
- progression: specific load/rep targets for weeks 1-4, 5-8, and 9-12 with actual numbers. Never write vague phrases like "add weight when comfortable".
- injury_modifications: specific alternative if injury applies, else empty string.

STEP 4 — BUILD THE MEAL PLAN.
- Every food must be a named food with a gram amount — e.g. "Chicken breast 180g", "White rice 200g cooked". Never write "lean protein" or "complex carbs".
- Label meals M1–M6. M4 must be "M4 — POST WORKOUT". No times on other meals.
- The grocery_list must reflect exactly the foods in the meal plan.
- Maximum 5 supplements. One line each: name, dose, timing.

STEP 5 — WRITE THE PERSONAL NOTE.
Minimum 150 words. Written directly to the client. Must include:
- The full Mifflin St Jeor calculation with their actual numbers — e.g. "BMR = (10 × 82) + (6.25 × 178) − (5 × 31) + 5 = 1,892 kcal. TDEE = 1,892 × 1.55 = 2,932 kcal."
- Their specific goal, current weight, target weight and what the calorie target is designed to achieve.
- Why the specific split suits their training days, experience and goal.
- How any stated injuries have been accounted for.
- One direct, motivating closing sentence — not a cliché.
Write as 3-4 short paragraphs separated by \\n\\n.

STANDARDS:
- All fields fully populated. No placeholders.
- All dates as DD Month YYYY — never ISO format.
- key_lifts: exactly 3 compound exercise names to track as strength benchmarks.
- Respond with ONLY the JSON object. No markdown, no code fences, no commentary.

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
  const { data, error } = await supabase.auth.getUser(token);
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
  const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId);
  if (authUser) {
    await supabase.from('profiles').upsert({
      id: userId,
      email: authUser.email,
      first_name: authUser.user_metadata?.first_name || '',
      last_name: authUser.user_metadata?.last_name || '',
    }, { onConflict: 'id', ignoreDuplicates: true });
  }

  // Save intake submission
  const { error: intakeErr } = await supabase.from('intake_submissions').insert({ user_id: userId, data: intakeData });
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
  const { error: insertErr } = await supabase.from('snapshots').insert({
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
  try {
    const message = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 32000,
      system: buildFullPlanSystemPrompt(),
      messages: [{ role: 'user', content: buildFullPlanUserPrompt(intakeData) }]
    }).finalMessage();

    const raw = message.content[0].text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    planData = JSON.parse(raw);
  } catch (err) {
    console.error('Plan generation error:', err);
    throw err;
  }

  const { error } = await supabase.from('plans').insert({
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
        const userId = session.metadata.user_id;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (!userId) { console.error('No user_id in session metadata'); return; }

        // Upsert subscription record
        await supabase.from('subscriptions').upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: process.env.STRIPE_PRICE_ID,
          status: 'active',
        }, { onConflict: 'stripe_subscription_id' });

        // Fetch the user's intake data to generate plan
        const { data: intakeRows } = await supabase
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
        await supabase.from('subscriptions')
          .update({
            status: sub.status,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);

      } else if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object;
        await supabase.from('subscriptions')
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
      success_url: `${origin}/dashboard?payment=success`,
      cancel_url: `${origin}/dashboard?payment=cancelled`,
      metadata: { user_id: userId },
    });

    return json(res, 200, { url: session.url });
  } catch (err) {
    console.error('Checkout session error:', err);
    return json(res, 500, { error: 'Failed to create checkout session' });
  }
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

    json(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('Unhandled error:', err);
    json(res, 500, { error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log('Server running on port ' + PORT));
