'use client';

import { useApp } from '@/context/AppContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Dashboard() {
    const { state } = useApp();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [showEarnedModal, setShowEarnedModal] = useState(false);
    const [earnedAmount, setEarnedAmount] = useState(0);
    const [isWinner, setIsWinner] = useState(false);

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
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <Link href="/schedule" style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: 600 }}>📅 Schedule</Link>
                        <Link href="/shop" style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: 600 }}>🛍️ Shop</Link>
                    </div>
                </div>
                <div style={{
                    background: 'var(--color-surface)',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-full)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 'bold'
                }}>
                    <span>🦴</span>
                    <span>{state.points}</span>
                </div>
            </header>

            <section>
                <h2 className="text-h2">Your Classes</h2>
                {state.classes.length === 0 ? (
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
                            <div key={cls.id} className="card" style={{ borderLeft: `6px solid ${cls.color}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{cls.name}</h3>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>{Math.round(progress / 60)} / {goal / 60} hrs</span>
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
                                        Study Now 🐶
                                    </Link>
                                </div>
                            </div>
                        );
                    })
                )}
            </section>

            <section style={{ marginTop: '24px' }}>
                <div className="card" style={{ background: 'linear-gradient(135deg, #FF7E36 0%, #FFD700 100%)', color: 'white' }}>
                    <h2 className="text-h2" style={{ color: 'white' }}>Weekly Challenge</h2>
                    <p style={{ opacity: 0.9 }}>Study for 10 hours total to unlock the "Golden Collar".</p>
                </div>
            </section>

            {/* Earned Modal */}
            {showEarnedModal && (
                <div style={{
                    position: 'fixed', top: '10%', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 100, pointerEvents: 'none'
                }}>
                    <div style={{
                        background: 'white',
                        padding: '16px 24px',
                        borderRadius: 'var(--radius-full)',
                        boxShadow: 'var(--shadow-float)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        animation: 'fadeIn 0.3s ease-out',
                        border: '1px solid var(--color-border)'
                    }}>
                        <div style={{ fontSize: '1.5rem' }}>{isWinner ? '🏆' : '🦴'}</div>
                        <div>
                            <p style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{isWinner ? 'You Won!' : 'Good Job!'}</p>
                            <p style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>+{earnedAmount} Bones</p>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
