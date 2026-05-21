const http = require('http');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

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

function generatePDF(planData, clientName) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: false });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const client = planData.client || {};
    const W = 595;
    const H = 842;

    // ── PAGE 1: Personal Summary ──────────────────────────────────────────
    newPage(doc);

    // Logo
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, 40, { width: 44 });
    }
    // Date
    doc.fontSize(9).fillColor(SILVER).font('Helvetica')
      .text(new Date().toLocaleDateString('en-GB'), 40, 44, { align: 'right', width: W - 80 });

    // Title
    doc.fontSize(52).fillColor(WHITE).font('Helvetica-Bold')
      .text((client.name || 'YOUR').toUpperCase() + "'S", 40, 110);
    doc.fontSize(32).fillColor(SILVER).font('Helvetica-Bold')
      .text('12 WEEK ' + (client.goal || 'PLAN').toUpperCase(), 40, doc.y + 4);

    // Divider
    doc.moveTo(40, doc.y + 16).lineTo(W - 40, doc.y + 16)
      .strokeColor(ACCENT).lineWidth(0.5).stroke();

    // Stats columns
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

    // Supplements
    let sy = ry + 20;
    if (planData.supplements && planData.supplements.length) {
      doc.fontSize(9).fillColor(SILVER).font('Helvetica-Bold').text('SUPPLEMENTS', 40, sy);
      sy += 16;
      planData.supplements.forEach(s => {
        doc.fontSize(9).fillColor(WHITE).font('Helvetica').text('· ' + s, 40, sy);
        sy += 14;
      });
      sy += 8;
    }

    // Personal note
    if (planData.personal_note) {
      doc.moveTo(40, sy).lineTo(W - 40, sy).strokeColor(ACCENT).lineWidth(0.5).stroke();
      sy += 16;
      doc.fontSize(10).fillColor(WHITE).font('Helvetica-Oblique')
        .text(planData.personal_note, 40, sy, { width: W - 80 });
    }

    footer(doc, client.name || clientName);

    // ── PAGE 2: How to use ────────────────────────────────────────────────
    newPage(doc);
    doc.fontSize(28).fillColor(WHITE).font('Helvetica-Bold').text('HOW TO USE THIS PLAN', 40, 60);
    doc.moveTo(40, 96).lineTo(W - 40, 96).strokeColor(ACCENT).lineWidth(0.5).stroke();
    doc.fontSize(10).fillColor(WHITE).font('Helvetica')
      .text(planData.how_to_use || '', 40, 116, { width: W - 80, lineGap: 4 });
    footer(doc, client.name || clientName);

    // ── TRAINING PAGES ────────────────────────────────────────────────────
    if (planData.sessions && planData.sessions.length) {
      planData.sessions.forEach(session => {
        newPage(doc);
        doc.fontSize(9).fillColor(SILVER).font('Helvetica-Bold').text('TRAINING', 40, 50);
        doc.fontSize(28).fillColor(WHITE).font('Helvetica-Bold').text((session.name || '').toUpperCase(), 40, 64);
        doc.moveTo(40, 100).lineTo(W - 40, 100).strokeColor(ACCENT).lineWidth(0.5).stroke();

        // Table header
        const cols = { ex: 40, sets: 250, reps: 300, rest: 360, notes: 415 };
        let ty = 118;
        doc.fontSize(8).fillColor(SILVER).font('Helvetica-Bold');
        doc.text('EXERCISE', cols.ex, ty);
        doc.text('SETS', cols.sets, ty);
        doc.text('REPS', cols.reps, ty);
        doc.text('REST', cols.rest, ty);
        doc.text('NOTES', cols.notes, ty);
        ty += 16;
        doc.moveTo(40, ty).lineTo(W - 40, ty).strokeColor(ACCENT).lineWidth(0.3).stroke();
        ty += 8;

        (session.exercises || []).forEach((ex, i) => {
          const rowBg = i % 2 === 0 ? '#141414' : '#0d0d0d';
          doc.rect(40, ty - 3, W - 80, 22).fill(rowBg);
          doc.fontSize(9).fillColor(WHITE).font('Helvetica');
          doc.text(ex.name || '', cols.ex, ty, { width: 200 });
          doc.text(String(ex.sets || ''), cols.sets, ty);
          doc.text(String(ex.reps || ''), cols.reps, ty);
          doc.text(String(ex.rest || ''), cols.rest, ty);
          doc.text(String(ex.notes || ''), cols.notes, ty, { width: 140 });
          ty += 22;
        });

        footer(doc, client.name || clientName);
      });
    }

    // ── NUTRITION PAGE ────────────────────────────────────────────────────
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
          doc.fontSize(10).fillColor(WHITE).font('Helvetica-Bold').text((meal.meal || '').toUpperCase(), 40, ny);
          ny += 16;
          (meal.foods || []).forEach(food => {
            doc.fontSize(9).fillColor(ACCENT).font('Helvetica').text('· ' + food, 55, ny);
            ny += 14;
          });
          ny += 8;
        });
      }

      footer(doc, client.name || clientName);
    }

    // ── GROCERY LIST ──────────────────────────────────────────────────────
    if (planData.grocery_list) {
      newPage(doc);
      const gl = planData.grocery_list;
      doc.fontSize(9).fillColor(SILVER).font('Helvetica-Bold').text('NUTRITION', 40, 50);
      doc.fontSize(28).fillColor(WHITE).font('Helvetica-Bold').text('GROCERY LIST', 40, 64);
      doc.moveTo(40, 100).lineTo(W - 40, 100).strokeColor(ACCENT).lineWidth(0.5).stroke();

      let gy = 120;
      [
        ['PROTEINS', gl.proteins],
        ['CARBOHYDRATES', gl.carbs],
        ['FRUITS & VEGETABLES', gl.fruits_veg],
        ['FATS', gl.fats],
        ['SUPPLEMENTS', gl.supplements],
      ].forEach(([cat, items]) => {
        if (!items || !items.length) return;
        doc.fontSize(10).fillColor(SILVER).font('Helvetica-Bold').text(cat, 40, gy);
        gy += 18;
        items.forEach(item => {
          doc.fontSize(9).fillColor(WHITE).font('Helvetica').text('· ' + item, 55, gy);
          gy += 14;
        });
        gy += 10;
      });

      footer(doc, client.name || clientName);
    }

    // ── FINAL PAGE ────────────────────────────────────────────────────────
    newPage(doc);
    doc.fontSize(28).fillColor(WHITE).font('Helvetica-Bold').text('WHAT HAPPENS NEXT', 40, 60);
    doc.moveTo(40, 96).lineTo(W - 40, 96).strokeColor(ACCENT).lineWidth(0.5).stroke();
    doc.fontSize(11).fillColor(WHITE).font('Helvetica')
      .text(planData.what_happens_next || '', 40, 116, { width: W - 80, lineGap: 6 });

    let finalY = doc.y + 40;
    doc.fontSize(9).fillColor(SILVER)
      .text('Video library: plus4performance.com/videos', 40, finalY);
    doc.text('Progress tracker: plus4performance.com/tracker', 40, finalY + 14);
    doc.text('Support: hello@plus4performance.com', 40, finalY + 28);

    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, finalY + 60, { width: 36 });
    }
    doc.fontSize(9).fillColor(SILVER).text('PLUS 4 PERFORMANCE', 86, finalY + 68);

    footer(doc, client.name || clientName);

    doc.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

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
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Plan generation started' }));

    try {
      const intakeData = JSON.parse(body);

      const systemPrompt = coachingBible + '\n\nCRITICAL INSTRUCTION: You must respond with ONLY a valid JSON object. No text before or after the JSON. No markdown. No code blocks. The JSON must exactly follow this structure:\n{\n  "client": {\n    "name": string,\n    "goal": string,\n    "age": number,\n    "height": number,\n    "current_weight": number,\n    "target_weight": number,\n    "bmr": number,\n    "tdee": number,\n    "plan_start": string,\n    "plan_end": string,\n    "experience": string,\n    "training_days": number,\n    "split": string\n  },\n  "personal_note": string,\n  "how_to_use": string,\n  "sessions": [{"name": string, "exercises": [{"name": string, "sets": number, "reps": string, "rest": string, "notes": string}]}],\n  "nutrition": {"daily_calories": number, "protein": number, "carbs": number, "fats": number, "training_day_calories": number, "rest_day_calories": number, "meal_plan": [{"meal": string, "foods": [string]}]},\n  "grocery_list": {"proteins": [string], "carbs": [string], "fruits_veg": [string], "fats": [string], "supplements": [string]},\n  "supplements": [string],\n  "what_happens_next": string\n}';

      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 32000,
          system: systemPrompt,
          messages: [{ role: 'user', content: `You are building a complete, detailed 12-week personalised training and nutrition plan. This is a paid product — the client expects professional, specific, substantive output. Generic responses are unacceptable.

TRAINING REQUIREMENTS:
- Build every single training session for all 12 weeks. Do not summarise or say "repeat week 1". Write out each session in full.
- Select exercises from the exercise library in the coaching bible. Use the priority ratings — prioritise Tier 1 exercises, use Tier 2 for variety, avoid Tier 3 unless justified.
- Apply progressive overload week by week exactly as described in Section 3 of the coaching bible. Sets, reps, and load must progress.
- Include the full coaching cues and common mistakes from the exercise library for every exercise in the notes field.
- Respect all injury contraindications the client has flagged. Apply the relevant protocol from Section 9.
- Session structure must follow Section 2 exactly — warm up, working sets, cool down, correct rest periods.

NUTRITION REQUIREMENTS:
- Calculate calories and macros using Mifflin St Jeor exactly as described in Section 7. Show your working in the personal_note field.
- Apply training day vs rest day splits per Section 7.
- Build a full meal plan using foods from the food library in Section 8. Be specific — name actual foods with quantities.
- The grocery list must reflect the meal plan exactly. No generic entries.
- Apply dietary preference adjustments from Section 7 based on the client's stated preferences.

PERSONAL NOTE:
- Reference the client's specific goal, stats, experience level and any injuries directly. This must feel like it was written for this individual, not a template.

STANDARDS:
- Every field must be fully populated. No placeholders. No "see coaching bible". No summaries.
- The plan must be substantive enough that a client could follow it for 12 weeks with no further guidance.
- Follow Section 10 presentation standards for all text fields.

Client data:
${JSON.stringify(intakeData, null, 2)}` }]
      })
      });

      const data = await anthropicResponse.json();

      if (!anthropicResponse.ok) {
        console.error('Anthropic error:', JSON.stringify(data));
        return;
      }

      const rawText = data.content[0].text;
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
      const pdfBuffer = await generatePDF(planData, clientName);
      console.log('PDF generated, size:', pdfBuffer.length);

      const pdfBase64 = pdfBuffer.toString('base64');

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
            '<p style="color:#C8C8C8;margin-bottom:24px;">Your personalised 12 week plan is attached. Here\'s what\'s inside:</p>' +
            '<ul style="color:#C8C8C8;line-height:2;">' +
            '<li>Your personal summary and targets</li>' +
            '<li>Full training programme with exercises, sets and reps</li>' +
            '<li>Nutrition plan with daily macro targets</li>' +
            '<li>7 day meal plan and grocery list</li>' +
            '<li>Supplement recommendations</li>' +
            '</ul>' +
            '<p style="color:#C8C8C8;margin-top:24px;">Start on week 1 by finding your working weights. Do not chase heavy weight in week 1 — get the movements right first.</p>' +
            '<p style="margin-top:32px;color:#787878;font-size:12px;">Plus 4 Performance · hello@plus4performance.com</p>' +
            '</div>',
          attachments: [{
            filename: 'Plus4Performance_' + clientName + '_12WeekPlan.pdf',
            content: pdfBase64
          }]
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
