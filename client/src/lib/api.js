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

export async function sendTestWeeklyEmail(token) {
  return authedPost('/api/test-weekly-email', {}, token);
}

export async function submitMonthlyCheckin(payload, token) {
  return authedPost('/api/monthly-checkin', payload, token);
}

export async function requestRenewalPlan(option, newIntake, token) {
  return authedPost('/api/plan/renew', { option, new_intake: newIntake || null }, token);
}

export async function listPlans(token)              { return authedGet('/api/plans', token); }
export async function activatePlan(planId, token)   { return authedPost('/api/plan/activate', { plan_id: planId }, token); }

export async function getWeekSchedule(weekStart, token)           { return authedGet(`/api/schedule/week?week_start=${weekStart}`, token); }
export async function saveWeekSchedule(weekStart, schedule, token){ return authedPost('/api/schedule/week', { week_start: weekStart, schedule }, token); }
export async function resetWeekSchedule(weekStart, token) {
  const API = import.meta.env.VITE_API_URL || '';
  const res = await fetch(API + `/api/schedule/week?week_start=${weekStart}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({ error: res.statusText })); throw new Error(e.error || 'Request failed'); }
  return res.json();
}

// ─── FOOD ─────────────────────────────────────────────────────────────────────
export async function foodSearch(token, query)         { return authedPost('/api/food/search', { query }, token); }
export async function foodLog(token, entry)            { return authedPost('/api/food/log', entry, token); }
export async function foodGetDay(token, date)          { return authedGet(`/api/food/log/${date}`, token); }
export async function foodDeleteEntry(token, id) {
  const res = await fetch(API + `/api/food/log/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({ error: res.statusText })); throw new Error(e.error || 'Request failed'); }
  return res.json();
}

// ─── 1RM ─────────────────────────────────────────────────────────────────────
export async function logOneRm(token, { lift, weight_kg, is_calculated }) {
  return authedPost('/api/1rm/log', { lift, weight_kg, is_calculated }, token);
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────
export async function getLeaderboard(token, { lift, period, scope }) {
  return authedGet(`/api/leaderboard?lift=${lift}&period=${period}&scope=${scope}`, token);
}

// ─── FRIENDS ─────────────────────────────────────────────────────────────────
export async function friendSearch(token, q)              { return authedGet(`/api/friends/search?q=${encodeURIComponent(q)}`, token); }
export async function friendList(token)                   { return authedGet('/api/friends', token); }
export async function friendRequest(token, recipient_id)  { return authedPost('/api/friends/request', { recipient_id }, token); }
export async function friendRespond(token, friendship_id, action) { return authedPost('/api/friends/respond', { friendship_id, action }, token); }
export async function friendRemove(token, friendship_id) {
  const res = await fetch(API + `/api/friends/${friendship_id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({ error: res.statusText })); throw new Error(e.error || 'Request failed'); }
  return res.json();
}

// ─── ADMIN — FLAGGED 1RM ─────────────────────────────────────────────────────
export async function adminGetFlagged1rm(token)          { return authedGet('/api/admin/flagged-1rm', token); }
export async function adminApprove1rm(token, id)         { return authedPost(`/api/admin/flagged-1rm/${id}/approve`, {}, token); }
export async function adminReject1rm(token, id)          { return authedPost(`/api/admin/flagged-1rm/${id}/reject`, {}, token); }

// ─── ADMIN ────────────────────────────────────────────────────────────────────
// ─── AFFILIATE (admin) ────────────────────────────────────────────────────────
export async function adminListAffiliates(token)               { return authedGet('/api/admin/affiliates', token); }
export async function adminCreateAffiliate(token, data)        { return authedPost('/api/admin/affiliates', data, token); }
export async function adminMarkAffiliatePaid(token, id)        { return authedPost(`/api/admin/affiliates/${id}/mark-paid`, {}, token); }

// ─── ADMIN ────────────────────────────────────────────────────────────────────
export async function adminGetStats(token)                   { return authedGet('/api/admin/stats', token); }
export async function adminGetRevenue(token, period = 'daily') { return authedGet(`/api/admin/revenue?period=${period}`, token); }
export async function adminListUsers(token, params = {}) {
  const qs = new URLSearchParams(params).toString();
  return authedGet(`/api/admin/users${qs ? '?' + qs : ''}`, token);
}
export async function adminGetUser(token, userId)            { return authedGet(`/api/admin/users/${userId}`, token); }
export async function adminGetLastCharge(token, userId)      { return authedGet(`/api/admin/users/${userId}/last-charge`, token); }
export async function adminCancelSub(token, userId, mode)    { return authedPost(`/api/admin/users/${userId}/cancel-subscription`, { mode }, token); }
export async function adminRefund(token, userId, chargeId, amount) { return authedPost(`/api/admin/users/${userId}/refund`, { chargeId, amount }, token); }
export async function adminRegeneratePlan(token, userId)     { return authedPost(`/api/admin/users/${userId}/regenerate-plan`, {}, token); }

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
