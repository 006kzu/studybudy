'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [msg, setMsg] = useState('Finalizing login...');

    useEffect(() => {
        const handleAuth = async () => {
            const code = searchParams.get('code');
            const next = searchParams.get('next') ?? '/dashboard';
            const errorDescription = searchParams.get('error_description');

            if (errorDescription) {
                setMsg(`Error: ${errorDescription}`);
                setTimeout(() => router.replace('/login'), 3000);
                return;
            }

            if (code) {
                // Exchange code for session client-side
                const { error } = await supabase.auth.exchangeCodeForSession(code);
                if (!error) {
                    setMsg('Success! Redirecting...');
                    router.replace(next);
                } else {
                    // It's possible the code was already consumed by auto-detect. Check session.
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        setMsg('Session active! Redirecting...');
                        router.replace(next);
                    } else {
                        setMsg(`Authentication failed: ${error.message}`);
                        setTimeout(() => router.replace('/login'), 3000);
                    }
                }
            } else {
                // No code? Maybe implicit flow or already authenticated
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    setMsg('Already logged in. Redirecting...');
                    router.replace(next);
                } else {
                    // No session, no code.
                    setMsg('Redirecting to login...');
                    setTimeout(() => router.replace('/login'), 1000);
                }
            }
        };

        handleAuth();
    }, [searchParams, router]);

    return (
        <main className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
            <div className="card text-center" style={{ padding: '40px' }}>
                <div className="spinner" style={{ marginBottom: '16px' }}></div>
                <h1 className="text-h2" style={{ marginBottom: '8px' }}>Authenticating</h1>
                <p className="text-body" style={{ color: '#666' }}>{msg}</p>
                <style jsx>{`
                    .spinner {
                        display: inline-block;
                        width: 40px;
                        height: 40px;
                        border: 4px solid rgba(0, 0, 0, 0.1);
                        border-left-color: var(--color-primary, #FF7E36);
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                    @keyframes spin { 100% { transform: rotate(360deg); } }
                `}</style>
            </div>
        </main>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={<div className="container text-center">Loading Auth...</div>}>
            <AuthCallbackContent />
        </Suspense>
    );
}
