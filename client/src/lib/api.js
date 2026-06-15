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

async function authedGet(path, token) {
  const res = await fetch(API + path, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export async function getEmailPreferences(token) {
  return authedGet('/api/email-preferences', token);
}

export async function saveEmailPreferences(prefs, token) {
  return authedPost('/api/email-preferences', prefs, token);
}

export async function submitSnapshot(intakeData, token) {
  return authedPost('/snapshot', { intakeData }, token);
}

export async function createCheckoutSession(email, token) {
  return authedPost('/create-checkout-session', { email }, token);
}

export async function createPortalSession(token) {
  return authedPost('/create-portal-session', {}, token);
}

export async function submitMonthlyCheckin(payload, token) {
  return authedPost('/api/monthly-checkin', payload, token);
}

export async function deleteAccount(token) {
  const res = await fetch((import.meta.env.VITE_API_URL || '') + '/delete-account', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}
