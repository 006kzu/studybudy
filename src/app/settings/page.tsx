'use client';

import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';

export default function SettingsPage() {
    const { clearSchedule, resetData, addPoints, state, updateSleepSettings } = useApp();
    const router = useRouter();

    const [showConfirm, setShowConfirm] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    // Sleep Settings State
    const [showSleepModal, setShowSleepModal] = useState(false);
    const [sleepEnabled, setSleepEnabled] = useState(false);
    const [bedtime, setBedtime] = useState('22:00');
    const [waketime, setWaketime] = useState('06:00');

    // Load initial sleep settings when modal opens (or on mount/change)
    useEffect(() => {
        if (state.sleepSettings) {
            setSleepEnabled(state.sleepSettings.enabled);
            setBedtime(state.sleepSettings.start);
            setWaketime(state.sleepSettings.end);
        }
    }, [state.sleepSettings, showSleepModal]);

    const handleClearSchedule = () => {
        clearSchedule();
        setShowConfirm(false);
        alert('Schedule cleared! Good luck with your new semester.');
        router.push('/dashboard');
    };

    const handleResetData = () => {
        resetData();
        router.push('/onboarding');
    };

    const saveSleepSettings = () => {
        updateSleepSettings({
            enabled: sleepEnabled,
            start: bedtime,
            end: waketime
        });
        setShowSleepModal(false);
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
                <h2 className="text-h2">Sleep Schedule 😴</h2>
                <p className="text-body" style={{ marginBottom: '16px' }}>
                    Configure your "Melatonin Mode" hours to prevent scheduling classes during sleep time.
                </p>
                <button
                    onClick={() => setShowSleepModal(true)}
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                >
                    Edit Sleep Schedule
                </button>
            </section>

            <section className="card" style={{ marginBottom: '24px' }}>
                <h2 className="text-h2">Semester Management</h2>
                <p className="text-body" style={{ marginBottom: '16px' }}>
                    Finished your semester? You can clear your entire schedule to start fresh.
                    This will remove all class times and study blocks. Your classes and points will remain.
                </p>

                <button
                    onClick={() => setShowConfirm(true)}
                    className="btn"
                    style={{ background: 'var(--color-error)', color: 'white' }}
                >
                    Finished Semester? Clear Schedule
                </button>
            </section>

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
                    className="btn btn-secondary"
                >
                    💰 Grant 1,000,000 Inches
                </button>
            </section>

            <section className="card">
                <h2 className="text-h2">App Data</h2>
                <p className="text-body" style={{ marginBottom: '16px', fontSize: '0.9rem', opacity: 0.8 }}>
                    Need a complete factory reset? This will delete all classes, points, and history.
                </p>
                <button
                    onClick={() => setShowResetConfirm(true)}
                    style={{ color: 'var(--color-error)', background: 'transparent', border: '1px solid var(--color-error)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', width: '100%' }}
                >
                    Reset App Data
                </button>
            </section>

            {/* Sleep Settings Modal */}
            <Modal
                isOpen={showSleepModal}
                onClose={() => setShowSleepModal(false)}
                title="Sleep Schedule"
                actions={
                    <>
                        <button className="btn btn-secondary" onClick={() => setShowSleepModal(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={saveSleepSettings}>Save</button>
                    </>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={sleepEnabled}
                            onChange={(e) => setSleepEnabled(e.target.checked)}
                            style={{ width: '20px', height: '20px' }}
                        />
                        Enable Melatonin Mode
                    </label>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '16px',
                        opacity: sleepEnabled ? 1 : 0.5,
                        pointerEvents: sleepEnabled ? 'auto' : 'none',
                        transition: 'opacity 0.2s'
                    }}>
                        <div>
                            <label className="text-body" style={{ display: 'block', marginBottom: '8px' }}>Bedtime 🌙</label>
                            <input
                                type="time"
                                className="input"
                                value={bedtime}
                                onChange={(e) => setBedtime(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div>
                            <label className="text-body" style={{ display: 'block', marginBottom: '8px' }}>Wake Up ☀️</label>
                            <input
                                type="time"
                                className="input"
                                value={waketime}
                                onChange={(e) => setWaketime(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>
                    </div>

                    <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '-8px' }}>
                        {sleepEnabled
                            ? "We'll block these hours on your calendar to protect your rest."
                            : "Enable this to visually block off sleep hours on your calendar."}
                    </p>
                </div>
            </Modal>

            {/* Clear Schedule Modal */}
            <Modal
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                title="Clear Schedule?"
                type="danger"
                actions={
                    <>
                        <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
                        <button
                            className="btn"
                            style={{ background: 'var(--color-error)', color: 'white' }}
                            onClick={handleClearSchedule}
                        >
                            Yes, Clear Schedule
                        </button>
                    </>
                }
            >
                <p>
                    Are you sure you want to clear your schedule?
                </p>
                <p style={{ fontSize: '0.9rem', marginTop: '12px', color: '#666' }}>
                    This will remove all your class times and study blocks, but keep your points and unlocked items.
                </p>
            </Modal>

            {/* Reset Data Modal */}
            <Modal
                isOpen={showResetConfirm}
                onClose={() => setShowResetConfirm(false)}
                title="Factory Reset?"
                type="danger"
                actions={
                    <>
                        <button className="btn btn-secondary" onClick={() => setShowResetConfirm(false)}>Cancel</button>
                        <button
                            className="btn"
                            style={{ background: 'var(--color-error)', color: 'white' }}
                            onClick={handleResetData}
                        >
                            Yes, Delete Everything
                        </button>
                    </>
                }
            >
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>💥</div>
                    <p>
                        <strong>Warning:</strong> This will delete all your classes, points, unlocked items, and schedule data.
                    </p>
                    <p style={{ fontSize: '0.9rem', marginTop: '12px' }}>
                        This action is irreversible. You will be returned to the onboarding screen.
                    </p>
                </div>
            </Modal>
        </main>
    );
}
