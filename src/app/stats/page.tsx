'use client';

import { useApp } from '@/context/AppContext';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function StatsPage() {
    const { state } = useApp();
    const [loading, setLoading] = useState(true);

    // Calculate start of week (Monday)
    const getStartOfWeek = () => {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday.getTime();
    };

    const startOfWeek = getStartOfWeek();

    // Stats Calculation
    const sessions = state.studySessions || [];
    const classes = state.classes || [];

    const totalStudyTimeMinutes = sessions.reduce((acc, s) => acc + s.durationMinutes, 0);
    const weeklyStudyMinutes = sessions
        .filter(s => s.timestamp >= startOfWeek)
        .reduce((acc, s) => acc + s.durationMinutes, 0);

    const totalWeeklyGoal = classes.reduce((acc, c) => acc + c.weeklyGoalMinutes, 0);
    const weeklyPercent = totalWeeklyGoal > 0 ? Math.min(100, (weeklyStudyMinutes / totalWeeklyGoal) * 100) : 0;

    // Sessions per class
    const classStats = classes.map(cls => {
        const classSessions = sessions.filter(s => s.classId === cls.id);
        const classMinutes = classSessions.reduce((acc, s) => acc + s.durationMinutes, 0);
        const weeklyClassMinutes = classSessions
            .filter(s => s.timestamp >= startOfWeek)
            .reduce((acc, s) => acc + s.durationMinutes, 0);
        return {
            ...cls,
            totalMinutes: classMinutes,
            weeklyMinutes: weeklyClassMinutes,
            sessionCount: classSessions.length
        };
    }).sort((a, b) => b.totalMinutes - a.totalMinutes);

    // Recent Activity (Top 10)
    const recentActivity = [...sessions]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);

    useEffect(() => {
        // Mock loading delay for smooth transition
        const timer = setTimeout(() => setLoading(false), 300);
        return () => clearTimeout(timer);
    }, []);

    if (loading) {
        return (
            <div className="container" style={{
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    border: '4px solid #CBE4DE',
                    borderTop: '4px solid #0E8388',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }} />
                <style jsx>{`
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                `}</style>
            </div>
        );
    }

    return (
        <main className="container" style={{
            paddingTop: 'calc(env(safe-area-inset-top) + 20px)',
            paddingBottom: '40px',
            minHeight: '100vh'
        }}>
            {/* Header */}
            <header style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '24px'
            }}>
                <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.8)',
                        padding: '8px 16px',
                        borderRadius: '12px',
                        fontWeight: 700,
                        color: '#2C3333',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        fontSize: '0.9rem'
                    }}>
                        ← Back
                    </div>
                </Link>
                <div style={{
                    background: '#CBE4DE',
                    color: '#2C3333',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontWeight: 800,
                    fontSize: '1.2rem',
                    boxShadow: '0 4px 12px rgba(14, 131, 136, 0.15)'
                }}>
                    My Stats 📊
                </div>
                <div style={{ width: '60px' }}></div> {/* Spacer for balance */}
            </header>

            {/* Weekly Progress Card */}
            <section style={{ marginBottom: '24px' }}>
                <div className="card" style={{
                    background: '#CBE4DE',
                    color: '#2C3333',
                    border: '1px solid rgba(14, 131, 136, 0.2)',
                    boxShadow: '0 8px 32px rgba(14, 131, 136, 0.1)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                Weekly Focus <img src="/icons/focus.png" alt="Focus" style={{ width: '32px', height: '32px' }} />
                            </h2>
                            <p style={{ fontSize: '0.9rem', margin: '4px 0 0', opacity: 0.7 }}>Total Study Time</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '2rem', fontWeight: 800 }}>{Math.round(weeklyStudyMinutes)}</span>
                            <span style={{ fontSize: '1rem', opacity: 0.7 }}> / {totalWeeklyGoal}m</span>
                        </div>
                    </div>

                    <div style={{
                        width: '100%',
                        height: '20px',
                        background: 'rgba(44, 51, 51, 0.1)',
                        borderRadius: 'var(--radius-full)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${weeklyPercent}%`,
                            height: '100%',
                            background: '#2C3333',
                            borderRadius: 'var(--radius-full)',
                            transition: 'width 1s ease-out'
                        }} />
                    </div>

                    {weeklyPercent >= 100 && (
                        <div style={{ marginTop: '12px', textAlign: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
                            🎉 Goal Crushed! Amazing work!
                        </div>
                    )}
                </div>
            </section>

            {/* Quick Stats Grid */}
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
                <div className="card" style={{ textAlign: 'center', padding: '16px', background: '#fff', border: '1px solid #eee' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '4px' }}>Total Hours</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f97316' }}>
                        {Math.round(totalStudyTimeMinutes / 60)}h
                    </div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '16px', background: '#fff', border: '1px solid #eee' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '4px' }}>Sessions</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0ea5e9' }}>
                        {sessions.length}
                    </div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '16px', background: '#fff', border: '1px solid #eee' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '4px' }}>Avg Time</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#8b5cf6' }}>
                        {sessions.length > 0 ? Math.round(totalStudyTimeMinutes / sessions.length) : 0}m
                    </div>
                </div>
            </section>

            {/* Class Breakdown */}
            <section style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', color: '#2C3333' }}>Class Breakdown</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                    {classStats.map(cls => (
                        <div key={cls.id} className="card" style={{
                            padding: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            borderLeft: `6px solid ${cls.color}`,
                            background: '#fff'
                        }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{cls.name}</div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                                    {cls.sessionCount} sessions • {cls.weeklyGoalMinutes}m goal/week
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#2C3333' }}>{Math.round(cls.totalMinutes)}m</div>
                                <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>Total</div>
                            </div>
                        </div>
                    ))}
                    {classStats.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '32px', opacity: 0.6 }}>No subjects added yet.</div>
                    )}
                </div>
            </section>

            {/* Recent Activity */}
            <section>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', color: '#2C3333' }}>Recent Activity</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                    {recentActivity.map((session, idx) => {
                        const cls = classes.find(c => c.id === session.classId);
                        return (
                            <div key={session.id || idx} style={{
                                background: '#fff',
                                padding: '12px 16px',
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                border: '1px solid #f0f0f0'
                            }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    background: cls?.color || '#eee',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '1rem',
                                    color: '#fff',
                                    flexShrink: 0
                                }}>
                                    {cls?.name.substring(0, 1) || '?'}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, color: '#2C3333' }}>
                                        {cls?.name || 'Unknown Class'}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                                        {new Date(session.timestamp).toLocaleDateString()} • {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    {session.notes && (
                                        <div style={{
                                            marginTop: '4px',
                                            fontSize: '0.85rem',
                                            background: '#f8f9fa',
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            fontStyle: 'italic',
                                            color: '#666'
                                        }}>
                                            "{session.notes}"
                                        </div>
                                    )}
                                </div>
                                <div style={{ fontWeight: 700, color: '#2C3333' }}>
                                    {session.durationMinutes}m
                                </div>
                            </div>
                        );
                    })}
                    {recentActivity.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '32px', opacity: 0.6 }}>No study sessions yet.</div>
                    )}
                </div>
            </section>
        </main>
    );
}
