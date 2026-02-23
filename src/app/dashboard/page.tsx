'use client';

import { useApp } from '@/context/AppContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import WienerAvatar from '@/components/WienerAvatar';
import Modal from '@/components/Modal';
import ShareProgressModal from '@/components/ShareProgressModal';

import { Suspense } from 'react';

function DashboardContent() {
    const {
        state,
        removeClass,
        user,
        signOut,
        isLoading,
        refreshData,
        claimPendingGifts,
        extendBreak
    } = useApp();
    const searchParams = useSearchParams();
    const router = useRouter();

    console.log('[Dashboard] Render. isLoading:', isLoading, 'Classes:', state.classes?.length);

    const [showEarnedModal, setShowEarnedModal] = useState(false);
    const [earnedAmount, setEarnedAmount] = useState(0);
    const [isWinner, setIsWinner] = useState(false);
    const [showWeeklyCongrats, setShowWeeklyCongrats] = useState(false);
    const [showSplash, setShowSplash] = useState(isLoading);
    const [splashFading, setSplashFading] = useState(false);

    // Delete Confirmation State
    const [classToDelete, setClassToDelete] = useState<string | null>(null);

    const handleDeleteClick = (id: string) => {
        setClassToDelete(id);
    };

    const confirmDelete = () => {
        if (classToDelete) {
            removeClass(classToDelete);
            setClassToDelete(null);
        }
    };

    const handleLogout = async () => {
        await signOut();
        window.location.reload(); // Refresh to show login state
    };

    // Gift Receipt State
    const [giftData, setGiftData] = useState<{ coins: number, gameMinutes: number, senderName: string, giftCredits?: { legendary: number, epic: number, rare: number } } | null>(null);

    // Check for earnings/gifts on mount
    useEffect(() => {
        const checkGifts = async () => {
            if (user && !isLoading) {
                // Check for URL params first (legacy/other flows)
                const earned = searchParams.get('earned');
                const winner = searchParams.get('winner');

                if (earned) {
                    setShowEarnedModal(true);
                    setEarnedAmount(Number(earned));
                    setIsWinner(winner === 'true');
                    setTimeout(() => { setShowEarnedModal(false); router.replace('/dashboard'); }, 2000);
                }

                // Check for Database Gifts (Parental Gifts)
                // checkGifts called below in correct effect
            }
        };
        checkGifts();
    }, [searchParams, router, user, isLoading]);

    // Separate Effect for Claiming Gifts to avoid missing dependencies in the complex one above
    useEffect(() => {
        let mounted = true;
        const claim = async () => {
            if (!user || isLoading) return;
            const gift = await claimPendingGifts();
            const hasGiftCredits = gift?.giftCredits && (gift.giftCredits.legendary > 0 || gift.giftCredits.epic > 0 || gift.giftCredits.rare > 0);
            if (mounted && gift && (gift.coins > 0 || gift.gameMinutes > 0 || hasGiftCredits)) {
                setGiftData(gift);
                // Help the user: Apply Game Time immediately so it's not lost
                if (gift.gameMinutes > 0) {
                    console.log('[Dashboard] Applying gifted game time:', gift.gameMinutes);
                    extendBreak(gift.gameMinutes);
                }
                // Play sound can go here
            }
        };
        claim();
        return () => { mounted = false; };
    }, [user, isLoading, claimPendingGifts, extendBreak]);


    // --- Navigation Logic ---
    const [hasRetried, setHasRetried] = useState(false);

    // Consolidated to prevent race conditions and hook mismatches
    useEffect(() => {
        if (!user || isLoading) return;

        // 1. Parent Redirect
        if ((state.isOnboarded || state.isRoleSet) && state.role === 'parent') {
            console.log('[Dashboard] Parent user detected. Redirecting to parent dashboard...');
            router.replace('/parent');
            return;
        }

        // 2. New User Redirect (Only if absolutely confirmed no data)
        const hasClasses = state.classes && state.classes.length > 0;
        // Wait a tick to ensure we aren't just in a "gap" between loading and data
        if (!state.isOnboarded && !state.isRoleSet && !hasClasses) {
            // Check if we just retried. If we haven't retried yet, maybe don't redirect yet?
            // Actually, let's rely on the auto-retry logic below to fire first if needed.
            // But if we are here, we might be stuck.
            // Let's give it a small delay before determining "Empty State" vs "Loading State"
            const timer = setTimeout(() => {
                // Double check after 500ms
                if (!state.classes?.length && !state.isOnboarded) {
                    console.log('[Dashboard] User confirmed not onboarded & no classes. Redirecting to setup...');
                    router.replace('/onboarding');
                }
            }, 500);
            return () => clearTimeout(timer);
        }

    }, [user, isLoading, state.isOnboarded, state.isRoleSet, state.role, state.classes, router]);


    // Auto-Retry for "Missing Classes" bug
    // Only fire if we are logged in, not loading, have NO classes, and haven't retried yet.
    // This runs in parallel but shouldn't cause a hook error as it just calls a function.
    useEffect(() => {
        if (user && !isLoading && state.classes?.length === 0 && !hasRetried) {
            // 1s Delay to allow initial render to settle
            const timer = setTimeout(() => {
                console.log('[Dashboard] Logged in but no classes found. Attempting one auto-refresh...');
                setHasRetried(true);
                refreshData();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [user, isLoading, state.classes?.length, hasRetried, refreshData]);

    // Splash Screen Timer
    useEffect(() => {
        if (!isLoading && showSplash) {
            const fadeTimer = setTimeout(() => setSplashFading(true), 2000);
            const removeTimer = setTimeout(() => setShowSplash(false), 2500);
            return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer); };
        }
    }, [isLoading, showSplash]);


    // --- AdMob Logic ---
    useEffect(() => {
        // Only run on native
        const manageAds = async () => {
            // Safety check for import
            try {
                const { AdMobService } = await import('@/lib/admob');
                if (!state.isPremium) {
                    // console.log('[Dashboard] Non-premium user, showing banner...');
                    await AdMobService.showBanner();
                } else {
                    await AdMobService.hideBanner();
                }
            } catch (e) {
                // console.error('AdMob init error', e); 
            }
        };

        if (!isLoading) {
            manageAds();
        }

        // Cleanup: Hide banner when leaving dashboard (important for other pages that might not want it)
        return () => {
            import('@/lib/admob').then(({ AdMobService }) => AdMobService.hideBanner());
        };
    }, [state.isPremium, isLoading]);



    // Weekly Progress Logic
    const getStartOfWeek = () => {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday.getTime();
    };

    const startOfWeek = getStartOfWeek();
    const activeClasses = state.classes?.filter(c => !c.isArchived) || [];

    // Sum of all active class goals
    const totalWeeklyGoal = activeClasses.reduce((acc, c) => acc + c.weeklyGoalMinutes, 0);

    // Sum of all study sessions for active classes this week
    const totalWeeklyMinutes = (state.studySessions || [])
        .filter(s => {
            const isRecent = s.timestamp >= startOfWeek;
            const isActiveClass = activeClasses.some(c => c.id === s.classId);
            return isRecent && isActiveClass;
        })
        .reduce((acc, s) => acc + s.durationMinutes, 0);

    const weeklyPercent = totalWeeklyGoal > 0 ? Math.min(100, (totalWeeklyMinutes / totalWeeklyGoal) * 100) : 0;

    // Check for Weekly Goal Completion (Persisted per week)
    useEffect(() => {
        if (totalWeeklyGoal > 0 && totalWeeklyMinutes >= totalWeeklyGoal) {
            const weekKey = `hasSeenWeeklyCongrats-${startOfWeek}`;
            const hasSeen = localStorage.getItem(weekKey);

            if (!hasSeen) {
                setShowWeeklyCongrats(true);
                localStorage.setItem(weekKey, 'true');
            }
        }
    }, [totalWeeklyMinutes, totalWeeklyGoal, startOfWeek]);

    // Calculate progress for each class
    const getClassProgress = (classId: string) => {
        const sessions = (state.studySessions || []).filter(s => s.classId === classId);
        const totalMinutes = sessions.reduce((acc, curr) => acc + curr.durationMinutes, 0);
        return totalMinutes;
    };

    return (
        <>
            <main className="container" style={{
                paddingTop: 'calc(env(safe-area-inset-top) + 20px)',
                paddingBottom: '120px', // Extra padding for Ad Banner
                minHeight: '100vh',
                position: 'relative'
            }}>
                <header style={{ marginBottom: '24px' }}>
                    {/* Top Row: Title & Avatar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ paddingTop: '16px' }}>
                            <h1 className="text-h1" style={{ margin: 0, lineHeight: 1 }}>Dashboard</h1>
                            {user && (
                                <div style={{
                                    fontSize: '0.8rem',
                                    color: 'var(--color-text-secondary)',
                                    marginTop: '4px',
                                    fontWeight: 500
                                }}>
                                    👋 Hi, {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Friend'}
                                </div>
                            )}
                        </div>



                        {/* Game Time Bank in Header */}
                        {(state.gameTimeBank ?? 0) >= 0 && (
                            <Link href="/games" style={{ textDecoration: 'none' }}>
                                <div className="animate-fade-in" style={{
                                    background: 'linear-gradient(135deg, #FF7E36, #E84545)',
                                    color: 'white',
                                    padding: '6px 12px',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    margin: '0 8px',
                                    boxShadow: '0 4px 10px rgba(232, 69, 69, 0.3)',
                                    flexShrink: 0,
                                    cursor: 'pointer',
                                    border: 'none'
                                }} title="Go to Game Hub">
                                    <div style={{ fontSize: '0.65rem', opacity: 0.9, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Game Time</div>
                                    <div style={{ fontWeight: 800, fontSize: '1.2rem', lineHeight: 1 }}>{state.gameTimeBank}m</div>
                                </div>
                            </Link>
                        )}

                        <div style={{ marginRight: '0px' }}>
                            <WienerAvatar points={state.points} inventory={state.inventory} equippedAvatar={state.equippedAvatar} coinPosition="top" size="small" />
                        </div>
                    </div>

                    {/* Bottom Row: Navigation Links */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '12px',
                        alignItems: 'start',
                        justifyItems: 'center',
                        paddingTop: '12px'
                    }}>
                        <Link href="/notes" style={{ fontSize: '0.7rem', color: 'var(--color-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none' }}>
                            <img src="/icons/icon_books.png" alt="Notes" style={{ width: '64px', height: '64px', marginBottom: '-4px' }} />
                            Notes
                        </Link>
                        <Link href="/shop" style={{ fontSize: '0.7rem', color: 'var(--color-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none' }}>
                            <img src="/icons/shop.png" alt="Shop" style={{ width: '64px', height: '64px', marginBottom: '-4px' }} />
                            Shop
                        </Link>
                        <Link href="/leaderboard" style={{ fontSize: '0.7rem', color: 'var(--color-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none' }}>
                            <img src="/icons/leaderboard.png" alt="Leaderboard" style={{ width: '64px', height: '64px', marginBottom: '-4px' }} />
                            Leaderboard
                        </Link>
                    </div>
                </header>

                <section style={{ marginBottom: '32px' }}>
                    <Link href="/stats" style={{ textDecoration: 'none' }}>
                        <div className="card" style={{ background: 'linear-gradient(135deg, #FF7E36, #E84545)', color: 'white', border: 'none', boxShadow: '0 4px 12px rgba(232, 69, 69, 0.3)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.4rem', margin: 0, opacity: 1, fontWeight: 800 }}>
                                        Weekly Focus <img src="/icons/focus.png" alt="Focus" style={{ width: '48px', height: '48px', verticalAlign: 'middle', marginLeft: '8px' }} />
                                    </h2>
                                    <p style={{ fontSize: '0.9rem', margin: '4px 0 0', opacity: 0.8 }}>All Subjects Combined</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: '2rem', fontWeight: 800 }}>{Math.round(totalWeeklyMinutes)}</span>
                                    <span style={{ fontSize: '1rem', opacity: 0.8 }}> / {totalWeeklyGoal} mins</span>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div style={{
                                width: '100%',
                                height: '16px',
                                background: 'rgba(44, 51, 51, 0.1)', // Darker background for contrast
                                borderRadius: 'var(--radius-full)',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${weeklyPercent}%`,
                                    height: '100%',
                                    background: '#2C3333', // Dark fill
                                    borderRadius: 'var(--radius-full)',
                                    transition: 'width 1s ease-out'
                                }} />
                            </div>
                            {weeklyPercent >= 100 && (
                                <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '1rem', fontWeight: 'bold', animation: 'fadeIn 0.5s' }}>
                                    🎉 Goal Met! Amazing work!
                                </div>
                            )}
                        </div>
                    </Link>

                    {!user && (
                        <div style={{ marginTop: '16px', textAlign: 'center' }}>
                            <div style={{
                                background: 'rgba(255,255,255,0.7)',
                                padding: '16px',
                                borderRadius: '16px',
                                border: '1px solid var(--color-border)',
                                marginBottom: '16px'
                            }}>
                                <p className="text-body" style={{ marginBottom: '12px' }}>
                                    Sign in to save your stats and access your data from any device! ☁️
                                </p>
                                <Link href="/login" className="btn btn-primary" style={{ width: '100%', display: 'block' }}>
                                    Sign In / Sign Up
                                </Link>
                            </div>
                        </div>
                    )}
                </section>

                <section>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 className="text-h2" style={{ margin: 0 }}>Your Subjects</h2>
                        {state.classes.filter(c => !c.isArchived).length > 0 && (
                            <Link href="/onboarding?mode=add" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                                + Add Subject
                            </Link>
                        )}
                    </div>
                    {state.connectionError ? (
                        <div className="card text-center" style={{ padding: '40px', border: '2px solid #ef4444' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
                            <h3 className="text-h3" style={{ color: '#ef4444', marginBottom: '8px' }}>Connection Error</h3>
                            <p className="text-body" style={{ marginBottom: '24px', color: 'var(--color-text-secondary)' }}>
                                We couldn't load your data. Please check your internet connection.
                            </p>
                            <button
                                onClick={() => refreshData()}
                                className="btn btn-primary"
                                style={{ minWidth: '120px' }}
                            >
                                Retry
                            </button>
                        </div>
                    ) : isLoading ? (
                        <div style={{ minHeight: '30vh' }} />
                    ) : state.classes.filter(c => !c.isArchived).length === 0 ? (
                        <div className="card text-center">
                            <p className="text-body">No subjects yet.</p>
                            <Link href="/onboarding?mode=add" className="btn btn-primary" style={{ marginTop: '16px' }}>
                                Add Your First Subject
                            </Link>
                        </div>
                    ) : (
                        state.classes.filter(c => !c.isArchived).map((cls) => {
                            const progress = getClassProgress(cls.id);
                            const goal = cls.weeklyGoalMinutes;
                            const percent = Math.min(100, (progress / goal) * 100);

                            return (
                                <div key={cls.id} className="card" style={{ borderLeft: `6px solid ${cls.color}`, position: 'relative' }}>
                                    {/* Delete Button */}
                                    <button
                                        onClick={() => handleDeleteClick(cls.id)}
                                        style={{
                                            position: 'absolute', top: '10px', right: '10px',
                                            background: 'transparent', border: 'none', cursor: 'pointer',
                                            width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.5rem', opacity: 0.5, padding: 0
                                        }}
                                    >
                                        &times;
                                    </button>

                                    {/* Edit Button */}
                                    <Link
                                        href={`/onboarding?classId=${cls.id}`}
                                        style={{
                                            position: 'absolute', top: '10px', right: '46px',
                                            background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.5,
                                            textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            width: '32px', height: '32px'
                                        }}
                                    >
                                        <img src="/icons/icon_pencil.png" alt="Edit" style={{ width: '32px', height: '32px' }} />
                                    </Link>

                                    <div style={{ marginBottom: '8px', paddingRight: '60px' }}>
                                        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>{cls.name}</h3>
                                    </div>

                                    {/* Progress Bar */}
                                    <div style={{
                                        width: '100%',
                                        height: '8px',
                                        background: 'var(--color-border)',
                                        borderRadius: 'var(--radius-full)',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            width: `${percent}%`,
                                            height: '100%',
                                            background: cls.color,
                                            borderRadius: 'var(--radius-full)'
                                        }} />
                                    </div>
                                    <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '6px' }}>
                                        {Math.round(progress)} / {goal} mins
                                    </div>

                                    <div style={{ marginTop: '16px', textAlign: 'right' }}>
                                        <Link
                                            href={`/study?classId=${cls.id}`}
                                            className="btn"
                                            style={{
                                                padding: '12px 24px',
                                                fontSize: '1rem',
                                                fontWeight: 'bold',
                                                background: 'linear-gradient(135deg, #FF7E36, #E84545)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '24px',
                                                boxShadow: '0 4px 15px rgba(232, 69, 69, 0.4)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                animation: 'pulse 2s infinite'
                                            }}
                                        >
                                            Study Now <img src="/icons/icon_books.png" alt="Books" style={{ width: '28px', height: '28px' }} />
                                        </Link>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </section>





                {/* Delete Confirmation Modal */}
                <Modal
                    isOpen={!!classToDelete}
                    onClose={() => setClassToDelete(null)}
                    title="Delete Class?"
                    type="danger"
                    actions={
                        <>
                            <button className="btn btn-secondary" onClick={() => setClassToDelete(null)}>Cancel</button>
                            <button className="btn" style={{ background: 'var(--color-error)', color: 'white' }} onClick={confirmDelete}>Delete</button>
                        </>
                    }
                >
                    Are you sure you want to delete this class? This action cannot be undone.
                </Modal>

                {/* Weekly Goal Met Modal - Share All Goals Achievement */}
                <ShareProgressModal
                    isOpen={showWeeklyCongrats}
                    onClose={() => setShowWeeklyCongrats(false)}
                    className="All Classes"
                    minutesStudied={totalWeeklyMinutes}
                    goalMinutes={totalWeeklyGoal}
                    isAllGoalsCelebration={true}
                    onPlayGame={() => router.push('/games')}
                    onContinueStudying={() => setShowWeeklyCongrats(false)}
                />

                {/* Earned Modal (Legacy/Winner) */}
                {
                    showEarnedModal && (
                        <div style={{
                            position: 'fixed', top: '10%', left: '50%', transform: 'translateX(-50%)',
                            zIndex: 2000, pointerEvents: 'none'
                        }}>
                            <div style={{
                                background: 'white',
                                padding: '16px 24px',
                                borderRadius: 'var(--radius-full)',
                                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                animation: 'fadeIn 0.3s ease-out',
                                border: '1px solid var(--color-border)'
                            }}>
                                <div style={{ fontSize: '1.5rem' }}>{isWinner ? '🏆' : '🌭'}</div>
                                <div>
                                    <p style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{isWinner ? 'You Won!' : 'Good Job!'}</p>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>+{earnedAmount} Coins 💰</p>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* NEW Gift Received Modal */}
                <Modal
                    isOpen={!!giftData}
                    onClose={() => setGiftData(null)}
                    title="🎁 You got a Gift!"
                    type="default"
                    actions={
                        <>
                            <button className="btn btn-secondary" onClick={() => setGiftData(null)}>
                                Thanks!
                            </button>
                            {giftData?.gameMinutes && giftData.gameMinutes > 0 && (
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        setGiftData(null);
                                        router.push('/games');
                                    }}
                                >
                                    Play Now 🎮
                                </button>
                            )}
                        </>
                    }
                >
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '16px', animation: 'bounce 1s infinite' }}>🎁</div>
                        <h3 className="text-h3" style={{ marginBottom: '8px' }}>From {giftData?.senderName || 'A Secret Admirer'}</h3>
                        <p className="text-body" style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
                            You've been rewarded for your hard work!
                        </p>

                        <div style={{
                            display: 'flex', gap: '16px', justifyContent: 'center',
                            background: '#f8fafc', padding: '16px', borderRadius: '16px'
                        }}>
                            {giftData?.coins ? (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b' }}>+{giftData.coins}</div>
                                    <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700, color: '#94a3b8' }}>Coins</div>
                                </div>
                            ) : null}
                            {giftData?.gameMinutes ? (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ec4899' }}>+{giftData.gameMinutes}m</div>
                                    <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700, color: '#94a3b8' }}>Game Time</div>
                                </div>
                            ) : null}
                            {giftData?.giftCredits && (giftData.giftCredits.legendary > 0 || giftData.giftCredits.epic > 0 || giftData.giftCredits.rare > 0) ? (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem' }}>🎁</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '8px 0' }}>
                                        {giftData.giftCredits.legendary > 0 && (
                                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#9d4edo' }}>
                                                {giftData.giftCredits.legendary} Legendary Credit{giftData.giftCredits.legendary > 1 ? 's' : ''}
                                            </div>
                                        )}
                                        {giftData.giftCredits.epic > 0 && (
                                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#a855f7' }}>
                                                {giftData.giftCredits.epic} Epic Credit{giftData.giftCredits.epic > 1 ? 's' : ''}
                                            </div>
                                        )}
                                        {giftData.giftCredits.rare > 0 && (
                                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#3b82f6' }}>
                                                {giftData.giftCredits.rare} Rare Credit{giftData.giftCredits.rare > 1 ? 's' : ''}
                                            </div>
                                        )}
                                    </div>
                                    <Link href="/shop" className="btn btn-primary" style={{
                                        textDecoration: 'none',
                                        fontSize: '0.8rem',
                                        marginTop: '8px',
                                        padding: '8px 16px',
                                        display: 'inline-block'
                                    }}>
                                        Go to Shop
                                    </Link>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </Modal>

                {/* Footer / Settings */}
                <div style={{ marginTop: '32px', textAlign: 'center', paddingBottom: '32px' }}>
                    <Link href="/settings" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <img src="/icons/settings.png" alt="Settings" style={{ width: '36px', height: '36px' }} /> Settings
                    </Link>
                </div>
            </main >

            {/* Full-Screen Splash Overlay — OUTSIDE main to avoid transform breaking position:fixed */}
            {showSplash && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: 9999,
                    background: 'linear-gradient(180deg, #fff5ee 0%, #ffe4d4 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: splashFading ? 0 : 1,
                    transition: 'opacity 0.5s ease-out',
                    pointerEvents: splashFading ? 'none' : 'auto'
                }}>
                    <img
                        src="/assets/avatar_golden_munchkin.png"
                        alt="Loading..."
                        style={{
                            width: '200px',
                            height: '200px',
                            objectFit: 'contain',
                            imageRendering: 'pixelated',
                            animation: 'splash-bounce 1.5s ease-in-out infinite',
                            filter: 'drop-shadow(0 12px 32px rgba(255, 126, 54, 0.4))'
                        }}
                    />
                    <p style={{
                        marginTop: '28px',
                        fontSize: '1.2rem',
                        fontWeight: 700,
                        color: '#E84545',
                        animation: 'splash-fade 1.5s ease-in-out infinite'
                    }}>Loading your stuff...</p>
                    <style jsx>{`
                        @keyframes splash-bounce {
                            0%, 100% { transform: scale(1); }
                            50% { transform: scale(1.06); }
                        }
                        @keyframes splash-fade {
                            0%, 100% { opacity: 0.5; }
                            50% { opacity: 1; }
                        }
                    `}</style>
                </div>
            )}
        </>
    );
}

export default function Dashboard() {
    return (
        <Suspense fallback={<div className="container text-center" style={{ marginTop: '20vh' }}>Loading Dashboard...</div>}>
            <DashboardContent />
        </Suspense>
    );
}
