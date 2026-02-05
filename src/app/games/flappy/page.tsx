'use client';

import FlappyBirdGame from '@/components/games/FlappyBirdGame';
import { useApp } from '@/context/AppContext';
import { AVATARS } from '@/constants/avatars';
import { useRouter } from 'next/navigation';
import React from 'react';

export default function FlappyPage() {
    const router = useRouter();
    const { state, isLoading } = useApp();



    // Get Avatar
    const userAvatarItem = AVATARS.find(a => a.name === state.equippedAvatar);
    const userAvatarSrc = userAvatarItem ? userAvatarItem.filename : '/assets/idle.png';

    // Calculate Time Left
    const [timeLeft, setTimeLeft] = React.useState(() => {
        if (state.breakTimer.endTime) {
            return Math.max(0, Math.ceil((state.breakTimer.endTime - Date.now()) / 1000));
        }
        return 0;
    });

    React.useEffect(() => {
        const interval = setInterval(() => {
            if (state.breakTimer.endTime) {
                const diff = Math.ceil((state.breakTimer.endTime - Date.now()) / 1000);
                setTimeLeft(Math.max(0, diff));
            } else {
                setTimeLeft(0);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [state.breakTimer.endTime]);

    if (isLoading) return <div style={{ minHeight: '100vh', background: '#333' }} />;

    return (
        <div style={{ height: '100vh', width: '100vw', position: 'relative', background: '#333' }}>
            {/* onExit handles the UI for exiting, but we pass large timeLeft for 'free play' mode */}
            <FlappyBirdGame
                avatarSrc={userAvatarSrc}
                timeLeft={timeLeft}
                onExit={(coins) => {
                    console.log('Game Over, Coins:', coins);
                    router.push('/games');
                }}
            />
        </div>
    );
}
