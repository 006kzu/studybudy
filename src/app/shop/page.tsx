'use client';

import { useApp } from '@/context/AppContext';
import Link from 'next/link';

export default function ShopPage() {
    const { state } = useApp();

    const ITEMS = [
        { name: 'Red Bandana', price: 500, icon: '🧣' },
        { name: 'Top Hat', price: 1000, icon: '🎩' },
        { name: 'Sunglasess', price: 750, icon: '😎' },
        { name: 'Super Cape', price: 2000, icon: '🦸' },
    ];

    return (
        <main className="container">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 className="text-h1">Pet Shop</h1>
                <div style={{
                    background: 'var(--color-surface)',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-full)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 'bold'
                }}>
                    <span>🦴</span>
                    <span>{state.points}</span>
                </div>
            </header>

            <div className="card text-center" style={{ background: '#FFF3E0', border: '1px solid #FFE0B2' }}>
                <p className="text-body" style={{ color: '#E65100' }}>
                    Earn bones by studying to buy outfits!
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {ITEMS.map((item) => (
                    <div key={item.name} className="card text-center" style={{ opacity: state.points >= item.price ? 1 : 0.6 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '8px' }}>{item.icon}</div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{item.name}</h3>
                        <p style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{item.price} 🦴</p>
                        <button
                            disabled
                            className="btn btn-secondary"
                            style={{ marginTop: '12px', width: '100%', fontSize: '0.8rem' }}
                        >
                            {state.points >= item.price ? 'Coming Soon' : 'Locked'}
                        </button>
                    </div>
                ))}
            </div>

            <Link href="/dashboard" className="btn btn-primary" style={{ marginTop: '24px', width: '100%' }}>
                Back to Dashboard
            </Link>
        </main>
    );
}
