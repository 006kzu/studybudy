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

    useEffect(() => {
        // Banner Ad
        if (!state.isPremium) {
            AdMobService.showBanner();
        }

        return () => {
            AdMobService.removeBanner();
        };
    }, [state.isPremium]);

    // Global Game Timer Logic
    useEffect(() => {
        if (isLoading) return;

        // Delay first consumption by 60s to ensure player gets at least 1 minute
        const firstTimeout = setTimeout(() => {
            if (state.gameTimeBank > 0) {
                consumeGameTime(1);
                sessionMinutesPlayed.current += 1;
            }

            // Then continue every minute
            intervalRef.current = setInterval(() => {
                if (state.gameTimeBank > 0) {
                    consumeGameTime(1);
                    sessionMinutesPlayed.current += 1;

                    if (sessionMinutesPlayed.current > 0 && sessionMinutesPlayed.current % 5 === 0) {
                        sessionStorage.setItem('ad_pending', 'true');
                    }
                }
            }, 60000);
        }, 60000);

        return () => {
            clearTimeout(firstTimeout);
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
