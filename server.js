const http = require('http');

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
          messages: [{ role: 'user', content: `You are a professional fitness coach. Based on this client data, generate a full personalised 12 week training and nutrition plan:\n\n${JSON.stringify(intakeData, null, 2)}` }]
        })
      });

      const data = await anthropicResponse.json();
      console.log('Anthropic response status:', anthropicResponse.status);
      
      if (!anthropicResponse.ok) {
        console.error('Anthropic error:', JSON.stringify(data));
        return;
      }
      
      const plan = data.content[0].text;
      console.log('Plan generated, length:', plan.length);

      const klaviyoBody = {
        data: {
          type: 'event',
          attributes: {
            metric: { data: { type: 'metric', attributes: { name: 'Plan Generated' } } },
            profile: { data: { type: 'profile', attributes: { email: intakeData.email } } },
            properties: { plan: plan }
          }
        }
      };

      const klaviyoResponse = await fetch('https://a.klaviyo.com/api/events/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Klaviyo-API-Key ${process.env.KLAVIYO_API_KEY}`,
          'revision': '2023-12-15'
        },
        body: JSON.stringify(klaviyoBody)
      });

      const klaviyoText = await klaviyoResponse.text();
      console.log('Klaviyo status:', klaviyoResponse.status);
      console.log('Klaviyo response:', klaviyoText);

    } catch (err) {
      console.error('Error:', err.message);
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
