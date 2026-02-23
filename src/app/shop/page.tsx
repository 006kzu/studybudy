'use client';

import { useApp } from '@/context/AppContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef } from 'react';
import WienerAvatar from '@/components/WienerAvatar';
import { AVATARS } from '@/constants/avatars';
import Modal from '@/components/Modal';
import Toast from '@/components/Toast';
import { purchaseItem } from '@/lib/iap';
import { supabase } from '@/lib/supabase';

export default function ShopPage() {
    const { state, buyItem, redeemCharacterCredit, equipAvatar, user } = useApp();
    const router = useRouter();
    const [toastMsg, setToastMsg] = useState<{ msg: string, type: 'error' | 'success' } | null>(null);
    const [selectedItem, setSelectedItem] = useState<{ name: string, price: number, filename: string } | null>(null);
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [unlockedItem, setUnlockedItem] = useState<{ name: string, filename: string } | null>(null);
    const [previewItem, setPreviewItem] = useState<{ name: string, filename: string } | null>(null);
    const scrollRef = useRef(0);

    // Filter out "Default Dog" if you don't want to sell it (it's price 0, implies owned)
    // Or keep it to show "Equipped"
    const ITEMS = AVATARS;

    const ownedCount = state.inventory ? state.inventory.length : 0;
    const totalCount = ITEMS.length;

    // Query unredeemed character tier gifts


    const getCategory = (price: number, name: string) => {
        if (name === 'Golden Munchkin Cat') return { name: 'Mythical', color: '#ffd700', tier: 'exclusive', cost: 'Points Only' };
        if (price < 20000) return { name: 'Starter Pal', color: '#4CAF50', tier: 'tier1', cost: '$0.99' };
        if (price < 100000) return { name: 'Rare Companion', color: '#2196F3', tier: 'tier2', cost: '$1.99' };
        if (price <= 200000) return { name: 'Epic Companion', color: '#a855f7', tier: 'tier3', cost: '$3.99' };
        return { name: 'Legendary Friend', color: '#9C27B0', tier: 'tier4', cost: '$4.99' };
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
            scrollRef.current = window.scrollY;
            setSelectedItem(item);
        }
    };

    const confirmPurchase = () => {
        if (selectedItem) {
            buyItem(selectedItem.name, selectedItem.price);
            equipAvatar(selectedItem.name);
            // Show Success Modal
            setUnlockedItem(selectedItem);
            setSuccessModalOpen(true);
            setSelectedItem(null);
        }
    };

    // Derived selected item category
    const selectedCategory = selectedItem ? getCategory(selectedItem.price, selectedItem.name) : null;

    return (
        <main className="container" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
            <header style={{ marginBottom: '24px', textAlign: 'center', position: 'relative' }}>
                <button
                    onClick={() => router.back()}
                    style={{
                        position: 'absolute',
                        left: '0',
                        top: '0',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.5rem',
                        color: '#333',
                        padding: 0
                    }}
                >
                    ←
                </button>
                <h1 style={{
                    fontSize: '2rem',
                    margin: '0 auto',
                    background: 'linear-gradient(135deg, #FF7E36, #E84545)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    borderRadius: '24px',
                    padding: '12px 24px',
                    width: 'fit-content',
                    boxShadow: '0 4px 12px rgba(232, 69, 69, 0.3)'
                }}>
                    <img src="/icons/icon_store.png" alt="Shop" style={{ width: '80px', height: '80px' }} />
                    Pet Shop
                </h1>

                <p style={{ color: '#888', marginTop: '8px' }}>Collection: {ownedCount} / {totalCount}</p>
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

                            <div style={{ height: '80px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', marginTop: '12px' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (isOwned) setPreviewItem({ name: item.name, filename: item.filename });
                                }}
                            >
                                <img
                                    src={item.filename}
                                    alt={item.name}
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        objectFit: 'contain',
                                        imageRendering: 'pixelated',
                                        filter: !isOwned ? 'brightness(0) opacity(0.5)' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                                        cursor: isOwned ? 'zoom-in' : 'default'
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
                                        background: '#000000', // Apple Black
                                        color: 'white',
                                        padding: '16px',
                                        borderRadius: '40px', // Pill shape
                                        fontWeight: 700,
                                        fontSize: '1rem',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginTop: '4px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                    }}
                                    onClick={async () => {
                                        // Direct Purchase Logic (No Parental Gate)
                                        if (selectedItem && selectedCategory) {
                                            try {
                                                // Map Tier to Product ID
                                                let productId = 'avatar_tier1';
                                                if (selectedCategory.tier === 'tier2') productId = 'avatar_tier2';
                                                if (selectedCategory.tier === 'tier3') productId = 'avatar_tier3'; // Epic
                                                if (selectedCategory.tier === 'tier4') productId = 'avatar_tier4'; // Legendary

                                                const success = await purchaseItem(productId);
                                                if (success) {
                                                    // Buy with 0 coin cost (Real Money paid via IAP)
                                                    buyItem(selectedItem.name, 0);
                                                    equipAvatar(selectedItem.name);
                                                    setUnlockedItem(selectedItem);
                                                    setSuccessModalOpen(true);
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
                                    <span style={{ fontWeight: 400, opacity: 0.9 }}>{selectedCategory.cost}</span>
                                </button>
                            )}

                            {/* Option 3: Gift Credit (if available for this tier) */}
                            {selectedCategory && (
                                (selectedCategory.tier === 'tier2' && state.characterCredits.rare > 0) ||
                                (selectedCategory.tier === 'tier3' && state.characterCredits.epic > 0) ||
                                (selectedCategory.tier === 'tier4' && state.characterCredits.legendary > 0)
                            ) && (
                                    <button
                                        className="btn"
                                        style={{
                                            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                            color: 'white',
                                            border: 'none',
                                            padding: '16px',
                                            borderRadius: '16px',
                                            fontWeight: 700,
                                            fontSize: '1rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            paddingLeft: '24px',
                                            paddingRight: '24px',
                                            marginTop: '4px',
                                            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
                                        }}
                                        onClick={async () => {
                                            if (!selectedItem) return;
                                            let tier: 'legendary' | 'epic' | 'rare' = 'rare';
                                            if (selectedCategory.tier === 'tier4') tier = 'legendary';
                                            if (selectedCategory.tier === 'tier3') tier = 'epic';

                                            await redeemCharacterCredit(tier, selectedItem.name);
                                            setUnlockedItem(selectedItem);
                                            setSuccessModalOpen(true);
                                            setSelectedItem(null);
                                        }}
                                    >
                                        <span>🎁 Use Gift Credit</span>
                                        <span>FREE</span>
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


            {/* Success Modal */}
            <Modal
                isOpen={successModalOpen}
                onClose={() => setSuccessModalOpen(false)}
                title="Congratulations! 🎉"
                actions={
                    <button className="btn btn-primary" onClick={() => setSuccessModalOpen(false)}>
                        Back to Shop
                    </button>
                }
            >
                {unlockedItem && (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <div style={{
                            width: '140px',
                            height: '140px',
                            margin: '0 auto 24px',
                            background: 'radial-gradient(circle, #fff9c4 0%, #ffffff 70%)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 30px rgba(255, 215, 0, 0.4)',
                            animation: 'pulse 2s infinite'
                        }}>
                            <img
                                src={unlockedItem.filename}
                                alt={unlockedItem.name}
                                style={{
                                    width: '100px',
                                    height: '100px',
                                    objectFit: 'contain',
                                    imageRendering: 'pixelated'
                                }}
                            />
                        </div>
                        <h3 className="text-h2" style={{ marginBottom: '8px', color: 'var(--color-primary)' }}>
                            New Study Buddy!
                        </h3>
                        <p className="text-body" style={{ color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                            You've unlocked <strong>{unlockedItem.name}</strong>.
                            <br />
                            They are now equipped!
                        </p>
                    </div>
                )}
            </Modal>

            {/* Character Preview Overlay */}
            {previewItem && (
                <div
                    onClick={() => setPreviewItem(null)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999,
                        background: 'rgba(0,0,0,0.8)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'zoom-out'
                    }}
                >
                    <img
                        src={previewItem.filename}
                        alt={previewItem.name}
                        style={{
                            width: '280px',
                            height: '280px',
                            objectFit: 'contain',
                            imageRendering: 'pixelated',
                            filter: 'drop-shadow(0 8px 32px rgba(255,255,255,0.15))',
                            animation: 'previewPop 0.3s ease-out'
                        }}
                    />
                    <p style={{ color: 'white', fontSize: '1.4rem', fontWeight: 700, marginTop: '24px' }}>{previewItem.name}</p>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginTop: '12px' }}>Tap anywhere to close</p>
                    <style jsx>{`
                        @keyframes previewPop {
                            from { transform: scale(0.5); opacity: 0; }
                            to { transform: scale(1); opacity: 1; }
                        }
                    `}</style>
                </div>
            )}
        </main >
    );
}
