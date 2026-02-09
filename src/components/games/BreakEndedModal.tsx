import React from 'react';
import { AdMobService } from '@/lib/admob';

type BreakEndedModalProps = {
    onWatchAd: () => void;
    onExit: () => void;
    canWatchAd: boolean;
    title?: string;
    message?: string;
};

export const BreakEndedModal = ({ onWatchAd, onExit, canWatchAd, title, message }: BreakEndedModalProps) => {
    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
            backdropFilter: 'blur(8px)'
        }}>
            <div style={{
                background: '#1a1a1a',
                padding: '30px',
                borderRadius: '20px',
                border: '1px solid #333',
                textAlign: 'center',
                maxWidth: '90%',
                width: '320px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}>
                <div style={{ fontSize: '4rem', marginBottom: '10px' }}>⏰</div>
                <h2 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: '10px' }}>{title || 'Break Over!'}</h2>
                <p style={{ color: '#aaa', marginBottom: '20px', fontSize: '1rem', lineHeight: '1.5' }}>
                    {message || 'Time to get back to studying! You need to study more to earn more break time.'}
                </p>

                {canWatchAd ? (
                    <>
                        <button
                            className="btn"
                            style={{
                                background: 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)',
                                color: 'white',
                                width: '100%',
                                padding: '15px',
                                fontSize: '1.1rem',
                                borderRadius: '12px',
                                border: 'none',
                                marginBottom: '15px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                            onClick={async () => {
                                const awarded = await AdMobService.showRewardVideo();
                                if (awarded) {
                                    onWatchAd();
                                }
                            }}
                        >
                            Watch Ad (+1m) 📺
                        </button>
                        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '15px' }}>
                            One-time offer per break
                        </div>
                    </>
                ) : (
                    <div style={{ padding: '10px', background: '#333', borderRadius: '8px', marginBottom: '20px', color: '#bbb', fontSize: '0.9rem' }}>
                        Ad reward already claimed.
                    </div>
                )}

                <button
                    onClick={onExit}
                    style={{
                        background: 'transparent',
                        color: '#e74c3c',
                        border: '1px solid #e74c3c',
                        width: '100%',
                        padding: '12px',
                        borderRadius: '12px',
                        fontSize: '1rem',
                        cursor: 'pointer'
                    }}
                >
                    Back to Study Mode
                </button>
            </div>
        </div>
    );
};
