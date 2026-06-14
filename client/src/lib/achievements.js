/*
  ─── SQL — run once in Supabase SQL editor ────────────────────────────────────

  create table user_achievements (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    achievement_id text not null,
    unlocked_at timestamptz not null default now(),
    unique(user_id, achievement_id)
  );
  alter table user_achievements enable row level security;
  create policy "achievements_all" on user_achievements
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  grant all on user_achievements to authenticated;

  create table user_xp (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade unique,
    total_xp int not null default 0,
    updated_at timestamptz not null default now()
  );
  alter table user_xp enable row level security;
  create policy "xp_all" on user_xp
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  grant all on user_xp to authenticated;

  -- RPC used by unlockAchievement to atomically add XP
  create or replace function add_xp(p_user_id uuid, p_amount int)
  returns void language plpgsql as $$
  begin
    insert into user_xp (user_id, total_xp)
    values (p_user_id, p_amount)
    on conflict (user_id) do update
    set total_xp = user_xp.total_xp + p_amount,
        updated_at = now();
  end;
  $$;

  ─────────────────────────────────────────────────────────────────────────────
*/

/**
 * Upsert an achievement row and atomically credit XP.
 * Safe to call multiple times — the unique constraint + ignoreDuplicates
 * means XP is only awarded on the first unlock.
 */
export async function unlockAchievement(supabase, userId, achievementId, xpAmount) {
  const { error } = await supabase
    .from('user_achievements')
    .upsert(
      { user_id: userId, achievement_id: achievementId },
      { onConflict: 'user_id,achievement_id', ignoreDuplicates: true }
    );
  if (!error) {
    await supabase.rpc('add_xp', { p_user_id: userId, p_amount: xpAmount });
  }
}

/**
 * Returns true if the log array contains at least `n` consecutive calendar days.
 * Logs must have a `logged_at` timestamptz field.
 */
export function hasConsecutiveDays(logs, n) {
  if (!logs || logs.length < n) return false;
  const dates = [...new Set(
    logs.map(l => new Date(l.logged_at).toISOString().split('T')[0])
  )].sort();
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
    if (diff === 1) {
      if (++streak >= n) return true;
    } else {
      streak = 1;
    }
  }
  return false;
}
