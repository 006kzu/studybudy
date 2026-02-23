'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { useApp } from '@/context/AppContext';

export default function LoginPage() {
    const { user } = useApp();
    const router = useRouter();
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

    useEffect(() => {
        if (user) router.replace('/dashboard');
    }, [user, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        if (mode === 'signup') {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
            });
            if (error) {
                setMessage({ text: error.message, type: 'error' });
            } else {
                setMessage({ text: '🎉 Account created! Check your email to confirm, then sign in.', type: 'success' });
                setMode('signin');
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                setMessage({ text: error.message, type: 'error' });
            } else {
                router.replace('/dashboard');
            }
        }

        setLoading(false);
    };

    const handleOAuth = async (provider: 'google' | 'apple') => {
        const isNative = Capacitor.isNativePlatform();
        const redirectTo = isNative
            ? 'com.zachthomas.studybudy.learnloop://callback'
            : `${window.location.origin}/auth/callback?next=/dashboard`;

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo,
                skipBrowserRedirect: true,
                queryParams: { access_type: 'offline', prompt: 'consent select_account' },
            },
        });

        if (error) {
            setMessage({ text: error.message, type: 'error' });
        } else if (data?.url) {
            if (isNative) {
                await Browser.open({ url: data.url });
            } else {
                window.location.href = data.url;
            }
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '16px 18px',
        fontSize: '1.1rem',
        border: '2px solid var(--color-border)',
        borderRadius: '14px',
        outline: 'none',
        background: 'white',
        color: 'var(--color-text-main)',
        transition: 'border-color 0.2s ease',
    };

    return (
        <main className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '90vh', paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
            <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '36px 28px' }}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>📚</div>
                    <h1 className="text-h2" style={{ marginBottom: '4px' }}>
                        {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
                    </h1>
                    <p className="text-body" style={{ color: '#888', fontSize: '0.95rem' }}>
                        {mode === 'signin' ? 'Sign in to sync your progress' : 'Start your study journey'}
                    </p>
                </div>

                {/* OAuth Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                    <button
                        onClick={() => handleOAuth('apple')}
                        className="btn"
                        style={{ background: 'black', color: 'white', gap: '8px', fontSize: '1rem', padding: '14px' }}
                    >
                        <span style={{ fontSize: '1.2rem' }}></span> Continue with Apple
                    </button>
                    <button
                        onClick={() => handleOAuth('google')}
                        className="btn"
                        style={{ background: 'white', color: '#333', border: '1.5px solid #ddd', gap: '8px', fontSize: '1rem', padding: '14px' }}
                    >
                        <span style={{ fontWeight: 700 }}>G</span> Continue with Google
                    </button>
                </div>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0', opacity: 0.45 }}>
                    <div style={{ height: '1px', background: '#bbb', flex: 1 }} />
                    <span style={{ fontSize: '0.8rem', letterSpacing: '1px' }}>OR</span>
                    <div style={{ height: '1px', background: '#bbb', flex: 1 }} />
                </div>

                {/* Email + Password Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.95rem' }}>
                            Email
                        </label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            style={inputStyle}
                            autoComplete="email"
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.95rem' }}>
                            Password
                        </label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={mode === 'signup' ? 'Choose a password (6+ chars)' : 'Your password'}
                            style={inputStyle}
                            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                            minLength={6}
                        />
                    </div>

                    {message && (
                        <div style={{
                            padding: '12px 16px',
                            borderRadius: '10px',
                            background: message.type === 'success' ? '#e6fffa' : '#fff5f5',
                            color: message.type === 'success' ? '#2c7a7b' : '#c53030',
                            border: `1px solid ${message.type === 'success' ? '#b2f5ea' : '#feb2b2'}`,
                            fontSize: '0.9rem',
                            lineHeight: 1.4
                        }}>
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '16px', fontSize: '1.05rem', marginTop: '4px' }}
                    >
                        {loading
                            ? (mode === 'signup' ? 'Creating account...' : 'Signing in...')
                            : (mode === 'signup' ? 'Create Account 🚀' : 'Sign In')}
                    </button>
                </form>

                {/* Toggle mode */}
                <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.9rem', color: '#666' }}>
                    {mode === 'signin' ? (
                        <>
                            Don&apos;t have an account?{' '}
                            <button
                                onClick={() => { setMode('signup'); setMessage(null); }}
                                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
                            >
                                Sign Up
                            </button>
                        </>
                    ) : (
                        <>
                            Already have an account?{' '}
                            <button
                                onClick={() => { setMode('signin'); setMessage(null); }}
                                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
                            >
                                Sign In
                            </button>
                        </>
                    )}
                </div>

                {/* Guest */}
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                    <Link href="/dashboard" style={{ color: '#aaa', fontSize: '0.85rem' }}>
                        Continue as Guest
                    </Link>
                </div>
            </div>
        </main>
    );
}
