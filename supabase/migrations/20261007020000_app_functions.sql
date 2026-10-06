-- HATI server-side rules the app relies on (TASK 005-014).
--
--   1. A profile is created automatically for every new auth user.
--   2. Members are found by exact email through a narrow lookup function.
--   3. An expense and its splits are written together, and must add up.
--   4. A member cannot leave a group while they still owe or are owed money.

-- ---------------------------------------------------------------------------
-- 1. Profile on sign-up.
--
-- The display name comes from the sign-up metadata. It is sanitised here because a failure in
-- this trigger would block the sign-up itself.
-- ---------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text;
begin
  name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if name = '' then
    name := btrim(split_part(coalesce(new.email, ''), '@', 1));
  end if;
  if name = '' then
    name := 'Kaibigan';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, left(name, 60))
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Find a user to add to a group.
--
-- Exact, case-insensitive email match only, and only for signed-in users, so it cannot be used
-- to browse or partially guess accounts. Returns just the id and display name.
-- ---------------------------------------------------------------------------
create function public.find_user_by_email(search_email text)
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name
  from auth.users u
  join public.profiles p on p.id = u.id
  where (select auth.uid()) is not null
    and lower(u.email) = lower(btrim(search_email))
  limit 1;
$$;

revoke all on function public.find_user_by_email(text) from public, anon;
grant execute on function public.find_user_by_email(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Expenses and their splits.
--
-- create_expense runs as the caller, so every insert still goes through Row Level Security.
-- ---------------------------------------------------------------------------
create function public.create_expense(
  p_group_id uuid,
  p_description text,
  p_amount numeric,
  p_paid_by uuid,
  p_split_method text,
  p_splits jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  insert into public.expenses (group_id, description, amount, paid_by, split_method)
  values (p_group_id, btrim(p_description), p_amount, p_paid_by, p_split_method)
  returning id into new_id;

  insert into public.expense_splits (expense_id, user_id, amount_owed)
  select new_id, s.user_id, s.amount_owed
  from jsonb_to_recordset(p_splits) as s (user_id uuid, amount_owed numeric);

  return new_id;
end;
$$;

revoke all on function public.create_expense(uuid, text, numeric, uuid, text, jsonb)
  from public, anon;
grant execute on function public.create_expense(uuid, text, numeric, uuid, text, jsonb)
  to authenticated;

-- Checked at commit, so it holds however the rows were written: an expense must have at least
-- one split, the splits must total the expense exactly, and an equal split may differ between
-- people only by the leftover centavo.
create function private.check_expense_splits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  expense public.expenses%rowtype;
  split_total numeric;
  split_count integer;
  split_spread numeric;
begin
  if tg_table_name = 'expenses' then
    target := new.id;
  elsif tg_op = 'DELETE' then
    target := old.expense_id;
  else
    target := new.expense_id;
  end if;

  select * into expense from public.expenses where id = target;
  if not found then
    -- The expense itself was deleted; its splits went with it.
    return null;
  end if;

  select coalesce(sum(amount_owed), 0), count(*), coalesce(max(amount_owed) - min(amount_owed), 0)
  into split_total, split_count, split_spread
  from public.expense_splits
  where expense_id = target;

  if split_count = 0 then
    raise exception 'An expense needs at least one person to split with.'
      using errcode = 'check_violation';
  end if;
  if split_total <> expense.amount then
    raise exception 'Splits total % but the expense is %.', split_total, expense.amount
      using errcode = 'check_violation';
  end if;
  if expense.split_method = 'equal' and split_spread > 0.01 then
    raise exception 'An equal split must give everyone the same share.'
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

revoke all on function private.check_expense_splits() from public;

create constraint trigger expenses_splits_must_total
  after insert or update of amount, split_method on public.expenses
  deferrable initially deferred
  for each row execute function private.check_expense_splits();

create constraint trigger expense_splits_must_total
  after insert or update or delete on public.expense_splits
  deferrable initially deferred
  for each row execute function private.check_expense_splits();

-- ---------------------------------------------------------------------------
-- 4. Leaving a group.
-- ---------------------------------------------------------------------------
create function private.member_balance(target_group uuid, target_user uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((
      select sum(amount) from public.expenses
      where group_id = target_group and paid_by = target_user
    ), 0)
    - coalesce((
      select sum(s.amount_owed)
      from public.expense_splits s
      join public.expenses e on e.id = s.expense_id
      where e.group_id = target_group and s.user_id = target_user
    ), 0)
    + coalesce((
      select sum(amount) from public.settlements
      where group_id = target_group and from_user = target_user
    ), 0)
    - coalesce((
      select sum(amount) from public.settlements
      where group_id = target_group and to_user = target_user
    ), 0);
$$;

revoke all on function private.member_balance(uuid, uuid) from public;

create function private.prevent_leaving_unsettled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- When the whole group is being deleted there is nothing left to settle.
  if not exists (select 1 from public.groups where id = old.group_id) then
    return old;
  end if;

  if private.member_balance(old.group_id, old.user_id) <> 0 then
    raise exception 'Settle up before leaving this group.'
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

revoke all on function private.prevent_leaving_unsettled() from public;

create trigger group_members_prevent_leaving_unsettled
  before delete on public.group_members
  for each row execute function private.prevent_leaving_unsettled();
