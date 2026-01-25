'use client';

import { useApp } from '@/context/AppContext';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import WienerAvatar from '@/components/WienerAvatar';

export default function StatsPage() {
    const { state } = useApp();

    // -- Metrics Calculation --
    const totalMinutes = useMemo(() => {
        return state.studySessions.reduce((acc, curr) => acc + curr.durationMinutes, 0);
    }, [state.studySessions]);

    const totalHours = (totalMinutes / 60).toFixed(1);

    const classStats = useMemo(() => {
        const stats: Record<string, number> = {};

        // Initialize with 0 for all active classes
        state.classes.forEach(c => {
            stats[c.id] = 0;
        });

        // Sum up sessions
        state.studySessions.forEach(s => {
            stats[s.classId] = (stats[s.classId] || 0) + s.durationMinutes;
        });

        // Convert to array for display
        return Object.entries(stats)
            .map(([classId, minutes]) => {
                const cls = state.classes.find(c => c.id === classId);
                return {
                    classId,
                    minutes,
                    className: cls?.name || 'Unknown Class',
                    color: cls?.color || '#ccc'
                };
            })
            .sort((a, b) => b.minutes - a.minutes); // Sort by most studied
    }, [state.studySessions, state.classes]);

    // -- Achievements Logic --
    // Simple milestones for now
    const achievements = [
        // Easy / Starter
        { id: 'first_step', title: 'First Step', desc: 'Study for 15 minutes', thresholdMin: 15, icon: '🐣' },
        { id: 'scholar', title: 'Scholar', desc: 'Study for 10 hours', thresholdMin: 600, icon: '🎓' },

        // Hours Milestones
        { id: 'dedicated', title: 'Dedicated', desc: 'Study for 50 hours', thresholdMin: 3000, icon: '📚' },
        { id: 'master', title: 'Master', desc: 'Study for 100 hours', thresholdMin: 6000, icon: '🧙‍♂️' },
        { id: 'obsessed', title: 'Obsessed', desc: 'Study for 200 hours', thresholdMin: 12000, icon: '🧠' },
        { id: 'einstein', title: 'Einstein', desc: 'Study for 500 hours', thresholdMin: 30000, icon: '⚡' },
        { id: 'time_lord', title: 'Time Lord', desc: 'Study for 1000 hours', thresholdMin: 60000, icon: '⏳' },

        // Wealth Milestones
        { id: 'rich', title: 'Rich Dog', desc: 'Earn 1000 Coins', thresholdCoins: 1000, icon: '💰' },
        { id: 'hoarder', title: 'Coin Hoarder', desc: 'Earn 2,500 Coins', thresholdCoins: 2500, icon: '🏦' },
        { id: 'tycoon', title: 'Tycoon', desc: 'Earn 5,000 Coins', thresholdCoins: 5000, icon: '🤑' },

        // Collection Milestones
        { id: 'collector', title: 'Collector', desc: 'Own 3 Avatars', thresholdItems: 3, icon: '🎨' },
        { id: 'fashionista', title: 'Fashionista', desc: 'Own 5 Avatars', thresholdItems: 5, icon: '👗' },
        { id: 'menagerie', title: 'The Menagerie', desc: 'Own 10 Avatars', thresholdItems: 10, icon: '🦁' },

        // Special Stats
        { id: 'jack', title: 'Jack of All Trades', desc: 'Study 5 different classes for 1+ hour each', special: 'jack', icon: '🛠️' },
        { id: 'specialist', title: 'Specialist', desc: 'Study a single class for 50+ hours', special: 'specialist', icon: '🔬' },
    ];

    return (
        <main className="container">
            <div style={{ marginBottom: '16px' }}>
                <Link href="/dashboard" style={{ textDecoration: 'none', color: 'var(--color-text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ← Back to Dashboard
                </Link>
            </div>

            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 className="text-h1">Statistics</h1>
                    <p className="text-body" style={{ opacity: 0.7 }}>Your academic journey</p>
                </div>
                <WienerAvatar points={state.points} inventory={state.inventory} equippedAvatar={state.equippedAvatar} />
            </header>

            {/* Overview Cards */}
            <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
                <div className="card text-center">
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⏱️</div>
                    <div className="text-h2">{totalHours}</div>
                    <div className="text-body" style={{ fontSize: '0.8rem', opacity: 0.7 }}>Total Study Hours</div>
                </div>
                <div className="card text-center">
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💰</div>
                    <div className="text-h2">{state.points}</div>
                    <div className="text-body" style={{ fontSize: '0.8rem', opacity: 0.7 }}>Lifetime Coins</div>
                </div>
            </section>

            {/* Class Breakdown */}
            <section style={{ marginBottom: '32px' }}>
                <h2 className="text-h2" style={{ marginBottom: '16px' }}>Subject Breakdown</h2>
                {classStats.length === 0 ? (
                    <p className="text-body" style={{ opacity: 0.6, fontStyle: 'italic' }}>No study sessions recorded yet.</p>
                ) : (
                    <div className="card">
                        {classStats.map(item => (
                            <div key={item.classId} style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.9rem' }}>
                                    <span style={{ fontWeight: 600 }}>{item.className}</span>
                                    <span>{(item.minutes / 60).toFixed(1)} hrs</span>
                                </div>
                                {/* Progress Bar representing % of total study time */}
                                <div style={{
                                    width: '100%',
                                    height: '8px',
                                    background: '#f0f0f0',
                                    borderRadius: '4px',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        width: `${totalMinutes > 0 ? (item.minutes / totalMinutes) * 100 : 0}%`,
                                        height: '100%',
                                        background: item.color,
                                        borderRadius: '4px'
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Achievements */}
            <section>
                <h2 className="text-h2" style={{ marginBottom: '16px' }}>Achievements</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
                    {achievements.map(ach => {
                        let isUnlocked = false;
                        if (ach.thresholdMin && totalMinutes >= ach.thresholdMin) isUnlocked = true;
                        if (ach.thresholdCoins && state.points >= ach.thresholdCoins) isUnlocked = true;
                        if (ach.thresholdItems && state.inventory.length >= ach.thresholdItems) isUnlocked = true;

                        // Special Logic
                        if (ach.special === 'jack') {
                            if (classStats.filter(c => c.minutes >= 60).length >= 5) isUnlocked = true;
                        }
                        if (ach.special === 'specialist') {
                            if (classStats.some(c => c.minutes >= 3000)) isUnlocked = true; // 50 hours
                        }

                        return (
                            <div
                                key={ach.id}
                                className="card text-center"
                                style={{
                                    opacity: isUnlocked ? 1 : 0.5,
                                    filter: isUnlocked ? 'none' : 'grayscale(100%)',
                                    background: isUnlocked ? 'white' : '#f9f9f9',
                                    transition: 'all 0.2s',
                                    border: isUnlocked ? '2px solid var(--color-primary)' : '1px solid #eee'
                                }}
                            >
                                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{ach.icon}</div>
                                <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>{ach.title}</h3>
                                <p style={{ fontSize: '0.7rem', color: isUnlocked ? 'var(--color-text-secondary)' : '#999' }}>{ach.desc}</p>
                                {!isUnlocked && <div style={{ fontSize: '0.7rem', marginTop: '8px', color: '#999' }}>🔒 Locked</div>}
                            </div>
                        );
                    })}
                </div>
            </section>
        </main>
    );
}
