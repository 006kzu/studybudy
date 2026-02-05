'use client';

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';

type ModalProps = {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
    type?: 'default' | 'danger' | 'success';
};

export default function Modal({ isOpen, onClose, title, children, actions, type = 'default' }: ModalProps) {
    const [mounted, setMounted] = React.useState(false);

    useEffect(() => {
        setMounted(true);
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen || !mounted) return null;

    // Use Portal to escape any parent transforms/z-indexes
    return ReactDOM.createPortal(
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000 // Higher Z
        }} onClick={onClose}>
            <div style={{
                position: 'relative',
                zIndex: 10001,
                background: 'white',
                width: '90%',
                maxWidth: '400px',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 20px 50px -10px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                opacity: 1,
                maxHeight: '90vh',
                overflowY: 'auto'
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
        </div>,
        document.body
    );
}
