'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';

interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children: ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
    const [startY, setStartY] = useState(0);
    const [currentY, setCurrentY] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Threshold to trigger refresh
    const PULL_THRESHOLD = 110; // Increased to ensure visibility below notch
    // Maximum pull distance visual
    const MAX_PULL = 200;

    const handleTouchStart = (e: React.TouchEvent) => {
        if (window.scrollY === 0 && !refreshing) {
            setStartY(e.touches[0].clientY);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (window.scrollY === 0 && !refreshing && startY > 0) {
            const pullDistance = e.touches[0].clientY - startY;
            if (pullDistance > 0) {
                // Add resistance
                // e.preventDefault(); // Warning: Passive event listener issue if not handled carefully, but React handles usually
                // Only pulling down
                const damped = Math.min(pullDistance * 0.5, MAX_PULL);
                setCurrentY(damped);
            }
        }
    };

    const handleTouchEnd = async () => {
        if (refreshing) return;

        if (currentY > PULL_THRESHOLD) {
            setRefreshing(true);
            setCurrentY(PULL_THRESHOLD); // Snap to threshold
            try {
                await onRefresh();
            } finally {
                setTimeout(() => {
                    setRefreshing(false);
                    setCurrentY(0);
                    setStartY(0);
                }, 500); // Small delay to show completion
            }
        } else {
            setCurrentY(0);
            setStartY(0);
        }
    };

    // Icon rotation based on pull
    const rotation = Math.min(currentY * 2, 180);

    return (
        <div
            ref={containerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ minHeight: '100vh', position: 'relative' }}
        >
            {/* Refresh Indicator */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: `${currentY}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                zIndex: 1000,
                pointerEvents: 'none', // Allow clicks through
                transition: refreshing ? 'height 0.2s ease' : 'none' // Don't animate during drag
            }}>
                <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: 'white',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: `translateY(${Math.min(currentY - 40, 60)}px) rotate(${refreshing ? 0 : rotation}deg)`,
                    transition: 'transform 0.2s'
                }}>
                    {refreshing ? (
                        <div className="animate-spin" style={{
                            width: '16px', height: '16px',
                            border: '2px solid var(--color-primary)',
                            borderTopColor: 'transparent',
                            borderRadius: '50%'
                        }} />
                    ) : (
                        <span style={{ color: 'var(--color-primary)', fontSize: '1rem' }}>⬇</span>
                    )}
                </div>
            </div>

            {/* Content with spring transform */}
            <div style={{
                transform: `translateY(${currentY}px)`,
                transition: refreshing ? 'transform 0.2s ease' : 'none',
                minHeight: '100vh'
            }}>
                {children}
            </div>
        </div>
    );
}
