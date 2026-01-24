'use client';

import React from 'react';
import { AVATARS } from '@/constants/avatars';

export default function WienerAvatar({ points, inventory = [], equippedAvatar = 'Default Dog' }: { points: number, inventory?: string[], equippedAvatar?: string }) {

    // Determine image src
    // Find the avatar in the detailed list, or default to the first one (Default Dog)
    const avatarItem = AVATARS.find(a => a.name === equippedAvatar);
    const imgSrc = avatarItem ? avatarItem.filename : AVATARS[0].filename;

    return (
        <div style={{ position: 'relative', width: '120px', height: 'auto', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}>
            <img
                src={imgSrc}
                alt={equippedAvatar}
                style={{
                    width: '100%',
                    display: 'block',
                    zIndex: 1,
                    position: 'relative'
                }}
            />

            {/* Stats Badge */}
            <div style={{
                position: 'absolute',
                bottom: '-10px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '0.6rem',
                whiteSpace: 'nowrap',
                zIndex: 3,
                fontFamily: 'var(--font-primary)'
            }}>
                {points} Coins 💰
            </div>
        </div>
    );
}
