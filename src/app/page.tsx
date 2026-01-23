'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';

export default function Home() {
  const { state } = useApp();
  const router = useRouter();

  useEffect(() => {
    // Determine where to send the user
    if (state.isOnboarded) {
      router.push('/dashboard');
    } else {
      router.push('/onboarding');
    }
  }, [state.isOnboarded, router]);

  // Loading state while redirecting
  return (
    <main className="container align-center justify-center">
      <div className="card text-center animate-fade-in" style={{ marginTop: '20vh' }}>
        <h1 className="text-h1">Study Budy 🐶</h1>
        <p className="text-body match-text">Loading your info...</p>
      </div>
    </main>
  );
}
