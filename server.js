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

function generatePDF(planData, clientName) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', autoFirstPage: true });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.on('pageAdded', () => {
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(DARK);
    });

    function addFooter(name) {
      doc.fontSize(8).fillColor(SILVER)
        .text('PLUS 4 PERFORMANCE  ·  ' + name.toUpperCase() + '  ·  12 WEEK PLAN',
          40, doc.page.height - 30, { align: 'center' });
    }

    // PAGE 1 - Cover/Personal Summary
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, 40, { width: 50 });
    }
    doc.fontSize(9).fillColor(SILVER)
      .text(new Date().toLocaleDateString('en-GB'), 0, 50, { align: 'right', width: doc.page.width - 40 });

    const client = planData.client;
    doc.fontSize(48).fillColor(WHITE).font('Helvetica-Bold')
      .text(client.name.toUpperCase() + "'S", 40, 130);
    doc.fontSize(36).fillColor(SILVER)
      .text('12 WEEK ' + client.goal.toUpperCase() + ' PLAN', 40, doc.y + 5);

    doc.moveTo(40, doc.y + 20).lineTo(doc.page.width - 40, doc.y + 20)
      .strokeColor(ACCENT).lineWidth(0.5).stroke();

    const statsY = doc.y + 35;
    doc.fontSize(9).fillColor(SILVER).font('Helvetica-Bold')
      .text('YOUR STATS', 40, statsY)
      .text('YOUR TARGETS', doc.page.width / 2, statsY);

    const stats = [
      ['Age', client.age + ' years'],
      ['Height', client.height + 'cm'],
      ['Current weight', client.current_weight + 'kg'],
      ['Target weight', client.target_weight + 'kg'],
      ['Goal', client.goal],
      ['Experience', client.experience],
      ['Start date', client.plan_start],
      ['End date', client.plan_end]
    ];

    const targets = [
      ['Daily calories', client.tdee + ' kcal'],
      ['Training days', client.training_days + ' per week'],
      ['Split', client.split],
      ['BMR', client.bmr + ' kcal'],
      ['TDEE', client.tdee + ' kcal']
    ];

    let rowY = statsY + 20;
    stats.forEach(([label, value]) => {
      doc.fontSize(9).fillColor(ACCENT).font('Helvetica').text(label + ':', 40, rowY);
      doc.fillColor(WHITE).text(value, 160, rowY);
      rowY += 16;
    });

    rowY = statsY + 20;
    targets.forEach(([label, value]) => {
      doc.fontSize(9).fillColor(ACCENT).font('Helvetica').text(label + ':', doc.page.width / 2, rowY);
      doc.fillColor(WHITE).text(value, doc.page.width / 2 + 120, rowY);
      rowY += 16;
    });

    if (planData.supplements && planData.supplements.length) {
      doc.moveDown(2);
      doc.fontSize(9).fillColor(SILVER).font('Helvetica-Bold').text('SUPPLEMENTS', 40, doc.y);
      doc.moveDown(0.5);
      planData.supplements.forEach(s => {
        doc.fontSize(9).fillColor(WHITE).font('Helvetica').text('· ' + s, 40);
      });
    }

    if (planData.personal_note) {
      doc.moveDown(2);
      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y)
        .strokeColor(ACCENT).lineWidth(0.5).stroke();
      doc.moveDown(1);
      doc.fontSize(10).fillColor(WHITE).font('Helvetica-Oblique')
        .text(planData.personal_note, 40, doc.y, { width: doc.page.width - 80 });
    }

    addFooter(client.name);

    // PAGE 2 - How to use
    doc.addPage();
    doc.fontSize(28).fillColor(WHITE).font('Helvetica-Bold').text('HOW TO USE THIS PLAN', 40, 60);
    doc.moveTo(40, doc.y + 10).lineTo(doc.page.width - 40, doc.y + 10)
      .strokeColor(ACCENT).lineWidth(0.5).stroke();
    doc.moveDown(2);
    doc.fontSize(10).fillColor(WHITE).font('Helvetica')
      .text(planData.how_to_use || '', 40, doc.y, { width: doc.page.width - 80, lineGap: 4 });
    addFooter(client.name);

    // TRAINING SESSIONS
    if (planData.sessions) {
      planData.sessions.forEach(session => {
        doc.addPage();
        doc.fontSize(9).fillColor(SILVER).font('Helvetica-Bold').text('TRAINING', 40, 50);
        doc.fontSize(28).fillColor(WHITE).font('Helvetica-Bold').text(session.name.toUpperCase(), 40, 65);
        doc.moveTo(40, doc.y + 10).lineTo(doc.page.width - 40, doc.y + 10)
          .strokeColor(ACCENT).lineWidth(0.5).stroke();

        let tableY = doc.y + 25;
        const cols = { ex: 40, sets: 260, reps: 310, rest: 370, notes: 420 };
        doc.fontSize(8).fillColor(SILVER).font('Helvetica-Bold');
        doc.text('EXERCISE', cols.ex, tableY);
        doc.text('SETS', cols.sets, tableY);
        doc.text('REPS', cols.reps, tableY);
        doc.text('REST', cols.rest, tableY);
        doc.text('NOTES', cols.notes, tableY);
        tableY += 18;
        doc.moveTo(40, tableY).lineTo(doc.page.width - 40, tableY)
          .strokeColor(ACCENT).lineWidth(0.3).stroke();
        tableY += 8;

        session.exercises && session.exercises.forEach((ex, i) => {
          const bg = i % 2 === 0 ? '#111111' : '#0d0d0d';
          doc.rect(40, tableY - 4, doc.page.width - 80, 20).fill(bg);
          doc.fontSize(9).fillColor(WHITE).font('Helvetica');
          doc.text(ex.name, cols.ex, tableY, { width: 210 });
          doc.text(String(ex.sets), cols.sets, tableY);
          doc.text(String(ex.reps), cols.reps, tableY);
          doc.text(String(ex.rest || ''), cols.rest, tableY);
          doc.text(String(ex.notes || ''), cols.notes, tableY, { width: 120 });
          tableY += 20;
        });

        addFooter(client.name);
      });
    }

    // NUTRITION PAGE
    if (planData.nutrition) {
      doc.addPage();
      const nut = planData.nutrition;
      doc.fontSize(9).fillColor(SILVER).font('Helvetica-Bold').text('NUTRITION', 40, 50);
      doc.fontSize(28).fillColor(WHITE).font('Helvetica-Bold').text('YOUR NUTRITION PLAN', 40, 65);
      doc.moveTo(40, doc.y + 10).lineTo(doc.page.width - 40, doc.y + 10)
        .strokeColor(ACCENT).lineWidth(0.5).stroke();

      let nutY = doc.y + 30;
      const macros = [
        ['Daily Calories', nut.daily_calories + ' kcal'],
        ['Protein', nut.protein + 'g'],
        ['Carbohydrates', nut.carbs + 'g'],
        ['Fats', nut.fats + 'g'],
        ['Training day calories', nut.training_day_calories + ' kcal'],
        ['Rest day calories', nut.rest_day_calories + ' kcal']
      ];

      macros.forEach(([label, value]) => {
        doc.fontSize(9).fillColor(ACCENT).font('Helvetica').text(label + ':', 40, nutY);
        doc.fillColor(WHITE).text(value, 220, nutY);
        nutY += 18;
      });

      if (nut.meal_plan && nut.meal_plan.length) {
        nutY += 20;
        doc.moveTo(40, nutY).lineTo(doc.page.width - 40, nutY)
          .strokeColor(ACCENT).lineWidth(0.5).stroke();
        nutY += 20;
        doc.fontSize(11).fillColor(SILVER).font('Helvetica-Bold').text('MEAL PLAN', 40, nutY);
        nutY += 20;

        nut.meal_plan.forEach(meal => {
          doc.fontSize(10).fillColor(WHITE).font('Helvetica-Bold').text(meal.meal.toUpperCase(), 40, nutY);
          nutY += 16;
          meal.foods && meal.foods.forEach(food => {
            doc.fontSize(9).fillColor(ACCENT).font('Helvetica').text('· ' + food, 55, nutY);
            nutY += 14;
          });
          nutY += 6;
        });
      }

      addFooter(client.name);
    }

    // GROCERY LIST
    if (planData.grocery_list) {
      doc.addPage();
      doc.fontSize(9).fillColor(SILVER).font('Helvetica-Bold').text('NUTRITION', 40, 50);
      doc.fontSize(28).fillColor(WHITE).font('Helvetica-Bold').text('GROCERY LIST', 40, 65);
      doc.moveTo(40, doc.y + 10).lineTo(doc.page.width - 40, doc.y + 10)
        .strokeColor(ACCENT).lineWidth(0.5).stroke();

      let gY = doc.y + 30;
      const gl = planData.grocery_list;
      const categories = [
        ['PROTEINS', gl.proteins],
        ['CARBOHYDRATES', gl.carbs],
        ['FRUITS & VEGETABLES', gl.fruits_veg],
        ['FATS', gl.fats],
        ['SUPPLEMENTS', gl.supplements]
      ];

      categories.forEach(([cat, items]) => {
        if (!items || !items.length) return;
        doc.fontSize(10).fillColor(SILVER).font('Helvetica-Bold').text(cat, 40, gY);
        gY += 18;
        items.forEach(item => {
          doc.fontSize(9).fillColor(WHITE).font('Helvetica').text('· ' + item, 55, gY);
          gY += 14;
        });
        gY += 10;
      });

      addFooter(client.name);
    }

    // FINAL PAGE
    doc.addPage();
    doc.fontSize(28).fillColor(WHITE).font('Helvetica-Bold').text('WHAT HAPPENS NEXT', 40, 60);
    doc.moveTo(40, doc.y + 10).lineTo(doc.page.width - 40, doc.y + 10)
      .strokeColor(ACCENT).lineWidth(0.5).stroke();
    doc.moveDown(2);
    doc.fontSize(11).fillColor(WHITE).font('Helvetica')
      .text(planData.what_happens_next || '', 40, doc.y, { width: doc.page.width - 80, lineGap: 6 });
    doc.moveDown(3);
    doc.fontSize(9).fillColor(SILVER).text('Video library: plus4performance.com/videos', 40);
    doc.text('Progress tracker: plus4performance.com/tracker', 40);
    doc.text('Support: hello@plus4performance.com', 40);
    doc.moveDown(2);
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, doc.y, { width: 40 });
    }
    doc.fontSize(9).fillColor(SILVER).text('PLUS 4 PERFORMANCE', 90, doc.y - 10);
    addFooter(client.name);

    doc.end();
  });
}

const server = http.createServer(async (req, res) => {
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
          messages: [{ role: 'user', content: 'Build a full personalised 12 week training and nutrition plan for this client. Follow the coaching bible exactly. Return ONLY valid JSON.\n\nClient data:\n' + JSON.stringify(intakeData, null, 2) }]
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

      console.log('Plan parsed successfully for:', planData.client && planData.client.name);

      const clientName = (planData.client && planData.client.name) || intakeData.name || 'Client';
      const pdfBuffer = await generatePDF(planData, clientName);
      const pdfBase64 = pdfBuffer.toString('base64');

      console.log('PDF generated, size:', pdfBuffer.length);

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
