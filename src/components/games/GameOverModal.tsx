import React from 'react';

type GameOverModalProps = {
    score?: number;
    highScore?: number;
    isNewRecord?: boolean;
    onRestart?: () => void;
    onBackToStudy: () => void;
    showRestart?: boolean;
};

export const GameOverModal = ({
    score,
    highScore,
    isNewRecord = false,
    onRestart,
    onBackToStudy,
    showRestart = true
}: GameOverModalProps) => {
    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            background: isNewRecord ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                background: isNewRecord
                    ? 'linear-gradient(145deg, #3d2f0a, #1a1a1a 30%, #1a1a1a 70%, #3d2f0a)'
                    : '#1a1a1a',
                padding: '30px',
                borderRadius: '20px',
                border: isNewRecord ? '2px solid #ffd700' : '1px solid #333',
                textAlign: 'center',
                maxWidth: '90%',
                width: '320px',
                boxShadow: isNewRecord
                    ? '0 0 30px rgba(255, 215, 0, 0.4), 0 10px 30px rgba(0,0,0,0.5)'
                    : '0 10px 30px rgba(0,0,0,0.5)',
                animation: isNewRecord ? 'goldPulse 2s infinite, fadeIn 0.3s ease-out' : 'fadeIn 0.3s ease-out'
            }}>
                <div style={{ fontSize: '4rem', marginBottom: '10px' }}>
                    {isNewRecord ? '🏆' : '🎮'}
                </div>
                <h2 style={{
                    fontSize: '2rem',
                    color: isNewRecord ? '#ffd700' : '#fff',
                    marginBottom: '8px',
                    textShadow: isNewRecord ? '0 0 10px rgba(255, 215, 0, 0.5)' : 'none'
                }}>
                    {isNewRecord ? 'New Record!' : 'Game Over!'}
                </h2>

                {isNewRecord && (
                    <p style={{
                        color: '#ffd700',
                        fontSize: '1rem',
                        marginBottom: '16px',
                        fontWeight: 'bold'
                    }}>
                        🎉 Congratulations! 🎉
                    </p>
                )}

                {score !== undefined && (
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ color: '#aaa', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Score</div>
                        <div style={{
                            fontSize: '2.5rem',
                            fontWeight: 'bold',
                            color: isNewRecord ? '#ffd700' : '#2ecc71',
                            textShadow: isNewRecord ? '0 0 15px rgba(255, 215, 0, 0.6)' : 'none'
                        }}>{score}</div>

                        {highScore !== undefined && !isNewRecord && (
                            <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '4px' }}>
                                Best: {highScore}
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {showRestart && onRestart && (
                        <button
                            className="btn"
                            style={{
                                background: isNewRecord ? 'linear-gradient(135deg, #ffd700, #ffaa00)' : '#3498db',
                                color: isNewRecord ? '#1a1a1a' : 'white',
                                width: '100%',
                                padding: '14px',
                                fontSize: '1.1rem',
                                borderRadius: '12px',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                transition: 'transform 0.1s active'
                            }}
                            onClick={onRestart}
                        >
                            Play Again 🔄
                        </button>
                    )}

                    <button
                        onClick={onBackToStudy}
                        className="btn"
                        style={{
                            background: 'transparent',
                            color: '#e74c3c',
                            border: '1px solid #e74c3c',
                            width: '100%',
                            padding: '12px',
                            borderRadius: '12px',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            fontWeight: '600'
                        }}
                    >
                        Back to Game Hub 🎮
                    </button>
                </div>
            </div>
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes goldPulse {
                    0%, 100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.3), 0 10px 30px rgba(0,0,0,0.5); }
                    50% { box-shadow: 0 0 40px rgba(255, 215, 0, 0.6), 0 10px 30px rgba(0,0,0,0.5); }
                }
            `}</style>
        </div>
    );
};
