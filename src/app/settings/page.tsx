'use client';

import { useApp } from '@/context/AppContext';
import { useState } from 'react';
import { purchaseItem } from '@/lib/iap';
import Link from 'next/link';

// ...
import Modal from '@/components/Modal';
import ParentalGate from '@/components/ParentalGate';

export default function SettingsPage() {
    const { state, updateSettings, testNotification, signOut, user, archiveAllClasses, scheduleClassReminders, cancelClassReminders, goPremium, deleteAccount } = useApp();
    const [showSemesterModal, setShowSemesterModal] = useState(false);
    const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
    const [showParentalGate, setShowParentalGate] = useState(false);

    // Local state for UI feedback before persisting (or direct persist if fast enough)
    // We'll assume updateSettings persists to Context/LocalStorage

    const toggleSleep = () => {
        const current = state.sleepSettings || { enabled: false, start: '22:00', end: '06:00' };
        updateSettings({
            sleepSettings: {
                ...current,
                enabled: !current.enabled
            }
        });
    };



    return (
        <main className="container" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
            <header style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <Link href="/dashboard" style={{ fontSize: '1.5rem', textDecoration: 'none' }}>
                    ←
                </Link>
                <h1 className="text-h1" style={{ margin: 0 }}>Settings</h1>
            </header>

            {/* Premium Upsell Card */}
            {!state.isPremium && (
                <div className="card" style={{
                    background: 'linear-gradient(135deg, #FFD700 0%, #FDB931 100%)',
                    color: '#5e4002',
                    border: 'none',
                    marginBottom: '24px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 className="text-h2" style={{ color: '#5e4002', margin: 0 }}>Go Premium 💎</h2>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', opacity: 0.9 }}>
                                Remove ads & support the developer.
                            </p>
                        </div>
                        <button
                            className="btn"
                            style={{
                                background: 'white',
                                color: '#5e4002',
                                border: 'none',
                                fontWeight: 'bold',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}
                            onClick={() => {
                                setShowParentalGate(true);
                            }}
                        >
                            $4.99
                        </button>
                    </div>
                </div>
            )}

            <div className="card">
                <h2 className="text-h2">🔔 Notifications</h2>


                {/* Study Break Alerts */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #eee' }}>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>Study Break Alerts</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                            Notify me when my timer ends.
                        </div>
                    </div>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={state.notifications?.studyBreaksEnabled ?? false}
                            onChange={(e) => {
                                updateSettings({
                                    notifications: {
                                        classRemindersEnabled: state.notifications?.classRemindersEnabled ?? false,
                                        studyBreaksEnabled: e.target.checked
                                    }
                                });
                            }}
                        />
                        <span className="slider round"></span>
                    </label>
                </div>



                {/* Class Reminders */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0' }}>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>Class Reminders</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                            Get notified 15 mins before class.
                        </div>
                    </div>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={state.notifications?.classRemindersEnabled ?? false}
                            onChange={(e) => {
                                const checked = e.target.checked;
                                updateSettings({
                                    notifications: {
                                        studyBreaksEnabled: state.notifications?.studyBreaksEnabled ?? false,
                                        classRemindersEnabled: checked
                                    }
                                });

                                if (checked) scheduleClassReminders?.(15);
                                else cancelClassReminders?.();
                            }}
                        />
                        <span className="slider round"></span>
                    </label>
                </div>
            </div>

            <div className="card">
                <h2 className="text-h2">🧘 Zen Mode</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
                    <div>
                        <div style={{ fontWeight: 600 }}>Focus Mode Guide</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                            Show reminder to use Guided Access when studying.
                        </div>
                    </div>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={state.zenMode ?? false}
                            onChange={() => updateSettings({ zenMode: !state.zenMode })}
                        />
                        <span className="slider round"></span>
                    </label>
                </div>
                {state.zenMode && (
                    <div style={{ marginTop: '12px', padding: '12px', background: '#f0f9ff', borderRadius: '8px', fontSize: '0.85rem', color: '#005580' }}>
                        <p style={{ marginBottom: '8px' }}>
                            ℹ️ <strong>How it works:</strong> When you start a session, we'll remind you to enable <strong>Guided Access</strong> (Triple-click Side Button) to lock your phone to StudyBudy and block other apps.
                        </p>
                        <a
                            href="App-Prefs:root=General&path=ACCESSIBILITY"
                            style={{
                                display: 'inline-block',
                                color: '#005580',
                                textDecoration: 'underline',
                                fontWeight: 600
                            }}
                        >
                            Go to Accessibility Settings →
                        </a>
                    </div>
                )}
            </div>

            <div className="card">
                <h2 className="text-h2">😴 Sleep Schedule</h2>
                <p className="text-body" style={{ marginBottom: '16px' }}>
                    Hide calendar slots during your sleep hours.
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontWeight: 600 }}>Enable Sleep Filter</span>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={state.sleepSettings?.enabled ?? false}
                            onChange={toggleSleep}
                        />
                        <span className="slider round"></span>
                    </label>
                </div>

                {state.sleepSettings?.enabled && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Bedtime</label>
                            <input
                                type="time"
                                value={state.sleepSettings?.start || '22:00'}
                                onChange={(e) => {
                                    const current = state.sleepSettings || { enabled: false, start: '22:00', end: '06:00' };
                                    updateSettings({
                                        sleepSettings: { ...current, start: e.target.value }
                                    });
                                }}
                                className="input"
                                style={{ width: '100%', padding: '8px' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Wake Up</label>
                            <input
                                type="time"
                                value={state.sleepSettings?.end || '06:00'}
                                onChange={(e) => {
                                    const current = state.sleepSettings || { enabled: false, start: '22:00', end: '06:00' };
                                    updateSettings({
                                        sleepSettings: { ...current, end: e.target.value }
                                    });
                                }}
                                className="input"
                                style={{ width: '100%', padding: '8px' }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {
                user && (
                    <div className="card" style={{ marginTop: '24px', border: '1px solid #fee2e2', background: '#fff' }}>
                        <h2 className="text-h2" style={{ color: 'var(--color-primary)' }}>👤 Account</h2>

                        <div style={{ marginBottom: '24px' }}>
                            <p className="text-body" style={{ marginBottom: '8px', fontWeight: 600 }}>Your Student ID</p>
                            <div style={{
                                background: '#f5f5f5',
                                padding: '12px',
                                borderRadius: '8px',
                                fontFamily: 'monospace',
                                fontSize: '0.9rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                border: '1px solid #e5e5e5'
                            }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                                    {user.id}
                                </span>
                                <button
                                    onClick={() => {
                                        const text = user.id;
                                        const copyFallback = () => {
                                            try {
                                                const textArea = document.createElement("textarea");
                                                textArea.value = text;
                                                // Avoid scrolling to bottom
                                                textArea.style.top = "0";
                                                textArea.style.left = "0";
                                                textArea.style.position = "fixed";
                                                document.body.appendChild(textArea);
                                                textArea.focus();
                                                textArea.select();
                                                const successful = document.execCommand('copy');
                                                document.body.removeChild(textArea);
                                                if (successful) alert('ID copied!');
                                                else throw new Error('Copy failed');
                                            } catch (err) {
                                                prompt('Copy your ID manually:', text);
                                            }
                                        };

                                        if (navigator.clipboard) {
                                            navigator.clipboard.writeText(text).then(() => {
                                                alert('ID copied!');
                                            }).catch(copyFallback);
                                        } else {
                                            copyFallback();
                                        }
                                    }}
                                    className="btn"
                                    style={{ padding: '4px 8px', fontSize: '0.8rem', background: 'white', border: '1px solid #ddd' }}
                                >
                                    Copy
                                </button>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '8px' }}>
                                Share this ID (or the link below) with your parent so they can automatically link to your account.
                            </p>

                            <button
                                onClick={() => {
                                    const link = `${window.location.origin}/link?studentId=${user.id}`;
                                    const message = `Connect to my Study Budy account: ${link} \n\nOr enter ID: ${user.id}`;

                                    if (navigator.share) {
                                        navigator.share({
                                            title: 'Connect to Study Budy',
                                            text: message,
                                            url: link
                                        }).catch(console.error);
                                    } else {
                                        // Fallback to copy
                                        navigator.clipboard.writeText(message);
                                        alert('Invite link copied to clipboard!');
                                    }
                                }}
                                className="btn btn-primary"
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    marginTop: '12px',
                                }}
                            >
                                🔗 Invite Parent
                            </button>
                        </div>

                        <div style={{ borderTop: '1px solid #eee', paddingTop: '16px' }}>
                            <p className="text-body" style={{ marginBottom: '16px' }}>
                                Logged in as: <strong>{user.email}</strong>
                            </p>
                            <button
                                onClick={async () => {
                                    await signOut?.();
                                    window.location.href = '/login';
                                }}
                                className="btn"
                                style={{
                                    width: '100%',
                                    background: '#fff',
                                    border: '1px solid #feb2b2',
                                    color: '#c53030',
                                    fontWeight: 600
                                }}
                            >
                                Sign Out
                            </button>

                            <button
                                onClick={() => setShowDeleteAccountModal(true)}
                                className="btn"
                                style={{
                                    width: '100%',
                                    marginTop: '12px',
                                    background: '#fee2e2',
                                    border: '1px solid #f87171',
                                    color: '#991b1b',
                                    fontWeight: 600,
                                    fontSize: '0.9rem'
                                }}
                            >
                                Delete Account
                            </button>
                        </div>
                    </div>
                )
            }

            <div className="card" style={{ marginTop: '24px' }}>
                <h2 className="text-h2">🎓 Semester Management</h2>
                <p className="text-body" style={{ marginBottom: '16px' }}>
                    Start fresh for a new semester.
                </p>
                <button
                    onClick={() => setShowSemesterModal(true)}
                    className="btn"
                    style={{
                        width: '100%',
                        background: 'transparent',
                        border: '1px solid var(--color-text-secondary)',
                        color: 'var(--color-text-main)',
                        opacity: 0.8
                    }}
                >
                    Done with Semester
                </button>
            </div>

            {/* Semester Reset Confirmation Modal */}
            <Modal
                isOpen={showSemesterModal}
                onClose={() => setShowSemesterModal(false)}
                title="End Semester?"
                type="danger"
                actions={
                    <>
                        <button className="btn btn-secondary" onClick={() => setShowSemesterModal(false)}>Cancel</button>
                        <button
                            className="btn"
                            style={{ background: 'var(--color-primary)', color: 'white' }}
                            onClick={async () => {
                                await archiveAllClasses?.(); // Optional chain safe
                                setShowSemesterModal(false);
                                alert('Semester ended! Classes archived. Good luck with the next one! 🍀');
                            }}
                        >
                            Archive Classes
                        </button>
                    </>
                }
            >
                <p>
                    This will <strong>archive all current classes</strong> and clear their weekly schedules.
                </p>
                <p style={{ marginTop: '12px', fontSize: '0.9rem', color: '#666' }}>
                    Don't worry, your <strong>stats and history are safe</strong>! You can still see your total study time in the Stats page.
                </p>
            </Modal>

            {/* Delete Account Confirmation Modal */}
            <Modal
                isOpen={showDeleteAccountModal}
                onClose={() => setShowDeleteAccountModal(false)}
                title="Delete Account?"
                type="danger"
                actions={
                    <>
                        <button className="btn btn-secondary" onClick={() => setShowDeleteAccountModal(false)}>Cancel</button>
                        <button
                            className="btn"
                            style={{ background: '#dc2626', color: 'white' }}
                            onClick={async () => {
                                if (confirm("Are you absolutely sure? This cannot be undone.")) {
                                    await deleteAccount?.();
                                }
                            }}
                        >
                            Confirm Delete
                        </button>
                    </>
                }
            >
                <p>
                    <strong>Warning: This action is permanent!</strong>
                </p>
                <p style={{ marginTop: '12px' }}>
                    Deleting your account will:
                </p>
                <ul style={{ paddingLeft: '20px', marginTop: '8px', color: '#666' }}>
                    <li>Delete your profile and points</li>
                    <li>Delete all your classes and schedule</li>
                    <li>Delete your study history</li>
                    <li>Cancel your subscription (if applicable)</li>
                </ul>
            </Modal>

            <ParentalGate
                isOpen={showParentalGate}
                onClose={() => setShowParentalGate(false)}
                onSuccess={async () => {
                    try {
                        const success = await purchaseItem('premium_upgrade');
                        if (success) {
                            await goPremium?.();
                            alert("Thank you for your support! Premium features unlocked.");
                        }
                    } catch (e) {
                        console.error(e);
                        alert("Purchase failed.");
                    }
                }}
            />

            <div className="text-center" style={{ marginTop: '32px', opacity: 0.5, fontSize: '0.8rem' }}>
                Learn Loop v1.0.0
            </div>

            <style jsx>{`
                .switch {
                    position: relative;
                    display: inline-block;
                    width: 50px;
                    height: 28px;
                }
                .switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #ccc;
                    transition: .4s;
                }
                .slider:before {
                    position: absolute;
                    content: "";
                    height: 20px;
                    width: 20px;
                    left: 4px;
                    bottom: 4px;
                    background-color: white;
                    transition: .4s;
                }
                input:checked + .slider {
                    background-color: var(--color-primary);
                }
                input:focus + .slider {
                    box-shadow: 0 0 1px var(--color-primary);
                }
                input:checked + .slider:before {
                    transform: translateX(22px);
                }
                .slider.round {
                    border-radius: 34px;
                }
                .slider.round:before {
                    border-radius: 50%;
                }
                .input {
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    font-size: 1rem;
                }
            `}</style>
        </main >
    );
}
