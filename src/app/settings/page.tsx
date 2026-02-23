'use client';

import { useApp } from '@/context/AppContext';
import { useState, useEffect } from 'react';
import { purchaseItem, restorePurchases } from '@/lib/iap';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

// ...
import Modal from '@/components/Modal';
import ParentalGate from '@/components/ParentalGate';

export default function SettingsPage() {
    const { state, updateSettings, testNotification, signOut, user, archiveAllClasses, scheduleClassReminders, cancelClassReminders, goPremium, deleteAccount } = useApp();
    const [showSemesterModal, setShowSemesterModal] = useState(false);
    const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
    const [showParentalGate, setShowParentalGate] = useState(false);
    const [leaderboardName, setLeaderboardName] = useState('');
    const [nameSaving, setNameSaving] = useState(false);
    const [nameSaved, setNameSaved] = useState(false);
    const [hasLinkedParent, setHasLinkedParent] = useState(false);

    // Check if a parent has linked to this student
    useEffect(() => {
        const checkLinkedParent = async () => {
            if (!user) return;
            const { data } = await supabase
                .from('profiles')
                .select('id')
                .eq('linked_user_id', user.id)
                .limit(1);
            if (data && data.length > 0) {
                setHasLinkedParent(true);
            }
        };
        checkLinkedParent();
    }, [user]);

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
                                Remove ads & support the developer. Monthly.
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
                            $4.99/mo
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
            </div>

            <div className="card" style={{ marginTop: '24px' }}>
                <h2 className="text-h2">🏆 Leaderboard</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                    Choose a display name for the leaderboard.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        placeholder={user?.user_metadata?.full_name || 'Enter display name'}
                        value={leaderboardName}
                        onChange={e => setLeaderboardName(e.target.value)}
                        maxLength={20}
                        style={{
                            flex: 1,
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #ddd',
                            fontSize: '1rem'
                        }}
                    />
                    <button
                        disabled={nameSaving || !leaderboardName.trim()}
                        onClick={async () => {
                            if (!user || !leaderboardName.trim()) return;
                            setNameSaving(true);
                            try {
                                // Update profiles table
                                const { supabase } = await import('@/lib/supabase');
                                await supabase.from('profiles').update({
                                    full_name: leaderboardName.trim()
                                }).eq('id', user.id);
                                // Also update existing game_scores
                                await supabase.from('game_scores').update({
                                    player_name: leaderboardName.trim()
                                }).eq('user_id', user.id);
                                setNameSaved(true);
                                setTimeout(() => setNameSaved(false), 2000);
                            } catch (e) {
                                console.error('Failed to update name:', e);
                                alert('Failed to save. Try again.');
                            }
                            setNameSaving(false);
                        }}
                        className="btn btn-primary"
                        style={{ padding: '10px 20px', fontSize: '0.9rem' }}
                    >
                        {nameSaved ? '✓ Saved' : nameSaving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            {
                user && (
                    <div className="card" style={{ marginTop: '24px', border: '1px solid #fee2e2', background: '#fff' }}>
                        <h2 className="text-h2" style={{ color: 'var(--color-primary)' }}>👤 Account</h2>

                        {/* Linked Parent Status */}
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

                            {hasLinkedParent && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    marginTop: '12px'
                                }}>
                                    <div style={{
                                        width: '24px', height: '24px', borderRadius: '50%',
                                        background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <span style={{ color: 'white', fontSize: '0.9rem', fontWeight: 'bold' }}>✓</span>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.95rem' }}>Successfully Linked!</div>
                                        <div style={{ fontSize: '0.8rem', color: '#15803d' }}>Your parent account is connected</div>
                                    </div>
                                </div>
                            )}

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
                                await deleteAccount();
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

            {/* Restore Purchases Link (Bottom) */}
            <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '32px' }}>
                <button
                    onClick={async () => {
                        try {
                            await restorePurchases();
                            alert('Restore process initiated. If you have valid purchases, they will be restored.');
                        } catch (e) {
                            alert('Restore failed.');
                        }
                    }}
                    className="btn"
                    style={{ background: 'transparent', color: '#666', fontSize: '0.9rem', border: 'none', textDecoration: 'underline' }}
                >
                    Restore Purchases
                </button>
            </div>

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
