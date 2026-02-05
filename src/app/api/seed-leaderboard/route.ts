import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase Admin Client (Service Role needed to bypass RLS for creating users/rows if needed, 
// but since we are just inserting data, we might need to be careful about RLS. 
// However, assuming we can insert into profiles/games if we are authenticated or if policies allow 'public' inserts for testing.
// Actually, RLS usually blocks public inserts. 
// We will use the Service Role Key if available in env, or fall back to Anon.
// IMPORTANT: For this to work best, we should use SERVICE_ROLE key.
// Since I don't have the user's env vars, I will try to use the standard client 
// and assume standard open policies or that I can just insert valid data.
// Wait, 'profiles' usually requires an auth user id.
// We'll generate generic UIDs.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// Note: In a real scenario, we'd need the Service Key to bypass 'auth.uid() = id' checks.
// If this fails due to RLS, I'll need to ask the user to toggle RLS off temporarily or provide the Service Key.
// Let's TRY standard client first. If policies are "insert if user matches id", we can spoof it? No.
// Actually, most of my RLS policies likely allow "authenticated" users. We aren't authenticated here.
// I'll try to use a "SERVICE_ROLE" key pattern if it exists in their env, but I can't see it.
// ALTERNATIVE: I can create a button in the UI that the LOGGED IN user clicks, which triggers this.
// But that only creates data for THEM.
// TO create OTHER users, I effectively need admin access.
// Let's assume for a "demo app" the user has the service role key in `SUPABASE_SERVICE_ROLE_KEY`.

const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey);

const FAKE_NAMES = [
    'StudyWizard', 'CoolCat99', 'BookWorm_22', 'FocusMaster', 'ChillVibes',
    'PixelPioneer', 'CodeCruncher', 'Mathlete_X', 'HistoryBuff', 'ScienceOwl',
    'ArtisticSoul', 'MusicLover', 'GymRat101', 'CoffeeAddict', 'NightOwl_00'
];

const AVATARS = [
    'Default Dog', 'Golden', 'Frenchie', 'Dalmatian', 'Husky', 'Beagle'
];

export async function GET() {
    try {
        const results = [];

        // 1. Create Fake Profiles via Auth (Bypass RLS by being valid users)
        for (const name of FAKE_NAMES) {
            const email = `${name.toLowerCase()}_fake_${Date.now()}@example.com`;
            const password = 'fakeStartingPassword123!';

            // A. Sign Up User
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: name, avatar_url: AVATARS[Math.floor(Math.random() * AVATARS.length)] }
                }
            });

            if (authError || !authData.user) {
                console.error('Auth Error:', name, authError);
                continue;
            }

            const date = new Date();
            date.setDate(date.getDate() - daysAgo);

            await supabase.from('study_sessions').insert({
                user_id: fakeId,
                class_id: 'fake-class-id', // Schema might not strictly enforce FK if class table RLS is loose, or just use NULL if allowed
                duration_minutes: duration,
                created_at: date.toISOString(),
                points_earned: duration * 2
            });
        }

        // 3. Insert Game Scores
        const score = Math.floor(Math.random() * 35) + 5; // 5-40 score (Beatable!)
        await supabase.from('game_scores').insert({
            user_id: fakeId,
            game_id: 'flappy_bird',
            score: score,
            created_at: new Date().toISOString()
        });

        results.push({ name, score });
    }

        return NextResponse.json({ success: true, seeded: results });
} catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
}
}
