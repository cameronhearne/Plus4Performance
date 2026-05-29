const http = require('http');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic();

const coachingBible = fs.readFileSync(path.join(__dirname, 'coaching_bible.txt'), 'utf8');
const logoPath = path.join(__dirname, 'logo_small.png');

const DARK = '#0d0d0d';
const WHITE = '#F5F3EE';
const SILVER = '#C8C8C8';
const ACCENT = '#787878';

function newPage(doc) {
  doc.addPage();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(DARK);
}

function footer(doc, name) {
  doc.save();
  doc.fontSize(8).fillColor(SILVER)
    .text('PLUS 4 PERFORMANCE  ·  ' + name.toUpperCase() + '  ·  12 WEEK PLAN',
      40, doc.page.height - 30, { align: 'center', width: doc.page.width - 80 });
  doc.restore();
}

function divider(doc) {
  doc.moveTo(40, doc.y + 8).lineTo(doc.page.width - 40, doc.y + 8)
    .strokeColor(ACCENT).lineWidth(0.5).stroke();
  doc.y += 24;
}

function safeText(doc, text, x, y, opts) {
  const fontSize = opts.fontSize || 10;
  const font = opts.font || 'Helvetica';
  const color = opts.color || WHITE;
  const lineGap = opts.lineGap || 4;
  const width = opts.width || (doc.page.width - x - 40);
  const footerName = opts.footerName || '';

  doc.fontSize(fontSize).font(font);
  const lineHeight = fontSize + lineGap;

  const paragraphs = String(text || '').split('\n');
  paragraphs.forEach(para => {
    const h = para.length
      ? doc.heightOfString(para, { width, lineGap })
      : lineHeight * 0.5;

    if (y + h > 750) {
      if (footerName) footer(doc, footerName);
      newPage(doc);
      y = 60;
    }

    doc.fontSize(fontSize).fillColor(color).font(font)
      .text(para.length ? para : ' ', x, y, { width, lineGap });
    y = doc.y + 4;
  });

  return y;
}

function makeCoverPage(doc, client, clientName, title, W, H) {
  newPage(doc);
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 40, 40, { width: 60 });
  }
  const coverNameY = H / 2 - 80;
  doc.fontSize(64).fillColor(WHITE).font('Helvetica-Bold')
    .text((client.name || clientName).toUpperCase(), 40, coverNameY, { width: W - 80, align: 'center' });
  const dividerY = doc.y + 16;
  doc.moveTo(40, dividerY).lineTo(W - 40, dividerY).strokeColor(SILVER).lineWidth(0.5).stroke();
  doc.fontSize(28).fillColor(SILVER).font('Helvetica-Bold')
    .text(title, 40, dividerY + 20, { width: W - 80, align: 'center' });
  doc.fontSize(12).fillColor(ACCENT).font('Helvetica')
    .text((client.plan_start || '') + '  —  ' + (client.plan_end || ''), 40, doc.y + 12, { width: W - 80, align: 'center' });
  doc.fontSize(9).fillColor(SILVER).font('Helvetica')
    .text('plus4performance.com', 40, H - 40, { width: W - 80, align: 'center' });
}

function generatePlanPDF(planData, clientName) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: false });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const client = planData.client || {};
    const W = 595;
    const H = 842;

    // ── COVER PAGE ────────────────────────────────────────────────────────
    const planTitle = '12 WEEK ' + (client.goal || 'TRAINING PLAN').toUpperCase();
    makeCoverPage(doc, client, clientName, planTitle, W, H);

    // ── PERSONAL SUMMARY ──────────────────────────────────────────────────
    newPage(doc);

    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, 40, { width: 44 });
    }
    doc.fontSize(9).fillColor(SILVER).font('Helvetica')
      .text(new Date().toLocaleDateString('en-GB'), 40, 44, { align: 'right', width: W - 80 });

    doc.fontSize(52).fillColor(WHITE).font('Helvetica-Bold')
      .text((client.name || 'YOUR').toUpperCase() + "'S", 40, 110);
    doc.fontSize(32).fillColor(SILVER).font('Helvetica-Bold')
      .text('12 WEEK ' + (client.goal || 'PLAN').toUpperCase(), 40, doc.y + 4);

    doc.moveTo(40, doc.y + 16).lineTo(W - 40, doc.y + 16)
      .strokeColor(ACCENT).lineWidth(0.5).stroke();

    const sY = doc.y + 32;
    doc.fontSize(9).fillColor(SILVER).font('Helvetica-Bold')
      .text('YOUR STATS', 40, sY)
      .text('YOUR TARGETS', W / 2, sY);

    const leftStats = [
      ['Age', (client.age || '') + ' years'],
      ['Height', (client.height || '') + 'cm'],
      ['Current weight', (client.current_weight || '') + 'kg'],
      ['Target weight', (client.target_weight || '') + 'kg'],
      ['Experience', client.experience || ''],
      ['Start date', client.plan_start || ''],
      ['End date', client.plan_end || ''],
    ];
    const rightStats = [
      ['Daily calories', (client.tdee || '') + ' kcal'],
      ['Protein', (planData.nutrition && planData.nutrition.protein ? planData.nutrition.protein + 'g' : '')],
      ['Carbs', (planData.nutrition && planData.nutrition.carbs ? planData.nutrition.carbs + 'g' : '')],
      ['Fats', (planData.nutrition && planData.nutrition.fats ? planData.nutrition.fats + 'g' : '')],
      ['Training days', (client.training_days || '') + ' per week'],
      ['Split', client.split || ''],
    ];

    let ry = sY + 18;
    leftStats.forEach(([l, v]) => {
      doc.fontSize(9).fillColor(ACCENT).font('Helvetica').text(l + ':', 40, ry);
      doc.fillColor(WHITE).text(v, 170, ry);
      ry += 16;
    });
    ry = sY + 18;
    rightStats.forEach(([l, v]) => {
      doc.fontSize(9).fillColor(ACCENT).font('Helvetica').text(l + ':', W / 2, ry);
      doc.fillColor(WHITE).text(String(v), W / 2 + 120, ry);
      ry += 16;
    });

    let sy = ry + 20;
    if (planData.supplements && planData.supplements.length) {
      doc.fontSize(9).fillColor(SILVER).font('Helvetica-Bold').text('SUPPLEMENTS', 40, sy);
      sy += 16;
      planData.supplements.forEach(s => {
        sy = safeText(doc, '· ' + s, 40, sy, { fontSize: 9, font: 'Helvetica', color: WHITE, lineGap: 3, footerName: client.name || clientName });
      });
      sy += 8;
    }

    if (sy > 380) {
      footer(doc, client.name || clientName);
      newPage(doc);
      sy = 80;
    }
    doc.moveTo(40, sy).lineTo(W - 40, sy).strokeColor(ACCENT).lineWidth(0.5).stroke();
    sy += 16;

    const bmr = client.bmr || '';
    const tdee = client.tdee || '';
    const dailyCals = (planData.nutrition && planData.nutrition.daily_calories) || '';
    doc.fontSize(9).fillColor(SILVER).font('Helvetica')
      .text('BMR: ' + bmr + ' kcal', 40, sy);
    sy += 14;
    doc.text('TDEE: ' + tdee + ' kcal', 40, sy);
    sy += 14;
    doc.text('Daily calorie target: ' + dailyCals + ' kcal', 40, sy);
    sy += 20;

    if (planData.personal_note) {
      safeText(doc, planData.personal_note, 40, sy, { fontSize: 10, font: 'Helvetica', color: WHITE, lineGap: 4, footerName: client.name || clientName });
    }

    footer(doc, client.name || clientName);

    // ── HOW TO USE ────────────────────────────────────────────────────────
    if (planData.how_to_use) {
      newPage(doc);
      doc.fontSize(28).fillColor(WHITE).font('Helvetica-Bold').text('HOW TO USE THIS PLAN', 40, 60);
      doc.moveTo(40, 96).lineTo(W - 40, 96).strokeColor(ACCENT).lineWidth(0.5).stroke();
      safeText(doc, planData.how_to_use, 40, 116, { fontSize: 10, font: 'Helvetica', color: WHITE, lineGap: 4, footerName: client.name || clientName });
      footer(doc, client.name || clientName);
    }

    // ── TRAINING SESSION TABLES ───────────────────────────────────────────
    if (planData.sessions && planData.sessions.length) {
      planData.sessions.forEach(session => {
        newPage(doc);
        doc.fontSize(9).fillColor(SILVER).font('Helvetica-Bold').text('TRAINING', 40, 50);
        doc.fontSize(22).fillColor(WHITE).font('Helvetica-Bold').text((session.name || '').toUpperCase(), 40, 58);
        doc.moveTo(40, 92).lineTo(W - 40, 92).strokeColor(ACCENT).lineWidth(0.5).stroke();

        const cols = { ex: 40, sets: 295, reps: 355, rest: 430 };
        let ty = 110;
        doc.fontSize(8).fillColor(SILVER).font('Helvetica-Bold');
        doc.text('EXERCISE', cols.ex, ty);
        doc.text('SETS', cols.sets, ty);
        doc.text('REPS', cols.reps, ty);
        doc.text('REST', cols.rest, ty);
        ty += 16;
        doc.moveTo(40, ty).lineTo(W - 40, ty).strokeColor(ACCENT).lineWidth(0.3).stroke();
        ty += 8;

        (session.exercises || []).forEach((ex, i) => {
          const nameHeight = doc.fontSize(9).font('Helvetica').heightOfString(ex.name || '', { width: 248 });
          const rowH = Math.max(22, nameHeight + 8);
          const rowBg = i % 2 === 0 ? '#141414' : '#0d0d0d';
          doc.rect(40, ty - 3, W - 80, rowH).fill(rowBg);
          doc.fontSize(9).fillColor(WHITE).font('Helvetica');
          doc.text(ex.name || '', cols.ex, ty, { width: 248, lineGap: 2 });
          doc.text(String(ex.sets || ''), cols.sets, ty, { width: 54, lineBreak: false });
          doc.text(String(ex.reps || ''), cols.reps, ty, { width: 68, lineBreak: false });
          doc.text(String(ex.rest || ''), cols.rest, ty, { width: 115, lineBreak: false });
          ty += rowH;
        });

        footer(doc, client.name || clientName);
      });
    }

    // ── NUTRITION ─────────────────────────────────────────────────────────
    if (planData.nutrition) {
      newPage(doc);
      const nut = planData.nutrition;
      doc.fontSize(9).fillColor(SILVER).font('Helvetica-Bold').text('NUTRITION', 40, 50);
      doc.fontSize(28).fillColor(WHITE).font('Helvetica-Bold').text('YOUR NUTRITION PLAN', 40, 64);
      doc.moveTo(40, 100).lineTo(W - 40, 100).strokeColor(ACCENT).lineWidth(0.5).stroke();

      let ny = 120;
      [
        ['Daily calories', nut.daily_calories + ' kcal'],
        ['Protein', nut.protein + 'g'],
        ['Carbohydrates', nut.carbs + 'g'],
        ['Fats', nut.fats + 'g'],
        ['Training day calories', nut.training_day_calories + ' kcal'],
        ['Rest day calories', nut.rest_day_calories + ' kcal'],
      ].forEach(([l, v]) => {
        doc.fontSize(9).fillColor(ACCENT).font('Helvetica').text(l + ':', 40, ny);
        doc.fillColor(WHITE).text(String(v), 220, ny);
        ny += 18;
      });

      if (nut.meal_plan && nut.meal_plan.length) {
        ny += 12;
        doc.moveTo(40, ny).lineTo(W - 40, ny).strokeColor(ACCENT).lineWidth(0.5).stroke();
        ny += 16;
        doc.fontSize(11).fillColor(SILVER).font('Helvetica-Bold').text('MEAL PLAN', 40, ny);
        ny += 20;
        nut.meal_plan.forEach(meal => {
          ny = safeText(doc, (meal.meal || '').toUpperCase(), 40, ny, { fontSize: 10, font: 'Helvetica-Bold', color: WHITE, lineGap: 4, footerName: client.name || clientName });
          (meal.foods || []).forEach(food => {
            ny = safeText(doc, '· ' + food, 55, ny, { fontSize: 9, font: 'Helvetica', color: ACCENT, lineGap: 3, footerName: client.name || clientName });
          });
          ny += 8;
        });
      }

      footer(doc, client.name || clientName);
    }

    // ── GROCERY LIST ──────────────────────────────────────────────────────
    if (planData.grocery_list) {
      const gl = planData.grocery_list;
      const glCategories = [
        ['PROTEINS', gl.proteins],
        ['CARBOHYDRATES', gl.carbs],
        ['FRUITS & VEGETABLES', gl.fruits_veg],
        ['FATS', gl.fats],
        ['SUPPLEMENTS', gl.supplements],
      ].filter(([, items]) => items && items.length);

      if (glCategories.length) {
        newPage(doc);
        doc.fontSize(9).fillColor(SILVER).font('Helvetica-Bold').text('NUTRITION', 40, 50);
        doc.fontSize(28).fillColor(WHITE).font('Helvetica-Bold').text('GROCERY LIST', 40, 64);
        doc.moveTo(40, 100).lineTo(W - 40, 100).strokeColor(ACCENT).lineWidth(0.5).stroke();

        let gy = 120;
        glCategories.forEach(([cat, items]) => {
          doc.fontSize(10).fillColor(SILVER).font('Helvetica-Bold').text(cat, 40, gy);
          gy += 18;
          items.forEach(item => {
            gy = safeText(doc, '· ' + item, 55, gy, { fontSize: 9, font: 'Helvetica', color: WHITE, lineGap: 3, footerName: client.name || clientName });
          });
          gy += 10;
        });

        footer(doc, client.name || clientName);
      }
    }

    // ── WHAT HAPPENS NEXT ─────────────────────────────────────────────────
    if (planData.what_happens_next) {
      newPage(doc);
      doc.fontSize(28).fillColor(WHITE).font('Helvetica-Bold').text('WHAT HAPPENS NEXT', 40, 60);
      doc.moveTo(40, 96).lineTo(W - 40, 96).strokeColor(ACCENT).lineWidth(0.5).stroke();
      const finalTextEnd = safeText(doc, planData.what_happens_next, 40, 116, { fontSize: 11, font: 'Helvetica', color: WHITE, lineGap: 6, footerName: client.name || clientName });

      const logoY = finalTextEnd + 40;
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 40, logoY, { width: 36 });
      }
      doc.fontSize(9).fillColor(SILVER).text('PLUS 4 PERFORMANCE', 86, logoY + 8);

      footer(doc, client.name || clientName);
    }
    doc.end();
  });
}

function generateCoachingPDF(planData, clientName) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: false });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const client = planData.client || {};
    const W = 595;
    const H = 842;

    // ── COVER PAGE ────────────────────────────────────────────────────────
    makeCoverPage(doc, client, clientName, 'COACHING GUIDE', W, H);

    // ── COACHING NOTES BY SESSION ─────────────────────────────────────────
    if (planData.sessions && planData.sessions.length) {
      planData.sessions.forEach(session => {
        newPage(doc);
        doc.fontSize(9).fillColor(SILVER).font('Helvetica-Bold').text('COACHING GUIDE', 40, 50);
        doc.fontSize(18).fillColor(WHITE).font('Helvetica-Bold')
          .text('COACHING NOTES — ' + (session.name || '').toUpperCase(), 40, 64);
        doc.moveTo(40, 90).lineTo(W - 40, 90).strokeColor(ACCENT).lineWidth(0.5).stroke();

        let ny = 130;
        (session.exercises || []).forEach(ex => {
          if (ny > 750) {
            footer(doc, client.name || clientName);
            newPage(doc);
            doc.fontSize(9).fillColor(SILVER).font('Helvetica-Bold').text('COACHING GUIDE', 40, 50);
            doc.fontSize(18).fillColor(WHITE).font('Helvetica-Bold')
              .text('COACHING NOTES — ' + (session.name || '').toUpperCase(), 40, 64);
            doc.moveTo(40, 90).lineTo(W - 40, 90).strokeColor(ACCENT).lineWidth(0.5).stroke();
            ny = 130;
          }

          doc.fontSize(11).fillColor(SILVER).font('Helvetica-Bold').text((ex.name || '').toUpperCase(), 40, ny);
          ny += 20;

          doc.fontSize(8).fillColor(SILVER).font('Helvetica-Bold').text('PROGRESSION', 40, ny);
          ny += 14;
          ny = safeText(doc, ex.progression || '', 40, ny, { fontSize: 9, font: 'Helvetica', color: WHITE, lineGap: 3, footerName: client.name || clientName });
          ny += 6;

          doc.fontSize(8).fillColor(SILVER).font('Helvetica-Bold').text('CUES', 40, ny);
          ny += 14;
          ny = safeText(doc, ex.notes || '', 40, ny, { fontSize: 9, font: 'Helvetica', color: WHITE, lineGap: 3, footerName: client.name || clientName });
          ny += 22;
        });

        footer(doc, client.name || clientName);
      });
    }

    doc.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.writeHead(204);
  res.end();
  return;
}

  if (req.method === 'GET' && req.url.startsWith('/verify-session')) {
    const sessionId = new URL(req.url, 'http://localhost').searchParams.get('session_id');
    if (!sessionId) { res.writeHead(200); res.end(JSON.stringify({ valid: false })); return; }
    try {
      const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` }
      });
      const session = await stripeRes.json();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ valid: session.payment_status === 'paid' }));
    } catch (err) {
      res.writeHead(200); res.end(JSON.stringify({ valid: false }));
    }
    return;
  }

  if (req.method !== 'POST' || req.url !== '/generate-plan') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Plan generation started' }));

    try {
      const intakeData = JSON.parse(body);

      const systemPrompt = coachingBible + '\n\nCRITICAL INSTRUCTION: You must respond with ONLY a valid JSON object. No text before or after the JSON. No markdown. No code blocks. The JSON must exactly follow this structure:\n{\n  "client": {\n    "name": string,\n    "goal": string,\n    "age": number,\n    "height": number,\n    "current_weight": number,\n    "target_weight": number,\n    "bmr": number,\n    "tdee": number,\n    "plan_start": string,\n    "plan_end": string,\n    "experience": string,\n    "training_days": number,\n    "split": string\n  },\n  "personal_note": string,\n  "how_to_use": string,\n  "sessions": [{"name": string, "exercises": [{"name": string, "sets": string, "reps": string, "rest": string, "notes": string, "progression": string}]}],\n  "nutrition": {"daily_calories": number, "protein": number, "carbs": number, "fats": number, "training_day_calories": number, "rest_day_calories": number, "meal_plan": [{"meal": string, "foods": [string]}]},\n  "grocery_list": {"proteins": [string], "carbs": [string], "fruits_veg": [string], "fats": [string], "supplements": [string]},\n  "supplements": [string],\n  "key_lifts": [string, string, string],\n  "what_happens_next": string\n}';

      const message = await anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 32000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `You are generating a fully individualised training and nutrition plan. Every field must be populated with specific, client-accurate content drawn directly from the coaching bible and the client data below. Generic output is a failure. This is a paid product.

STEP 1 — READ THE CLIENT DATA CAREFULLY.
Extract and use: name, age, sex, height (cm), current weight (kg), goal, experience level, training days per week, preferred split, session length, equipment, injuries, dietary preferences. Every one of these must influence the output.

STEP 2 — CALCULATE NUTRITION USING MIFFLIN ST JEOR.
Male: BMR = (10 × weight) + (6.25 × height) - (5 × age) + 5
Female: BMR = (10 × weight) + (6.25 × height) - (5 × age) - 161
Multiply BMR by the client's activity multiplier to get TDEE. Apply the goal adjustment from Section 7 to get daily_calories. Set macros using the split from Section 7. Set training_day_calories and rest_day_calories per Section 7. Store BMR and TDEE in the client object.

STEP 3 — BUILD THE TRAINING SESSIONS.
Generate ONE complete week of training — every session written out in full. The client repeats this week with progressive overload. Do not generate 12 separate weeks of sessions. Do not summarise. Do not use "repeat week 1".
- The sessions array must contain one entry per session in the week — for example a 4-day Upper/Lower split produces 4 session entries: Upper A, Lower A, Upper B, Lower B.
- Select exercises from the exercise library in the coaching bible. Tier 1 as foundation, Tier 2 for variety.
- For PPL splits: generate Push A and Push B as separate sessions with different exercise selections. Same for Pull A and Pull B.
- Apply all injury contraindications from Section 9 for any injuries the client has stated.
- The notes field on every exercise must contain exactly three things, in this order: (1) The primary coaching cue — one sentence on how to execute the movement correctly. (2) The most common mistake — one sentence on what to avoid. (3) The progression instruction — specific sets, reps and load targets for weeks 1-4, weeks 5-8 and weeks 9-12 with actual numbers, e.g. "Weeks 1-4: 3×10 at 60kg. Weeks 5-8: 4×8 at 65kg. Weeks 9-12: 4×6 at 70kg." Never write vague phrases like "add weight when comfortable".

STEP 4 — BUILD THE MEAL PLAN.
- Every food entry must be a named food with a gram amount taken from the food library in Section 8 — for example "Chicken breast 180g" or "White rice 200g cooked". Never write "lean protein", "complex carbs", or any other generic description.
- Label meals M1, M2, M3, M4, M5, M6. M4 must be labelled "M4 — POST WORKOUT". No times on any other meal.
- Apply dietary preference adjustments from Section 7.
- The grocery list must reflect exactly the foods in the meal plan. In the supplements section give a specific weekly quantity per item — e.g. "Creatine monohydrate 35g (5g × 7 days)". Never write "check your supply".
- Maximum 5 supplements. One line each: name, dose, timing. No explanations.

STEP 5 — WRITE THE PERSONAL NOTE.
Minimum 150 words. Written directly to the client. Must include:
- The full Mifflin St Jeor calculation with their actual numbers shown — e.g. "BMR = (10 × 82) + (6.25 × 178) − (5 × 31) + 5 = 1,892 kcal. TDEE = 1,892 × 1.55 = 2,932 kcal."
- Their specific goal, current weight, target weight and what the calorie target is designed to achieve
- Why the specific split suits their training days, experience level and goal
- How any stated injuries have been accounted for in the plan
- One direct, motivating closing sentence — not a cliché
Write the personal_note as 3-4 short paragraphs separated by line breaks (\\n\\n). Do not write it as one continuous block of text.

KEY LIFTS:
- Exactly 3 exercise names — the primary compound lifts to track as weekly strength benchmarks.

STANDARDS:
- All fields fully populated. No placeholders. No references to the coaching bible in output text.
- All dates formatted as DD Month YYYY. Never use hyphens or ISO format.
- Respond with ONLY the JSON object. No markdown, no code fences, no commentary.

Client data:
${JSON.stringify(intakeData, null, 2)}` }]
      }).finalMessage();

      const rawText = message.content[0].text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      console.log('Raw response length:', rawText.length);

      let planData;
      try {
        planData = JSON.parse(rawText);
      } catch (e) {
        console.error('JSON parse failed:', e.message);
        console.error('Raw text sample:', rawText.substring(0, 500));
        return;
      }

      console.log('Plan parsed for:', planData.client && planData.client.name);

      const clientName = (planData.client && planData.client.name) || intakeData.name || 'Client';
      const [planBuffer, coachingBuffer] = await Promise.all([
        generatePlanPDF(planData, clientName),
        generateCoachingPDF(planData, clientName),
      ]);
      console.log('Plan PDF size:', planBuffer.length, '— Coaching PDF size:', coachingBuffer.length);

      const safeName = clientName.replace(/\s+/g, '');

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + process.env.RESEND_API_KEY
        },
        body: JSON.stringify({
          from: 'Plus 4 Performance <hello@plus4performance.com>',
          to: intakeData.email,
          subject: 'Your Plus 4 Performance Plan is Ready, ' + clientName,
          html: '<div style="background:#0d0d0d;color:#F5F3EE;padding:40px;font-family:sans-serif;max-width:600px;margin:0 auto;">' +
            '<h1 style="font-size:28px;margin-bottom:8px;">Your plan is ready, ' + clientName + '.</h1>' +
            '<p style="color:#C8C8C8;margin-bottom:24px;">Your plan and coaching guide are both attached below. Here\'s what\'s inside:</p>' +
            '<ul style="color:#C8C8C8;line-height:2;">' +
            '<li>Your personal summary and targets</li>' +
            '<li>Full training programme with exercises, sets and reps</li>' +
            '<li>Nutrition plan with daily macro targets</li>' +
            '<li>7 day meal plan and grocery list</li>' +
            '<li>Supplement recommendations</li>' +
            '<li>Coaching guide with progression and cues for every exercise</li>' +
            '</ul>' +
            '<p style="color:#C8C8C8;margin-top:24px;">Start on week 1 by finding your working weights. Do not chase heavy weight in week 1 — get the movements right first.</p>' +
            '<p style="margin-top:32px;color:#787878;font-size:12px;">Plus 4 Performance · hello@plus4performance.com</p>' +
            '</div>',
          attachments: [
            {
              filename: 'Plus4Performance_' + safeName + 'Plan.pdf',
              content: planBuffer.toString('base64')
            },
            {
              filename: 'Plus4Performance_' + safeName + '_CoachingGuide.pdf',
              content: coachingBuffer.toString('base64')
            }
          ]
        })
      });

      const emailData = await emailResponse.json();
      console.log('Email status:', emailResponse.status);
      console.log('Email response:', JSON.stringify(emailData));

    } catch (err) {
      console.error('Error:', err.message);
      console.error('Stack:', err.stack);
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log('Server running on port ' + PORT));
