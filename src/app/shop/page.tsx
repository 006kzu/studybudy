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
    const [selectedItem, setSelectedItem] = useState<{ name: string, price: number, filename: string } | null>(null);

    // Filter out "Default Dog" if you don't want to sell it (it's price 0, implies owned)
    // Or keep it to show "Equipped"
    const ITEMS = AVATARS;

    const ownedCount = state.inventory ? state.inventory.length : 0;
    const totalCount = ITEMS.length;

    const handleAction = (item: { name: string, price: number, filename: string }) => {
        const isOwned = state.inventory?.includes(item.name);
        const isEquipped = state.equippedAvatar === item.name;

        if (isEquipped) return;

        if (isOwned) {
            equipAvatar(item.name);
            setToastMsg({ msg: `Equipped ${item.name}!`, type: 'success' });
        } else {
            // Check for cash purchase option (always open modal now)
            setSelectedItem(item);
        }
    };

    const confirmPurchase = () => {
        if (selectedItem) {
            buyItem(selectedItem.name, selectedItem.price);
            equipAvatar(selectedItem.name);
            setToastMsg({ msg: `${selectedItem.name} unlocked!`, type: 'success' });
            setSelectedItem(null);
        }
    };

    return (
        <main className="container" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
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

            {/* Bank Section Removed - Replaced with Direct Avatar Purchase */}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingBottom: '40px' }}>
                {ITEMS.map((item) => {
                    const isOwned = state.inventory?.includes(item.name);
                    const isEquipped = state.equippedAvatar === item.name;

                    return (
                        <div
                            key={item.name}
                            className="card text-center"
                            style={{
                                opacity: isEquipped ? 0.8 : 1, // Always fully visible to encourage buying
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
                                        imageRendering: 'pixelated',
                                        filter: !isOwned ? 'brightness(0) opacity(0.5)' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                                    }}
                                />
                            </div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{item.name}</h3>
                            <p style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>
                                {isOwned ? 'Owned' : `${item.price.toLocaleString()} 💰`}
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
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction(item);
                                }}
                            >
                                {isEquipped ? 'Equipped' : (isOwned ? 'Equip' : 'Unlock')}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Confirmation Modal */}
            <Modal
                isOpen={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                title="Unlock Avatar"
                actions={
                    <>
                        <button className="btn btn-secondary" onClick={() => setSelectedItem(null)}>Cancel</button>
                    </>
                }
            >
                {selectedItem && (
                    <div style={{ textAlign: 'center', paddingBottom: '16px' }}>
                        <img
                            src={selectedItem.filename}
                            alt={selectedItem.name}
                            style={{
                                width: '100px',
                                height: '100px',
                                objectFit: 'contain',
                                imageRendering: 'pixelated',
                                margin: '0 auto 16px auto',
                                display: 'block'
                            }}
                        />
                        <h3 style={{ marginBottom: '24px' }}>{selectedItem.name}</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Option 1: Coins */}
                            <button
                                className="btn"
                                style={{
                                    background: state.points >= selectedItem.price ? 'var(--color-primary)' : '#ccc',
                                    color: 'white',
                                    padding: '12px'
                                }}
                                disabled={state.points < selectedItem.price}
                                onClick={confirmPurchase}
                            >
                                {state.points >= selectedItem.price ? (
                                    <>Unlock with <strong>{selectedItem.price.toLocaleString()} Coins</strong> 💰</>
                                ) : (
                                    <>Need {selectedItem.price.toLocaleString()} Coins 🔒</>
                                )}
                            </button>

                            {/* Option 2: Cash (If not Golden Munchkin Cat) */}
                            {selectedItem.name !== 'Golden Munchkin Cat' && (
                                <button
                                    className="btn"
                                    style={{
                                        background: '#2ecc71',
                                        color: 'white',
                                        padding: '12px',
                                        boxShadow: '0 4px 6px rgba(46, 204, 113, 0.3)'
                                    }}
                                    onClick={() => {
                                        const cashPrice = selectedItem.price <= 50000 ? '$0.99' : '$1.99';
                                        if (confirm(`Purchase ${selectedItem.name} for ${cashPrice}? (Mock Payment)`)) {
                                            // Buy with 0 coin cost (Real Money)
                                            buyItem(selectedItem.name, 0);
                                            equipAvatar(selectedItem.name);
                                            setToastMsg({ msg: `${selectedItem.name} Purchased!`, type: 'success' });
                                            setSelectedItem(null);
                                        }
                                    }}
                                >
                                    Buy Now ({selectedItem.price <= 50000 ? '$0.99' : '$1.99'}) 💳
                                </button>
                            )}

                            {selectedItem.name === 'Golden Munchkin Cat' && (
                                <p style={{ fontSize: '0.8rem', color: '#f1c40f', fontStyle: 'italic' }}>
                                    ✨ Exclusive Status Symbol: Cannot be bought with money. Earn it!
                                </p>
                            )}
                        </div>
                    </div>
                )}
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
