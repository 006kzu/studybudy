'use client';

import { useEffect, useState } from 'react';

interface LeaderboardPlacementPopupProps {
    rank: number;
    score: number;
    gameName: string;
    onClose: () => void;
}

export const LeaderboardPlacementPopup = ({ rank, score, gameName, onClose }: LeaderboardPlacementPopupProps) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger entrance animation
        setTimeout(() => setIsVisible(true), 50);
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    const getRankEmoji = () => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return '🏆';
    };

    const getRankText = () => {
        if (rank === 1) return '1st Place!';
        if (rank === 2) return '2nd Place!';
        if (rank === 3) return '3rd Place!';
        return `#${rank}`;
    };

    const isTopThree = rank <= 3;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                opacity: isVisible ? 1 : 0,
                transition: 'opacity 0.3s ease-out',
                backdropFilter: 'blur(8px)'
            }}
            onClick={handleClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: isTopThree
                        ? 'linear-gradient(145deg, #2a1f00, #1a1a1a 40%, #1a1a1a 60%, #2a1f00)'
                        : 'linear-gradient(145deg, #1a1a1a, #252525)',
                    borderRadius: '24px',
                    padding: '32px',
                    maxWidth: '90%',
                    width: '340px',
                    textAlign: 'center',
                    border: isTopThree ? '2px solid #ffd700' : '1px solid #444',
                    boxShadow: isTopThree
                        ? '0 0 60px rgba(255, 215, 0, 0.3), 0 20px 40px rgba(0, 0, 0, 0.6)'
                        : '0 20px 40px rgba(0, 0, 0, 0.5)',
                    transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(20px)',
                    transition: 'transform 0.3s ease-out'
                }}
            >
                {/* Trophy/Rank Icon */}
                <div style={{
                    fontSize: '5rem',
                    marginBottom: '16px',
                    filter: isTopThree ? 'drop-shadow(0 0 20px rgba(255, 215, 0, 0.6))' : 'none',
                    animation: isTopThree ? 'pulse 2s infinite' : 'none'
                }}>
                    {getRankEmoji()}
                </div>

                {/* Title */}
                <h2 style={{
                    fontSize: '1.8rem',
                    color: isTopThree ? '#ffd700' : '#fff',
                    margin: '0 0 8px 0',
                    textShadow: isTopThree ? '0 0 10px rgba(255, 215, 0, 0.5)' : 'none'
                }}>
                    You Made the Leaderboard!
                </h2>

                {/* Rank */}
                <div style={{
                    fontSize: '2.5rem',
                    fontWeight: 'bold',
                    color: isTopThree ? '#ffd700' : '#00f3ff',
                    margin: '16px 0',
                    textShadow: isTopThree
                        ? '0 0 20px rgba(255, 215, 0, 0.6)'
                        : '0 0 10px rgba(0, 243, 255, 0.5)'
                }}>
                    {getRankText()}
                </div>

                {/* Score & Game */}
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '24px'
                }}>
                    <p style={{ color: '#888', margin: '0 0 8px 0', fontSize: '0.9rem' }}>
                        {gameName}
                    </p>
                    <p style={{
                        fontSize: '2rem',
                        fontWeight: 'bold',
                        color: '#fff',
                        margin: 0
                    }}>
                        {score.toLocaleString()} pts
                    </p>
                </div>

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    style={{
                        background: isTopThree
                            ? 'linear-gradient(135deg, #ffd700, #ffaa00)'
                            : 'linear-gradient(135deg, #00f3ff, #0088ff)',
                        color: isTopThree ? '#1a1a1a' : '#fff',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '14px 32px',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        width: '100%'
                    }}
                >
                    Awesome! 🎉
                </button>
            </div>

            <style jsx>{`
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
            `}</style>
        </div>
    );
};
