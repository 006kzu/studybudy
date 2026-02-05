-- Add role column to profiles table if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'student';

-- Ensure is_onboarded exists as well (safety check)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_onboarded boolean DEFAULT false;

-- Update RLS policies to allow updating these columns
-- (Existing policies might already cover it, but good to be safe)
