'use client';

import Modal from './Modal';
import { useApp } from '@/context/AppContext';
import { useState } from 'react';

interface ShareProgressModalProps {
    isOpen: boolean;
    onClose: () => void;
    className: string;
    minutesStudied: number;
    goalMinutes: number;
    isAllGoalsCelebration?: boolean;
    onPlayGame?: () => void;
    onContinueStudying?: () => void;
}

export default function ShareProgressModal({
    isOpen,
    onClose,
    className,
    minutesStudied,
    goalMinutes,
    isAllGoalsCelebration = false,
    onPlayGame,
    onContinueStudying
}: ShareProgressModalProps) {
    const { user } = useApp();
    const [hasShared, setHasShared] = useState(false);

    const handleShare = () => {
        // Create the achievement message
        const achievementText = isAllGoalsCelebration
            ? `🎉 I completed ALL my study goals this week on Learn Loop! 📚✨`
            : `🎉 I hit my ${className} study goal! Studied ${Math.round(minutesStudied)} mins this week! 📚✨`;

        const downloadLink = `https://learnloop.app/invite?id=${user?.id || ''}`;

        const fullMessage = `${achievementText}\nDownload Learn Loop to see my hard work!\n${downloadLink}`;

        if (navigator.share) {
            navigator.share({
                title: 'Study Progress',
                text: fullMessage,
                url: downloadLink
            }).catch(console.error);
        } else {
            // Open SMS with pre-filled message as fallback
            const smsUrl = `sms:&body=${encodeURIComponent(fullMessage)}`;
            window.location.href = smsUrl;
        }

        // Show the game/study choice after sharing
        setHasShared(true);
    };

    const handlePlayGame = () => {
        setHasShared(false);
        if (onPlayGame) onPlayGame();
        onClose();
    };

    const handleContinueStudying = () => {
        setHasShared(false);
        if (onContinueStudying) onContinueStudying();
        onClose();
    };

    // Reset state when modal closes
    const handleClose = () => {
        setHasShared(false);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title=""
        >
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                {/* Celebration Animation */}
                <div style={{
                    fontSize: '4rem',
                    marginBottom: '16px',
                    animation: 'bounce 0.6s ease infinite alternate'
                }}>
                    🎉
                </div>

                <h2 style={{
                    fontSize: '1.8rem',
                    fontWeight: 800,
                    marginBottom: '8px',
                    background: 'linear-gradient(135deg, #FF7E36, #FFB347)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                }}>
                    {isAllGoalsCelebration ? 'ALL Goals Complete!' : 'Goal Reached!'}
                </h2>

                <p style={{
                    fontSize: '1.1rem',
                    color: 'var(--color-text-secondary)',
                    marginBottom: '24px'
                }}>
                    {isAllGoalsCelebration
                        ? "You've completed all your study goals this week! Amazing work! 🌟"
                        : `You've hit your ${className} goal with ${Math.round(minutesStudied)} minutes studied! 🌟`
                    }
                </p>

                {/* Progress Visualization */}
                <div style={{
                    background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)',
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '24px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '2rem' }}>✅</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2e7d32' }}>
                            {Math.round(minutesStudied)} / {goalMinutes} mins
                        </span>
                    </div>
                    {minutesStudied > goalMinutes && (
                        <p style={{ fontSize: '0.9rem', color: '#388e3c' }}>
                            Goal exceeded by {Math.round(minutesStudied - goalMinutes)} minutes!
                        </p>
                    )}
                </div>

                {!hasShared ? (
                    <>
                        {/* Share CTA */}
                        <button
                            onClick={handleShare}
                            className="btn btn-primary"
                            style={{
                                width: '100%',
                                padding: '16px',
                                fontSize: '1.1rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                background: 'linear-gradient(135deg, #FF7E36 0%, #FFB347 100%)',
                                border: 'none',
                                borderRadius: '12px',
                                boxShadow: '0 4px 15px rgba(255, 126, 54, 0.4)'
                            }}
                        >
                            📲 Share Achievement
                        </button>

                        <button
                            onClick={() => setHasShared(true)}
                            style={{
                                marginTop: '12px',
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-text-secondary)',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                padding: '8px'
                            }}
                        >
                            Skip →
                        </button>
                    </>
                ) : (
                    <>
                        {/* Game or Study Choice */}
                        <p style={{ fontSize: '1rem', color: 'var(--color-text)', marginBottom: '16px', fontWeight: 600 }}>
                            What would you like to do now?
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={handleContinueStudying}
                                className="btn btn-secondary"
                                style={{
                                    flex: 1,
                                    padding: '14px 16px',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    borderRadius: '12px'
                                }}
                            >
                                📚 Keep Studying
                            </button>
                            <button
                                onClick={handlePlayGame}
                                className="btn btn-primary"
                                style={{
                                    flex: 1,
                                    padding: '14px 16px',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%)',
                                    border: 'none'
                                }}
                            >
                                🎮 Play Game!
                            </button>
                        </div>
                    </>
                )}

                <style jsx>{`
                    @keyframes bounce {
                        from { transform: translateY(0); }
                        to { transform: translateY(-10px); }
                    }
                `}</style>
            </div>
        </Modal>
    );
}
