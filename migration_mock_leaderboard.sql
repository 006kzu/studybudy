-- 1. Schema Updates (Idempotent)
-- Add display_name to profiles if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'display_name') THEN
        ALTER TABLE public.profiles ADD COLUMN display_name text;
    END IF;
END $$;

-- 2. RLS Updates for Leaderboard 
-- Allow anyone to read display_name, equipped_avatar, and points from profiles (for Leaderboard)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING (true);

-- Ensure game_scores table exists
CREATE TABLE IF NOT EXISTS public.game_scores (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    game_id text NOT NULL,
    score integer NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on game_scores
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read scores
DROP POLICY IF EXISTS "Scores are viewable by everyone" ON public.game_scores;
CREATE POLICY "Scores are viewable by everyone" 
ON public.game_scores FOR SELECT 
USING (true);

-- Allow users to insert their own scores
DROP POLICY IF EXISTS "Users can insert own scores" ON public.game_scores;
CREATE POLICY "Users can insert own scores" 
ON public.game_scores FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 3. Mock Data Insertion
-- Insert Fake Profiles
INSERT INTO public.profiles (id, points, equipped_avatar, is_onboarded, role, display_name)
VALUES
    ('00000000-0000-0000-0000-000000000001', 1500, 'Default Cat', true, 'student', 'StudyMaster99'),
    ('00000000-0000-0000-0000-000000000002', 2450, 'Golden Dog', true, 'student', 'ProReader'),
    ('00000000-0000-0000-0000-000000000003', 890, 'Default Dog', true, 'student', 'MathWhiz'),
    ('00000000-0000-0000-0000-000000000004', 3200, 'Cool Cat', true, 'student', 'TopScholar'),
    ('00000000-0000-0000-0000-000000000005', 120, 'Default Cat', true, 'student', 'NewbieLearner'),
    ('00000000-0000-0000-0000-000000000006', 5600, 'Robot Dog', true, 'student', 'BrainyPaws'),
    ('00000000-0000-0000-0000-000000000007', 900, 'Default Dog', true, 'student', 'QuizKing'),
    ('00000000-0000-0000-0000-000000000008', 4100, 'Wizard Cat', true, 'student', 'FocusNinja'),
    ('00000000-0000-0000-0000-000000000009', 1800, 'Ninja Dog', true, 'student', 'StudyBuddyUser'),
    ('00000000-0000-0000-0000-000000000010', 750, 'Default Cat', true, 'student', 'BookWorm')
ON CONFLICT (id) DO UPDATE 
SET display_name = EXCLUDED.display_name;

-- Insert Mock Scores
INSERT INTO public.game_scores (user_id, game_id, score, created_at)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'flappy-bird', 12, NOW() - INTERVAL '1 day'),
    ('00000000-0000-0000-0000-000000000002', 'flappy-bird', 45, NOW() - INTERVAL '2 days'),
    ('00000000-0000-0000-0000-000000000003', 'flappy-bird', 8, NOW() - INTERVAL '1 hour'),
    ('00000000-0000-0000-0000-000000000004', 'flappy-bird', 110, NOW() - INTERVAL '5 days'),
    ('00000000-0000-0000-0000-000000000006', 'flappy-bird', 205, NOW() - INTERVAL '1 week'),
    ('00000000-0000-0000-0000-000000000008', 'flappy-bird', 88, NOW() - INTERVAL '3 hours'),
    ('00000000-0000-0000-0000-000000000009', 'flappy-bird', 32, NOW() - INTERVAL '2 hours'),
    ('00000000-0000-0000-0000-000000000001', '2048', 2400, NOW() - INTERVAL '1 day'),
    ('00000000-0000-0000-0000-000000000002', '2048', 8400, NOW() - INTERVAL '2 days'),
    ('00000000-0000-0000-0000-000000000004', '2048', 16200, NOW() - INTERVAL '3 days'),
    ('00000000-0000-0000-0000-000000000005', '2048', 500, NOW() - INTERVAL '1 hour'),
    ('00000000-0000-0000-0000-000000000006', '2048', 32000, NOW() - INTERVAL '1 week')
ON CONFLICT DO NOTHING;
