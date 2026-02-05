'use client';

import React from 'react';
import Link from 'next/link';
import { AVATARS } from '@/constants/avatars';

export default function WienerAvatar({
    points,
    inventory = [],
    equippedAvatar = 'Default Dog',
    coinPosition = 'bottom',
    size = 'normal'
}: {
    points: number,
    inventory?: string[],
    equippedAvatar?: string,
    coinPosition?: 'top' | 'bottom',
    size?: 'normal' | 'small'
}) {

    // Determine image src
    // Find the avatar in the detailed list, or default to the first one (Default Dog)
    const avatarItem = AVATARS.find(a => a.name === equippedAvatar);
    const imgSrc = avatarItem ? avatarItem.filename : AVATARS[0].filename;

    const isSmall = size === 'small';

    const badgeStyle: React.CSSProperties = {
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: isSmall ? '2px 4px 2px 8px' : '4px 6px 4px 12px',
        borderRadius: '20px',
        fontSize: isSmall ? '0.7rem' : '0.9rem',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        textDecoration: 'none',
        zIndex: 3,
        cursor: 'pointer',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        whiteSpace: 'nowrap'
    };

    if (coinPosition === 'top') {
        badgeStyle.top = isSmall ? '-16px' : '-20px';
    } else {
        badgeStyle.bottom = isSmall ? '-10px' : '-14px';
    }

    const containerStyle: React.CSSProperties = {
        position: 'relative',
        width: isSmall ? '60px' : '120px',
        height: 'auto',
        filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))',
        marginTop: coinPosition === 'top' ? (isSmall ? '16px' : '20px') : 0
    };

    return (
        <div style={containerStyle}>
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
            <Link href="/stats" style={badgeStyle}>
                {points}
                <img
                    src="/icons/coins.png"
                    alt="Coins"
                    style={{
                        width: isSmall ? '18px' : '28px',
                        height: isSmall ? '18px' : '28px',
                        display: 'block'
                    }}
                />
            </Link>
        </div>
    );
}
