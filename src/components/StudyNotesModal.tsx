'use client';

import React, { useState } from 'react';
import Modal from './Modal';

interface StudyNotesModalProps {
    isOpen: boolean;
    onSave: (note: string | undefined) => void;
    onSkip: () => void;
}

export default function StudyNotesModal({ isOpen, onSave, onSkip }: StudyNotesModalProps) {
    const [note, setNote] = useState('');

    const handleSave = () => {
        onSave(note.trim() === '' ? undefined : note.trim());
        setNote(''); // Reset
    };

    const handleSkip = () => {
        onSkip();
        setNote(''); // Reset
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleSkip} // Closing acts as skip
            title="Session Notes 📝"
            actions={
                <>
                    <button className="btn btn-secondary" onClick={handleSkip}>
                        Skip
                    </button>
                    <button className="btn btn-primary" onClick={handleSave}>
                        Save Note
                    </button>
                </>
            }
        >
            <p className="text-body" style={{ marginBottom: '16px' }}>
                Great job! Want to write down what you covered in this session?
            </p>
            <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="I studied chapter 4 and learned about..."
                className="input"
                style={{
                    width: '100%',
                    height: '100px',
                    resize: 'none',
                    padding: '12px',
                    fontSize: '1rem',
                    marginBottom: '8px'
                }}
            />
            <p style={{ fontSize: '0.8rem', color: '#666' }}>
                Optional. Your parents can see this note to know what you've been up to!
            </p>
        </Modal>
    );
}
