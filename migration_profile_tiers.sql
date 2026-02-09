-- Add profile columns for character tier credits (consumable)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tier_legendary_credits INTEGER DEFAULT 0;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tier_epic_credits INTEGER DEFAULT 0;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tier_rare_credits INTEGER DEFAULT 0;
