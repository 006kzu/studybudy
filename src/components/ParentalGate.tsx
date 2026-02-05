'use client';

import { useState, useEffect, useRef } from 'react';
import Modal from '@/components/Modal';

interface ParentalGateProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ParentalGate({ isOpen, onClose, onSuccess }: ParentalGateProps) {
    const [problem, setProblem] = useState({ a: 0, b: 0 });
    const [answer, setAnswer] = useState('');
    const [error, setError] = useState(false);

    // Generate new problem ONLY when modal opens
    useEffect(() => {
        if (isOpen) {
            setProblem({
                a: Math.floor(Math.random() * 9) + 11, // 11-19
                b: Math.floor(Math.random() * 9) + 11  // 11-19
            });
            setAnswer('');
            setError(false);
        }
    }, [isOpen]);

    const handleSubmit = () => {
        const val = parseInt(answer, 10);
        if (!isNaN(val) && val === problem.a + problem.b) {
            onSuccess();
            onClose(); // Close the gate after success
        } else {
            setError(true);
            setTimeout(() => {
                onClose(); // Apple guideline: If wrong, just close it (or give feedback then close)
            }, 1000);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Parental Check"
            type="default"
            actions={
                <>
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        className="btn"
                        style={{ background: 'var(--color-primary)', color: 'white' }}
                        onClick={handleSubmit}
                    >
                        Submit
                    </button>
                </>
            }
        >
            <div style={{ textAlign: 'center' }}>
                <p style={{ marginBottom: '16px' }}>
                    Please ask a parent to answer this question:
                </p>

                <div style={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    padding: '16px',
                    background: '#f0f0f0',
                    borderRadius: '12px',
                    display: 'inline-block',
                    marginBottom: '16px'
                }}>
                    {problem.a} + {problem.b} = ?
                </div>

                <input
                    type="number"
                    value={answer}
                    onChange={(e) => {
                        setAnswer(e.target.value);
                        setError(false);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSubmit();
                    }}
                    placeholder="Answer"
                    className="input"
                    style={{
                        display: 'block',
                        width: '100%',
                        maxWidth: '200px',
                        margin: '0 auto',
                        textAlign: 'center',
                        fontSize: '1.2rem',
                        padding: '12px',
                        border: error ? '2px solid red' : '1px solid #ddd'
                    }}
                    autoFocus
                />

                {error && (
                    <p style={{ color: 'red', marginTop: '8px', fontWeight: 'bold' }}>
                        Incorrect. Please try again.
                    </p>
                )}
            </div>
        </Modal>
    );
}
