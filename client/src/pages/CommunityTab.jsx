import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { friendSearch, friendList, friendRequest, friendRespond, friendRemove, getLeaderboard } from '../lib/api';

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────

const C = {
  surface:    '#131119',
  surface2:   '#0C0A0F',
  bone:       '#F3F1ED',
  ash:        '#ABA9B0',
  ashDim:     '#7A7880',
  pinkGlow:   'rgba(255,79,196,0.5)',
  pinkLine:   'rgba(255,79,196,0.25)',
};

// Pink lift+glow active state — used on sub-tabs, pills, toggles
const activeTabStyle = {
  background: 'linear-gradient(160deg, #1A1722, #100E15)',
  color: '#F3F1ED',
  boxShadow: `0 0 16px -4px rgba(255,79,196,0.5), 0 1px 0 rgba(255,255,255,0.04) inset`,
};

// CTA (primary action) button
function primaryBtn(disabled = false, extra = {}) {
  return {
    background: disabled ? C.surface2 : 'linear-gradient(160deg, #18151F, #100E15)',
    border: disabled ? '1px solid rgba(255,255,255,0.08)' : `1px solid ${C.pinkLine}`,
    color: disabled ? C.ashDim : C.bone,
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600,
    letterSpacing: '1.2px', textTransform: 'uppercase',
    padding: '9px 16px', borderRadius: 8, cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.7 : 1, whiteSpace: 'nowrap', flexShrink: 0,
    boxShadow: disabled ? 'none' : `0 6px 16px -6px rgba(255,79,196,0.5)`,
    ...extra,
  };
}

// Ghost / neutral button
function ghostBtn(extra = {}) {
  return {
    background: 'none', border: '1px solid rgba(255,255,255,0.12)',
    color: C.ash,
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600,
    letterSpacing: '1.2px', textTransform: 'uppercase',
    padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0,
    ...extra,
  };
}

// Danger button — neutral appearance, same as ghost per design system
function dangerBtn(extra = {}) {
  return ghostBtn(extra);
}

// ─── AVATAR ───────────────────────────────────────────────────────────────────

function Avatar({ url, name, size = 40 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (url) {
    return (
      <img src={url} alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: C.surface2 }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: C.surface2, border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: size * 0.32, fontWeight: 600, color: C.ashDim, letterSpacing: '0.05em' }}>
        {initials}
      </span>
    </div>
  );
}

// ─── SECTION CARD ─────────────────────────────────────────────────────────────

function SectionCard({ title, children, count }) {
  return (
    <div style={{
      background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 16, marginBottom: 18,
      boxShadow: '0 12px 30px -16px rgba(0,0,0,0.55)',
    }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 16, textTransform: 'uppercase', color: C.bone }}>
            {title}
          </div>
          {count != null && (
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.ashDim, fontWeight: 500 }}>
              {count}
            </span>
          )}
        </div>
      </div>
      <div style={{ padding: '16px 24px' }}>{children}</div>
    </div>
  );
}

// ─── PERSON ROW ───────────────────────────────────────────────────────────────

function PersonRow({ person, actions, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <Avatar url={person.avatar_url} name={person.display_name} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, color: C.bone }}>
          {person.display_name || person.username}
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.ashDim, marginTop: 2 }}>
          @{person.username}
        </div>
        {note && (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.ashDim, marginTop: 2 }}>{note}</div>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

// ─── LEADERBOARD PANEL ───────────────────────────────────────────────────────

const LIFTS_LB = [
  { key: 'bench_press',    label: 'Bench'    },
  { key: 'squat',          label: 'Squat'    },
  { key: 'deadlift',       label: 'Deadlift' },
  { key: 'overhead_press', label: 'OHP'      },
  { key: 'combined',       label: 'Combined' },
];

function Toggle2({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: C.surface, borderRadius: 9, padding: 4 }}>
      {options.map(opt => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '9px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: "'Oswald', sans-serif", fontSize: 11.5, fontWeight: 600,
              letterSpacing: '0.8px', textTransform: 'uppercase',
              ...(isActive ? activeTabStyle : { background: 'none', color: C.ash }),
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function LeaderboardPanel({ token }) {
  const [lift, setLift]       = useState('bench_press');
  const [period, setPeriod]   = useState('all_time');
  const [scope, setScope]     = useState('global');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    getLeaderboard(token, { lift, period, scope })
      .then(data => { if (!cancelled) { setEntries(data.entries || []); setLoading(false); } })
      .catch(e  => { if (!cancelled) { setError(e.message || 'Failed to load'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [token, lift, period, scope]);

  const liftLabel = LIFTS_LB.find(l => l.key === lift)?.label || lift;
  const unit = lift === 'combined' ? 'kg total' : 'kg';

  return (
    <div>
      {/* Lift filter pills — never a solid fill, pink lift+glow on active */}
      <div style={{
        display: 'flex', gap: 8,
        background: C.surface, border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, padding: 10, marginBottom: 16, overflowX: 'auto',
      }}>
        {LIFTS_LB.map(l => {
          const isActive = lift === l.key;
          return (
            <button
              key={l.key}
              onClick={() => setLift(l.key)}
              style={{
                padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 12.5,
                letterSpacing: '0.8px', textTransform: 'uppercase',
                whiteSpace: 'nowrap', flexShrink: 0,
                ...(isActive ? activeTabStyle : { background: 'none', color: C.ash }),
              }}
            >
              {l.label}
            </button>
          );
        })}
      </div>

      {/* Period + Scope toggles */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <Toggle2
          value={period}
          onChange={setPeriod}
          options={[{ value: 'all_time', label: 'All-Time' }, { value: 'week', label: 'This Week' }]}
        />
        <Toggle2
          value={scope}
          onChange={setScope}
          options={[{ value: 'global', label: 'Global' }, { value: 'friends', label: 'Friends' }]}
        />
      </div>

      {/* Board */}
      {loading ? (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash, padding: '32px 0' }}>Loading…</div>
      ) : error ? (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#fca5a5', padding: '20px 0' }}>{error}</div>
      ) : entries.length < 5 ? (
        <div style={{
          background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16, padding: '50px 24px', textAlign: 'center',
          boxShadow: '0 12px 30px -16px rgba(0,0,0,0.55)',
        }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 18, textTransform: 'uppercase', marginBottom: 10, color: C.bone }}>
            Not Enough Entries Yet
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: C.ash }}>
            Be one of the first to log a {liftLabel} 1RM and claim your spot.
          </div>
        </div>
      ) : (
        <div style={{
          background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surface2} 100%)`,
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16, overflow: 'hidden',
        }}>
          {entries.map((e, i) => {
            const rankColor = e.rank === 1 ? '#D4A537' : e.rank === 2 ? C.ash : e.rank === 3 ? '#C8946A' : C.ashDim;
            return (
              <div
                key={e.user_id + i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
                  borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  background: e.is_self ? 'rgba(255,79,196,0.04)' : 'none',
                }}
              >
                {/* Rank */}
                <div style={{
                  fontFamily: "'Roboto Mono', monospace",
                  fontSize: e.rank <= 3 ? 20 : 14,
                  fontWeight: 600,
                  color: rankColor,
                  minWidth: 28, textAlign: 'center', flexShrink: 0,
                }}>
                  {e.rank}
                </div>

                <Avatar url={e.avatar_url} name={e.display_name} size={36} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, color: C.bone, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {e.display_name || e.username}
                    {e.is_self && (
                      <span style={{
                        fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 600,
                        letterSpacing: '1.6px', textTransform: 'uppercase', color: C.bone,
                        border: `1px solid ${C.pinkLine}`, borderRadius: 4, padding: '1px 6px',
                      }}>You</span>
                    )}
                  </div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.ashDim, marginTop: 1 }}>
                    @{e.username}
                  </div>
                </div>

                <div style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 600, fontSize: 18, color: C.bone, flexShrink: 0 }}>
                  {e.weight_kg} <span style={{ fontSize: 11, color: C.ashDim, fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>{unit}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function CommunityTab() {
  const [activePanel, setActivePanel] = useState('friends');
  const [token, setToken]             = useState(null);
  const [searchQ, setSearchQ]         = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]     = useState(false);
  const [searchErr, setSearchErr]     = useState('');
  const [friends, setFriends]         = useState([]);
  const [received, setReceived]       = useState([]);
  const [sent, setSent]               = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [busyIds, setBusyIds]         = useState(new Set());
  const searchTimer                   = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token || null);
    });
  }, []);

  const loadList = useCallback(async (tok) => {
    if (!tok) return;
    try {
      const data = await friendList(tok);
      setFriends(data.friends || []);
      setReceived(data.received || []);
      setSent(data.sent || []);
    } catch (e) {
      console.error('[friends] load error', e.message);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) loadList(token);
  }, [token, loadList]);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQ.trim() || searchQ.trim().length < 2) {
      setSearchResults([]); setSearchErr(''); return;
    }
    searchTimer.current = setTimeout(async () => {
      if (!token) return;
      setSearching(true); setSearchErr('');
      try {
        const data = await friendSearch(token, searchQ.trim());
        setSearchResults(data.results || []);
        if (!data.results?.length) setSearchErr('No users found matching that username.');
      } catch (e) {
        setSearchErr(e.message || 'Search failed');
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [searchQ, token]);

  function setBusy(id, val) {
    setBusyIds(prev => { const next = new Set(prev); val ? next.add(id) : next.delete(id); return next; });
  }

  async function sendRequest(recipientId) {
    setBusy(recipientId, true);
    try {
      await friendRequest(token, recipientId);
      setSearchResults(r => r.filter(p => p.id !== recipientId));
      await loadList(token);
    } catch (e) {
      alert(e.message || 'Failed to send request');
    } finally {
      setBusy(recipientId, false);
    }
  }

  async function respond(friendshipId, action) {
    setBusy(friendshipId, true);
    try {
      await friendRespond(token, friendshipId, action);
      await loadList(token);
    } catch (e) {
      alert(e.message || 'Failed to respond');
    } finally {
      setBusy(friendshipId, false);
    }
  }

  async function remove(friendshipId) {
    setBusy(friendshipId, true);
    try {
      await friendRemove(token, friendshipId);
      await loadList(token);
    } catch (e) {
      alert(e.message || 'Failed to remove');
    } finally {
      setBusy(friendshipId, false);
    }
  }

  const friendIds       = new Set(friends.map(f => f.id));
  const sentToIds       = new Set(sent.map(f => f.id));
  const receivedFromIds = new Set(received.map(f => f.id));

  function searchResultActions(person) {
    if (friendIds.has(person.id))       return <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ashDim }}>Friends</span>;
    if (sentToIds.has(person.id))       return <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ashDim }}>Request sent</span>;
    if (receivedFromIds.has(person.id)) return <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ashDim }}>Request received</span>;
    const busy = busyIds.has(person.id);
    return (
      <button onClick={() => sendRequest(person.id)} disabled={busy} style={primaryBtn(busy)}>
        {busy ? '…' : 'Add Friend'}
      </button>
    );
  }

  // Sub-tab (Friends / Leaderboard)
  const panelTab = (id, label) => (
    <button
      key={id}
      onClick={() => setActivePanel(id)}
      style={{
        padding: '11px 22px', borderRadius: 7, border: 'none', cursor: 'pointer',
        fontFamily: "'Oswald', sans-serif", fontSize: 12.5, fontWeight: 600,
        letterSpacing: '1px', textTransform: 'uppercase',
        ...(activePanel === id ? activeTabStyle : { background: 'none', color: C.ash }),
      }}
    >
      {label}
    </button>
  );

  return (
    <div>

      {/* Page header */}
      <div style={{ marginBottom: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 28, height: 1, background: C.pinkLine }} />
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, letterSpacing: '2px', color: C.ashDim, textTransform: 'uppercase' }}>Community</div>
          <div style={{ width: 28, height: 1, background: C.pinkLine }} />
        </div>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 'clamp(32px, 6vw, 38px)', textTransform: 'uppercase', color: C.bone, lineHeight: 1 }}>
          {activePanel === 'leaderboard' ? 'Leaderboard' : 'Friends'}
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'inline-flex', gap: 4, background: C.surface, borderRadius: 10, padding: 5, marginBottom: 28 }}>
        {panelTab('friends', 'Friends')}
        {panelTab('leaderboard', 'Leaderboard')}
      </div>

      {/* ── LEADERBOARD PANEL ── */}
      {activePanel === 'leaderboard' && <LeaderboardPanel token={token} />}

      {/* ── FRIENDS PANEL ── */}
      {activePanel === 'friends' && (
        <>
          {/* Search */}
          <SectionCard title="Find Members">
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <input
                placeholder="Search by username…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onFocus={e => { e.target.style.borderColor = C.pinkLine; e.target.style.boxShadow = `0 0 18px -8px ${C.pinkGlow}`; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                style={{
                  width: '100%', padding: '14px 16px',
                  background: C.surface2, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
                  color: C.bone, fontFamily: "'Inter', sans-serif", fontSize: 14, outline: 'none',
                  boxSizing: 'border-box', transition: 'border-color 0.25s, box-shadow 0.25s',
                }}
              />
              {searching && (
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ashDim }}>
                  …
                </span>
              )}
            </div>

            {searchErr && !searching && (
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: C.ashDim, marginBottom: 4 }}>{searchErr}</div>
            )}

            {searchResults.length > 0 && (
              <div>
                {searchResults.map(person => (
                  <PersonRow key={person.id} person={person} actions={searchResultActions(person)} />
                ))}
              </div>
            )}

            {!searchQ.trim() && (
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: C.ashDim }}>
                Enter a username to find other Plus 4 members.
              </div>
            )}
          </SectionCard>

          {/* Requests Received */}
          {(received.length > 0 || listLoading) && (
            <SectionCard title="Requests Received" count={received.length || null}>
              {listLoading ? (
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash }}>Loading…</div>
              ) : received.map(person => (
                <PersonRow
                  key={person.friendship_id}
                  person={person}
                  actions={
                    <>
                      <button onClick={() => respond(person.friendship_id, 'accept')} disabled={busyIds.has(person.friendship_id)} style={primaryBtn(busyIds.has(person.friendship_id))}>
                        {busyIds.has(person.friendship_id) ? '…' : 'Accept'}
                      </button>
                      <button onClick={() => respond(person.friendship_id, 'decline')} disabled={busyIds.has(person.friendship_id)} style={ghostBtn()}>
                        Decline
                      </button>
                    </>
                  }
                />
              ))}
            </SectionCard>
          )}

          {/* Requests Sent */}
          {sent.length > 0 && (
            <SectionCard title="Requests Sent" count={sent.length}>
              {sent.map(person => (
                <PersonRow
                  key={person.friendship_id}
                  person={person}
                  note="Pending"
                  actions={
                    <button onClick={() => remove(person.friendship_id)} disabled={busyIds.has(person.friendship_id)} style={dangerBtn()}>
                      {busyIds.has(person.friendship_id) ? '…' : 'Cancel'}
                    </button>
                  }
                />
              ))}
            </SectionCard>
          )}

          {/* Friends List */}
          <SectionCard title="My Friends" count={friends.length}>
            {listLoading ? (
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ash }}>Loading…</div>
            ) : friends.length === 0 ? (
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: C.ashDim }}>
                No friends yet. Search for other members above to get started.
              </div>
            ) : (
              friends.map(person => (
                <PersonRow
                  key={person.friendship_id}
                  person={person}
                  actions={
                    <button onClick={() => remove(person.friendship_id)} disabled={busyIds.has(person.friendship_id)} style={dangerBtn()}>
                      {busyIds.has(person.friendship_id) ? '…' : 'Remove'}
                    </button>
                  }
                />
              ))
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
