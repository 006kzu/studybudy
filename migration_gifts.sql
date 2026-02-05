-- Creates table for tracking gifts sent by parents to children
CREATE TABLE IF NOT EXISTS public.gifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_name TEXT,
    gift_type TEXT NOT NULL CHECK (gift_type IN ('coins', 'game_time')),
    amount INTEGER NOT NULL,
    redeemed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Anyone can create gifts" ON public.gifts;
DROP POLICY IF EXISTS "Users can view own gifts" ON public.gifts;
DROP POLICY IF EXISTS "Users can update own gifts" ON public.gifts;

-- Anyone can create a gift (no auth required for parents without account)
CREATE POLICY "Anyone can create gifts" ON public.gifts
    FOR INSERT WITH CHECK (true);

-- Users can view their own gifts
CREATE POLICY "Users can view own gifts" ON public.gifts
    FOR SELECT USING (auth.uid() = recipient_user_id);

-- Users can mark their own gifts as redeemed
CREATE POLICY "Users can update own gifts" ON public.gifts
    FOR UPDATE USING (auth.uid() = recipient_user_id);
