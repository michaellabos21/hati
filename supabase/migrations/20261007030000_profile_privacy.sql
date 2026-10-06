-- Wallet numbers are private to their owner (TASK 020, security review).
--
-- Members are added to groups by email without having to accept, so "people in my groups" is
-- not a set of people the user has chosen to trust. If group mates could read each other's
-- GCash and Maya numbers, anyone who knew an email address could create a group, add that
-- person and read their number.
--
-- The app never needs someone else's number: a payment reminder is written by the person being
-- paid and includes their own. So the columns are simply not readable through the table.
-- Group mates still see each other's name.

revoke select on public.profiles from authenticated;
grant select (id, display_name, avatar_url, created_at, updated_at)
  on public.profiles to authenticated;

-- The signed-in user's own profile, including the private columns.
create function public.get_my_profile()
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  gcash_number text,
  maya_number text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.avatar_url, p.gcash_number, p.maya_number
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;
