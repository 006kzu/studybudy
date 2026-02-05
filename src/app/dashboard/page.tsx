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
    const { state, removeClass, user, signOut, isLoading, refreshData } = useApp();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [showEarnedModal, setShowEarnedModal] = useState(false);
    const [earnedAmount, setEarnedAmount] = useState(0);
    const [isWinner, setIsWinner] = useState(false);
    const [showWeeklyCongrats, setShowWeeklyCongrats] = useState(false);

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
    const [giftData, setGiftData] = useState<{ coins: number, gameMinutes: number, senderName: string } | null>(null);

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
                // We add a small delay to ensure AppContext is fully ready or just call it.
                // Assuming claimPendingGifts handles the DB call.
                const { claimPendingGifts } = state as any; // Cast if type missing in interface, but should be there
                // Actually claimPendingGifts is in the returned context object, not 'state'.
            }
        };
        // checkGifts called below in correct effect
    }, [searchParams, router, user, isLoading]);

    // Separate Effect for Claiming Gifts to avoid missing dependencies in the complex one above
    const { claimPendingGifts } = useApp();
    useEffect(() => {
        let mounted = true;
        const claim = async () => {
            if (!user || isLoading) return;
            const gift = await claimPendingGifts();
            if (mounted && gift && (gift.coins > 0 || gift.gameMinutes > 0)) {
                setGiftData(gift);
                // Play sound?
            }
        };
        claim();
        return () => { mounted = false; };
    }, [user, isLoading, claimPendingGifts]);

    // Auto-Retry Fetch for "Missing Classes" bug
    // If logged in, not loading, but no data? Try once more.
    const [hasRetried, setHasRetried] = useState(false);

    useEffect(() => {
        if (user && !isLoading && state.classes.length === 0 && !hasRetried) {
            console.log('[Dashboard] Logged in but no classes found. Attempting one auto-refresh...');
            setHasRetried(true);
            refreshData();
        }
    }, [user, isLoading, state.classes.length, hasRetried, refreshData]);

    // Redirect to Onboarding if new user (AND hasn't selected a role yet)
    useEffect(() => {
        if (user && !isLoading) {
            // If they haven't finished onboarding AND haven't even selected a role, send them to setup
            if (!state.isOnboarded && !state.isRoleSet) {
                console.log('[Dashboard] User not onboarded & no role. Redirecting to setup...');
                router.replace('/onboarding');
            }
        }
    }, [user, isLoading, state.isOnboarded, state.isRoleSet, router]);

    // Redirect Parents to Parent Dashboard
    useEffect(() => {
        // If they are a parent (either fully onboarded OR just selected the role), go to parent view
        if (user && !isLoading && (state.isOnboarded || state.isRoleSet) && state.role === 'parent') {
            console.log('[Dashboard] Parent user detected. Redirecting to parent dashboard...');
            router.replace('/parent');
        }
    }, [user, isLoading, state.isOnboarded, state.isRoleSet, state.role, router]);

    // --- AdMob Logic ---
    useEffect(() => {
        // Only run on native
        const manageAds = async () => {
            const { AdMobService } = await import('@/lib/admob');
            if (!state.isPremium) {
                console.log('[Dashboard] Non-premium user, showing banner...');
                await AdMobService.showBanner();
            } else {
                console.log('[Dashboard] Premium user, hiding banner.');
                await AdMobService.hideBanner();
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
    const activeClasses = state.classes.filter(c => !c.isArchived);

    // Sum of all active class goals
    const totalWeeklyGoal = activeClasses.reduce((acc, c) => acc + c.weeklyGoalMinutes, 0);

    // Sum of all study sessions for active classes this week
    const totalWeeklyMinutes = state.studySessions
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
        const sessions = state.studySessions.filter(s => s.classId === classId);
        const totalMinutes = sessions.reduce((acc, curr) => acc + curr.durationMinutes, 0);
        return totalMinutes;
    };

    return (
        <main className="container" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
            <header style={{ marginBottom: '24px' }}>
                {/* Top Row: Title & Avatar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
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

                    <div style={{ marginRight: '0px' }}>
                        <WienerAvatar points={state.points} inventory={state.inventory} equippedAvatar={state.equippedAvatar} coinPosition="top" size="small" />
                    </div>
                </div>

                {/* Bottom Row: Navigation Links */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    gap: '12px',
                    alignItems: 'start',
                    justifyItems: 'center',
                    paddingTop: '12px'
                }}>
                    <Link href="/schedule" style={{ fontSize: '0.7rem', color: 'var(--color-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none' }}>
                        <img src="/icons/schedule.png" alt="Schedule" style={{ width: '64px', height: '64px', marginBottom: '-4px' }} />
                        Schedule
                    </Link>
                    <Link href="/shop" style={{ fontSize: '0.7rem', color: 'var(--color-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none' }}>
                        <img src="/icons/shop.png" alt="Shop" style={{ width: '64px', height: '64px', marginBottom: '-4px' }} />
                        Shop
                    </Link>
                    <Link href="/stats" style={{ fontSize: '0.7rem', color: 'var(--color-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none' }}>
                        <img src="/icons/stats.png" alt="Stats" style={{ width: '64px', height: '64px', marginBottom: '-4px' }} />
                        Stats
                    </Link>
                    <Link href="/leaderboard" style={{ fontSize: '0.7rem', color: 'var(--color-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none' }}>
                        <img src="/icons/leaderboard.png" alt="Leaderboard" style={{ width: '64px', height: '64px', marginBottom: '-4px' }} />
                        Leaderboard
                    </Link>
                </div>
            </header>

            <section style={{ marginBottom: '32px' }}>
                <div className="card" style={{ background: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)', color: 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                        <div>
                            <h2 style={{ fontSize: '1.4rem', margin: 0, opacity: 1, fontWeight: 800 }}>
                                Weekly Focus <img src="/icons/focus.png" alt="Focus" style={{ width: '48px', height: '48px', verticalAlign: 'middle', marginLeft: '8px' }} />
                            </h2>
                            <p style={{ fontSize: '0.9rem', margin: '4px 0 0', opacity: 0.9 }}>All Classes Combined</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '2rem', fontWeight: 800 }}>{Math.round(totalWeeklyMinutes)}</span>
                            <span style={{ fontSize: '1rem', opacity: 0.9 }}> / {totalWeeklyGoal} mins</span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{
                        width: '100%',
                        height: '16px',
                        background: 'rgba(255,255,255,0.2)',
                        borderRadius: 'var(--radius-full)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${weeklyPercent}%`,
                            height: '100%',
                            background: '#FFFFFF',
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
                    <h2 className="text-h2" style={{ margin: 0 }}>Your Classes</h2>
                    {state.classes.filter(c => !c.isArchived).length > 0 && (
                        <Link href="/onboarding" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                            + Add Class
                        </Link>
                    )}
                </div>
                {isLoading ? (
                    <div className="card text-center" style={{ padding: '40px' }}>
                        <div className="spinner"></div>
                        <p className="text-body" style={{ marginTop: '16px' }}>Fetching your schedule...</p>
                        <style jsx>{`
                            .spinner {
                                display: inline-block;
                                width: 30px;
                                height: 30px;
                                border: 3px solid rgba(0, 0, 0, 0.1);
                                border-left-color: var(--color-primary, #FF7E36);
                                border-radius: 50%;
                                animation: spin 1s linear infinite;
                            }
                            @keyframes spin { 100% { transform: rotate(360deg); } }
                         `}</style>
                    </div>
                ) : state.classes.filter(c => !c.isArchived).length === 0 ? (
                    <div className="card text-center">
                        <p className="text-body">No classes yet.</p>
                        <Link href="/onboarding" className="btn btn-primary" style={{ marginTop: '16px' }}>
                            Add Your First Class
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
                                        background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.5
                                    }}
                                >
                                    &times;
                                </button>

                                {/* Edit Button */}
                                <Link
                                    href={`/onboarding?classId=${cls.id}`}
                                    style={{
                                        position: 'absolute', top: '12px', right: '40px',
                                        background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', opacity: 0.5,
                                        textDecoration: 'none'
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
                                        className="btn btn-primary"
                                        style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                                    >
                                        Study Now <img src="/icons/icon_books.png" alt="Books" style={{ width: '32px', height: '32px', verticalAlign: 'middle', marginLeft: '8px' }} />
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
            {showEarnedModal && (
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
            )}

            {/* NEW Gift Received Modal */}
            <Modal
                isOpen={!!giftData}
                onClose={() => setGiftData(null)}
                title="🎁 You got a Gift!"
                type="default"
                actions={
                    <>
                        <button className="btn btn-secondary" onClick={() => setGiftData(null)}>
                            {giftData?.gameMinutes && giftData.gameMinutes > 0 ? 'Save for Later' : 'Awesome!'}
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
                    </div>
                </div>
            </Modal>
            {/* Footer / Settings */}
            <div style={{ marginTop: '32px', textAlign: 'center', paddingBottom: '32px' }}>
                <Link href="/settings" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <img src="/icons/settings.png" alt="Settings" style={{ width: '36px', height: '36px' }} /> Settings
                </Link>
            </div>
        </main>
    );
}

export default function Dashboard() {
    return (
        <Suspense fallback={<div className="container text-center" style={{ marginTop: '20vh' }}>Loading Dashboard...</div>}>
            <DashboardContent />
        </Suspense>
    );
}
