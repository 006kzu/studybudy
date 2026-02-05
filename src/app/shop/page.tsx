'use client';

import { useApp } from '@/context/AppContext';
import Link from 'next/link';
import { useState } from 'react';
import WienerAvatar from '@/components/WienerAvatar';
import { AVATARS } from '@/constants/avatars';
import Modal from '@/components/Modal';
import Toast from '@/components/Toast';
import { purchaseItem } from '@/lib/iap';

export default function ShopPage() {
    const { state, buyItem, equipAvatar } = useApp();
    const [toastMsg, setToastMsg] = useState<{ msg: string, type: 'error' | 'success' } | null>(null);
    const [selectedItem, setSelectedItem] = useState<{ name: string, price: number, filename: string } | null>(null);

    // Filter out "Default Dog" if you don't want to sell it (it's price 0, implies owned)
    // Or keep it to show "Equipped"
    const ITEMS = AVATARS;

    const ownedCount = state.inventory ? state.inventory.length : 0;
    const totalCount = ITEMS.length;

    // Helper to determine Tier/Category
    const getCategory = (price: number, name: string) => {
        if (name === 'Golden Munchkin Cat') return { name: 'Mythical', color: '#ffd700', tier: 'exclusive', cost: 'Points Only' };
        if (price < 20000) return { name: 'Starter Pal', color: '#4CAF50', tier: 'tier1', cost: '$0.99' };
        if (price < 100000) return { name: 'Rare Companion', color: '#2196F3', tier: 'tier2', cost: '$1.99' };
        return { name: 'Legendary Friend', color: '#9C27B0', tier: 'tier3', cost: '$4.99' };
    };

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

    // Derived selected item category
    const selectedCategory = selectedItem ? getCategory(selectedItem.price, selectedItem.name) : null;

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
                    // Default Dog is always owned (free for everyone)
                    const isOwned = item.name === 'Default Dog' || state.inventory?.includes(item.name);
                    const isEquipped = state.equippedAvatar === item.name;
                    const cat = getCategory(item.price, item.name);

                    return (
                        <div
                            key={item.name}
                            className="card text-center"
                            style={{
                                opacity: isEquipped ? 0.8 : 1, // Always fully visible to encourage buying
                                cursor: isEquipped ? 'default' : 'pointer',
                                border: isEquipped ? '2px solid var(--color-primary)' : (cat.tier === 'exclusive' ? '2px solid #f1c40f' : 'none'),
                                background: cat.tier === 'exclusive' ? 'linear-gradient(135deg, #fff9c4 0%, #fff 50%, #f1c40f 100%)' : 'white',
                                boxShadow: cat.tier === 'exclusive' ? '0 0 15px rgba(241, 196, 15, 0.5)' : 'var(--shadow-card)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                            onClick={() => handleAction(item)}
                        >
                            {/* Category Badge */}
                            {cat.tier !== 'tier1' && (
                                <div style={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    fontSize: '0.6rem',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    background: cat.color,
                                    color: 'white',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    zIndex: 1
                                }}>
                                    {cat.name.split(' ')[0]}
                                </div>
                            )}

                            <div style={{ height: '80px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', marginTop: '12px' }}>
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
                            <p style={{ color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                {isOwned ? 'Owned' : `${item.price.toLocaleString()} 💰`}
                            </p>

                            {/* Visual Tier Indicator Bar */}
                            <div style={{ width: '100%', height: '4px', background: '#eee', marginTop: '8px', borderRadius: '2px' }}>
                                <div style={{
                                    width: '100%',
                                    height: '100%',
                                    background: cat.color,
                                    borderRadius: '2px',
                                    opacity: 0.5
                                }}></div>
                            </div>

                            <button
                                className={`btn ${isOwned ? 'btn-secondary' : 'btn-secondary'}`}
                                style={{
                                    marginTop: '8px',
                                    width: '100%',
                                    fontSize: '0.8rem',
                                    background: isEquipped ? '#ccc' : (isOwned ? '#4CAF50' : undefined),
                                    color: (isOwned || isEquipped) ? 'white' : undefined,
                                    border: isOwned ? 'none' : undefined
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
                title="Unlock Companion"
                actions={null}
            >
                {selectedItem && selectedCategory && (
                    <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>

                        <div style={{
                            marginBottom: '16px',
                            display: 'inline-block',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            background: selectedCategory.color,
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            textTransform: 'uppercase',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                        }}>
                            {selectedCategory.name}
                        </div>

                        {/* Avatar Preview with subtle shadow */}
                        <div style={{
                            width: '120px',
                            height: '120px',
                            margin: '0 auto 20px',
                            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                            borderRadius: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                        }}>
                            <img
                                src={selectedItem.filename}
                                alt={selectedItem.name}
                                style={{
                                    width: '90px',
                                    height: '90px',
                                    objectFit: 'contain',
                                    imageRendering: 'pixelated'
                                }}
                            />
                        </div>

                        <h3 style={{
                            fontSize: '1.3rem',
                            fontWeight: 700,
                            marginBottom: '8px',
                            color: 'var(--color-text)'
                        }}>
                            {selectedItem.name}
                        </h3>

                        <p style={{
                            fontSize: '0.9rem',
                            color: 'var(--color-text-secondary)',
                            marginBottom: '24px'
                        }}>
                            {selectedCategory.tier === 'exclusive'
                                ? "This mythical creature can only be earned with coins!"
                                : "Add this companion to your collection instantly."}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Option 1: Coins */}
                            <button
                                className="btn"
                                style={{
                                    background: (state.points || 0) >= selectedItem.price
                                        ? 'linear-gradient(135deg, var(--color-primary) 0%, #ff9a56 100%)'
                                        : '#e9ecef',
                                    color: (state.points || 0) >= selectedItem.price ? 'white' : '#868e96',
                                    padding: '14px 20px',
                                    borderRadius: '12px',
                                    fontWeight: 600,
                                    fontSize: '0.95rem',
                                    border: 'none',
                                    boxShadow: (state.points || 0) >= selectedItem.price
                                        ? '0 4px 12px rgba(255, 126, 54, 0.3)'
                                        : 'none',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    paddingLeft: '24px',
                                    paddingRight: '24px'
                                }}
                                disabled={(state.points || 0) < selectedItem.price}
                                onClick={confirmPurchase}
                            >
                                <span>Use Coins</span>
                                <span style={{ opacity: 0.9 }}>{selectedItem.price.toLocaleString()} 💰</span>
                            </button>

                            {/* Option 2: Cash (Hidden for Exclusive) */}
                            {selectedCategory.tier !== 'exclusive' && (
                                <button
                                    className="btn"
                                    style={{
                                        background: 'white',
                                        color: selectedCategory.color, // Theme color
                                        border: `2px solid ${selectedCategory.color}20`, // Light border
                                        padding: '16px',
                                        borderRadius: '16px',
                                        fontWeight: 700,
                                        fontSize: '1rem',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        paddingLeft: '24px',
                                        paddingRight: '24px',
                                        marginTop: '4px'
                                    }}
                                    onClick={async () => {
                                        // Direct Purchase Logic (No Parental Gate)
                                        if (selectedItem && selectedCategory) {
                                            try {
                                                // Map Tier to Product ID
                                                let productId = 'avatar_tier1';
                                                if (selectedCategory.tier === 'tier2') productId = 'avatar_tier2';
                                                if (selectedCategory.tier === 'tier3') productId = 'avatar_tier3';

                                                const success = await purchaseItem(productId);
                                                if (success) {
                                                    // Buy with 0 coin cost (Real Money paid via IAP)
                                                    buyItem(selectedItem.name, 0);
                                                    equipAvatar(selectedItem.name);
                                                    setToastMsg({ msg: `${selectedItem.name} Unlocked!`, type: 'success' });
                                                    setSelectedItem(null);
                                                }
                                            } catch (e) {
                                                console.error(e);
                                                setToastMsg({ msg: `Purchase failed`, type: 'error' });
                                            }
                                        }
                                    }}
                                >
                                    <span>Buy Instantly</span>
                                    <span>{selectedCategory.cost}</span>
                                </button>
                            )}

                            {/* Cancel Button */}
                            <button
                                onClick={() => setSelectedItem(null)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--color-text-secondary)',
                                    fontSize: '0.9rem',
                                    padding: '8px',
                                    cursor: 'pointer',
                                    marginTop: '4px'
                                }}
                            >
                                Cancel
                            </button>
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
