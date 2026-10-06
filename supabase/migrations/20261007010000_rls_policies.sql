-- HATI Row Level Security policies (TASK 004).
--
-- Access model: everything is scoped to group membership. Only signed-in users (the
-- `authenticated` role) get any access; `anon` gets none. Anything without a policy below
-- (for example updating an expense or deleting a group) is denied.

-- ---------------------------------------------------------------------------
-- Helper functions.
--
-- These live in a `private` schema, which the API does not expose, so they cannot be called as
-- RPCs. They are SECURITY DEFINER so that policies can check membership without recursing into
-- the policies on group_members itself.
-- ---------------------------------------------------------------------------
create schema private;

create function private.is_group_member(target_group uuid, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = target_group and user_id = target_user
  );
$$;

create function private.shares_group_with(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = target_user
  );
$$;

-- The group an expense belongs to, for policies on expense_splits.
create function private.expense_group(target_expense uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select group_id from public.expenses where id = target_expense;
$$;

create function private.is_expense_creator(target_expense uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.expenses
    where id = target_expense and created_by = (select auth.uid())
  );
$$;

revoke all on schema private from public;
revoke all on all functions in schema private from public;
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------
-- No access for signed-out users.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Record who created a row from the session, not from client input.
-- ---------------------------------------------------------------------------
alter table public.groups alter column created_by set default auth.uid();
alter table public.expenses alter column created_by set default auth.uid();
alter table public.settlements alter column created_by set default auth.uid();

-- A group's creator becomes its first member. Done here rather than by the client so a group
-- can never exist without the person who made it being able to see it.
create function private.add_creator_as_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.group_members (group_id, user_id)
    values (new.id, new.created_by);
  end if;
  return new;
end;
$$;

revoke all on function private.add_creator_as_member() from public;

create trigger groups_add_creator_as_member
  after insert on public.groups
  for each row execute function private.add_creator_as_member();

-- ---------------------------------------------------------------------------
-- profiles
-- Visible to yourself and to people you share a group with (this is what scopes GCash/Maya
-- numbers to group contexts). Only you can create or edit your own profile.
-- ---------------------------------------------------------------------------
create policy profiles_select_self_or_group_mates on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_group_with(id));

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- groups
-- The creator clause on select lets `insert ... returning` work, since the membership row is
-- added by a trigger after the insert's own visibility check.
-- ---------------------------------------------------------------------------
create policy groups_select_members on public.groups
  for select to authenticated
  using (
    private.is_group_member(id, (select auth.uid()))
    or created_by = (select auth.uid())
  );

create policy groups_insert_as_creator on public.groups
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy groups_update_creator on public.groups
  for update to authenticated
  using (
    created_by = (select auth.uid())
    and private.is_group_member(id, (select auth.uid()))
  )
  with check (created_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- group_members
-- Members see the member list and can add people. You can only remove yourself (leave).
-- ---------------------------------------------------------------------------
create policy group_members_select_members on public.group_members
  for select to authenticated
  using (private.is_group_member(group_id, (select auth.uid())));

create policy group_members_insert_by_member on public.group_members
  for insert to authenticated
  with check (private.is_group_member(group_id, (select auth.uid())));

create policy group_members_delete_self on public.group_members
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- expenses
-- Members read. A member can add an expense paid by any current member. Only the person who
-- recorded an expense can delete it, and only while still in the group.
-- ---------------------------------------------------------------------------
create policy expenses_select_members on public.expenses
  for select to authenticated
  using (private.is_group_member(group_id, (select auth.uid())));

create policy expenses_insert_by_member on public.expenses
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.is_group_member(group_id, (select auth.uid()))
    and private.is_group_member(group_id, paid_by)
  );

create policy expenses_delete_own on public.expenses
  for delete to authenticated
  using (
    created_by = (select auth.uid())
    and private.is_group_member(group_id, (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- expense_splits
-- Readable by the expense's group. Only the expense's creator can add splits, and only for
-- current members of that group. Splits are removed by deleting the expense.
-- ---------------------------------------------------------------------------
create policy expense_splits_select_members on public.expense_splits
  for select to authenticated
  using (
    private.is_group_member(private.expense_group(expense_id), (select auth.uid()))
  );

create policy expense_splits_insert_by_expense_creator on public.expense_splits
  for insert to authenticated
  with check (
    private.is_expense_creator(expense_id)
    and private.is_group_member(private.expense_group(expense_id), (select auth.uid()))
    and private.is_group_member(private.expense_group(expense_id), user_id)
  );

-- ---------------------------------------------------------------------------
-- settlements
-- Members read. A payment can only be recorded by its payer or its payee, between two current
-- members. Settlements are history: no update or delete.
-- ---------------------------------------------------------------------------
create policy settlements_select_members on public.settlements
  for select to authenticated
  using (private.is_group_member(group_id, (select auth.uid())));

create policy settlements_insert_by_party on public.settlements
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select auth.uid()) in (from_user, to_user)
    and private.is_group_member(group_id, from_user)
    and private.is_group_member(group_id, to_user)
  );
