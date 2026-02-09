-- Update gifts table to support character tier unlocks
-- This enables parents to gift character unlock tiers to students

-- Update gift_type constraint to include new character tier types
ALTER TABLE public.gifts 
DROP CONSTRAINT IF EXISTS gifts_gift_type_check;

ALTER TABLE public.gifts 
ADD CONSTRAINT gifts_gift_type_check 
CHECK (gift_type IN ('coins', 'game_time', 'character_legendary', 'character_epic', 'character_rare'));

-- Note: The sender_id column was added in migration_gifts_sender_id.sql
