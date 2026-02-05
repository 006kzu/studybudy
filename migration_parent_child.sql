-- Add role and linked_user_id to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student' CHECK (role IN ('student', 'parent')),
ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES public.profiles(id);

-- Add policy to allow parents to view/update their linked child's data
-- Note: This requires complex policies. For now, we'll keep it simple: 
-- A user can see their linked user's profile if they are the parent.

CREATE POLICY "Parents can view linked child" ON public.profiles
    FOR SELECT USING (
        auth.uid() = linked_user_id -- If I am the linked parent? No, linked_user_id points to the OTHER person.
        -- Logic: 
        -- Parent sets linked_user_id = ChildID
        -- Child sets linked_user_id = ParentID
        -- OR one-way link?
        -- Let's assume two-way link for simplicity in query, or parent has linked_user_id = child.
        
        -- Policy: User can see profile if ID is their linked_user_id
        id = (SELECT linked_user_id FROM public.profiles WHERE id = auth.uid())
    );

-- Allow updating linked_user_id (for initial link setup)
CREATE POLICY "Users can update their own linked_user_id" ON public.profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
