import React, { useEffect } from 'react';

type ModalProps = {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
    type?: 'default' | 'danger' | 'success';
};

export default function Modal({ isOpen, onClose, title, children, actions, type = 'default' }: ModalProps) {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease-out'
        }} onClick={onClose}>
            <div style={{
                background: 'white',
                width: '90%',
                maxWidth: '400px',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 20px 50px -10px rgba(0,0,0,0.3)',
                transform: 'scale(1)',
                animation: 'scaleIn 0.2s ease-out',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
            }} onClick={e => e.stopPropagation()}>

                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{
                        margin: 0,
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        color: type === 'danger' ? 'var(--color-error)' : 'var(--color-text)'
                    }}>{title}</h2>
                    <button onClick={onClose} style={{
                        background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#999'
                    }}>&times;</button>
                </header>

                <div style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
                    {children}
                </div>

                {actions && (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px', justifyContent: 'flex-end' }}>
                        {actions}
                    </div>
                )}
            </div>
            <style jsx>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            `}</style>
        </div>
    );
}
