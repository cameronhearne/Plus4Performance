exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'No API key' }) };
  }

  let intakeData;
  try {
    intakeData = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON', details: e.message }) };
  }

  const prompt = `You are a professional fitness coach. Based on this client data, generate a personalised 12 week training and nutrition plan:\n\n${JSON.stringify(intakeData, null, 2)}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API error', details: data }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/plain' },
    body: data.content[0].text
  };
};
