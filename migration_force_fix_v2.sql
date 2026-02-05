-- Force Repair RLS & Hardened Trigger
-- Drop policies to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Recreate Policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Hardened Trigger Function (Handles missing name/avatar)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'New Student'), 
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''), 
    new.email
  );
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block user creation if strictly ID/Email are enough?
  -- Actually, profile creation is critical.
  -- But we can fallback to minimal insert
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, 'Fallback Student');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rebind trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
