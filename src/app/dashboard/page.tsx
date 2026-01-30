'use client';

import { useApp } from '@/context/AppContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import WienerAvatar from '@/components/WienerAvatar';
import Modal from '@/components/Modal';

import { Suspense } from 'react';

function DashboardContent() {
    const { state, removeClass, user, signOut, isLoading } = useApp();
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

    // Check for earnings on mount
    useEffect(() => {
        const earned = searchParams.get('earned');
        const winner = searchParams.get('winner');

        if (earned) {
            setShowEarnedModal(true);
            setEarnedAmount(Number(earned));
            setIsWinner(winner === 'true');

            // Auto close after 2 seconds
            const timer = setTimeout(() => {
                setShowEarnedModal(false);
                router.replace('/dashboard'); // Clean URL after close
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [searchParams, router]);

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
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ paddingTop: '8px' }}>
                    <h1 className="text-h1" style={{ margin: 0, lineHeight: 1 }}>Dashboard</h1>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
                        <Link href="/schedule" style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 600 }}>📅 Schedule</Link>
                        <Link href="/shop" style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 600 }}>🛍️ Shop</Link>
                        <Link href="/stats" style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 600 }}>📊 Stats</Link>
                    </div>
                    {user && (
                        <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--color-text-secondary)',
                            marginTop: '8px',
                            fontWeight: 500
                        }}>
                            👋 Hi, {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Friend'}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginTop: '-12px' }}>
                    <WienerAvatar points={state.points} inventory={state.inventory} equippedAvatar={state.equippedAvatar} />
                </div>
            </header>

            <section style={{ marginBottom: '32px' }}>
                <div className="card" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)', color: 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                        <div>
                            <h2 style={{ fontSize: '1.4rem', margin: 0, opacity: 1, fontWeight: 800 }}>Weekly Focus 🎯</h2>
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
                                    ✏️
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
                                        Study Now 📚
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

            {/* Weekly Goal Met Modal */}
            <Modal
                isOpen={showWeeklyCongrats}
                onClose={() => setShowWeeklyCongrats(false)}
                title="Weekly Goal Met! 🏆"
                actions={
                    <button className="btn btn-primary" onClick={() => setShowWeeklyCongrats(false)}>Let's Go! 🚀</button>
                }
            >
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎉</div>
                    <p style={{ fontSize: '1.2rem', marginBottom: '12px' }}>
                        You've hit your total goal of <strong>{totalWeeklyGoal} minutes</strong> for the week!
                    </p>
                    <p className="text-body">
                        Your dedication is paying off. Enjoy that sense of accomplishment!
                    </p>
                </div>
            </Modal>

            {/* Earned Modal - Keeping custom for "Reward" feel */}
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
            {/* Footer / Settings */}
            <div style={{ marginTop: '32px', textAlign: 'center', paddingBottom: '32px' }}>
                <Link href="/settings" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '1.2rem' }}>⚙️</span> Settings
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
