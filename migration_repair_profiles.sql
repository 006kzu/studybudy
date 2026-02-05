-- Repair Script: Ensure all Auth Users have a Profile
-- Run this if you have users "stuck" in a state where they exist in Auth but not in Profiles due to previous trigger failures.

INSERT INTO public.profiles (id, email, full_name, avatar_url)
SELECT 
    au.id, 
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', 'Student'),
    COALESCE(au.raw_user_meta_data->>'avatar_url', '')
FROM auth.users au
LEFT JOIN public.profiles pp ON pp.id = au.id
WHERE pp.id IS NULL;

-- Query to verify fix
SELECT COUNT(*) as fixed_profiles FROM public.profiles;
