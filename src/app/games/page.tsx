'use client';

import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { AVATARS } from '@/constants/avatars';
import { useEffect, useState } from 'react';
import { AdMobService } from '@/lib/admob';
import { BreakEndedModal } from '@/components/games/BreakEndedModal';

export default function GameHubPage() {
    const { state, extendBreak, isLoading } = useApp();
    const router = useRouter();
    const [showBreakModal, setShowBreakModal] = useState(false);



    const userAvatarItem = AVATARS.find(a => a.name === state.equippedAvatar);
    const userAvatarSrc = userAvatarItem ? userAvatarItem.filename : '/assets/idle.png';

    const GAMES = [
        {
            id: 'flappy',
            name: 'Flappy Buddies',
            description: 'Fly through the pipes!',
            emoji: '🐦',
            icon: '/icons/game_flappy.png',
            path: '/games/flappy',
            color: '#3498db'
        },
        {
            id: 'crossy-road',
            name: 'Buddy Cross',
            description: 'Why did the avatar cross the road?',
            emoji: '🛣️',
            icon: '/icons/game_crossy.png',
            path: '/games/crossy-road',
            color: '#2ecc71'
        },
        {
            id: '2048',
            name: '4096',
            description: 'Neon Edition: Join the numbers!',
            emoji: '🔢',
            icon: '/icons/game_2048.png',
            path: '/games/2048',
            color: '#f1c40f'
        }
    ];

    const [timeLeft, setTimeLeft] = useState(() => {
        if (state.breakTimer.endTime) {
            return Math.max(0, Math.ceil((state.breakTimer.endTime - Date.now()) / 1000));
        }
        return 0;
    });

    // Timer Logic
    useEffect(() => {
        const interval = setInterval(() => {
            if (state.breakTimer.endTime) {
                const diff = Math.ceil((state.breakTimer.endTime - Date.now()) / 1000);
                setTimeLeft(Math.max(0, diff));
            } else {
                setTimeLeft(0);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [state.breakTimer.endTime]);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    if (isLoading) return <div style={{ minHeight: '100vh', background: '#f5f5f5' }} />;

    return (
        <main className="container" style={{ padding: '24px', paddingTop: 'calc(env(safe-area-inset-top) + 24px)' }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button onClick={() => router.push('/study')} className="btn" style={{ background: '#f0f0f0', color: '#333', padding: '8px 16px', marginRight: '16px', fontSize: '0.9rem', borderRadius: '12px', fontWeight: 'bold' }}>
                        ← Back to Studying
                    </button>
                    <h1 className="text-h1" style={{ margin: 0 }}>Game Hub</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={() => router.push('/leaderboard')}
                        style={{
                            background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
                            color: '#1a1a1a',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontWeight: 'bold',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        🏆 Top 100
                    </button>
                    {state.breakTimer.isActive && (
                        <div style={{ background: timeLeft <= 0 ? '#e74c3c' : (timeLeft <= 30 ? '#e74c3c' : '#27ae60'), color: 'white', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold' }}>
                            {timeLeft <= 0 ? 'Break Over' : formatTime(timeLeft)}
                        </div>
                    )}
                </div>
            </header>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px', background: 'white', padding: '16px', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }}>
                <img src={userAvatarSrc} style={{ width: '60px', height: '60px', objectFit: 'contain', imageRendering: 'pixelated' }} />
                <div>
                    <h3 style={{ margin: 0 }}>Ready to play?</h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>Choose a game to unwind.</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                {GAMES.map(game => (
                    <div
                        key={game.id}
                        className="card"
                        onClick={() => {
                            // Enforce timer? Or allow peek?
                            // User said "Only get 5 mins combined".
                            // If timer <= 0, prevent play.
                            if (state.breakTimer.isActive && timeLeft <= 0) {
                                setShowBreakModal(true);
                                return;
                            }
                            router.push(game.path);
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            cursor: 'pointer',
                            background: `linear-gradient(135deg, ${game.color}22 0%, white 100%)`, // Light tint
                            borderLeft: `6px solid ${game.color}`,
                            opacity: (state.breakTimer.isActive && timeLeft <= 0) ? 0.5 : 1
                        }}
                    >
                        <div style={{ width: '96px', height: '96px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img src={game.icon} alt={game.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '1.2rem', margin: '0 0 4px 0', color: '#333' }}>{game.name}</h3>
                            <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>{game.description}</p>
                        </div>
                        <div style={{ fontSize: '1.5rem', color: game.color }}>→</div>
                    </div>
                ))}
            </div>

            {
                showBreakModal && (
                    <BreakEndedModal
                        canWatchAd={!state.breakTimer.hasClaimedAd}
                        onWatchAd={() => {
                            extendBreak(1);
                            setShowBreakModal(false);
                        }}
                        onExit={() => router.push('/study')}
                    />
                )
            }
        </main >
    );
}
