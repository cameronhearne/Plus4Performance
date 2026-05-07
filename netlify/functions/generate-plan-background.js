exports.handler = async (event) => {
  const { createClient } = require('@klaviyo/api');
  
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const klaviyoKey = process.env.KLAVIYO_API_KEY;

  let intakeData;
  try {
    intakeData = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const prompt = `You are a professional fitness coach. Based on this client data, generate a full personalised 12 week training and nutrition plan:\n\n${JSON.stringify(intakeData, null, 2)}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  const plan = data.content[0].text;

  await fetch('https://a.klaviyo.com/api/events/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Klaviyo-API-Key ${klaviyoKey}`,
      'revision': '2023-12-15'
    },
    body: JSON.stringify({
      data: {
        type: 'event',
        attributes: {
          metric: { data: { type: 'metric', attributes: { name: 'Plan Generated' } } },
          profile: { data: { type: 'profile', attributes: { email: intakeData.email } } },
          properties: { plan: plan }
        }
      }
    })
  });

  return { statusCode: 202 };
};
