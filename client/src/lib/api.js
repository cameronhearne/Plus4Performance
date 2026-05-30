const API = import.meta.env.VITE_API_URL || '';

async function authedPost(path, body, token) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export async function submitSnapshot(intakeData, token) {
  return authedPost('/snapshot', { intakeData }, token);
}

export async function createCheckoutSession(email, token) {
  return authedPost('/create-checkout-session', { email }, token);
}
