-- FIX INFINITE RECURSION IN RLS POLICIES
-- The previous policy for profiles queried itself, causing infinite recursion.
-- Solution: Use a SECURITY DEFINER function to bypass RLS when looking up the linked child.

-- 1. Create Helper Function (Bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_my_linked_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT linked_user_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. Update PROFILES Policy
DROP POLICY IF EXISTS "Users can view own profile or linked child" ON public.profiles;

CREATE POLICY "Users can view own profile or linked child" ON public.profiles
    FOR SELECT USING (
        -- I can see my own profile
        auth.uid() = id 
        OR 
        -- I can see the profile of the user I am linked to (Child)
        id = public.get_my_linked_user_id()
    );

-- 3. Update CLASSES Policy (Use the function for consistency/performance)
DROP POLICY IF EXISTS "Classes: Select Own or Linked Child" ON public.classes;

CREATE POLICY "Classes: Select Own or Linked Child" ON public.classes
    FOR SELECT USING (
        auth.uid() = user_id 
        OR 
        user_id = public.get_my_linked_user_id()
    );

-- 4. Update STUDY SESSIONS Policy
DROP POLICY IF EXISTS "Sessions: Select Own or Linked Child" ON public.study_sessions;

CREATE POLICY "Sessions: Select Own or Linked Child" ON public.study_sessions
    FOR SELECT USING (
        auth.uid() = user_id 
        OR 
        user_id = public.get_my_linked_user_id()
    );

-- 5. Update GIFTS Policies to use the function
DROP POLICY IF EXISTS "Gifts: Insert" ON public.gifts;
CREATE POLICY "Gifts: Insert" ON public.gifts
    FOR INSERT WITH CHECK (
        recipient_user_id = public.get_my_linked_user_id()
    );

-- Note: No changes needed for "Gifts: View Own" (auth.uid() = recipient_user_id)
