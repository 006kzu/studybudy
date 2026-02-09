'use client';

import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useState } from 'react';

function NotesPageContent() {
    const { state, isLoading } = useApp();
    const router = useRouter();

    // Filter sessions with notes and sort by date descending
    const notesSessions = state.studySessions
        .filter(s => s.notes && s.notes.trim().length > 0)
        .sort((a, b) => b.timestamp - a.timestamp);

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    if (isLoading) {
        return <div className="container text-center" style={{ marginTop: '20vh' }}>Loading Notes...</div>;
    }

    return (
        <main className="container" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
            <header style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <Link href="/dashboard" style={{ textDecoration: 'none', fontSize: '1.5rem' }}>
                    🔙
                </Link>
                <h1 className="text-h1" style={{ margin: 0 }}>My Study Notes 📝</h1>
            </header>

            {notesSessions.length === 0 ? (
                <div className="card text-center" style={{ padding: '40px' }}>
                    <p className="text-body" style={{ color: 'var(--color-text-secondary)' }}>
                        You haven't written any notes yet.
                    </p>
                    <p className="text-body" style={{ marginTop: '8px' }}>
                        When you finish a study session, adding a note is a great way to remember what you learned!
                    </p>
                    <Link href="/dashboard" className="btn btn-primary" style={{ marginTop: '24px' }}>
                        Start Studying
                    </Link>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {notesSessions.map(session => {
                        const classItem = state.classes.find(c => c.id === session.classId);
                        const classColor = classItem ? classItem.color : 'var(--color-secondary)';
                        const className = classItem ? classItem.name : 'Unknown Class';

                        return (
                            <div key={session.id} className="card" style={{ borderLeft: `6px solid ${classColor}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'flex-start' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{className}</h3>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                            {formatDate(session.timestamp)}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 'bold' }}>{session.durationMinutes} mins</div>
                                        <div style={{ fontSize: '0.8rem', color: '#f59e0b' }}>+{session.pointsEarned} pts</div>
                                    </div>
                                </div>

                                <div style={{
                                    background: '#f8fafc',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--color-border)',
                                    fontSize: '0.95rem',
                                    lineHeight: '1.5',
                                    whiteSpace: 'pre-wrap' // Preserve line breaks
                                }}>
                                    {session.notes}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </main>
    );
}

export default function NotesPage() {
    return (
        <Suspense fallback={<div className="container text-center" style={{ marginTop: '20vh' }}>Loading...</div>}>
            <NotesPageContent />
        </Suspense>
    );
}
