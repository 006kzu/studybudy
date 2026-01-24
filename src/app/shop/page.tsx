'use client';

import { useApp } from '@/context/AppContext';
import Link from 'next/link';
import { useState } from 'react';
import WienerAvatar from '@/components/WienerAvatar';
import { AVATARS } from '@/constants/avatars';
import Modal from '@/components/Modal';
import Toast from '@/components/Toast';

export default function ShopPage() {
    const { state, buyItem, equipAvatar } = useApp();
    const [toastMsg, setToastMsg] = useState<{ msg: string, type: 'error' | 'success' } | null>(null);
    const [selectedItem, setSelectedItem] = useState<{ name: string, price: number } | null>(null);

    // Filter out "Default Dog" if you don't want to sell it (it's price 0, implies owned)
    // Or keep it to show "Equipped"
    const ITEMS = AVATARS;

    const ownedCount = state.inventory ? state.inventory.length : 0;
    const totalCount = ITEMS.length;

    const handleAction = (item: { name: string, price: number }) => {
        const isOwned = state.inventory?.includes(item.name);
        const isEquipped = state.equippedAvatar === item.name;

        if (isEquipped) return;

        if (isOwned) {
            equipAvatar(item.name);
            setToastMsg({ msg: `Equipped ${item.name}!`, type: 'success' });
        } else {
            // Buy logic
            if (state.points < item.price) {
                setToastMsg({ msg: "Spend more time studying to unlock this character 💰", type: 'error' });
            } else {
                // Open confirmation Modal
                setSelectedItem(item);
            }
        }
    };

    const confirmPurchase = () => {
        if (selectedItem) {
            buyItem(selectedItem.name, selectedItem.price);
            equipAvatar(selectedItem.name);
            setToastMsg({ msg: `Bought ${selectedItem.name}!`, type: 'success' });
            setSelectedItem(null);
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
                <div>
                    <h1 className="text-h1" style={{ marginBottom: '4px' }}>Pet Shop</h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                        Collection: <strong>{ownedCount}</strong> / {totalCount}
                    </p>
                </div>
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
                                        filter: !isOwned ? 'brightness(0) opacity(0.5)' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                                    }}
                                />
                            </div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{item.name}</h3>
                            <p style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>
                                {isOwned ? 'Owned' : `${item.price} Coins 💰`}
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
                                {isEquipped ? 'Equipped' : (isOwned ? 'Equip' : (state.points >= item.price ? 'Unlock' : 'Locked'))}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Confirmation Modal */}
            <Modal
                isOpen={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                title="Confirm Unlock"
                actions={
                    <>
                        <button className="btn btn-secondary" onClick={() => setSelectedItem(null)}>Cancel</button>
                        <button className="btn btn-primary" onClick={confirmPurchase}>Unlock Now</button>
                    </>
                }
            >
                Are you sure you want to unlock <strong>{selectedItem?.name}</strong> for <strong>{selectedItem?.price} Coins 💰</strong>?
            </Modal>

            {/* Notification Toast */}
            {toastMsg && (
                <Toast
                    message={toastMsg.msg}
                    type={toastMsg.type}
                    onClose={() => setToastMsg(null)}
                />
            )}
        </main>
    );
}
