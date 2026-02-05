'use client';

import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { createClient } from '@supabase/supabase-js';

// Create a public client for gift sending (no auth required)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function GiftPageContent() {
    const searchParams = useSearchParams();
    const recipientId = searchParams.get('userId');

    const [senderName, setSenderName] = useState('');
    const [giftType, setGiftType] = useState<'coins' | 'game_time'>('coins');
    const [amount, setAmount] = useState<number>(10000);
    const [sent, setSent] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    const COIN_OPTIONS = [10000, 50000, 1000000];
    const TIME_OPTIONS = [10, 30, 60]; // Minutes

    const handleSendGift = async () => {
        if (!recipientId) {
            setError('Invalid gift link. Please ask for a new link.');
            return;
        }

        if (!senderName.trim()) {
            setError('Please enter your name');
            return;
        }

        setSending(true);
        setError('');

        try {
            const supabase = createClient(supabaseUrl, supabaseAnonKey);

            const { error: insertError } = await supabase.from('gifts').insert({
                recipient_user_id: recipientId,
                sender_name: senderName.trim(),
                gift_type: giftType,
                amount: amount
            });

            if (insertError) {
                console.error('Gift insert error:', insertError);
                setError('Failed to send gift. Please try again.');
                setSending(false);
                return;
            }

            setSent(true);
        } catch (err) {
            console.error('Gift error:', err);
            setError('Something went wrong. Please try again.');
        }
        setSending(false);
    };

    if (!recipientId) {
        return (
            <main className="container" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 40px)', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '16px' }}>🎁 Send a Gift</h1>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                    This link is invalid. Please ask for a new share link from the Learn Loop app.
                </p>
            </main>
        );
    }

    if (sent) {
        return (
            <main className="container" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 40px)', textAlign: 'center' }}>
                <div style={{ fontSize: '5rem', marginBottom: '24px' }}>🎉</div>
                <h1 style={{ fontSize: '2rem', marginBottom: '16px', color: '#4CAF50' }}>Gift Sent!</h1>
                <p style={{ fontSize: '1.1rem', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
                    Your gift of <strong>{giftType === 'coins' ? `${amount.toLocaleString()} coins 💰` : `${amount} minutes of game time 🎮`}</strong> has been sent!
                </p>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                    They'll receive it the next time they open Study Budy.
                </p>
            </main>
        );
    }

    return (
        <main className="container" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 40px)' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎁</div>
                <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Send a Gift</h1>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                    Reward their hard work with coins or game time!
                </p>
            </div>

            {/* Sender Name */}
            <div className="card" style={{ marginBottom: '16px', padding: '20px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>
                    Your Name
                </label>
                <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="e.g., Mom, Dad, Grandma"
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: '1rem',
                        borderRadius: '12px',
                        border: '2px solid var(--color-border)',
                        outline: 'none'
                    }}
                />
            </div>

            {/* Gift Type Selector */}
            <div className="card" style={{ marginBottom: '16px', padding: '20px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '12px' }}>
                    Gift Type
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={() => { setGiftType('coins'); setAmount(10000); }}
                        style={{
                            flex: 1,
                            padding: '16px',
                            borderRadius: '12px',
                            border: giftType === 'coins' ? '3px solid var(--color-primary)' : '2px solid var(--color-border)',
                            background: giftType === 'coins' ? 'linear-gradient(135deg, #fff9c4, #fff)' : 'white',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 600
                        }}
                    >
                        💰 Coins
                    </button>
                    <button
                        onClick={() => { setGiftType('game_time'); setAmount(10); }}
                        style={{
                            flex: 1,
                            padding: '16px',
                            borderRadius: '12px',
                            border: giftType === 'game_time' ? '3px solid var(--color-primary)' : '2px solid var(--color-border)',
                            background: giftType === 'game_time' ? 'linear-gradient(135deg, #e3f2fd, #fff)' : 'white',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 600
                        }}
                    >
                        🎮 Game Time
                    </button>
                </div>
            </div>

            {/* Amount Selector */}
            <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '12px' }}>
                    Amount
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {(giftType === 'coins' ? COIN_OPTIONS : TIME_OPTIONS).map((opt) => (
                        <button
                            key={opt}
                            onClick={() => setAmount(opt)}
                            style={{
                                flex: '1 1 calc(33.33% - 6px)',
                                padding: '16px 8px',
                                borderRadius: '12px',
                                border: amount === opt ? '3px solid var(--color-primary)' : '2px solid var(--color-border)',
                                background: amount === opt ? 'var(--color-primary)' : 'white',
                                color: amount === opt ? 'white' : 'var(--color-text)',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 700
                            }}
                        >
                            {giftType === 'coins'
                                ? (opt >= 1000000 ? '1M' : opt.toLocaleString())
                                : `${opt} min${opt > 1 ? 's' : ''}`
                            }
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div style={{
                    color: '#d32f2f',
                    background: '#ffebee',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    marginBottom: '16px',
                    textAlign: 'center'
                }}>
                    {error}
                </div>
            )}

            {/* Send Button */}
            <button
                onClick={handleSendGift}
                disabled={sending}
                className="btn btn-primary"
                style={{
                    width: '100%',
                    padding: '18px',
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, #FF7E36 0%, #FFB347 100%)',
                    border: 'none',
                    boxShadow: '0 4px 15px rgba(255, 126, 54, 0.4)',
                    opacity: sending ? 0.7 : 1
                }}
            >
                {sending ? 'Sending...' : '🎁 Send Gift'}
            </button>

            <p style={{
                textAlign: 'center',
                marginTop: '16px',
                color: 'var(--color-text-secondary)',
                fontSize: '0.85rem'
            }}>
                This gift is free to send! It encourages learning. ❤️
            </p>
        </main>
    );
}

export default function GiftPage() {
    return (
        <Suspense fallback={<div className="container" style={{ textAlign: 'center', paddingTop: '100px' }}>Loading...</div>}>
            <GiftPageContent />
        </Suspense>
    );
}
