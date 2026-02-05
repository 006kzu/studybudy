'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

function LinkContent() {
    const searchParams = useSearchParams();
    const studentId = searchParams.get('studentId');
    const router = useRouter();
    const { user, state, isLoading, refreshData } = useApp();
    const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('loading');
    const [message, setMessage] = useState('Connecting to student account...');

    useEffect(() => {
        const linkStudent = async () => {
            if (!studentId) {
                setStatus('error');
                setMessage('Invalid link. No Student ID found.');
                return;
            }

            if (isLoading) return;

            if (!user) {
                // Not logged in -> Redirect to login (passing this URL as next)
                // We use a simpler return URL strategy
                const returnUrl = encodeURIComponent(`/link?studentId=${studentId}`);
                router.replace(`/login?next=${returnUrl}`);
                return;
            }

            // User is logged in. Check role.
            if (state.role === 'student' && state.isRoleSet) {
                setStatus('error');
                setMessage('You are logged in as a Student. Only Parents can link to Student accounts.');
                return;
            }

            // Attempt to link
            try {
                // 1. Update Profile with linked_user_id
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        linked_user_id: studentId,
                        role: 'parent', // Ensure they are a parent
                        is_onboarded: true // Mark as onboarded if not already
                    })
                    .eq('id', user.id);

                if (error) throw error;

                // 2. Refresh Context
                await refreshData();

                setStatus('success');
                setMessage('Successfully linked! Redirecting to Parent Dashboard...');

                setTimeout(() => {
                    router.replace('/parent');
                }, 2000);

            } catch (err: any) {
                console.error('Linking error:', err);
                setStatus('error');
                setMessage(`Failed to link: ${err.message || 'Unknown error'}`);
            }
        };

        linkStudent();
    }, [studentId, user, isLoading, state.role, router, refreshData]);

    return (
        <main className="container" style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            padding: '24px'
        }}>
            <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
                <h1 className="text-h2" style={{ marginBottom: '16px' }}>
                    {status === 'loading' && '🔄 Connecting...'}
                    {status === 'success' && '✅ Connected!'}
                    {status === 'error' && '❌ Error'}
                </h1>

                <p className="text-body" style={{ marginBottom: '24px' }}>
                    {message}
                </p>

                {status === 'error' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <Link href="/dashboard" className="btn btn-secondary">
                            Go to Dashboard
                        </Link>
                        {state.role === 'student' && (
                            <button
                                onClick={() => {
                                    // Allow switching accounts
                                    supabase.auth.signOut().then(() => {
                                        window.location.reload();
                                    });
                                }}
                                className="btn"
                                style={{ background: '#f5f5f5', border: '1px solid #ddd' }}
                            >
                                Log Out & Switch Account
                            </button>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}

export default function LinkPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <LinkContent />
        </Suspense>
    );
}
