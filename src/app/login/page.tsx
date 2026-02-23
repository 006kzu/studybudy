'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { useApp } from '@/context/AppContext';

export default function LoginPage() {
    const { user, isLoading: appLoading } = useApp();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
    const [redirectUrl, setRedirectUrl] = useState<string>('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setRedirectUrl(`${window.location.origin}/auth/callback`);
        }

        // Auto-redirect if already logged in
        if (user) {
            console.log('User already logged in, redirecting to dashboard...');
            router.replace('/dashboard');
        }
    }, [user, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        // Magic Link Login
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        if (error) {
            setMessage({ text: error.message, type: 'error' });
        } else {
            setMessage({ text: 'Check your email for the magic link!', type: 'success' });
        }
        setLoading(false);
    };

    const handleOAuth = async (provider: 'google' | 'apple') => {
        const isNative = Capacitor.isNativePlatform();
        const redirectTo = isNative
            ? 'com.zachthomas.studybudy.learnloop://callback'
            : `${window.location.origin}/auth/callback?next=/dashboard`;

        console.log('OAuth Redirect URL:', redirectTo);

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo,
                skipBrowserRedirect: true,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent select_account',
                },
            },
        });

        if (error) {
            setMessage({ text: error.message, type: 'error' });
        } else if (data?.url) {
            // Open the OAuth URL
            if (isNative) {
                await Browser.open({ url: data.url });
            } else {
                window.location.href = data.url;
            }
        }
    };

    return (
        <main className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🌭</div>
                    <h1 className="text-h2">Welcome Back</h1>
                    <p className="text-body" style={{ color: '#666' }}>Sign in to sync your progress</p>
                    <p style={{ fontSize: '0.7rem', color: '#999', marginTop: '8px' }}>
                        Redirecting to: {redirectUrl || '...'}
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                    <button
                        onClick={() => handleOAuth('apple')}
                        className="btn"
                        style={{
                            background: 'black',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        <span style={{ fontSize: '1.2rem' }}></span> Sign in with Apple
                    </button>
                    <button
                        onClick={() => handleOAuth('google')}
                        className="btn"
                        style={{
                            background: 'white',
                            color: '#333',
                            border: '1px solid #ddd',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        <span style={{ fontSize: '1.2rem' }}>G</span> Sign in with Google
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0', opacity: 0.5 }}>
                    <div style={{ height: '1px', background: '#ccc', flex: 1 }} />
                    <span style={{ fontSize: '0.8rem' }}>OR MAGIC LINK</span>
                    <div style={{ height: '1px', background: '#ccc', flex: 1 }} />
                </div>

                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: '16px' }}>
                        <label className="text-body" style={{ display: 'block', marginBottom: '8px' }}>Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="input"
                            style={{ width: '100%' }}
                        />
                    </div>

                    {message && (
                        <div style={{
                            padding: '12px',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            background: message.type === 'success' ? '#e6fffa' : '#fff5f5',
                            color: message.type === 'success' ? '#2c7a7b' : '#c53030',
                            border: `1px solid ${message.type === 'success' ? '#b2f5ea' : '#feb2b2'}`
                        }}>
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                    >
                        {loading ? 'Sending Magic Link...' : 'Send Magic Link ✨'}
                    </button>
                </form>

                <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.9rem' }}>
                    <Link href="/dashboard" style={{ color: '#666' }}>
                        Continue as Guest
                    </Link>
                </div>
            </div>
        </main>
    );
}
