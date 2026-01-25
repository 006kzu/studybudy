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

    // Calculate progress for each class
    const getClassProgress = (classId: string) => {
        const sessions = state.studySessions.filter(s => s.classId === classId);
        const totalMinutes = sessions.reduce((acc, curr) => acc + curr.durationMinutes, 0);
        return totalMinutes;
    };

    return (
        <main className="container">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 className="text-h1">Dashboard</h1>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <Link href="/schedule" style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: 600 }}>📅 Schedule</Link>
                        <Link href="/shop" style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: 600 }}>🛍️ Shop</Link>
                        <Link href="/settings" style={{ fontSize: '1.2rem', textDecoration: 'none' }} title="Settings">⚙️</Link>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {!user && (
                        <Link href="/login" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
                            ☁️ Login / Sync
                        </Link>
                    )}
                    {user && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: '8px' }}>
                            <span style={{ fontSize: '0.8rem', color: '#666' }}>
                                {user.email?.split('@')[0]}
                            </span>
                            <button
                                onClick={handleLogout}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--color-primary)',
                                    fontSize: '0.7rem',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    padding: 0
                                }}
                            >
                                Log out
                            </button>
                        </div>
                    )}
                    <WienerAvatar points={state.points} inventory={state.inventory} equippedAvatar={state.equippedAvatar} />
                </div>
            </header>

            <section>
                <h2 className="text-h2">Your Classes</h2>
                {isLoading ? (
                    <div className="card text-center" style={{ padding: '40px' }}>
                        <div style={{ fontSize: '2rem', animation: 'spin 1s linear infinite', display: 'inline-block' }}>🌭</div>
                        <p className="text-body" style={{ marginTop: '16px' }}>Fetching your schedule...</p>
                        <style jsx>{`
                            @keyframes spin { 100% { transform: rotate(360deg); } }
                         `}</style>
                    </div>
                ) : state.classes.length === 0 ? (
                    <div className="card text-center">
                        <p className="text-body">No classes yet.</p>
                        <Link href="/onboarding" className="btn btn-secondary" style={{ marginTop: '16px' }}>
                            Add Class
                        </Link>
                    </div>
                ) : (
                    state.classes.map((cls) => {
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

                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingRight: '24px' }}>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{cls.name}</h3>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>{Math.round(progress)} / {goal} mins</span>
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

                {/* Add Class Button - Bottom of List */}
                <Link href="/onboarding" className="btn btn-secondary" style={{ width: '100%', marginTop: '16px', borderStyle: 'dashed' }}>
                    ➕ Add Another Class
                </Link>
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
