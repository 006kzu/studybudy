'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// Replace with your actual App Store URL once live
const APP_STORE_URL = 'https://apps.apple.com/app/id6742199147';

function GiftPageContent() {
    const searchParams = useSearchParams();
    const studentId = searchParams.get('userId') || searchParams.get('studentId');

    // Build a deep link so the app can pre-fill the recipient after download
    const deepLink = studentId
        ? `${APP_STORE_URL}`
        : APP_STORE_URL;

    return (
        <main style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 24px',
            color: 'white',
            fontFamily: "'Inter', sans-serif",
            textAlign: 'center'
        }}>
            {/* Gift emoji */}
            <div style={{ fontSize: '5rem', marginBottom: '16px', lineHeight: 1 }}>🎁</div>

            {/* Headline */}
            <h1 style={{
                fontSize: '2rem',
                fontWeight: 900,
                marginBottom: '12px',
                lineHeight: 1.2,
                maxWidth: '320px'
            }}>
                Send a Study Reward
            </h1>

            <p style={{
                fontSize: '1.05rem',
                opacity: 0.8,
                maxWidth: '300px',
                lineHeight: 1.6,
                marginBottom: '32px'
            }}>
                Encourage a student with bonus coins or extra game time — rewarded instantly inside <strong>Learn Loop</strong>.
            </p>

            {/* What they can send */}
            <div style={{
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '20px',
                padding: '24px 28px',
                maxWidth: '320px',
                width: '100%',
                marginBottom: '32px',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(10px)'
            }}>
                <p style={{ fontWeight: 700, fontSize: '0.85rem', letterSpacing: '1px', opacity: 0.6, textTransform: 'uppercase', marginBottom: '16px' }}>
                    Gift Options
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.8rem' }}>💰</span>
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 700 }}>Coin Packs</div>
                            <div style={{ opacity: 0.65, fontSize: '0.85rem' }}>Spend in the avatar shop</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.8rem' }}>🎮</span>
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 700 }}>Game Time</div>
                            <div style={{ opacity: 0.65, fontSize: '0.85rem' }}>Extra minutes in the game hub</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CTA — App Store */}
            <a
                href={deepLink}
                style={{
                    display: 'block',
                    width: '100%',
                    maxWidth: '320px',
                    padding: '18px 24px',
                    background: 'linear-gradient(135deg, #FF7E36, #E84545)',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                    borderRadius: '18px',
                    textDecoration: 'none',
                    boxShadow: '0 6px 24px rgba(232,69,69,0.45)',
                    marginBottom: '16px'
                }}
            >
                Download Learn Loop to Send 🎁
            </a>

            <p style={{ opacity: 0.45, fontSize: '0.8rem', maxWidth: '260px', lineHeight: 1.5 }}>
                Gifts are purchased securely through the App Store inside the Learn Loop app.
            </p>

            <style>{`
                * { box-sizing: border-box; margin: 0; padding: 0; }
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
            `}</style>
        </main>
    );
}

export default function GiftPage() {
    return (
        <Suspense fallback={
            <div style={{ minHeight: '100vh', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                Loading...
            </div>
        }>
            <GiftPageContent />
        </Suspense>
    );
}
