-- Add display_name column to profiles for leaderboard
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Drop existing policies first (safe to run multiple times)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles for leaderboard" ON public.profiles;

-- Recreate both policies:
-- 1. Users can view their own full profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- 2. Anyone can view minimal profile info for leaderboard (display_name, equipped_avatar)
-- Since RLS policies are OR'd together, this allows public read
CREATE POLICY "Anyone can view profiles for leaderboard" ON public.profiles
    FOR SELECT USING (true);
