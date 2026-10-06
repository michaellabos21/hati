-- Premium is not for sale yet. This records who tapped "Try Premium", so demand can be counted
-- before anything is built or charged for. One row per person.

create table public.premium_interest (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.premium_interest enable row level security;
revoke all on public.premium_interest from anon;

-- People can register and see only their own interest. Nobody can read the list through the
-- API; count it from the Supabase dashboard:  select count(*) from public.premium_interest;
create policy premium_interest_select_own on public.premium_interest
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy premium_interest_insert_own on public.premium_interest
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy premium_interest_delete_own on public.premium_interest
  for delete to authenticated
  using (user_id = (select auth.uid()));
