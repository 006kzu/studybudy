-- Add sender_id to gifts table to track which parent sent the gift
-- This enables "First gift of the day is Free" logic

ALTER TABLE public.gifts 
ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_gifts_sender_created 
ON public.gifts(sender_id, created_at DESC);
