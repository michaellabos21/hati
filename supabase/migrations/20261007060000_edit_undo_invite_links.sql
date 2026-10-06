-- Three additions:
--   1. The person who recorded an expense can edit it.
--   2. Either party to a payment can remove it (undo).
--   3. A group can have a shareable invite link.

-- ---------------------------------------------------------------------------
-- 1. Editing an expense
--
-- Only whoever recorded it, while still a member, and the payer must be a member. The deferred
-- check from the earlier migration still requires the splits to total the new amount.
-- ---------------------------------------------------------------------------
create policy expenses_update_own on public.expenses
  for update to authenticated
  using (
    created_by = (select auth.uid())
    and private.is_group_member(group_id, (select auth.uid()))
  )
  with check (
    created_by = (select auth.uid())
    and private.is_group_member(group_id, (select auth.uid()))
    and private.is_group_member(group_id, paid_by)
  );

-- An expense never moves to another group or changes who recorded it.
create function private.expenses_keep_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.group_id is distinct from old.group_id then
    raise exception 'An expense cannot be moved to another group.'
      using errcode = 'check_violation';
  end if;
  -- created_by may still become null when that person's account is deleted.
  if new.created_by is distinct from old.created_by and new.created_by is not null then
    raise exception 'The person who recorded an expense cannot be changed.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.expenses_keep_identity() from public;

create trigger expenses_keep_identity
  before update on public.expenses
  for each row execute function private.expenses_keep_identity();

-- Replacing the splits means removing the old ones first.
create policy expense_splits_delete_by_expense_creator on public.expense_splits
  for delete to authenticated
  using (
    private.is_expense_creator(expense_id)
    and private.is_group_member(private.expense_group(expense_id), (select auth.uid()))
  );

-- Rewrites an expense and its splits together. Runs as the caller, so every statement goes
-- through the policies above.
create function public.update_expense(
  p_expense_id uuid,
  p_description text,
  p_amount numeric,
  p_paid_by uuid,
  p_split_method text,
  p_splits jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.expenses
  set description = btrim(p_description),
      amount = p_amount,
      paid_by = p_paid_by,
      split_method = p_split_method
  where id = p_expense_id;

  if not found then
    raise exception 'Only the person who added this expense can edit it.'
      using errcode = 'check_violation';
  end if;

  delete from public.expense_splits where expense_id = p_expense_id;

  insert into public.expense_splits (expense_id, user_id, amount_owed)
  select p_expense_id, s.user_id, s.amount_owed
  from jsonb_to_recordset(p_splits) as s (user_id uuid, amount_owed numeric);
end;
$$;

revoke all on function public.update_expense(uuid, text, numeric, uuid, text, jsonb)
  from public, anon;
grant execute on function public.update_expense(uuid, text, numeric, uuid, text, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Undoing a payment
--
-- The payer or the payee can remove it, so a mistaken or untrue record can be corrected by
-- either side. Everyone in the group sees the balances change.
-- ---------------------------------------------------------------------------
create policy settlements_delete_by_party on public.settlements
  for delete to authenticated
  using (
    (select auth.uid()) in (from_user, to_user)
    and private.is_group_member(group_id, (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 3. Invite links
--
-- One link per group. Whoever opens it while signed in can choose to join, so consent is still
-- theirs. The token is a random uuid; members can replace it, and it expires.
-- ---------------------------------------------------------------------------
create table public.group_invite_links (
  token uuid primary key default gen_random_uuid(),
  group_id uuid not null unique references public.groups (id) on delete cascade,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

create index group_invite_links_created_by_idx on public.group_invite_links (created_by);

alter table public.group_invite_links enable row level security;
revoke all on public.group_invite_links from anon;

create policy group_invite_links_select_members on public.group_invite_links
  for select to authenticated
  using (private.is_group_member(group_id, (select auth.uid())));

create policy group_invite_links_insert_by_member on public.group_invite_links
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.is_group_member(group_id, (select auth.uid()))
  );

-- Removing the link turns it off; creating a new one gives a new token.
create policy group_invite_links_delete_by_member on public.group_invite_links
  for delete to authenticated
  using (private.is_group_member(group_id, (select auth.uid())));

-- What someone holding a link sees before deciding. Returns nothing for an unknown or expired
-- token, so tokens cannot be told apart from guesses.
create function public.get_invite_link(p_token uuid)
returns table (
  group_id uuid,
  group_name text,
  invited_by_name text,
  member_count integer,
  already_member boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.group_id,
    g.name,
    p.display_name,
    (select count(*)::integer from public.group_members m where m.group_id = l.group_id),
    private.is_group_member(l.group_id, (select auth.uid()))
  from public.group_invite_links l
  join public.groups g on g.id = l.group_id
  left join public.profiles p on p.id = l.created_by
  where l.token = p_token
    and l.expires_at > now()
    and (select auth.uid()) is not null;
$$;

revoke all on function public.get_invite_link(uuid) from public, anon;
grant execute on function public.get_invite_link(uuid) to authenticated;

create function public.join_group_with_link(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Log in to join this group.' using errcode = 'check_violation';
  end if;

  select group_id into target
  from public.group_invite_links
  where token = p_token and expires_at > now();

  if target is null then
    raise exception 'This invite link is no longer valid. Ask for a new one.'
      using errcode = 'check_violation';
  end if;

  insert into public.group_members (group_id, user_id)
  values (target, (select auth.uid()))
  on conflict do nothing;

  -- A personal invite to the same group is now redundant.
  delete from public.group_invites
  where group_id = target and invited_user = (select auth.uid());

  return target;
end;
$$;

revoke all on function public.join_group_with_link(uuid) from public, anon;
grant execute on function public.join_group_with_link(uuid) to authenticated;
