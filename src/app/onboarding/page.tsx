'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import Modal from '@/components/Modal';
import { CLASS_COLORS, DEFAULT_CLASS_COLOR } from '@/constants/classColors';
import { generateUUID } from '@/lib/uuid';


import { supabase } from '@/lib/supabase';

function OnboardingContent() {
    const { state, addClass, updateClass, completeOnboarding, removeClass, isLoading } = useApp();
    const router = useRouter();
    const searchParams = useSearchParams();
    const editClassId = searchParams.get('classId');
    const mode = searchParams.get('mode');

    // If editing or already onboarded (or role is set in DB), skip role selection (Step 0)
    // We use a useEffect to handle async data loading updates
    const initialStep = (editClassId || mode === 'add' || state.isOnboarded || state.isRoleSet) ? 1 : 0;
    const [step, setStep] = useState(initialStep);

    // Watch for data load to auto-skip Step 0
    useEffect(() => {
        if (!isLoading && step === 0) {
            if (editClassId || mode === 'add') {
                setStep(1);
            } else if (state.isOnboarded || state.isRoleSet) {
                // Existing user landing here without adding a class -> Redirect to Dashboard
                router.replace('/dashboard');
            }
        }
    }, [isLoading, state.isOnboarded, state.isRoleSet, editClassId, mode, step, router]);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <style jsx>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // Step 0: Parent/Student Role
    const [role, setRole] = useState<'student' | 'parent'>('student');
    const [childEmail, setChildEmail] = useState('');
    const [linkError, setLinkError] = useState('');
    const [isStudentSetup, setIsStudentSetup] = useState(false);
    const [isParentLinking, setIsParentLinking] = useState(false);
    const [showWhereIsId, setShowWhereIsId] = useState(false);
    const [showLinkSuccess, setShowLinkSuccess] = useState(false);

    // Step 1 State
    const [className, setClassName] = useState('');
    const [durationGoal, setDurationGoal] = useState(2);
    const [color, setColor] = useState(DEFAULT_CLASS_COLOR);
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // Load existing data
    useEffect(() => {
        if (editClassId && state.classes.length > 0) {
            const cls = state.classes.find(c => c.id === editClassId);
            if (cls) {
                setClassName(cls.name);
                setDurationGoal(Math.round(cls.weeklyGoalMinutes / 60));
                setColor(cls.color);
            }
        }
    }, [editClassId, state.classes]);


    const handleDelete = () => {
        if (editClassId) {
            removeClass(editClassId);
            router.push('/dashboard');
        }
    };

    const handleFinish = async () => {
        console.log('Starting handleFinish...');
        try {
            const classId = editClassId || generateUUID();
            const classData = {
                id: classId,
                name: className,
                weeklyGoalMinutes: durationGoal * 60,
                color: color,
            };

            console.log('Items prepared. Saving...');
            if (editClassId) {
                console.log('Updating class...');
                await updateClass(classData);
            } else {
                console.log('Adding class...');
                await addClass(classData);
            }

            console.log('Completing onboarding...');
            await completeOnboarding();
            console.log('Navigating to dashboard...');
            window.location.assign('/dashboard');
        } catch (error) {
            console.error('CRITICAL ERROR in handleFinish:', error);
            alert('Something went wrong saving your class. Check console for details.');
        }
    };



    const handleLinkByEmail = async () => {
        const cleanedId = childEmail.trim();
        if (!cleanedId) { setLinkError('Please enter an ID'); return; }

        // Validation to prevent hangs on invalid UUIDs
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!UUID_REGEX.test(cleanedId)) {
            setLinkError('Invalid ID format. Please check the ID in Settings.');
            return;
        }

        setIsParentLinking(true);
        console.log('[Onboarding] Parent Link initiated for ID:', cleanedId);

        try {
            // Check auth first
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.error('[Onboarding] No active user found when linking.');
                throw new Error('NoUser');
            }

            // GLOBAL TIMEOUT (10s)
            await Promise.race([
                (async () => {
                    // 1. Verify child exists
                    const { data: child, error } = await supabase.from('profiles').select('id').eq('id', cleanedId).single();
                    if (error || !child) throw new Error('ChildNotFound');

                    console.log('[Onboarding] Child found:', child.id);

                    // 2. Upsert Self (creates profile if it doesn't exist)
                    const { error: updateError } = await supabase.from('profiles').upsert({
                        id: user.id,
                        role: 'parent',
                        linked_user_id: child.id,
                        is_onboarded: true
                    });

                    if (updateError) throw updateError;

                    // 3. Show confetti loading screen
                    setShowLinkSuccess(true);
                    await completeOnboarding('parent');
                    await new Promise(r => setTimeout(r, 2500));
                    window.location.assign('/parent');
                })(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
            ]);

        } catch (e: any) {
            console.error('[Onboarding] Link Error:', e);
            setIsParentLinking(false);
            if (e.message === 'Timeout') {
                setLinkError('Connection timed out. Please try again.');
            } else if (e.message === 'ChildNotFound') {
                setLinkError('Student ID not found. Check the ID in their Settings.');
            } else if (e.message === 'NoUser') {
                setLinkError('Not signed in. Please restart the app or sign in again.');
            } else {
                setLinkError('Connection error. Please try again.');
            }
        }
    };

    const handleSkipLinking = async () => {
        setIsParentLinking(true);
        try {
            // Race condition: Timeout after 5 seconds to ensure we don't hang
            await Promise.race([
                completeOnboarding('parent'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
            ]);
            window.location.assign('/parent');
        } catch (e) {
            console.error('Error skipping link:', e);
            // Force navigation anyway
            window.location.assign('/parent');
        }
    };

    return (
        <div className="card animate-fade-in" style={{ width: '95%', maxWidth: '800px', margin: '2vh auto' }}>
            {step === 0 && (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                    <h1 className="text-h1">Study Buddies</h1>
                    <p className="text-body" style={{ marginBottom: '32px' }}>How will you use this app?</p>

                    <div style={{ display: 'flex', gap: '16px', flexDirection: 'column', maxWidth: '400px', margin: '0 auto' }}>
                        <button
                            onClick={async () => {
                                if (isStudentSetup || isParentLinking) return; // Prevent conflicts
                                setIsStudentSetup(true);
                                setRole('student');
                                // Fast-track: Complete onboarding immediately without adding a class
                                console.log('[Onboarding] Student button clicked. Starting setup...');
                                try {
                                    // Race condition: Timeout after 5 seconds to ensure we don't hang
                                    await Promise.race([
                                        completeOnboarding('student'),
                                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
                                    ]);
                                    console.log('[Onboarding] Setup complete. Navigating...');
                                    router.replace('/dashboard');
                                } catch (e) {
                                    console.warn('[Onboarding] Setup warning (or timeout):', e);
                                    // Even if it times out/fails, we force navigation if we believe we are done
                                    // But let's alert if it's a real error
                                    if ((e as Error).message === 'Timeout') {
                                        console.log('[Onboarding] Timed out, forcing dashboard...');
                                        window.location.href = '/dashboard';
                                    } else {
                                        setIsStudentSetup(false);
                                        console.error('Error completing onboarding:', e);
                                        alert('Profile setup issue. Redirecting anyway...');
                                        window.location.href = '/dashboard';
                                    }
                                }
                            }}
                            className="card"
                            style={{
                                padding: '24px',
                                border: '2px solid var(--color-primary)',
                                cursor: (isStudentSetup || isParentLinking) ? 'wait' : 'pointer',
                                background: 'white',
                                opacity: (isStudentSetup || isParentLinking) ? 0.7 : 1
                            }}
                        >
                            <div style={{ fontSize: '3rem' }}>{isStudentSetup ? '⏳' : '🎓'}</div>
                            <h3 style={{ margin: '8px 0' }}>{isStudentSetup ? 'Setting up...' : 'I am a Student'}</h3>
                            <p style={{ fontSize: '0.9rem', color: '#666' }}>I want to track my subjects and earn rewards.</p>
                        </button>

                        <button
                            onClick={() => setRole('parent')}
                            className="card"
                            style={{
                                padding: '24px',
                                border: role === 'parent' ? '3px solid var(--color-primary)' : '1px solid #ddd',
                                cursor: 'pointer',
                                background: role === 'parent' ? '#fff9c4' : 'white'
                            }}
                        >
                            <div style={{ fontSize: '3rem' }}>👨‍👩‍👧‍👦</div>
                            <h3 style={{ margin: '8px 0' }}>I am a Parent</h3>
                            <p style={{ fontSize: '0.9rem', color: '#666' }}>I want to gift rewards to my student.</p>
                        </button>
                    </div>

                    {role === 'parent' && (
                        <div style={{ marginTop: '32px', textAlign: 'left', maxWidth: '400px', margin: '32px auto 0' }}>
                            <h3 className="text-h3">Link to Student</h3>
                            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '16px' }}>
                                Enter your child's <strong>Student ID</strong>. They can find this in <em>Settings → Account</em>.
                            </p>

                            <input
                                type="text"
                                placeholder="e.g. 550e8400-e29b..."
                                value={childEmail}
                                onChange={e => setChildEmail(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '8px' }}
                            />

                            {linkError && <p style={{ color: 'red', fontSize: '0.9rem' }}>{linkError}</p>}

                            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                <button
                                    onClick={handleLinkByEmail}
                                    disabled={isParentLinking}
                                    className="btn btn-primary"
                                    style={{ flex: 2 }}
                                >
                                    {isParentLinking ? 'Linking...' : 'Link Account'}
                                </button>
                                <button
                                    onClick={handleSkipLinking}
                                    disabled={isParentLinking}
                                    className="btn"
                                    style={{ flex: 1, background: '#f5f5f5', color: '#666' }}
                                >
                                    Later
                                </button>
                            </div>
                            <button
                                onClick={() => setShowWhereIsId(true)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--color-primary)',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    marginTop: '12px'
                                }}
                            >
                                Where is my Student ID?
                            </button>
                        </div>
                    )}
                </div>
            )}

            {step > 0 && step === 1 && (
                <>
                    <h1 className="text-h1 text-center">{editClassId ? 'Edit Subject' : 'Subject Details'}</h1>

                    <div style={{ maxWidth: '500px', margin: '0 auto 20px' }}>
                        <label className="text-body" style={{ display: 'block', marginBottom: '8px' }}>Subject Name</label>
                        <input
                            type="text"
                            value={className}
                            onChange={(e) => setClassName(e.target.value)}
                            placeholder="e.g. Biology 101"
                            className="input"
                            style={{ width: '100%', padding: '12px', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '16px' }}
                        />

                        <label className="text-body" style={{ display: 'block', marginBottom: '8px' }}>Weekly Study Goal (Hours)</label>
                        <input
                            type="number"
                            value={durationGoal}
                            onChange={(e) => setDurationGoal(Number(e.target.value))}
                            min="1"
                            max="20"
                            className="input"
                            style={{ width: '100%', padding: '12px', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '16px' }}
                        />

                        <label className="text-body" style={{ display: 'block', marginBottom: '8px' }}>Color Code</label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {CLASS_COLORS.map((c) => (
                                <div
                                    key={c}
                                    onClick={() => setColor(c)}
                                    style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        backgroundColor: c,
                                        cursor: 'pointer',
                                        border: color === c ? '4px solid var(--color-text-main)' : '2px solid transparent',
                                        transition: 'transform 0.2s'
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            if (!className) return;
                            const duplicate = state.classes.filter(c => !c.isArchived).find(c =>
                                c.name.toLowerCase() === className.toLowerCase() && c.id !== editClassId
                            );
                            if (duplicate) {
                                setShowDuplicateModal(true);
                                return;
                            }
                            handleFinish();
                        }}
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '24px', maxWidth: '500px', margin: '24px auto', display: 'block' }}
                        disabled={!className}
                    >
                        {editClassId ? 'Save Changes' : 'Finish'}
                    </button>

                    {editClassId && (
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="btn"
                            style={{ background: 'transparent', border: 'none', color: 'var(--color-error)', width: '100%', maxWidth: '500px', margin: '0 auto', display: 'block', textDecoration: 'underline' }}
                        >
                            Delete This Class
                        </button>
                    )}

                    {!editClassId && (
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="btn"
                            style={{ background: 'transparent', border: 'none', color: '#666', width: '100%', maxWidth: '500px', margin: '8px auto', display: 'block', textDecoration: 'underline' }}
                        >
                            Cancel
                        </button>
                    )}

                    {showDuplicateModal && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                        }} onClick={() => setShowDuplicateModal(false)}>
                            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', textAlign: 'center', width: '90%', maxWidth: '300px' }} onClick={e => e.stopPropagation()}>
                                <h3 className="text-h2" style={{ marginTop: 0 }}>Class Exists</h3>
                                <p className="text-body" style={{ marginBottom: '24px' }}>
                                    name <strong>{className}</strong> taken.
                                </p>
                                <button onClick={() => setShowDuplicateModal(false)} className="btn btn-primary">Okay</button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Delete Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Delete Class?"
                type="danger"
                actions={
                    <>
                        <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                        <button className="btn" style={{ background: 'var(--color-error)', color: 'white' }} onClick={handleDelete}>Delete Class</button>
                    </>
                }
            >
                Are you sure you want to delete <strong>{className}</strong>?
                This cannot be undone.
            </Modal>

            {/* Where is my Student ID? Modal */}
            <Modal
                isOpen={showWhereIsId}
                onClose={() => setShowWhereIsId(false)}
                title="Finding the Student ID"
            >
                <div style={{ textAlign: 'center', padding: '16px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🔍</div>
                    <div style={{ textAlign: 'left', lineHeight: 1.8 }}>
                        <p style={{ marginBottom: '12px', fontWeight: 600 }}>On your student's phone:</p>
                        <ol style={{ paddingLeft: '20px', color: '#555' }}>
                            <li>Open <strong>Study Budy</strong></li>
                            <li>Go to <strong>Settings</strong> (bottom of dashboard)</li>
                            <li>Scroll to the <strong>Account</strong> section</li>
                            <li>Copy the <strong>Student ID</strong> or tap <strong>Invite Parent</strong></li>
                        </ol>
                    </div>
                    <div style={{
                        marginTop: '20px',
                        padding: '16px',
                        background: '#f0f9ff',
                        borderRadius: '12px',
                        border: '1px solid #bae6fd'
                    }}>
                        <p style={{ fontSize: '0.85rem', color: '#0369a1', fontWeight: 600 }}>
                            📹 Video walkthrough coming soon!
                        </p>
                    </div>
                </div>
                <div style={{ marginTop: '16px', textAlign: 'right' }}>
                    <button onClick={() => setShowWhereIsId(false)} className="btn btn-primary" style={{ width: '100%' }}>
                        Got it!
                    </button>
                </div>
            </Modal>

            {/* Link Success Overlay with Confetti */}
            {showLinkSuccess && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0,
                    width: '100vw', height: '100vh',
                    zIndex: 9999,
                    background: 'linear-gradient(180deg, #fff5ee 0%, #ffe4d4 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                }}>
                    {Array.from({ length: 50 }).map((_, i) => (
                        <div
                            key={i}
                            style={{
                                position: 'absolute',
                                top: '-10px',
                                left: `${Math.random() * 100}%`,
                                width: `${8 + Math.random() * 8}px`,
                                height: `${8 + Math.random() * 8}px`,
                                background: ['#f43f5e', '#fb923c', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'][i % 7],
                                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                                animation: `confetti-fall ${2 + Math.random() * 3}s ease-in forwards`,
                                animationDelay: `${Math.random() * 1.5}s`,
                                transform: `rotate(${Math.random() * 360}deg)`
                            }}
                        />
                    ))}
                    <img
                        src="/assets/avatar_golden_munchkin.png"
                        alt="Connected!"
                        style={{
                            width: '200px',
                            height: '200px',
                            objectFit: 'contain',
                            imageRendering: 'pixelated',
                            animation: 'splash-bounce 1.5s ease-in-out infinite',
                            filter: 'drop-shadow(0 12px 32px rgba(255, 126, 54, 0.4))'
                        }}
                    />
                    <p style={{
                        marginTop: '28px',
                        fontSize: '1.4rem',
                        fontWeight: 800,
                        color: '#E84545',
                        animation: 'splash-fade 1.5s ease-in-out infinite'
                    }}>Connected! 🎉</p>
                    <style jsx>{`
                        @keyframes confetti-fall {
                            0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                        }
                        @keyframes splash-bounce {
                            0%, 100% { transform: scale(1); }
                            50% { transform: scale(1.06); }
                        }
                        @keyframes splash-fade {
                            0%, 100% { opacity: 0.7; }
                            50% { opacity: 1; }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
}

export default function Onboarding() {
    return (
        <main className="container" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
            <Suspense fallback={<div className="text-center p-8">Loading...</div>}>
                <OnboardingContent />
            </Suspense>
        </main>
    );
}

