const http = require('http');
const fs = require('fs');
const path = require('path');

const coachingBible = fs.readFileSync(path.join(__dirname, 'coaching_bible.txt'), 'utf8');

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
          max_tokens: 8000,
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
          text: plan
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
