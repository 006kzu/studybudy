'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

type LeaderboardEntry = {
    username: string; // or email
    points: number;
    avatar: string;
};

export default function LeaderboardPage() {
    const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('points, equipped_avatar, id')
                .order('points', { ascending: false })
                .limit(10);

            if (error) {
                console.error('Error fetching leaderboard:', error);
            } else {
                // Map to display format (we don't have usernames yet, so we'll use "User X" or email if we joined it)
                // For now, let's just show "Study Buddy" + last 4 of ID
                const formatted = data.map(p => ({
                    username: `Budy #${p.id.slice(0, 4)}`,
                    points: p.points,
                    avatar: p.equipped_avatar || 'Default Dog'
                }));
                setLeaders(formatted);
            }
            setLoading(false);
        };

        fetchLeaderboard();
    }, []);

    return (
        <main className="container" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
            <header style={{ marginBottom: '24px', textAlign: 'center' }}>
                <Link href="/dashboard" style={{ float: 'left', textDecoration: 'none', fontSize: '1.5rem' }}>🔙</Link>
                <h1 className="text-h1">Top Dogs 🏆</h1>
                <p className="text-body" style={{ color: '#666' }}>Who has the longest streak?</p>
            </header>

            <section className="card">
                {loading ? (
                    <p className="text-center">Loading scores...</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {leaders.length === 0 && <p className="text-center">No scores yet!</p>}
                        {leaders.map((leader, index) => (
                            <div key={index} style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '12px',
                                background: index === 0 ? '#fff9c4' : index === 1 ? '#f5f5f5' : index === 2 ? '#ffe0b2' : 'transparent',
                                borderRadius: '12px',
                                border: '1px solid var(--color-border)'
                            }}>
                                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', width: '30px', color: '#666' }}>#{index + 1}</span>
                                <div style={{ fontSize: '2rem', marginRight: '16px' }}>
                                    {/* Simple mapping for now, ideally use the WienerAvatar logic */}
                                    🐶
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontWeight: 'bold' }}>{leader.username}</p>
                                    <p style={{ fontSize: '0.8rem', color: '#666' }}>{leader.avatar}</p>
                                </div>
                                <div style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
                                    {leader.points} pts
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}
