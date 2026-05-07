const http = require('http');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const coachingBible = fs.readFileSync(path.join(__dirname, 'coaching_bible.txt'), 'utf8');

function generatePDF(plan, clientName) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(24).font('Helvetica-Bold').text('PLUS 4 PERFORMANCE', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(18).font('Helvetica').text(clientName + ' — 12 Week Plan', { align: 'center' });
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);
    doc.fontSize(11).font('Helvetica').text(plan, { lineGap: 4 });
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

      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 16000,
          system: coachingBible,
          messages: [{ role: 'user', content: 'Build a full personalised 12 week training and nutrition plan for this client. Follow the coaching bible exactly.\n\nClient data:\n' + JSON.stringify(intakeData, null, 2) }]
        })
      });

      const data = await anthropicResponse.json();

      if (!anthropicResponse.ok) {
        console.error('Anthropic error:', JSON.stringify(data));
        return;
      }

      const plan = data.content[0].text;
      console.log('Plan generated, length:', plan.length);

      const clientName = intakeData.name || 'Client';
      const pdfBuffer = await generatePDF(plan, clientName);
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
          subject: 'Your Plus 4 Performance Plan is Ready',
          html: '<h2>Your Plus 4 Performance Plan is Ready</h2><p>Hi ' + clientName + ',</p><p>Your personalised 12 week plan is attached. Start strong.</p><p>The Plus 4 Performance Team</p>',
          attachments: [{
            filename: 'Plus4Performance_Plan.pdf',
            content: pdfBase64
          }]
        })
      });

      const emailData = await emailResponse.json();
      console.log('Email status:', emailResponse.status);
      console.log('Email response:', JSON.stringify(emailData));

    } catch (err) {
      console.error('Error:', err.message);
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log('Server running on port ' + PORT));
