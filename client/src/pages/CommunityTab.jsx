import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { friendSearch, friendList, friendRequest, friendRespond, friendRemove, getLeaderboard } from '../lib/api';

// ─── STYLE TOKENS ─────────────────────────────────────────────────────────────

const eyebrow = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#555' };
const sectionTitle = { fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.1em', color: '#F5F3EE', paddingBottom: 14 };
const cardStyle = { background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.12)', marginBottom: 20 };
const labelText = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#CDCDC8', letterSpacing: '0.04em' };
const subText = { fontFamily: "'Barlow', sans-serif", fontSize: 12, color: '#555', fontWeight: 300 };

function inp(extra = {}) {
  return { padding: '10px 12px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#F5F3EE', fontFamily: "'Barlow', sans-serif", fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', ...extra };
}
function primaryBtn(disabled = false, extra = {}) {
  return { background: disabled ? '#2a2a2a' : '#C0392B', border: 'none', color: disabled ? '#555' : '#fff', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '8px 16px', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.7 : 1, whiteSpace: 'nowrap', flexShrink: 0, ...extra };
}
function ghostBtn(extra = {}) {
  return { background: 'none', border: '1px solid rgba(200,200,200,0.18)', color: '#787878', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 14px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, ...extra };
}
function dangerBtn(extra = {}) {
  return { ...ghostBtn(extra), borderColor: 'rgba(192,57,43,0.4)', color: '#C0392B' };
}

// ─── AVATAR ───────────────────────────────────────────────────────────────────

function Avatar({ url, name, size = 40 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#1a1a1a' }}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: size * 0.35, fontWeight: 700, color: '#555', letterSpacing: '0.05em' }}>{initials}</span>
    </div>
  );
}

// ─── SECTION CARD ─────────────────────────────────────────────────────────────

function SectionCard({ title, children, count }) {
  return (
    <div style={cardStyle}>
      <div style={{ padding: '20px 20px 0', borderBottom: '1px solid rgba(200,200,200,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 14 }}>
          <div style={sectionTitle}>{title}</div>
          {count != null && (
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: '#555', letterSpacing: '0.08em' }}>
              {count}
            </span>
          )}
        </div>
      </div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  );
}

// ─── PERSON ROW ───────────────────────────────────────────────────────────────

function PersonRow({ person, actions, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid #111' }}>
      <Avatar url={person.avatar_url} name={person.display_name} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...labelText, fontWeight: 600 }}>{person.display_name || person.username}</div>
        <div style={{ ...subText, marginTop: 2 }}>@{person.username}</div>
        {note && <div style={{ ...subText, marginTop: 2 }}>{note}</div>}
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
    <div style={{ display: 'flex', gap: 2, background: '#111', padding: 3 }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '7px 14px',
            background: value === opt.value ? '#1a1a1a' : 'none',
            border: 'none',
            color: value === opt.value ? '#F5F3EE' : '#555',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {opt.label}
        </button>
      ))}
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
      {/* Lift tabs */}
      <div style={{ display: 'flex', gap: 2, background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.08)', padding: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        {LIFTS_LB.map(l => (
          <button
            key={l.key}
            onClick={() => setLift(l.key)}
            style={{
              padding: '8px 16px',
              background: lift === l.key ? '#C0392B' : 'none',
              border: 'none',
              color: lift === l.key ? '#fff' : '#555',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {l.label}
          </button>
        ))}
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
        <div style={{ ...subText, padding: '32px 0' }}>Loading…</div>
      ) : error ? (
        <div style={{ ...subText, color: '#C0392B', padding: '20px 0' }}>{error}</div>
      ) : entries.length < 5 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px solid rgba(200,200,200,0.08)' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.08em', color: '#333', marginBottom: 10 }}>
            Not enough entries yet
          </div>
          <div style={subText}>
            Be one of the first to log a {liftLabel} 1RM and claim your spot.
          </div>
        </div>
      ) : (
        <div style={{ background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.08)' }}>
          {entries.map((e, i) => (
            <div
              key={e.user_id + i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px 16px',
                borderBottom: i < entries.length - 1 ? '1px solid #111' : 'none',
                background: e.is_self ? 'rgba(192,57,43,0.07)' : 'none',
              }}
            >
              {/* Rank */}
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: e.rank <= 3 ? 20 : 15,
                letterSpacing: '0.04em',
                color: e.rank === 1 ? '#F5C518' : e.rank === 2 ? '#CDCDC8' : e.rank === 3 ? '#CD7F32' : '#333',
                minWidth: 28,
                textAlign: 'center',
                flexShrink: 0,
              }}>
                {e.rank}
              </div>

              <Avatar url={e.avatar_url} name={e.display_name} size={36} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...labelText, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {e.display_name || e.username}
                  {e.is_self && (
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#C0392B', border: '1px solid rgba(192,57,43,0.4)', padding: '1px 6px' }}>You</span>
                  )}
                </div>
                <div style={{ ...subText, marginTop: 1 }}>@{e.username}</div>
              </div>

              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.06em', color: '#F5F3EE', flexShrink: 0 }}>
                {e.weight_kg} <span style={{ fontSize: 11, color: '#555', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em' }}>{unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function CommunityTab() {
  const [activePanel, setActivePanel] = useState('friends');
  const [token, setToken] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [friends, setFriends] = useState([]);
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [busyIds, setBusyIds] = useState(new Set());
  const searchTimer = useRef(null);

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
      setSearchResults([]);
      setSearchErr('');
      return;
    }
    searchTimer.current = setTimeout(async () => {
      if (!token) return;
      setSearching(true);
      setSearchErr('');
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
    setBusyIds(prev => {
      const next = new Set(prev);
      val ? next.add(id) : next.delete(id);
      return next;
    });
  }

  async function sendRequest(recipientId) {
    setBusy(recipientId, true);
    try {
      await friendRequest(token, recipientId);
      // Remove from search results and reload list
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

  // Determine per-search-result relationship state
  const friendIds = new Set(friends.map(f => f.id));
  const sentToIds = new Set(sent.map(f => f.id));
  const receivedFromIds = new Set(received.map(f => f.id));

  function searchResultActions(person) {
    if (friendIds.has(person.id)) {
      return <span style={subText}>Friends</span>;
    }
    if (sentToIds.has(person.id)) {
      return <span style={subText}>Request sent</span>;
    }
    if (receivedFromIds.has(person.id)) {
      return <span style={subText}>Request received</span>;
    }
    const busy = busyIds.has(person.id);
    return (
      <button
        onClick={() => sendRequest(person.id)}
        disabled={busy}
        style={primaryBtn(busy)}
      >
        {busy ? '…' : 'Add Friend'}
      </button>
    );
  }

  const panelTab = (id, label) => (
    <button
      key={id}
      onClick={() => setActivePanel(id)}
      style={{
        padding: '10px 22px',
        background: activePanel === id ? '#1a1a1a' : 'none',
        border: 'none',
        color: activePanel === id ? '#F5F3EE' : '#555',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 60px' }}>

      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ ...eyebrow, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'block', width: 24, height: 1, background: '#C0392B' }} />
          Community
          <span style={{ display: 'block', width: 24, height: 1, background: '#C0392B' }} />
        </div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(36px, 6vw, 52px)', letterSpacing: '0.04em', color: '#F5F3EE', lineHeight: 1 }}>
          {activePanel === 'leaderboard' ? 'Leaderboard' : 'Friends'}
        </div>
      </div>

      {/* Internal tab nav */}
      <div style={{ display: 'flex', gap: 2, background: '#0d0d0d', border: '1px solid rgba(200,200,200,0.08)', padding: 3, marginBottom: 28, width: 'fit-content' }}>
        {panelTab('friends', 'Friends')}
        {panelTab('leaderboard', 'Leaderboard')}
      </div>

      {/* ── LEADERBOARD PANEL ── */}
      {activePanel === 'leaderboard' && <LeaderboardPanel token={token} />}

      {/* ── FRIENDS PANEL ── */}
      {activePanel === 'friends' && <>

      {/* Search */}
      <SectionCard title="Find Members">
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <input
            style={inp()}
            placeholder="Search by username…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
          {searching && (
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', ...subText }}>
              …
            </span>
          )}
        </div>

        {searchErr && !searching && (
          <div style={{ ...subText, paddingBottom: 4 }}>{searchErr}</div>
        )}

        {searchResults.length > 0 && (
          <div>
            {searchResults.map(person => (
              <PersonRow
                key={person.id}
                person={person}
                actions={searchResultActions(person)}
              />
            ))}
          </div>
        )}

        {!searchQ.trim() && (
          <div style={subText}>Enter a username to find other Plus 4 members.</div>
        )}
      </SectionCard>

      {/* Requests Received */}
      {(received.length > 0 || listLoading) && (
        <SectionCard title="Requests Received" count={received.length || null}>
          {listLoading ? (
            <div style={subText}>Loading…</div>
          ) : received.map(person => (
            <PersonRow
              key={person.friendship_id}
              person={person}
              actions={
                <>
                  <button
                    onClick={() => respond(person.friendship_id, 'accept')}
                    disabled={busyIds.has(person.friendship_id)}
                    style={primaryBtn(busyIds.has(person.friendship_id))}
                  >
                    {busyIds.has(person.friendship_id) ? '…' : 'Accept'}
                  </button>
                  <button
                    onClick={() => respond(person.friendship_id, 'decline')}
                    disabled={busyIds.has(person.friendship_id)}
                    style={ghostBtn()}
                  >
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
                <button
                  onClick={() => remove(person.friendship_id)}
                  disabled={busyIds.has(person.friendship_id)}
                  style={dangerBtn()}
                >
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
          <div style={subText}>Loading…</div>
        ) : friends.length === 0 ? (
          <div style={subText}>No friends yet. Search for other members above to get started.</div>
        ) : (
          friends.map(person => (
            <PersonRow
              key={person.friendship_id}
              person={person}
              actions={
                <button
                  onClick={() => remove(person.friendship_id)}
                  disabled={busyIds.has(person.friendship_id)}
                  style={dangerBtn()}
                >
                  {busyIds.has(person.friendship_id) ? '…' : 'Remove'}
                </button>
              }
            />
          ))
        )}
      </SectionCard>

      </>}

    </div>
  );
}
