-- HATI initial schema (TASK 003).
--
-- Money is stored as numeric(12,2) pesos; the app converts to integer centavos for arithmetic.
-- Row Level Security is enabled on every table here with no policies, so nothing is readable or
-- writable through the API until the policies in the next migration (TASK 004) are applied.

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current.
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  gcash_number text,
  maya_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length
    check (char_length(btrim(display_name)) between 1 and 60),
  constraint profiles_gcash_number_format
    check (gcash_number is null or gcash_number ~ '^(09|\+639)[0-9]{9}$'),
  constraint profiles_maya_number_format
    check (maya_number is null or maya_number ~ '^(09|\+639)[0-9]{9}$')
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  -- Kept as history only; a group outlives its creator's account.
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint groups_description_length
    check (description is null or char_length(description) <= 280)
);

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- group_members
-- ---------------------------------------------------------------------------
create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- "Which groups am I in?" The primary key already covers lookups by group.
create index group_members_user_id_idx on public.group_members (user_id);

-- ---------------------------------------------------------------------------
-- expenses
--
-- paid_by is ON DELETE RESTRICT: a profile that still appears in a group's money records cannot
-- be deleted, because removing it would silently change everyone else's balances.
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null,
  paid_by uuid not null references public.profiles (id) on delete restrict,
  created_by uuid references public.profiles (id) on delete set null,
  split_method text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_description_length
    check (char_length(btrim(description)) between 1 and 120),
  constraint expenses_amount_positive check (amount > 0),
  constraint expenses_split_method_valid check (split_method in ('equal', 'exact'))
);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

create index expenses_group_id_created_at_idx
  on public.expenses (group_id, created_at desc);
create index expenses_paid_by_idx on public.expenses (paid_by);
create index expenses_created_by_idx on public.expenses (created_by);

-- ---------------------------------------------------------------------------
-- expense_splits: what each participant owes for an expense.
-- ---------------------------------------------------------------------------
create table public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  amount_owed numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  constraint expense_splits_amount_owed_non_negative check (amount_owed >= 0),
  -- One split per participant per expense; also serves lookups by expense.
  constraint expense_splits_expense_user_unique unique (expense_id, user_id)
);

create index expense_splits_user_id_idx on public.expense_splits (user_id);

-- ---------------------------------------------------------------------------
-- settlements: a payment from one member to another.
-- ---------------------------------------------------------------------------
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  from_user uuid not null references public.profiles (id) on delete restrict,
  to_user uuid not null references public.profiles (id) on delete restrict,
  amount numeric(12, 2) not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint settlements_amount_positive check (amount > 0),
  constraint settlements_distinct_users check (from_user <> to_user)
);

create index settlements_group_id_created_at_idx
  on public.settlements (group_id, created_at desc);
create index settlements_from_user_idx on public.settlements (from_user);
create index settlements_to_user_idx on public.settlements (to_user);
create index settlements_created_by_idx on public.settlements (created_by);

-- ---------------------------------------------------------------------------
-- Row Level Security: on everywhere, deny by default until TASK 004 adds policies.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;
