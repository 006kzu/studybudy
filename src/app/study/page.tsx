'use client';

import { useApp } from '@/context/AppContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { AVATARS } from '@/constants/avatars';

// Random name generator for opponents
const BOT_NAMES = ['Speedy', 'Noodle', 'Frankie', 'Sausage', 'Chip'];

export default function StudyPage() {
    const { state, recordSession } = useApp();
    const searchParams = useSearchParams();
    const router = useRouter();

    const classId = searchParams.get('classId');
    const [seconds, setSeconds] = useState(0);
    const [isActive, setIsActive] = useState(true);
    const [finished, setFinished] = useState(false);

    // Race State
    const [userPos, setUserPos] = useState(0); // 0 to 100%
    const [bots, setBots] = useState<{ name: string, pos: number, speed: number }[]>([]);

    const raceInterval = useRef<NodeJS.Timeout | null>(null);

    const targetClass = state.classes.find(c => c.id === classId);

    // Get User Avatar
    const userAvatarItem = AVATARS.find(a => a.name === state.equippedAvatar);
    const userAvatarSrc = userAvatarItem ? userAvatarItem.filename : '/assets/run.png';

    // Initialize Bots
    useEffect(() => {
        setBots([
            { name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)], pos: 0, speed: 0.5 + Math.random() * 0.3 },
            { name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)], pos: 0, speed: 0.5 + Math.random() * 0.3 }
        ]);
    }, []);

    // Timer Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isActive && !finished) {
            interval = setInterval(() => {
                setSeconds((s) => s + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isActive, finished]);

    // Race Logic
    useEffect(() => {
        if (!finished) {
            raceInterval.current = setInterval(() => {
                if (isActive) {
                    setUserPos(p => p + 0.1);
                }
                setBots(prev => prev.map(bot => ({
                    ...bot,
                    pos: bot.pos + (bot.speed * 0.1) + (Math.random() * 0.05 - 0.025)
                })));
            }, 100);
        }
        return () => clearInterval(raceInterval.current as NodeJS.Timeout);
    }, [isActive, finished]);

    const toggleTimer = () => {
        setIsActive(!isActive);
    };

    const endSession = () => {
        setIsActive(false);
        setFinished(true);

        // Calculate Winner
        const userScore = userPos;
        const isWinner = bots.every(b => userScore > b.pos);

        // Award Points: 
        // 1. Time based: 1 point per second
        // 2. Bonus: 100 points for completing the session
        const timePoints = seconds;
        const bonusPoints = 100;
        const totalPoints = timePoints + bonusPoints;

        if (targetClass) {
            // Save
            recordSession({
                id: crypto.randomUUID(),
                classId: targetClass.id,
                durationMinutes: Math.ceil(seconds / 60),
                timestamp: Date.now(),
                pointsEarned: totalPoints
            });

            // Redirect to Dashboard with popup trigger
            router.push(`/dashboard?earned=${totalPoints}&winner=${isWinner}`);
        } else {
            router.push('/dashboard');
        }
    };

    if (!targetClass) return <div className="container">Class not found</div>;

    const formatTime = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <main className="container" style={{ maxWidth: '100vw', padding: 0, overflow: 'hidden' }}>
            {/* Header Info */}
            <div style={{ padding: '24px', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
                <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.9 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={endSession} className="btn" style={{ background: 'var(--color-error)', color: 'white', padding: '8px 16px', fontSize: '0.9rem' }}>
                            End Race
                        </button>
                        <div>
                            <h2 className="text-h2" style={{ margin: 0, fontSize: '1.2rem' }}>{targetClass.name}</h2>
                            <p className="text-body" style={{ margin: 0, fontSize: '0.8rem' }}>Studying...</p>
                        </div>
                    </div>
                    <div className="text-h1" style={{ fontFamily: 'monospace', margin: 0 }}>
                        {formatTime(seconds)}
                    </div>
                </div>
            </div>

            {/* Race Track */}
            <div style={{
                height: '100vh',
                background: '#83a598', // Grass/Track color
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
            }}>
                {/* Track Lines */}
                <div style={{ position: 'absolute', top: '50%', width: '100%', height: '2px', background: 'rgba(255,255,255,0.5)' }}></div>

                {/* User Dog */}
                <div style={{
                    position: 'absolute',
                    transition: 'left 0.1s linear',
                    left: `${10 + (userPos % 80)}%`,
                    top: '40%',
                    zIndex: 20,
                    opacity: isActive ? 1 : 0.5
                }}>
                    <img src={userAvatarSrc} style={{
                        width: '100px',
                        imageRendering: 'pixelated',
                        transform: 'scaleX(1) translateY(-20px)', // Lift up slightly to stand on line
                        filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.3))'
                    }} />
                    <div style={{ textAlign: 'center', fontWeight: 'bold', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>You</div>
                </div>

                {/* Bot Dogs */}
                {bots.map((bot, i) => (
                    <div key={i} style={{
                        position: 'absolute',
                        transition: 'left 0.1s linear',
                        left: `${10 + (bot.pos % 80)}%`,
                        top: `${55 + (i * 15)}%`,
                        opacity: 0.8
                    }}>
                        <img src="/assets/run.png" style={{
                            width: '80px',
                            imageRendering: 'pixelated',
                            filter: 'grayscale(100%) sepia(50%) hue-rotate(200deg)', // Tint bots
                            transform: 'scaleX(-1)'
                        }} />
                        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{bot.name}</div>
                    </div>
                ))}

            </div>

            {/* Controls */}
            <div style={{ position: 'absolute', bottom: '40px', left: '0', right: '0', textAlign: 'center', zIndex: 10 }}>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                    {isActive ? (
                        <button onClick={toggleTimer} className="btn btn-secondary" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>Pause</button>
                    ) : (
                        <button onClick={toggleTimer} className="btn btn-primary" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>Resume</button>
                    )}
                </div>
            </div>

        </main>
    );
}
