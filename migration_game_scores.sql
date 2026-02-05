-- Create game_scores table to store individual game scores
CREATE TABLE IF NOT EXISTS game_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    game_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast leaderboard queries
CREATE INDEX IF NOT EXISTS idx_game_scores_game_score ON game_scores(game_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_game_scores_user ON game_scores(user_id);

-- Enable RLS
ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe to run multiple times)
DROP POLICY IF EXISTS "Anyone can view game scores" ON game_scores;
DROP POLICY IF EXISTS "Users can insert own scores" ON game_scores;
DROP POLICY IF EXISTS "Users can delete own scores" ON game_scores;

-- Everyone can read all scores (for leaderboard)
CREATE POLICY "Anyone can view game scores" ON game_scores
    FOR SELECT USING (true);

-- Users can insert their own scores
CREATE POLICY "Users can insert own scores" ON game_scores
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own scores
CREATE POLICY "Users can delete own scores" ON game_scores
    FOR DELETE USING (auth.uid() = user_id);
