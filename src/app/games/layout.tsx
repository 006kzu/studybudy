'use client';

import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AdMobService } from '@/lib/admob';

export default function GamesLayout({ children }: { children: React.ReactNode }) {
    const { state, consumeGameTime, isLoading } = useApp();
    const router = useRouter();
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const sessionMinutesPlayed = useRef(0);

    // Global Game Timer Logic
    useEffect(() => {
        if (isLoading) return;

        // Start Timer
        intervalRef.current = setInterval(() => {
            if (state.gameTimeBank > 0) {
                consumeGameTime(1);
                sessionMinutesPlayed.current += 1;

                // Ad Logic Check (Every 5 mins) -> Handled via Event? 
                // Or we can just set a flag in a context or store?
                // Actually, the "Game Over" logic needs to check this.
                // We can use sessionStorage or a global variable since this layout wraps everything.
                if (sessionMinutesPlayed.current > 0 && sessionMinutesPlayed.current % 5 === 0) {
                    sessionStorage.setItem('ad_pending', 'true');
                }
            } else {
                // Time up!
                // We should probably redirect or block usage if in a game.
                // But let's be nice and let them finish the current run?
                // The games check `timeLeft` usually. 
                // We can force a redirect if we want strict enforcement.
                // router.replace('/games'); // Maybe too harsh?
            }
        }, 60000); // Every minute

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isLoading, state.gameTimeBank, consumeGameTime]);

    return (
        <>
            {/* Global Game Time Indicator (Optional, maybe sticky header?) */}
            {/* The individual pages have their own headers, so we just provide logic here. */}
            {children}
        </>
    );
}
