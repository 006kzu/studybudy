-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES (Extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  points integer default 0,
  inventory text[], -- Array of strings for item names
  equipped_avatar text default 'Default Dog',
  sleep_settings jsonb default '{"enabled": false, "start": "22:00", "end": "06:00"}'::jsonb,
  is_onboarded boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS for Profiles
alter table public.profiles enable row level security;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;

create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Trigger to create profile on signup (idempotent)
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to avoid duplication errors on multiple runs (optional but safe)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. CLASSES
create table if not exists public.classes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  weekly_goal_minutes integer default 120,
  color text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS for Classes
alter table public.classes enable row level security;
-- Drop existing generic policy
drop policy if exists "Users can CRUD own classes" on public.classes;

-- Explicit Policies
create policy "Classes: Select Own" on public.classes for select using (auth.uid() = user_id);
create policy "Classes: Insert Own" on public.classes for insert with check (auth.uid() = user_id);
create policy "Classes: Update Own" on public.classes for update using (auth.uid() = user_id);
create policy "Classes: Delete Own" on public.classes for delete using (auth.uid() = user_id);


-- 3. SCHEDULE ITEMS
create table if not exists public.schedule_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  day text not null, 
  start_time text not null, 
  end_time text not null, 
  type text not null, 
  label text,
  class_id uuid references public.classes(id) on delete cascade,
  is_recurring boolean default true,
  specific_date date, 
  start_date date, 
  color text, 
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS for Schedule Items
alter table public.schedule_items enable row level security;
drop policy if exists "Users can CRUD own schedule" on public.schedule_items;

create policy "Schedule: Select Own" on public.schedule_items for select using (auth.uid() = user_id);
create policy "Schedule: Insert Own" on public.schedule_items for insert with check (auth.uid() = user_id);
create policy "Schedule: Update Own" on public.schedule_items for update using (auth.uid() = user_id);
create policy "Schedule: Delete Own" on public.schedule_items for delete using (auth.uid() = user_id);


-- 4. STUDY SESSIONS
create table if not exists public.study_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  class_id uuid references public.classes(id) on delete set null,
  duration_minutes integer not null,
  points_earned integer default 0,
  timestamp bigint, 
  session_timestamp bigint, 
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS for Study Sessions
alter table public.study_sessions enable row level security;
drop policy if exists "Users can CRUD own sessions" on public.study_sessions;

create policy "Sessions: Select Own" on public.study_sessions for select using (auth.uid() = user_id);
create policy "Sessions: Insert Own" on public.study_sessions for insert with check (auth.uid() = user_id);
create policy "Sessions: Update Own" on public.study_sessions for update using (auth.uid() = user_id);
create policy "Sessions: Delete Own" on public.study_sessions for delete using (auth.uid() = user_id);
