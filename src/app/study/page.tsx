'use client';

import { useApp } from '@/context/AppContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { AVATARS } from '@/constants/avatars';
import { Suspense } from 'react';
import Modal from '@/components/Modal';
import FlappyBirdGame from '@/components/games/FlappyBirdGame';

function StudyPageContent() {
    const { state, recordSession } = useApp();
    const searchParams = useSearchParams();
    const router = useRouter();

    const classId = searchParams.get('classId');
    const [seconds, setSeconds] = useState(0);
    const [isActive, setIsActive] = useState(true);
    const [finished, setFinished] = useState(false);

    // Pomodoro State
    const [showBreakModal, setShowBreakModal] = useState(false);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [hasShownGoalModal, setHasShownGoalModal] = useState(false);
    const [isPlayingGame, setIsPlayingGame] = useState(false);
    const [gameCoins, setGameCoins] = useState(0);

    // "Floating" Visual State (Passive)
    // We just track a global scroll offset to move the background/obstacles
    const [scrollOffset, setScrollOffset] = useState(0);
    const animationRef = useRef<number | null>(null);

    const targetClass = state.classes.find(c => c.id === classId);

    // Get User Avatar
    const userAvatarItem = AVATARS.find(a => a.name === state.equippedAvatar);
    const userAvatarSrc = userAvatarItem ? userAvatarItem.filename : '/assets/run.png';

    // Calculate Weekly Progress
    const getStartOfWeek = () => {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday.getTime();
    };

    const weeklyMinutes = state.studySessions
        .filter(s => s.classId === classId && s.timestamp >= getStartOfWeek())
        .reduce((acc, curr) => acc + curr.durationMinutes, 0);

    const goalMinutes = targetClass ? targetClass.weeklyGoalMinutes : 0;

    // Verbose time format: "13 mins 2 Seconds"
    const formatVerboseTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m} mins ${s} Seconds`;
    };

    // Timer Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isActive && !finished && !isPlayingGame) { // Pause timer while playing game
            interval = setInterval(() => {
                setSeconds((s) => {
                    const next = s + 1;
                    // Check for 25m interval (1500 seconds)
                    if (next > 0 && next % 1500 === 0) {
                        setIsActive(false); // Pause timer
                        setShowBreakModal(true);
                    }
                    return next;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isActive, finished, isPlayingGame]);

    // Check for Goal Completion
    useEffect(() => {
        if (!targetClass || hasShownGoalModal) return;

        const currentTotal = weeklyMinutes;
        const newSessionMinutes = seconds / 60; // Precise float
        const goal = targetClass.weeklyGoalMinutes;

        // console.log('[StudyPage] Goal Check:', { currentTotal, newSessionMinutes, goal, sum: currentTotal + newSessionMinutes });

        if (currentTotal < goal && (currentTotal + newSessionMinutes) >= goal) {
            // console.log('[StudyPage] GOAL REACHED! Triggering Modal.');
            setIsActive(false);
            setShowGoalModal(true);
            setHasShownGoalModal(true);
        }
    }, [seconds, targetClass, weeklyMinutes, hasShownGoalModal]);

    // Passive Animation Loop (Parallax / Floating)
    useEffect(() => {
        const loop = () => {
            if (isActive && !finished && !isPlayingGame) {
                setScrollOffset(prev => prev + 1); // Slow 1px/frame scroll
            }
            animationRef.current = requestAnimationFrame(loop);
        };
        animationRef.current = requestAnimationFrame(loop);

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isActive, finished, isPlayingGame]);

    const endSession = async () => {
        setIsActive(false);
        setFinished(true);

        // Award Points based on time: 0.46 points per second
        const timePoints = Math.floor(seconds * 0.46);

        // Weekly Bonus Check
        let bonusPoints = 0;
        if (targetClass) {
            const currentTotal = weeklyMinutes;
            const newSessionMinutes = Math.ceil(seconds / 60);
            const goal = targetClass.weeklyGoalMinutes;

            // Check if we crossed the goal line this specific session
            if (currentTotal < goal && (currentTotal + newSessionMinutes) >= goal) {
                bonusPoints = 100;
            }
        }

        const totalPoints = timePoints + gameCoins + bonusPoints;

        if (targetClass) {
            // Save
            await recordSession({
                id: crypto.randomUUID(),
                classId: targetClass.id,
                durationMinutes: Math.ceil(seconds / 60),
                timestamp: Date.now(),
                pointsEarned: totalPoints
            });

            // Redirect to Dashboard (Winner is always true now since there are no bots)
            router.push(`/dashboard?earned=${totalPoints}&winner=true`);
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

    // --- Developer Tools ---
    const devSetTimeAlmost25 = () => {
        setSeconds(1495); // 5 seconds before 25m
    };

    return (
        <main className="container" style={{ maxWidth: '100vw', padding: 0, overflow: 'hidden' }}>

            {/* If Playing Game, show FULL SCREEN overlay */}
            {isPlayingGame && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 2000 }}>
                    <FlappyBirdGame
                        avatarSrc={userAvatarSrc}
                        onExit={(coins) => {
                            // Save game coins to state or just add them?
                            // We need to store them until the session ends or add them casually?
                            // The session might continue.
                            // Let's create a Ref or State to accumulate Game Coins for this session.
                            // Actually, let's just create a `gameCoins` ref.
                            setGameCoins(prev => prev + coins);
                            setIsPlayingGame(false);
                            setIsActive(true); // Auto-resume
                        }}
                    />
                </div>
            )}

            {/* Header Info */}
            <div style={{ padding: '24px', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
                <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.9 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={endSession} className="btn" style={{ background: 'var(--color-error)', color: 'white', padding: '8px 16px', fontSize: '0.9rem' }}>
                            End Session
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

            {/* Relaxing "Float" Background */}
            <div style={{
                height: '100vh',
                background: '#70c5ce', // Sky Blue (Flappy Bird style)
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
            }}>
                {/* Scrolling Background Elements (Clouds/Ground/Obstacles) */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>

                    {/* Clouds (Slow) */}
                    {[1, 2, 3].map(i => (
                        <div key={`cloud-${i}`} style={{
                            position: 'absolute',
                            top: `${20 + (i * 15)}%`,
                            left: `${((i * 400 + scrollOffset * 0.5) % (window.innerWidth + 200)) - 200}px`,
                            transition: 'none',
                            // Using negative margin to wrap around?
                            // Actually, simpler logic:
                            transform: `translateX(${-((scrollOffset * 0.2 + i * 300) % (2000))}px) translateX(${window.innerWidth}px)`,
                            fontSize: '4rem',
                            opacity: 0.8
                        }}>☁️</div>
                    ))}

                    {/* "Obstacles" (Stacks of Books - Passively floating by) */}
                    {[1, 2, 3, 4].map(i => {
                        // Distribute them every 600px
                        const gap = 600;
                        const totalWidth = gap * 4;
                        // Calculate position based on scrollOffset
                        // We want them to move LEFT.
                        const currentX = (i * gap) - (scrollOffset * 2) % totalWidth;
                        // Wrap around
                        const dispX = currentX < -100 ? currentX + totalWidth : currentX;

                        return (
                            <div key={`obs-${i}`} style={{
                                position: 'absolute',
                                left: dispX,
                                bottom: '100px', // Just above ground
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center'
                            }}>
                                {/* Random Height Stack of Books */}
                                <div style={{
                                    width: '60px',
                                    height: `${100 + (i * 30)}px`,
                                    background: `repeating-linear-gradient(
                                        45deg,
                                        #606dbc,
                                        #606dbc 10px,
                                        #465298 10px,
                                        #465298 20px
                                    )`,
                                    border: '2px solid #333',
                                    borderRadius: '4px'
                                }}></div>
                            </div>
                        );
                    })}
                </div>

                {/* Ground */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    width: '100%',
                    height: '100px',
                    background: '#ded895',
                    borderTop: '4px solid #cbb968'
                }}>
                    {/* Ground Pattern Scrolling */}
                    <div style={{
                        width: '100%',
                        height: '100%',
                        backgroundImage: 'linear-gradient(135deg, #d0c874 25%, transparent 25%), linear-gradient(225deg, #d0c874 25%, transparent 25%)',
                        backgroundSize: '20px 20px',
                        opacity: 0.5,
                        transform: `translateX(-${scrollOffset % 20}px)`
                    }}></div>
                </div>

                {/* User Avatar (Bobbing in Center) */}
                <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: `translate(-50%, -50%) translateY(${Math.sin(scrollOffset * 0.05) * 20}px)`, // Gentle Bob
                    zIndex: 20,
                    transition: 'transform 0.1s linear'
                }}>
                    {/* Stats Bubble */}
                    <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        marginBottom: '15px',
                        background: 'white',
                        padding: '8px 12px',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        whiteSpace: 'nowrap',
                        textAlign: 'center',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        color: '#222'
                    }}>
                        <div style={{ fontSize: '0.9rem', marginBottom: '2px', color: '#222' }}>{formatVerboseTime(seconds)}</div>
                        <div style={{ color: '#666', fontSize: '0.75rem' }}>
                            ({weeklyMinutes} / {goalMinutes} mins)
                        </div>
                        {/* Triangle pointer */}
                        <div style={{
                            position: 'absolute',
                            bottom: '-6px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 0,
                            height: 0,
                            borderLeft: '6px solid transparent',
                            borderRight: '6px solid transparent',
                            borderTop: '6px solid white'
                        }}></div>
                    </div>

                    <img src={userAvatarSrc} style={{
                        width: '100px',
                        imageRendering: 'pixelated',
                        filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.3))'
                    }} />
                </div>

                {/* Pause/Resume Overlay State Indicator */}
                {!isActive && !showBreakModal && !isPlayingGame && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30, pointerEvents: 'none' }}>
                        <h2 style={{ color: 'white', fontSize: '3rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>PAUSED</h2>
                    </div>
                )}

            </div>

            {/* Controls */}
            <div style={{ position: 'absolute', bottom: '40px', left: '0', right: '0', textAlign: 'center', zIndex: 10 }}>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                    {isActive ? (
                        <button onClick={() => setIsActive(false)} className="btn btn-secondary" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>Pause</button>
                    ) : (
                        <button onClick={() => setIsActive(true)} className="btn btn-primary" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>Resume</button>
                    )}
                </div>
            </div>

            {/* Dev Tools - Hidden in corner */}
            <div style={{ position: 'fixed', top: '10px', right: '10px', opacity: 0.8, zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', background: 'rgba(0,0,0,0.5)', padding: '4px', color: 'white', fontSize: '10px' }}>
                <button onClick={devSetTimeAlmost25}>⏩ 24:55</button>
                <button onClick={() => setSeconds(7195)}>⏩ 1:59:55</button>
                <div>Goal: {targetClass?.weeklyGoalMinutes}</div>
                <div>Weekly: {weeklyMinutes}</div>
                <div>Session: {Math.ceil(seconds / 60)}</div>
                <div>Total: {weeklyMinutes + Math.ceil(seconds / 60)}</div>
                <div>Shown: {hasShownGoalModal ? 'Yes' : 'No'}</div>
            </div>

            {/* Break Modal */}
            <Modal
                isOpen={showBreakModal}
                onClose={() => setShowBreakModal(false)}
                title="Great Job! 🍅"
                actions={
                    <>
                        <button className="btn btn-secondary" onClick={() => {
                            setShowBreakModal(false);
                            setIsActive(true);
                        }}>Skip Break</button>
                        <button className="btn btn-primary" onClick={() => {
                            setShowBreakModal(false);
                            setIsPlayingGame(true);
                        }}>Play Game! 🎮</button>
                    </>
                }
            >
                You've focused for 25 minutes straight! StudyBudy recommends taking a 5-minute break to recharge properly.
                <br /><br />
                Want to play a quick round of Flappy Budy to relax?
            </Modal>

            {/* Goal Reached Modal */}
            <Modal
                isOpen={showGoalModal}
                onClose={() => setShowGoalModal(false)}
                title="Goal Reached! 🎉"
                actions={
                    <>
                        <button className="btn btn-secondary" onClick={() => {
                            setShowGoalModal(false);
                            setIsActive(true);
                        }}>Keep Studying</button>
                        <button className="btn btn-primary" onClick={() => {
                            setShowGoalModal(false);
                            endSession();
                        }}>Finish Session 🏆</button>
                    </>
                }
            >
                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '1.2rem', marginBottom: '16px' }}>
                        You've hit your weekly goal for <strong>{targetClass.name}</strong>!
                    </p>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>💰 +100 Coins</div>
                    <p style={{ color: '#27ae60', fontWeight: 'bold', marginBottom: '16px' }}>
                        Bonus Secured!
                    </p>
                    <p>
                        Want to push further or call it a success for today?
                    </p>
                </div>
            </Modal>

        </main>
    );
}

export default function StudyPage() {
    return (
        <Suspense fallback={<div className="container text-center" style={{ marginTop: '20vh' }}>Loading Study Session...</div>}>
            <StudyPageContent />
        </Suspense>
    );
}
