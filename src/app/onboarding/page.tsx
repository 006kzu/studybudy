'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';

export default function Onboarding() {
    const { addClass, completeOnboarding } = useApp();
    const router = useRouter();

    const [step, setStep] = useState(1);
    const [className, setClassName] = useState('');
    const [hours, setHours] = useState(2);
    const [color, setColor] = useState('#FF7E36');

    const handleNext = () => {
        if (!className) return;

        // Add the class
        addClass({
            id: crypto.randomUUID(),
            name: className,
            weeklyGoalMinutes: hours * 60,
            color: color,
        });

        // For MVP, just one class setup is fine to start
        completeOnboarding();
        router.push('/dashboard');
    };

    return (
        <main className="container">
            <div className="card animate-fade-in" style={{ marginTop: '10vh' }}>
                <h1 className="text-h1 text-center">Let's Get Started!</h1>
                <p className="text-body text-center" style={{ marginBottom: '24px' }}>
                    Add your first class to start tracking.
                </p>

                <div style={{ marginBottom: '20px' }}>
                    <label className="text-body" style={{ display: 'block', marginBottom: '8px' }}>Class Name</label>
                    <input
                        type="text"
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        placeholder="e.g. Biology 101"
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)',
                            fontSize: '1rem',
                            marginBottom: '16px'
                        }}
                    />

                    <label className="text-body" style={{ display: 'block', marginBottom: '8px' }}>Weekly Study Goal (Hours)</label>
                    <input
                        type="number"
                        value={hours}
                        onChange={(e) => setHours(Number(e.target.value))}
                        min="1"
                        max="20"
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)',
                            fontSize: '1rem',
                            marginBottom: '16px'
                        }}
                    />

                    <label className="text-body" style={{ display: 'block', marginBottom: '8px' }}>Color Code</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {['#FF7E36', '#4A90E2', '#34C759', '#FF3B30', '#9013FE'].map((c) => (
                            <div
                                key={c}
                                onClick={() => setColor(c)}
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    backgroundColor: c,
                                    cursor: 'pointer',
                                    border: color === c ? '3px solid var(--color-text-main)' : 'none',
                                    transform: color === c ? 'scale(1.1)' : 'scale(1)'
                                }}
                            />
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleNext}
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: '24px' }}
                    disabled={!className}
                >
                    Create Profile
                </button>
            </div>
        </main>
    );
}
