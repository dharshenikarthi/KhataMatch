-- ==============================================================================
-- KHATAMATCH DATABASE SCHEMA, STORAGE & ROW LEVEL SECURITY POLICIES
-- ==============================================================================

-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Create tables

-- PROFILES Table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  shop_name text default '',
  preferred_language text default 'english' check (preferred_language in ('english', 'tamil', 'tanglish')),
  tone text default 'polite' check (tone in ('polite', 'friendly', 'firm')),
  created_at timestamptz default now() not null
);

-- LEDGER_ENTRIES Table
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  name_normalized text not null,
  amount numeric not null check (amount >= 0),
  entry_date date,
  type text default 'credit' check (type in ('credit', 'payment')),
  status text default 'active' check (status in ('active', 'struck_out', 'deleted')),
  confidence numeric default 1.0 check (confidence >= 0.0 and confidence <= 1.0),
  source_image_path text,
  confirmed boolean default false not null,
  created_at timestamptz default now() not null
);

-- PAYMENTS Table
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payer_name text not null,
  amount numeric not null check (amount > 0),
  paid_at timestamptz,
  reference text,
  raw_row jsonb,
  created_at timestamptz default now() not null
);

-- MATCHES Table
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  ledger_entry_id uuid references public.ledger_entries(id) on delete set null,
  match_type text not null check (match_type in ('exact', 'fuzzy', 'ambiguous', 'unmatched')),
  confidence numeric not null check (confidence >= 0.0 and confidence <= 1.0),
  reason text not null,
  user_confirmed boolean default false not null,
  created_at timestamptz default now() not null
);

-- REMINDERS Table
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  amount_due numeric not null check (amount_due >= 0),
  language text default 'english' check (language in ('english', 'tamil', 'tanglish')),
  tone text default 'polite' check (tone in ('polite', 'friendly', 'firm')),
  message text not null,
  status text default 'drafted' check (status in ('drafted', 'approved', 'sent', 'skipped')),
  created_at timestamptz default now() not null
);

-- REMINDER_HISTORY Table (Phase 11 Follow-up Management)
create table if not exists public.reminder_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  phone text,
  amount_due numeric not null check (amount_due >= 0),
  ledger_entry_ids uuid[] default '{}',
  message text not null,
  style text default 'friendly' check (style in ('friendly', 'professional', 'gentle', 'short')),
  language text default 'english' check (language in ('english', 'tamil', 'tanglish')),
  status text default 'draft' check (status in ('draft', 'copied', 'opened_in_whatsapp', 'follow_up', 'archived')),
  next_follow_up_at timestamptz,
  notes text default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- EVAL_RUNS Table
create table if not exists public.eval_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now() not null,
  extraction_accuracy numeric not null,
  match_accuracy numeric not null,
  n_cases integer not null
);

-- 3. Create Indexes for query performance
create index if not exists idx_ledger_entries_user_id on public.ledger_entries(user_id);
create index if not exists idx_ledger_entries_status on public.ledger_entries(status);
create index if not exists idx_payments_user_id on public.payments(user_id);
create index if not exists idx_matches_user_id on public.matches(user_id);
create index if not exists idx_matches_payment_id on public.matches(payment_id);
create index if not exists idx_matches_ledger_id on public.matches(ledger_entry_id);
create index if not exists idx_reminders_user_id on public.reminders(user_id);
create index if not exists idx_reminders_status on public.reminders(status);
create index if not exists idx_reminder_history_user_id on public.reminder_history(user_id);
create index if not exists idx_reminder_history_status on public.reminder_history(status);
create index if not exists idx_reminder_history_followup on public.reminder_history(next_follow_up_at);

-- 4. Enable Row Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.payments enable row level security;
alter table public.matches enable row level security;
alter table public.reminders enable row level security;
alter table public.reminder_history enable row level security;
alter table public.eval_runs enable row level security;

-- 5. Define Row Level Security Policies

-- PROFILES Policies
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- LEDGER_ENTRIES Policies
drop policy if exists "Users can select own ledger entries" on public.ledger_entries;
create policy "Users can select own ledger entries"
  on public.ledger_entries for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own ledger entries" on public.ledger_entries;
create policy "Users can insert own ledger entries"
  on public.ledger_entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own ledger entries" on public.ledger_entries;
create policy "Users can update own ledger entries"
  on public.ledger_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own ledger entries" on public.ledger_entries;
create policy "Users can delete own ledger entries"
  on public.ledger_entries for delete
  using (auth.uid() = user_id);

-- PAYMENTS Policies
drop policy if exists "Users can select own payments" on public.payments;
create policy "Users can select own payments"
  on public.payments for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own payments" on public.payments;
create policy "Users can insert own payments"
  on public.payments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own payments" on public.payments;
create policy "Users can update own payments"
  on public.payments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own payments" on public.payments;
create policy "Users can delete own payments"
  on public.payments for delete
  using (auth.uid() = user_id);

-- MATCHES Policies
drop policy if exists "Users can select own matches" on public.matches;
create policy "Users can select own matches"
  on public.matches for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own matches" on public.matches;
create policy "Users can insert own matches"
  on public.matches for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own matches" on public.matches;
create policy "Users can update own matches"
  on public.matches for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own matches" on public.matches;
create policy "Users can delete own matches"
  on public.matches for delete
  using (auth.uid() = user_id);

-- REMINDERS Policies
drop policy if exists "Users can select own reminders" on public.reminders;
create policy "Users can select own reminders"
  on public.reminders for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own reminders" on public.reminders;
create policy "Users can insert own reminders"
  on public.reminders for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own reminders" on public.reminders;
create policy "Users can update own reminders"
  on public.reminders for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own reminders" on public.reminders;
create policy "Users can delete own reminders"
  on public.reminders for delete
  using (auth.uid() = user_id);

-- REMINDER_HISTORY Policies
drop policy if exists "Users can select own reminder history" on public.reminder_history;
create policy "Users can select own reminder history"
  on public.reminder_history for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own reminder history" on public.reminder_history;
create policy "Users can insert own reminder history"
  on public.reminder_history for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own reminder history" on public.reminder_history;
create policy "Users can update own reminder history"
  on public.reminder_history for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own reminder history" on public.reminder_history;
create policy "Users can delete own reminder history"
  on public.reminder_history for delete
  using (auth.uid() = user_id);

-- EVAL_RUNS Policies
drop policy if exists "Authenticated users can select eval runs" on public.eval_runs;
create policy "Authenticated users can select eval runs"
  on public.eval_runs for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert eval runs" on public.eval_runs;
create policy "Authenticated users can insert eval runs"
  on public.eval_runs for insert
  with check (auth.role() = 'authenticated');

-- 6. Automatic Profile Creation Trigger on Signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, shop_name, preferred_language, tone)
  values (new.id, '', 'english', 'polite')
  on conflict (id) do nothing;
  return new;
exception
  when others then
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7. Supabase Storage Setup & Private Storage RLS
-- Creates the private 'ledger-images' bucket
insert into storage.buckets (id, name, public)
values ('ledger-images', 'ledger-images', false)
on conflict (id) do update set public = false;

-- Storage RLS: Users can only upload and read files in their own user_id folder: <user_id>/<filename>
drop policy if exists "Users can upload own ledger images" on storage.objects;
create policy "Users can upload own ledger images"
  on storage.objects for insert
  with check (
    bucket_id = 'ledger-images' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can view own ledger images" on storage.objects;
create policy "Users can view own ledger images"
  on storage.objects for select
  using (
    bucket_id = 'ledger-images' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own ledger images" on storage.objects;
create policy "Users can update own ledger images"
  on storage.objects for update
  using (
    bucket_id = 'ledger-images' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own ledger images" on storage.objects;
create policy "Users can delete own ledger images"
  on storage.objects for delete
  using (
    bucket_id = 'ledger-images' and
    (storage.foldername(name))[1] = auth.uid()::text
  );
