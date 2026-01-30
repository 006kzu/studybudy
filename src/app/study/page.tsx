'use client';

import { useApp } from '@/context/AppContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { generateUUID } from '@/lib/uuid';
import {
    initAudio,
    startLockScreenSession,
    updateLockScreenProgress,
    clearLockScreenSession,
    setLockScreenHandlers
} from '@/utils/mediaSession';
import { useRef, useEffect, useState } from 'react';
import { AVATARS } from '@/constants/avatars';
import { Suspense } from 'react';
import Modal from '@/components/Modal';
import FlappyBirdGame from '@/components/games/FlappyBirdGame';

function StudyPageContent() {
    const { state, recordSession, user, scheduleStudyNotification, cancelStudyNotification } = useApp();
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
    const [breakSeconds, setBreakSeconds] = useState(300); // 5 Minutes
    const [gameCoins, setGameCoins] = useState(0);
    const [showBreakOverModal, setShowBreakOverModal] = useState(false);
    const [breakExtensionUsed, setBreakExtensionUsed] = useState(false);

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

    // --- Lock Screen Timer Logic ---
    useEffect(() => {
        // Initialize silent audio on mount to enable background audio
        initAudio();

        if (isActive && !finished && targetClass) {
            startLockScreenSession({
                title: targetClass.name,
                artist: 'Study Timer',
                artwork: [
                    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
                ]
            });

            // Handle Lock Screen Controls
            setLockScreenHandlers(
                () => { /* Play: Resume if paused (not impl yet) */ },
                () => { /* Pause: Maybe pause timer? For now just ignores */ }
            );
        }

        return () => {
            clearLockScreenSession();
        };
    }, []); // Run once on mount (or when targetClass available)

    // Update Lock Screen Progress
    useEffect(() => {
        if (isActive && !finished) {
            // Update lock screen every second
            // Total duration is 25 mins usually, but we want to show elapsed/remaining.
            // MediaSession duration is usually fixed.
            // Let's set duration to 25 mins (1500s) and position to current seconds.
            updateLockScreenProgress(seconds, 25 * 60);
        }
    }, [seconds, isActive, finished]);

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

    // Track when the notification is set to fire, to avoid spamming the native bridge
    const notificationTimeRef = useRef<number | null>(null);

    // Notification Logic
    useEffect(() => {
        if (isActive && !finished && !isPlayingGame) {
            const targetSeconds = 25 * 60;
            const remainingSeconds = targetSeconds - seconds;

            // Calculate absolute target time for notification
            const proposedEndTime = Date.now() + (remainingSeconds * 1000);

            // Check if we need to schedule/reschedule
            // Reschedule if:
            // 1. No notification is currently set (ref is null)
            // 2. The proposed time differs significantly (> 2 seconds) from what we persisted. 
            //    (This handles manual time jumps/dev tools while ignoring expected 1s tick execution drift)
            const shouldSchedule =
                !notificationTimeRef.current ||
                Math.abs(proposedEndTime - notificationTimeRef.current) > 2000;

            if (shouldSchedule && remainingSeconds > 0) {
                scheduleStudyNotification(remainingSeconds / 60);
                notificationTimeRef.current = proposedEndTime;
            }
        } else {
            // Cancel if not active
            if (notificationTimeRef.current) {
                cancelStudyNotification();
                notificationTimeRef.current = null;
            }
        }
        return () => {
            // Only cancel on actual unmount, not every re-render.
            // But how do we distinguish? 
            // Actually, if dependencies change (pause), we DO want to cancel.
            // So this cleanup is correct for `isActive` toggling.
            if (!isActive && notificationTimeRef.current) {
                cancelStudyNotification();
                notificationTimeRef.current = null;
            }
        };
    }, [isActive, finished, isPlayingGame, seconds]); // 'seconds' added to catch time jumps

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
                id: generateUUID(),
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

    const [showZenGuide, setShowZenGuide] = useState(false);
    const [returnToBreak, setReturnToBreak] = useState(false);
    const [showAdUpsell, setShowAdUpsell] = useState(false);

    // Audio Logic
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const { musicEnabled, zenMode } = useApp().state; // Get settings
    const { updateSettings } = useApp(); // To toggle

    useEffect(() => {
        if (!audioRef.current) return;

        // Play if Active AND Music Enabled
        // Pause if Inactive OR Music Disabled
        // Also pause if Zen Mode? User said "soft music... for focus", so Zen Mode likely wants music.
        if (isActive && musicEnabled) {
            audioRef.current.volume = 0.5; // Slightly louder to ensure it's not just quiet
            audioRef.current.play()
                .then(() => console.log("Audio started playing"))
                .catch(e => console.error("Audio play failed:", e));
        } else {
            audioRef.current.pause();
        }
    }, [isActive, musicEnabled]);

    useEffect(() => {
        if (isActive && zenMode) {
            setShowZenGuide(true);
        }
    }, [isActive, zenMode]);


    // --- AdMob & Premium Logic (Moved Up) ---
    const { isPremium } = useApp().state;
    const { goPremium } = useApp();
    const [showPremiumModal, setShowPremiumModal] = useState(false);

    // Render check happens later, keeping hooks valid
    const isClassInvalid = !targetClass || targetClass.isArchived;

    // ... existing helper ...

    const formatTime = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // --- Developer Tools ---
    const devSetTimeAlmost25 = () => {
        setSeconds(1495); // 5 seconds before 25m
    };

    // AdMob Effect - Only run if valid class
    useEffect(() => {
        if (isClassInvalid) return;

        // Handle AdMob Logic
        const manageAds = async () => {
            const { AdMobService } = await import('@/lib/admob');

            if (!isPremium) {
                if (isPlayingGame) {
                    await AdMobService.hideBanner(); // Hide during game
                } else {
                    await AdMobService.showBanner();
                    await AdMobService.prepareInterstitial();
                    await AdMobService.prepareRewardVideo();
                }
            } else {
                await AdMobService.hideBanner();
            }
        };
        manageAds();

        return () => {
            import('@/lib/admob').then(({ AdMobService }) => AdMobService.hideBanner());
        };
    }, [isPremium, isPlayingGame, isClassInvalid]);

    // Early Return for Invalid Class (Check executed after all hooks)
    if (isClassInvalid) return <div className="container">Class not found</div>;

    const handlePlayGame = async () => {
        setIsActive(false); // Ensure timer is paused
        setShowBreakModal(false); // Close break modal if open

        if (isPremium) {
            setIsPlayingGame(true);
        } else {
            // Intercept with Upsell Modal
            setShowAdUpsell(true);
        }
    };

    const handleWatchAdAndPlay = async () => {
        setShowAdUpsell(false);
        const { AdMobService } = await import('@/lib/admob');
        // Show Interstitial or Loading Toast?
        const watched = await AdMobService.showInterstitial();
        // If watched or failed (watched=false but we let them play anyway often), start game
        setIsPlayingGame(true);
    };

    const handleUpgradeAndPlay = async () => {
        if (confirm("Purchase Premium for $4.99? (Mock)")) {
            goPremium();
            setShowAdUpsell(false);
            setIsPlayingGame(true); // Instant start!
        }
    };

    // Break Timer Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPlayingGame && breakSeconds > 0) {
            interval = setInterval(() => {
                setBreakSeconds(prev => {
                    if (prev <= 1) {
                        setIsPlayingGame(false);
                        setShowBreakOverModal(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isPlayingGame, breakSeconds]);

    // Reset Break Props on New Session
    useEffect(() => {
        // If seconds resets to 0 (or low), assume new session start? 
        // Actually, better to reset when they click "Start" logic or when session ends.
        // Let's reset when isActive becomes true (resuming study).
        if (isActive) {
            setBreakExtensionUsed(false);
            setBreakSeconds(300); // Reset to 5 mins
        }
    }, [isActive]);

    const handleWatchReward = async () => {
        const { AdMobService } = await import('@/lib/admob');
        const rewarded = await AdMobService.showRewardVideo();
        if (rewarded) {
            setBreakSeconds(120); // +2 Minutes
            setBreakExtensionUsed(true);
            setShowBreakOverModal(false);
            setIsPlayingGame(true);
        } else {
            alert('Ad failed to load. Please try again or resume studying.');
        }
    };

    return (
        <main className="container" style={{ maxWidth: '100vw', padding: 0, overflow: 'hidden' }}>

            {/* If Playing Game, show FULL SCREEN overlay */}
            {isPlayingGame && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 2000 }}>
                    {/* Dev Tool: Break End Button - Positioned in top-right over game */}
                    <button
                        onClick={() => setBreakSeconds(5)}
                        style={{
                            position: 'absolute',
                            top: '60px',
                            right: '20px',
                            zIndex: 3000,
                            padding: '8px 12px',
                            background: 'red',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            opacity: 0.8
                        }}
                    >
                        ⏩ End Break
                    </button>
                    <FlappyBirdGame
                        avatarSrc={userAvatarSrc}
                        timeLeft={breakSeconds}
                        onExit={(coins) => {
                            setGameCoins(prev => prev + coins);
                            setIsPlayingGame(false);
                            setIsActive(true); // Auto-resume
                            // Banner visibility handled by useEffect
                        }}
                    />
                </div>
            )}

            {/* Audio Element */}
            <audio ref={audioRef} loop src="/assets/study_music.mp3" />

            {/* Consolidated Header Controls */}
            <div style={{ padding: '16px 24px', paddingTop: 'calc(env(safe-area-inset-top) + 20px)', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, pointerEvents: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>

                    {/* Left: Class Info & Timer */}
                    <div className="card" style={{
                        pointerEvents: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '12px 20px',
                        background: 'rgba(255,255,255,0.95)',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        gap: '4px',
                        minWidth: '140px'
                    }}>
                        <h2 className="text-h2" style={{ margin: 0, fontSize: '1.1rem', color: targetClass.color }}>{targetClass.name}</h2>
                        <div className="text-h1" style={{ fontFamily: 'monospace', margin: 0, fontSize: '1.5rem', lineHeight: 1 }}>
                            {formatTime(seconds)}
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div style={{ display: 'flex', gap: '12px', pointerEvents: 'auto' }}>
                        {/* Music Toggle */}
                        <button
                            onClick={() => updateSettings({ musicEnabled: !musicEnabled })}
                            style={{
                                background: 'rgba(255,255,255,0.95)',
                                border: 'none',
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                fontSize: '1.4rem',
                                transition: 'transform 0.1s'
                            }}
                            title={musicEnabled ? "Mute Music" : "Play Music"}
                        >
                            {musicEnabled ? '🎵' : '🔇'}
                        </button>

                        {/* End Session */}
                        <button
                            onClick={endSession}
                            className="btn"
                            style={{
                                background: 'var(--color-error)',
                                color: 'white',
                                padding: '0 20px',
                                height: '48px',
                                fontSize: '0.9rem',
                                boxShadow: '0 4px 12px rgba(231, 76, 60, 0.3)',
                                borderRadius: '24px'
                            }}
                        >
                            Stop
                        </button>
                    </div>
                </div>
            </div>

            {/* Relaxing "Float" Background - Zen Mode */}
            <div style={{
                height: '100vh',
                background: 'linear-gradient(180deg, #A3958C 0%, #D9CBC2 100%)', // Mushroom to Oat Milk
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
                            transform: `translateX(${-((scrollOffset * 0.2 + i * 300) % (2000))}px) translateX(${window.innerWidth}px)`,
                            fontSize: '4rem',
                            opacity: 0.8
                        }}>☁️</div>
                    ))}

                    {/* "Obstacles" (Stacks of Books - Passively floating by) */}
                    {[1, 2, 3, 4].map(i => {
                        const gap = 600;
                        const totalWidth = gap * 4;
                        const currentX = (i * gap) - (scrollOffset * 2) % totalWidth;
                        const dispX = currentX < -100 ? currentX + totalWidth : currentX;

                        // Pseudo-random generation based on index 'i' to avoid flicker
                        // We render ~5-8 books per stack.
                        const bookCount = 5 + (i % 3);
                        const books = Array.from({ length: bookCount }).map((_, bIdx) => {
                            const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#34495e'];
                            // Stable "Random"
                            const seed = (i * 10) + bIdx;
                            const bg = colors[seed % colors.length];
                            const h = 20 + (seed % 15); // height in px approximation (or vh logic)
                            const wPct = 90 + (seed % 10); // 90-100% width

                            return { bg, h, wPct };
                        });

                        return (
                            <div key={`obs-${i}`} style={{
                                position: 'absolute',
                                left: dispX,
                                bottom: '18vh', // Responsive ground offset
                                display: 'flex',
                                flexDirection: 'column-reverse', // Stack from bottom up
                                alignItems: 'center',
                                width: '10vh', // Stack width
                            }}>
                                {books.map((book, bIdx) => (
                                    <div key={bIdx} style={{
                                        width: `${book.wPct}%`,
                                        height: `${book.h * 0.15}vh`, // Scaled height
                                        background: book.bg,
                                        border: '1px solid rgba(0,0,0,0.1)',
                                        borderRadius: '2px',
                                        position: 'relative',
                                        marginBottom: '-1px' // Tight stack
                                    }}>
                                        {/* Spine Detail */}
                                        <div style={{
                                            position: 'absolute',
                                            left: 0, top: '10%', bottom: '10%', width: '3px',
                                            background: 'rgba(255,255,255,0.3)'
                                        }} />
                                        <div style={{
                                            position: 'absolute',
                                            right: '4px', top: '50%', height: '40%', width: '10px',
                                            background: 'rgba(255,255,255,0.2)',
                                            transform: 'translateY(-50%)'
                                        }} />
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>

                {/* Ground */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    width: '100%',
                    height: '18vh', // Scaled Ground
                    background: '#ded895',
                    borderTop: '0.6vh solid #cbb968'
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
                        height: '15vh', // Scaled Avatar
                        width: 'auto',
                        imageRendering: 'pixelated',
                        filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.3))'
                    }} />
                </div>

                {/* Pause/Resume Overlay State Indicator */}
                {!isActive && !showBreakModal && !isPlayingGame && !showPremiumModal && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30, pointerEvents: 'none' }}>
                        <h2 style={{ color: 'white', fontSize: '3rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>PAUSED</h2>
                    </div>
                )}

            </div>

            {/* Controls */}
            <div style={{ position: 'absolute', bottom: '100px', left: '0', right: '0', textAlign: 'center', zIndex: 10 }}>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                    {isActive ? (
                        <button onClick={() => setIsActive(false)} className="btn btn-secondary" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>Pause</button>
                    ) : (
                        <button onClick={() => setIsActive(true)} className="btn btn-primary" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>Resume</button>
                    )}

                    {/* Premium Button */}
                    {!isPremium && !isActive && (
                        <button
                            onClick={() => setShowPremiumModal(true)}
                            className="btn"
                            style={{ background: '#f1c40f', color: '#5e4002', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
                        >
                            🚫 Ads
                        </button>
                    )}
                </div>
            </div>
            {/* Ad Banner Placeholder Removed per user request */}

            {/* Dev Tools - Hidden in corner */}
            <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 50px)', right: '10px', opacity: 0.8, zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', background: 'rgba(0,0,0,0.5)', padding: '4px', color: 'white', fontSize: '10px' }}>
                <button onClick={devSetTimeAlmost25}>⏩ 24:55</button>
                <button onClick={() => setSeconds(7195)}>⏩ 1:59:55</button>
                <button onClick={() => setBreakSeconds(5)}>⏩ Break End</button>
                <div>Goal: {targetClass?.weeklyGoalMinutes}</div>
                <div>Weekly: {weeklyMinutes}</div>
                <div>Session: {Math.ceil(seconds / 60)}</div>
                <div>Total: {weeklyMinutes + Math.ceil(seconds / 60)}</div>
                <div>Shown: {hasShownGoalModal ? 'Yes' : 'No'}</div>
                <div>Premium: {isPremium ? 'YES' : 'NO'}</div>
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
                        <button className="btn btn-primary" onClick={handlePlayGame}>Play Game! 🎮</button>
                    </>
                }
            >
                You've focused for 25 minutes straight! StudyBudy recommends taking a 5-minute break to recharge properly.
                <br /><br />
                Want to play a quick round of Flappy Budy to relax?

                {/* Upsell Removed here as requested, moving to Interstitial flow + keeping text tweak if needed */}
                {/* Upsell Removed per user request */}
            </Modal>

            {/* Pre-Ad Upsell Modal (New) */}
            <Modal
                isOpen={showAdUpsell}
                onClose={() => setShowAdUpsell(false)} // Or Go Back?
                title="Strict Mode? 💎"
                // Using a placeholder title or "Upgrade to Premium"
                actions={
                    <>
                        <button className="btn btn-secondary" onClick={handleWatchAdAndPlay}>
                            Watch Ad & Play 📺
                        </button>
                        <button className="btn btn-primary" onClick={handleUpgradeAndPlay}>
                            Upgrade Now ($4.99) 🚀
                        </button>
                    </>
                }
            >
                <div style={{ textAlign: 'center', padding: '12px' }}>
                    <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#2c3e50', marginBottom: '16px' }}>
                        Keep the momentum.
                    </p>
                    <p style={{ marginBottom: '24px', color: '#555' }}>
                        Remove ads and get to your break faster.
                    </p>
                    <div style={{ fontSize: '0.85rem', color: '#888' }}>
                        One-time purchase. No subscriptions.
                    </div>
                </div>
            </Modal>

            {/* Premium Offer Modal */}
            <Modal
                isOpen={showPremiumModal}
                onClose={() => setShowPremiumModal(false)}
                title="Go Premium! 💎"
                actions={
                    <>
                        <button className="btn btn-secondary" onClick={() => {
                            setShowPremiumModal(false);
                            if (returnToBreak) {
                                setShowBreakModal(true);
                                setReturnToBreak(false); // Reset
                            }
                        }}>Later</button>
                        <button className="btn btn-primary" onClick={() => {
                            if (confirm("Purchase Premium for $4.99? (Mock)")) {
                                goPremium();
                                setShowPremiumModal(false);
                                // Hiding banner handled by useEffect
                            }
                        }}>Upgrade ($4.99)</button>
                    </>
                }
            >
                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '1.2rem', marginBottom: '16px' }}>
                        Support StudyBudy & Remove Ads!
                    </p>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>💎</div>
                    <ul style={{ textAlign: 'left', margin: '0 0 24px 24px', lineHeight: '1.6' }}>
                        <li>🚫 No more Ads (Interstitials & Banners)</li>
                        <li>💰 <strong>25,000 Coin Bonus</strong> instantly!</li>
                        <li>❤️ Support future development</li>
                    </ul>
                    <p style={{ color: '#27ae60', fontWeight: 'bold' }}>
                        One-time purchase. Forever yours.
                    </p>
                </div>
            </Modal>

            {/* Break Over Modal */}
            <Modal
                isOpen={showBreakOverModal}
                onClose={() => { /* Force Choice */ }}
                title="Break Over! ⏰"
                actions={
                    <>
                        <button className="btn btn-secondary" onClick={() => {
                            setShowBreakOverModal(false);
                            setIsActive(true);
                        }}>Back to Study</button>

                        {!breakExtensionUsed && !isPremium && (
                            <button className="btn btn-primary" onClick={handleWatchReward}>
                                Watch AD (+2 Min) 📺
                            </button>
                        )}
                    </>
                }
            >
                <div style={{ textAlign: 'center' }}>
                    <p>Time's up! Hope you feel refreshed.</p>
                    {!breakExtensionUsed && !isPremium && (
                        <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '8px' }}>
                            Need a little more time? Watch a short ad to extend your break by 2 minutes.
                        </p>
                    )}
                </div>
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

            {/* Zen Mode Guide Modal */}
            {
                showZenGuide && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.8)', zIndex: 9999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '24px'
                    }}>
                        <div style={{ background: 'white', padding: '24px', borderRadius: '16px', maxWidth: '320px', textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🧘</div>
                            <h2 className="text-h2" style={{ marginBottom: '12px' }}>Zen Mode</h2>
                            <p className="text-body" style={{ marginBottom: '16px' }}>
                                To block distractions, enable <strong>Guided Access</strong> now.
                            </p>
                            <ol style={{ textAlign: 'left', marginBottom: '24px', paddingLeft: '24px', fontSize: '0.9rem', lineHeight: '1.4' }}>
                                <li>Enable <strong>Guided Access</strong> in Settings.</li>
                                <li><strong>Triple-click</strong> the Side Button.</li>
                                <li>Tap <strong>Start</strong> to lock app.</li>
                            </ol>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <a
                                    href="App-Prefs:root=General&path=ACCESSIBILITY"
                                    className="btn"
                                    style={{
                                        background: '#f0f0f0', color: '#333',
                                        textDecoration: 'none', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    Open Settings
                                </a>
                                <button className="btn" onClick={() => setShowZenGuide(false)}>
                                    I'm Ready
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </main >
    );
}

export default function StudyPage() {
    return (
        <Suspense fallback={<div className="container text-center" style={{ marginTop: '20vh' }}>Loading Study Session...</div>}>
            <StudyPageContent />
        </Suspense>
    );
}
