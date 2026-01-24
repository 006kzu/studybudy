'use client';

import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

export default function SettingsPage() {
    const { clearSchedule, resetData, addPoints } = useApp();
    const router = useRouter();

    const [showConfirm, setShowConfirm] = useState(false);

    const handleClearSchedule = () => {
        clearSchedule();
        alert('Schedule cleared! Good luck with your new semester.');
        setShowConfirm(false);
        router.push('/dashboard');
    };

    return (
        <main className="container">
            <header style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
                <Link href="/dashboard" style={{ fontSize: '1.5rem', textDecoration: 'none' }}>
                    🔙
                </Link>
                <h1 className="text-h1">Settings</h1>
            </header>

            <section className="card" style={{ marginBottom: '24px' }}>
                <h2 className="text-h2">Testing Zone 🧪</h2>
                <p className="text-body" style={{ marginBottom: '16px' }}>
                    Need some resources to test the shop?
                </p>
                <button
                    onClick={() => {
                        addPoints(1000000);
                        alert('Granted 1,000,000 Inches! 🌭 Your wiener is massive!');
                    }}
                    className="btn btn-primary"
                >
                    💰 Grant 1,000,000 Inches
                </button>
            </section>

            <section className="card">
                <h2 className="text-h2">Semester Management</h2>
                <p className="text-body" style={{ marginBottom: '16px' }}>
                    Finished your semester? You can clear your entire schedule to start fresh.
                    This will remove all class times and study blocks. Your classes and points will remain.
                </p>

                {!showConfirm ? (
                    <button
                        onClick={() => setShowConfirm(true)}
                        className="btn"
                        style={{ background: 'var(--color-error)', color: 'white' }}
                    >
                        Finished Semester? Clear Schedule
                    </button>
                ) : (
                    <div style={{ background: '#fff0f0', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-error)' }}>
                        <p style={{ fontWeight: 'bold', color: 'var(--color-error)', marginBottom: '12px' }}>
                            Are you sure? This action cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="btn btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleClearSchedule}
                                className="btn"
                                style={{ background: 'var(--color-error)', color: 'white' }}
                            >
                                Yes, Clear Everything
                            </button>
                        </div>
                    </div>
                )}
            </section>

            <section className="card" style={{ marginTop: '24px' }}>
                <h2 className="text-h2">App Data</h2>
                <p className="text-body" style={{ marginBottom: '16px', fontSize: '0.9rem', opacity: 0.8 }}>
                    Need a complete factory reset? This will delete all classes, points, and history.
                </p>
                <button
                    onClick={() => {
                        if (confirm('WARNING: This will delete ALL data including points and classes. Are you absolutely sure?')) {
                            resetData();
                            router.push('/onboarding');
                        }
                    }}
                    style={{ color: 'var(--color-error)', background: 'transparent', border: '1px solid var(--color-error)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
                >
                    Reset App Data
                </button>
            </section>
        </main>
    );
}
