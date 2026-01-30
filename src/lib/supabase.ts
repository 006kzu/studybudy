import { createClient } from '@supabase/supabase-js';

// Use createClient for SPA/Static Export (uses LocalStorage, avoids Cookie/PKCE issues)
export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
        auth: {
            persistSession: true, // Auto-save session to localStorage
            autoRefreshToken: true,
            detectSessionInUrl: true // Helper for OAuth redirects
        }
    }
);
