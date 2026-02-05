'use client';

import React, { useEffect } from 'react';

type ToastProps = {
    message: string;
    type?: 'success' | 'error' | 'info';
    onClose: () => void;
    duration?: number;
};

export default function Toast({ message, type = 'info', onClose, duration = 3000 }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const styles = {
        success: { bg: '#E8F5E9', border: '#4CAF50', color: '#1B5E20', icon: '✅' },
        error: { bg: '#FFEBEE', border: '#F44336', color: '#B71C1C', icon: '⚠️' },
        info: { bg: '#E3F2FD', border: '#2196F3', color: '#0D47A1', icon: 'ℹ️' }
    };

    const style = styles[type];

    return (
        <div style={{
            position: 'fixed',
            bottom: '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: style.bg,
            border: `1px solid ${style.border}`,
            color: style.color,
            padding: '12px 24px',
            borderRadius: '50px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 2000,
            fontSize: '0.95rem',
            fontWeight: 600,
            animation: 'slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
            <span style={{ fontSize: '1.2rem' }}>{style.icon}</span>
            {message}

            <style jsx>{`
                @keyframes slideUp { 
                    from { transform: translate(-50%, 100%); opacity: 0; } 
                    to { transform: translate(-50%, 0); opacity: 1; } 
                }
            `}</style>
        </div>
    );
}
