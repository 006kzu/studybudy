'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { AVATARS } from '@/constants/avatars';

type GameScore = {
    username: string;
    score: number;
    avatar: string;
    rank: number;
};

type GameTab = '2048' | 'crossy-road' | 'flappy-bird';

const GAME_NAMES: Record<GameTab, string> = {
    '2048': '4096 Neon',
    'crossy-road': 'Buddy Cross',
    'flappy-bird': 'Flappy Buddies'
};

const GAME_ICONS: Record<GameTab, string> = {
    '2048': '/icons/game_2048.png',
    'crossy-road': '/icons/game_crossy.png',
    'flappy-bird': '/icons/game_flappy.png'
};

import { useRouter } from 'next/navigation';

export default function LeaderboardPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<GameTab>('2048');
    const [scores, setScores] = useState<GameScore[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLeaderboard = async () => {
        setLoading(true);
        try {
            // Get top 100 scores for the game
            const { data: scoreData, error: scoreError } = await supabase
                .from('game_scores')
                .select('user_id, score')
                .eq('game_id', activeTab)
                .order('score', { ascending: false })
                .limit(100);

            if (scoreError) throw scoreError;
            if (!scoreData || scoreData.length === 0) {
                setScores([]);
                setLoading(false);
                return;
            }

            // Get unique user IDs
            const userIds = [...new Set(scoreData.map(s => s.user_id))];

            // Fetch profile data for those users
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, display_name, equipped_avatar')
                .in('id', userIds);

            if (profileError) {
                console.warn('Error fetching profiles:', profileError);
            }

            // Create profile map
            const profileMap: Record<string, { display_name?: string; equipped_avatar?: string }> = {};
            profiles?.forEach(p => {
                profileMap[p.id] = { display_name: p.display_name, equipped_avatar: p.equipped_avatar };
            });

            // Format the data
            const formatted: GameScore[] = scoreData.map((s, idx) => {
                const profile = profileMap[s.user_id];
                const displayName = profile?.display_name || `Budy #${s.user_id.slice(0, 4).toUpperCase()}`;
                return {
                    username: displayName,
                    score: s.score,
                    avatar: profile?.equipped_avatar || 'Default Dog',
                    rank: idx + 1
                };
            });

            setScores(formatted);
        } catch (err) {
            console.error('Error fetching leaderboard:', err);
            setScores([]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchLeaderboard();
    }, [activeTab]);

    const getAvatarEmoji = (avatarName: string) => {
        if (avatarName.includes('Cat')) return '🐱';
        if (avatarName.includes('Dragon')) return '🐲';
        if (avatarName.includes('Unicorn')) return '🦄';
        if (avatarName.includes('Penguin')) return '🐧';
        if (avatarName.includes('Fox')) return '🦊';
        return '🐶';
    };

    const getRankStyle = (index: number): React.CSSProperties => {
        if (index === 0) return { background: 'linear-gradient(135deg, #ffd700, #ffaa00)', color: '#1a1a1a' };
        if (index === 1) return { background: 'linear-gradient(135deg, #c0c0c0, #a0a0a0)', color: '#1a1a1a' };
        if (index === 2) return { background: 'linear-gradient(135deg, #cd7f32, #b5651d)', color: '#fff' };
        return { background: 'transparent', color: '#fff' };
    };

    return (
        <main style={{
            minHeight: '100vh',
            background: '#09090b',
            padding: '20px',
            paddingTop: 'calc(env(safe-area-inset-top) + 20px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
            color: '#fff'
        }}>
            <header style={{ marginBottom: '24px', textAlign: 'center', position: 'relative' }}>
                <button
                    onClick={() => router.back()}
                    style={{
                        position: 'absolute',
                        left: '0',
                        top: '0',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.5rem',
                        color: '#fff',
                        padding: 0
                    }}
                >
                    ←
                </button>
                <h1 style={{
                    fontSize: '2.5rem',
                    margin: 0,
                    background: 'linear-gradient(135deg, #ffd700, #ff6b6b)',
                    WebkitTextFillColor: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px'
                }}>
                    <img src="/icons/leaderboard.png" alt="Leaderboard" style={{ width: '80px', height: '80px' }} />
                    Leaderboard
                </h1>
                <button
                    onClick={() => fetchLeaderboard()}
                    style={{
                        position: 'absolute',
                        right: '0',
                        top: '8px',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid #333',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '1.2rem'
                    }}
                >
                    🔄
                </button>
                <p style={{ color: '#888', marginTop: '8px' }}>Top 100 Players</p>
            </header>

            {/* Game Tabs */}
            <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '20px',
                overflowX: 'auto',
                paddingBottom: '8px'
            }}>
                {(['2048', 'crossy-road', 'flappy-bird'] as GameTab[]).map(game => (
                    <button
                        key={game}
                        onClick={() => setActiveTab(game)}
                        style={{
                            padding: '12px 20px',
                            borderRadius: '12px',
                            border: activeTab === game ? '2px solid #ffd700' : '1px solid #333',
                            background: activeTab === game ? 'rgba(255, 215, 0, 0.15)' : '#1a1a1a',
                            color: activeTab === game ? '#ffd700' : '#888',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            fontSize: '0.9rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <img src={GAME_ICONS[game]} alt={GAME_NAMES[game]} style={{ width: '32px', height: '32px', verticalAlign: 'middle', marginRight: '8px' }} />
                        {GAME_NAMES[game]}
                    </button>
                ))}
            </div>

            {/* Leaderboard List */}
            <div style={{
                background: '#1a1a1a',
                borderRadius: '16px',
                padding: '16px',
                border: '1px solid #333'
            }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                        Loading scores...
                    </div>
                ) : scores.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎮</div>
                        <p>No scores yet!</p>
                        <p style={{ fontSize: '0.9rem' }}>Be the first to play {GAME_NAMES[activeTab]}!</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {scores.map((entry, index) => (
                            <div
                                key={`${entry.rank}-${entry.username}`}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    ...getRankStyle(index),
                                    border: index < 3 ? 'none' : '1px solid #333'
                                }}
                            >
                                <span style={{
                                    fontSize: '1.2rem',
                                    fontWeight: 'bold',
                                    width: '40px',
                                    textAlign: 'center'
                                }}>
                                    {index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`}
                                </span>
                                <div style={{ fontSize: '1.8rem', marginRight: '12px' }}>
                                    {getAvatarEmoji(entry.avatar)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{
                                        fontWeight: 'bold',
                                        margin: 0,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>{entry.username}</p>
                                </div>
                                <div style={{
                                    fontWeight: 'bold',
                                    fontSize: '1.2rem',
                                    color: index < 3 ? 'inherit' : '#ffd700'
                                }}>
                                    {entry.score.toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
