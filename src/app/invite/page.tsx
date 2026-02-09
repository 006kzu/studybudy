'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';

function InviteContent() {
    const searchParams = useSearchParams();
    const studentId = searchParams.get('id');
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (studentId) {
            navigator.clipboard.writeText(studentId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <main className="container" style={{
            paddingTop: 'calc(env(safe-area-inset-top) + 40px)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minHeight: '80vh'
        }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px', animation: 'bounce 1s infinite alternate' }}>
                👋
            </div>

            <h1 style={{
                fontSize: '2rem',
                fontWeight: 800,
                marginBottom: '16px',
                background: 'linear-gradient(135deg, #FF7E36, #FFB347)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
            }}>
                Join Learn Loop!
            </h1>

            <p style={{
                fontSize: '1.1rem',
                color: 'var(--color-text-secondary)',
                marginBottom: '32px',
                maxWidth: '300px',
                lineHeight: '1.5'
            }}>
                You've been invited to connect with a student on Learn Loop.
            </p>

            {studentId ? (
                <div className="card" style={{
                    padding: '24px',
                    marginBottom: '32px',
                    width: '100%',
                    maxWidth: '400px',
                    border: '2px solid var(--color-primary)',
                    background: '#fff3e0'
                }}>
                    <label style={{
                        display: 'block',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        marginBottom: '8px',
                        color: 'var(--color-text-secondary)'
                    }}>
                        Student Code
                    </label>
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center'
                    }}>
                        <div style={{
                            flex: 1,
                            padding: '12px',
                            background: 'white',
                            borderRadius: '8px',
                            border: '1px solid #ccc',
                            fontFamily: 'monospace',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            letterSpacing: '1px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {studentId}
                        </div>
                        <button
                            onClick={handleCopy}
                            style={{
                                padding: '12px 16px',
                                borderRadius: '8px',
                                background: copied ? '#4CAF50' : 'var(--color-primary)',
                                color: 'white',
                                border: 'none',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                    <p style={{ marginTop: '12px', fontSize: '0.85rem', color: '#666' }}>
                        👇 Copy this code, then download the app!
                    </p>
                </div>
            ) : (
                <div className="card" style={{ padding: '20px', marginBottom: '32px', background: '#ffebee' }}>
                    <p style={{ color: '#c62828' }}>No Student ID found in this link.</p>
                </div>
            )}

            <a
                href="https://apps.apple.com/app/learn-loop"
                className="btn"
                style={{
                    background: 'black',
                    color: 'white',
                    padding: '16px 32px',
                    borderRadius: '16px',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontWeight: 700,
                    fontSize: '1.2rem',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                }}
            >
                <img src="/icons/apple.png" alt="" style={{ width: '24px', height: '24px', filter: 'invert(1)' }} onError={(e) => e.currentTarget.style.display = 'none'} />
                <span>Download on App Store</span>
            </a>

            <div style={{ marginTop: 'auto', padding: '20px', color: '#999', fontSize: '0.8rem' }}>
                Already have the app? <br /> Open Learn Loop and go to Parent Dashboard.
            </div>

            <style jsx>{`
                @keyframes bounce {
                    from { transform: translateY(0); }
                    to { transform: translateY(-10px); }
                }
            `}</style>
        </main>
    );
}

export default function InvitePage() {
    return (
        <Suspense fallback={<div className="container" style={{ textAlign: 'center', paddingTop: '100px' }}>Loading...</div>}>
            <InviteContent />
        </Suspense>
    );
}
