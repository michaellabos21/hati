-- Joining a group now needs the person's consent.
--
-- Before: any member could insert a group_members row for any user they could find by email,
-- then include that user in expenses. Someone could be put in a group, and assigned debts,
-- without agreeing to anything.
--
-- Now: a member sends an invite. Only the invited person can turn it into a membership, by
-- accepting. Expenses and payments already require everyone involved to be a member, so nobody
-- can be assigned a balance in a group they have not joined.

-- ---------------------------------------------------------------------------
-- Pending invites. Accepting or declining removes the row.
-- ---------------------------------------------------------------------------
create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  invited_user uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint group_invites_one_per_person unique (group_id, invited_user)
);

create index group_invites_invited_user_idx on public.group_invites (invited_user);
create index group_invites_invited_by_idx on public.group_invites (invited_by);

alter table public.group_invites enable row level security;
revoke all on public.group_invites from anon;

-- The invited person sees their invites; members see who is pending in their group.
create policy group_invites_select_involved on public.group_invites
  for select to authenticated
  using (
    invited_user = (select auth.uid())
    or private.is_group_member(group_id, (select auth.uid()))
  );

-- A member can invite someone who is not already in the group.
create policy group_invites_insert_by_member on public.group_invites
  for insert to authenticated
  with check (
    invited_by = (select auth.uid())
    and private.is_group_member(group_id, (select auth.uid()))
    and not private.is_group_member(group_id, invited_user)
  );

-- The invited person can decline; a member can withdraw an invite.
create policy group_invites_delete_involved on public.group_invites
  for delete to authenticated
  using (
    invited_user = (select auth.uid())
    or private.is_group_member(group_id, (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Membership can no longer be created directly through the API. It comes only from creating
-- a group (the existing trigger) or from accepting an invite (below).
-- ---------------------------------------------------------------------------
drop policy group_members_insert_by_member on public.group_members;

create function public.accept_group_invite(p_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.group_invites%rowtype;
begin
  select * into invite
  from public.group_invites
  where id = p_invite_id and invited_user = (select auth.uid());

  if not found then
    raise exception 'This invite is no longer available.' using errcode = 'check_violation';
  end if;

  insert into public.group_members (group_id, user_id)
  values (invite.group_id, invite.invited_user)
  on conflict do nothing;

  delete from public.group_invites where id = invite.id;

  return invite.group_id;
end;
$$;

revoke all on function public.accept_group_invite(uuid) from public, anon;
grant execute on function public.accept_group_invite(uuid) to authenticated;

-- What the invited person needs in order to decide: which group, who asked, how big it is.
-- They cannot read the group or its members until they accept, so this hands over just that.
create function public.get_my_invites()
returns table (
  id uuid,
  group_id uuid,
  group_name text,
  invited_by_name text,
  member_count integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    i.group_id,
    g.name,
    p.display_name,
    (select count(*)::integer from public.group_members m where m.group_id = i.group_id),
    i.created_at
  from public.group_invites i
  join public.groups g on g.id = i.group_id
  left join public.profiles p on p.id = i.invited_by
  where i.invited_user = (select auth.uid())
  order by i.created_at desc;
$$;

revoke all on function public.get_my_invites() from public, anon;
grant execute on function public.get_my_invites() to authenticated;

-- Pending invites for a group, with names, for its members.
create function public.get_group_invites(p_group_id uuid)
returns table (
  id uuid,
  invited_user uuid,
  display_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.invited_user, p.display_name, i.created_at
  from public.group_invites i
  join public.profiles p on p.id = i.invited_user
  where i.group_id = p_group_id
    and private.is_group_member(p_group_id, (select auth.uid()))
  order by i.created_at desc;
$$;

revoke all on function public.get_group_invites(uuid) from public, anon;
grant execute on function public.get_group_invites(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Leaving: a member who has never put any money into the group's records themselves can always
-- walk away, even if others have assigned them a share. Anyone who has paid for something,
-- recorded an expense or been part of a payment still has to settle up first.
-- ---------------------------------------------------------------------------
create or replace function private.prevent_leaving_unsettled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_own_activity boolean;
begin
  -- When the whole group is being deleted there is nothing left to settle.
  if not exists (select 1 from public.groups where id = old.group_id) then
    return old;
  end if;

  has_own_activity :=
    exists (
      select 1 from public.expenses
      where group_id = old.group_id
        and (paid_by = old.user_id or created_by = old.user_id)
    )
    or exists (
      select 1 from public.settlements
      where group_id = old.group_id
        and (from_user = old.user_id or to_user = old.user_id)
    );

  if has_own_activity and private.member_balance(old.group_id, old.user_id) <> 0 then
    raise exception 'Settle up before leaving this group.'
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;
