'use client';

import { useApp } from '@/context/AppContext';
import Link from 'next/link';
import { useState } from 'react';
import WienerAvatar from '@/components/WienerAvatar';
import { AVATARS } from '@/constants/avatars';

export default function ShopPage() {
    const { state, buyItem, equipAvatar } = useApp();
    const [showPoorPopup, setShowPoorPopup] = useState(false);

    // Filter out "Default Dog" if you don't want to sell it (it's price 0, implies owned)
    // Or keep it to show "Equipped"
    const ITEMS = AVATARS;

    const handleAction = (item: { name: string, price: number }) => {
        const isOwned = state.inventory?.includes(item.name);
        const isEquipped = state.equippedAvatar === item.name;

        if (isEquipped) return;

        if (isOwned) {
            equipAvatar(item.name);
        } else {
            // Buy logic
            if (state.points < item.price) {
                setShowPoorPopup(true);
                setTimeout(() => setShowPoorPopup(false), 3000);
            } else {
                buyItem(item.name, item.price);
                equipAvatar(item.name);
            }
        }
    };

    return (
        <main className="container">
            <div style={{ marginBottom: '16px' }}>
                <Link href="/dashboard" style={{ textDecoration: 'none', color: 'var(--color-text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ← Back to Dashboard
                </Link>
            </div>

            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 className="text-h1">Pet Shop</h1>
                <WienerAvatar points={state.points} inventory={state.inventory} equippedAvatar={state.equippedAvatar} />
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingBottom: '40px' }}>
                {ITEMS.map((item) => {
                    const isOwned = state.inventory?.includes(item.name);
                    const isEquipped = state.equippedAvatar === item.name;

                    return (
                        <div
                            key={item.name}
                            className="card text-center"
                            style={{
                                opacity: isEquipped ? 0.8 : (isOwned || state.points >= item.price ? 1 : 0.6),
                                cursor: isEquipped ? 'default' : 'pointer',
                                border: isEquipped ? '2px solid var(--color-primary)' : 'none',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center'
                            }}
                            onClick={() => handleAction(item)}
                        >
                            <div style={{ height: '80px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                                <img
                                    src={item.filename}
                                    alt={item.name}
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        objectFit: 'contain',
                                        imageRendering: 'pixelated', // Keep pixel art crisp
                                        filter: !isOwned && state.points < item.price ? 'grayscale(100%)' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                                    }}
                                />
                            </div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{item.name}</h3>
                            <p style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>
                                {isOwned ? 'Owned' : `${item.price} inches`}
                            </p>
                            <button
                                className={`btn ${isOwned ? 'btn-secondary' : 'btn-secondary'}`}
                                style={{
                                    marginTop: '8px',
                                    width: '100%',
                                    fontSize: '0.8rem',
                                    background: isEquipped ? '#ccc' : (isOwned ? '#4CAF50' : undefined),
                                    color: (isOwned || isEquipped) ? 'white' : undefined
                                }}
                                disabled={isEquipped}
                            >
                                {isEquipped ? 'Equipped' : (isOwned ? 'Equip' : (state.points >= item.price ? 'Buy' : 'Locked'))}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Insufficient Funds Popup */}
            {showPoorPopup && (
                <div style={{
                    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
                    background: '#222', color: '#ff6b6b', padding: '12px 24px', borderRadius: '50px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 100,
                    animation: 'fadeIn 0.3s ease-out',
                    whiteSpace: 'nowrap',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    border: '1px solid #ff6b6b'
                }}>
                    You don't have a big enough wiener 🌭
                </div>
            )}
        </main>
    );
}
