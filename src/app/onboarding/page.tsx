'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp, ScheduleItem } from '@/context/AppContext';
import Modal from '@/components/Modal';
import { CLASS_COLORS, DEFAULT_CLASS_COLOR } from '@/constants/classColors';
import { generateUUID } from '@/lib/uuid';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
// HOURS is now dynamic inside component

import { supabase } from '@/lib/supabase';

function OnboardingContent() {
    const { state, addClass, updateClass, addScheduleItem, replaceClassSchedule, completeOnboarding, removeClass } = useApp();
    const router = useRouter();
    const searchParams = useSearchParams();
    const editClassId = searchParams.get('classId');

    // If editing or already onboarded (or role is set in DB), skip role selection (Step 0)
    const initialStep = (editClassId || state.isOnboarded || state.isRoleSet) ? 1 : 0;
    const [step, setStep] = useState(initialStep);

    // Step 0: Parent/Student Role
    const [role, setRole] = useState<'student' | 'parent'>('student');
    const [childEmail, setChildEmail] = useState('');
    const [linkError, setLinkError] = useState('');
    const [isStudentSetup, setIsStudentSetup] = useState(false);
    const [isParentLinking, setIsParentLinking] = useState(false);

    // Step 1 State
    const [className, setClassName] = useState('');
    const [durationGoal, setDurationGoal] = useState(2);
    const [color, setColor] = useState(DEFAULT_CLASS_COLOR);
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // Step 2 (Schedule) State - formerly Step 3
    const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
    const isDragging = useRef(false);
    const addMode = useRef(true);

    // Dynamic Hours based on Awake Time
    let awakeHours: number[] = [];
    if (state.sleepSettings?.enabled) {
        const [wakeH] = state.sleepSettings.end.split(':').map(Number);
        const [sleepH] = state.sleepSettings.start.split(':').map(Number);

        let curr = wakeH;
        // Safety cap to prevent infinite loop if settings are weird
        let iterations = 0;
        while (curr !== sleepH && iterations < 24) {
            awakeHours.push(curr);
            curr++;
            if (curr >= 24) curr = 0;
            iterations++;
        }
        // Add the sleep hour itself as the cutoff? No, range is [start, end).
    } else {
        // Default 8am - 9pm if sleep disabled
        awakeHours = Array.from({ length: 13 }, (_, i) => i + 8);
    }

    // Sort logic handled by simply iterating? 
    // If wake is 6am and sleep is 10pm -> 6,7,8...21.
    // If wake is 6am and sleep is 1am -> 6...23, 0.
    // The render loop below maps HOURS.map.

    const HOURS = awakeHours;

    // Helper for 12h format
    const format12h = (h: number) => {
        const p = h >= 12 ? 'pm' : 'am';
        const hr = h % 12 || 12;
        return `${hr}${p}`;
    };

    const isSleepTime = (h: number, m: number) => {
        if (!state.sleepSettings?.enabled) return false;
        const { start, end } = state.sleepSettings;
        const [sH, sM] = start.split(':').map(Number);
        const [eH, eM] = end.split(':').map(Number);
        const currVal = h * 60 + m;
        const startVal = sH * 60 + sM;
        const endVal = eH * 60 + eM;
        if (startVal > endVal) {
            if (currVal >= startVal || currVal < endVal) return true;
        } else {
            if (currVal >= startVal && currVal < endVal) return true;
        }
        return false;
    };

    // Load existing data
    useEffect(() => {
        if (editClassId && state.classes.length > 0) {
            const cls = state.classes.find(c => c.id === editClassId);
            if (cls) {
                setClassName(cls.name);
                setDurationGoal(Math.round(cls.weeklyGoalMinutes / 60));
                setColor(cls.color);

                // Load Schedule
                const classSchedule = state.schedule.filter(s =>
                    s.classId === editClassId || (s.label === cls.name && s.type === 'class')
                );

                const slots = new Set<string>();
                classSchedule.forEach(s => {
                    const [hStr, mStr] = s.startTime.split(':');
                    const startH = parseInt(hStr);
                    const startM = parseInt(mStr);
                    const [endHStr, endMStr] = s.endTime.split(':');
                    const endH = parseInt(endHStr);
                    const endM = parseInt(endMStr);

                    let currH = startH;
                    let currM = startM;
                    while (currH < endH || (currH === endH && currM < endM)) {
                        slots.add(`${s.day}-${currH}:${currM}`);
                        currM += 15;
                        if (currM >= 60) {
                            currM = 0;
                            currH++;
                        }
                    }
                });
                setSelectedSlots(slots);
            }
        }
    }, [editClassId, state.classes, state.schedule]);

    const toggleSlot = (day: string, hour: number, mins: number, forceAdd?: boolean) => {
        const key = `${day}-${hour}:${mins}`;
        setSelectedSlots(prev => {
            const next = new Set(prev);
            if (forceAdd !== undefined) {
                if (forceAdd) next.add(key);
                else next.delete(key);
            } else {
                if (next.has(key)) next.delete(key);
                else next.add(key);
            }
            return next;
        });
    };

    const handleMouseDown = (day: string, hour: number, mins: number) => {
        isDragging.current = true;
        const key = `${day}-${hour}:${mins}`;
        addMode.current = !selectedSlots.has(key);
        toggleSlot(day, hour, mins, addMode.current);
    };

    const handleMouseEnter = (day: string, hour: number, mins: number) => {
        if (isDragging.current) {
            toggleSlot(day, hour, mins, addMode.current);
        }
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

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

            const newScheduleItems: ScheduleItem[] = [];

            // ... (schedule generation logic omitted for brevity, keeping existing) ...
            DAYS.forEach(day => {
                const daySlots = Array.from(selectedSlots)
                    .filter(s => s.startsWith(`${day}-`))
                    .map(s => {
                        const [_, time] = s.split('-');
                        const [h, m] = time.split(':').map(Number);
                        return { h, m, val: h * 60 + m };
                    })
                    .sort((a, b) => a.val - b.val);

                if (daySlots.length === 0) return;

                // Merge contiguous
                let start = daySlots[0];
                let last = daySlots[0];

                for (let i = 1; i < daySlots.length; i++) {
                    const curr = daySlots[i];
                    if (curr.val === last.val + 15) {
                        last = curr;
                    } else {
                        pushItem(day, start, last);
                        start = curr;
                        last = curr;
                    }
                }
                pushItem(day, start, last);
            });

            function pushItem(day: string, start: { h: number, m: number }, last: { h: number, m: number }) {
                let endH = last.h;
                let endM = last.m + 15;
                if (endM >= 60) {
                    endH++;
                    endM = 0;
                }
                const startStr = `${start.h}:${start.m.toString().padStart(2, '0')}`;
                const endStr = `${endH}:${endM.toString().padStart(2, '0')}`;

                // Calculate Start Date (Next occurrence of this day)
                const today = new Date();
                const targetDayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day);
                let diff = targetDayIndex - today.getDay();
                if (diff < 0) diff += 7; // If day passed this week, move to next week? 
                // Wait, if it's today? 
                // Let's say today is Sunday. target is Monday (1). diff = 1. Date is Tomorrow.
                // If today is Monday. target is Monday. diff = 0. Date is Today.
                // If today is Tuesday. target is Monday. diff = -1 -> 6. Date is next Monday.

                const startDate = new Date(today);
                startDate.setDate(today.getDate() + diff);
                const startDateISO = startDate.toISOString().split('T')[0];

                newScheduleItems.push({
                    id: generateUUID(),
                    day: day as any,
                    startTime: startStr,
                    endTime: endStr,
                    type: 'class',
                    label: className,
                    classId: classId,
                    isRecurring: true,
                    startDate: startDateISO
                });
            }

            console.log('Items prepared. Saving...');
            if (editClassId) {
                console.log('Updating class...');
                await updateClass(classData);
                console.log('Replacing schedule...');
                await replaceClassSchedule(classId, newScheduleItems);
            } else {
                console.log('Adding class...');
                await addClass(classData);
                if (newScheduleItems.length > 0) {
                    console.log('Adding schedule items...');
                    await replaceClassSchedule(classId, newScheduleItems);
                }
            }

            console.log('Completing onboarding...');
            await completeOnboarding();
            console.log('Navigating to dashboard...');
            // Force navigation to ensure we leave the page
            window.location.assign('/dashboard');
        } catch (error) {
            console.error('CRITICAL ERROR in handleFinish:', error);
            alert('Something went wrong saving your class. Check console for details.');
        }
    };

    useEffect(() => {
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);




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

                    // 2. Update Self
                    const { error: updateError } = await supabase.from('profiles').update({
                        role: 'parent',
                        linked_user_id: child.id,
                        is_onboarded: true
                    }).eq('id', user.id);

                    if (updateError) throw updateError;

                    // 3. Complete
                    await completeOnboarding();
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
            // Just set role to parent and onboard
            await completeOnboarding('parent');
            window.location.assign('/parent');
        } catch (e) {
            console.error('Error skipping link:', e);
            setIsParentLinking(false);
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
                            <p style={{ fontSize: '0.9rem', color: '#666' }}>I want to track my classes and earn rewards.</p>
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
                        </div>
                    )}
                </div>
            )}

            {step > 0 && (
                step === 1 ? (
                    <>
                        <h1 className="text-h1 text-center">{editClassId ? 'Edit Class' : 'Class Details'}</h1>
                        <p className="text-body text-center" style={{ marginBottom: '24px', opacity: 0.7 }}>
                            Step 1 of 2
                        </p>

                        <div style={{ maxWidth: '500px', margin: '0 auto 20px' }}>
                            <label className="text-body" style={{ display: 'block', marginBottom: '8px' }}>Class Name</label>
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
                                const duplicate = state.classes.filter(c => !c.isArchived).find(c =>
                                    c.name.toLowerCase() === className.toLowerCase() && c.id !== editClassId
                                );
                                if (duplicate) {
                                    setShowDuplicateModal(true);
                                    return;
                                }
                                setStep(2);
                            }}
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '24px', maxWidth: '500px', margin: '24px auto', display: 'block' }}
                            disabled={!className}
                        >
                            Next: Class Times
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
                ) : (
                    <>
                        <p className="text-body text-center" style={{ marginBottom: '8px', opacity: 0.7 }}>Step 2 of 2</p>
                        <h1 className="text-h1 text-center">When is this class?</h1>
                        <p className="text-body text-center" style={{ marginBottom: '16px', opacity: 0.7 }}>
                            Tap & Drag to paint time blocks
                        </p>



                        <div
                            className="calendar-grid"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '50px repeat(5, 1fr)',
                                gap: '1px',
                                userSelect: 'none',
                                touchAction: 'none', // Critical for drag interactions
                                background: '#999', // Grid lines (gap color)
                                border: '1px solid #999',
                                fontSize: '0.8rem'
                            }}
                            onTouchMove={(e) => {
                                // Custom Touch Drag Logic
                                // We need to find the element under the finger
                                const touch = e.touches[0];
                                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                                if (target && target instanceof HTMLElement) {
                                    // We store data attributes on the slots to identify them
                                    const day = target.dataset.day;
                                    const hour = target.dataset.hour;
                                    const min = target.dataset.min;

                                    if (day && hour && min) {
                                        if (isDragging.current) {
                                            // "Paint" mode - if we started by adding, we add. If removing, we remove.
                                            // But simple toggle might flicker. 
                                            // Ideally we know if we are Adding or Removing based on the first touch.
                                            toggleSlot(day, parseInt(hour), parseInt(min), addMode.current);
                                        }
                                    }
                                }
                            }}
                        >
                            {/* Header Row */}
                            <div style={{ background: '#f9f9f9' }}></div>
                            {DAYS.map(d => (
                                <div key={d} style={{ background: '#f9f9f9', textAlign: 'center', fontWeight: 'bold', padding: '8px 0', fontSize: '0.8rem' }}>{d}</div>
                            ))}

                            {/* Grid Rows */}
                            {HOURS.map(h => (
                                [0, 15, 30, 45].map((currMin, idx) => (
                                    <div key={`row-${h}-${currMin}`} style={{ display: 'contents' }}>
                                        {/* Time Label */}
                                        <div style={{
                                            background: 'white',
                                            textAlign: 'right',
                                            paddingRight: '6px',
                                            fontSize: '0.7rem',
                                            color: '#999',
                                            display: 'flex',
                                            alignItems: 'start',
                                            justifyContent: 'flex-end',
                                            paddingTop: '-6px'
                                        }}>
                                            {currMin === 0 ? format12h(h) : ''}
                                        </div>

                                        {DAYS.map(d => {
                                            const key = `${d}-${h}:${currMin}`;
                                            const isSelected = selectedSlots.has(key);
                                            const isSleep = isSleepTime(h, currMin);

                                            const existingEvent = state.schedule.find(s => {
                                                if (editClassId && s.classId === editClassId) return false;
                                                if (s.day !== d) return false;
                                                const [sH, sM] = s.startTime.split(':').map(Number);
                                                const [eH, eM] = s.endTime.split(':').map(Number);
                                                const startVal = sH * 60 + sM;
                                                const endVal = eH * 60 + eM;
                                                const currVal = h * 60 + currMin;
                                                return currVal >= startVal && currVal < endVal;
                                            });

                                            let style: React.CSSProperties = {
                                                height: '24px', // Taller touch target
                                                background: 'white',
                                                cursor: (existingEvent || isSleep) ? 'not-allowed' : 'pointer',
                                                opacity: existingEvent ? 0.5 : 1
                                            };

                                            if (isSleep) {
                                                style.background = '#F3E8FF';
                                            } else if (existingEvent) {
                                                const assoc = state.classes.find(c => c.name === existingEvent.label || existingEvent.label?.includes(c.name));
                                                let bg = assoc ? assoc.color : '#ccc';
                                                style.background = bg + '40';
                                            } else if (isSelected) {
                                                style.background = color;
                                            }

                                            return (
                                                <div
                                                    key={key}
                                                    // Data attributes for touch-move detection
                                                    data-day={d}
                                                    data-hour={h}
                                                    data-min={currMin}
                                                    // Mouse Events
                                                    onMouseDown={(e) => {
                                                        if (existingEvent || isSleep) return;
                                                        e.preventDefault(); // Prevent text select
                                                        handleMouseDown(d, h, currMin);
                                                    }}
                                                    onMouseEnter={() => !existingEvent && !isSleep && handleMouseEnter(d, h, currMin)}
                                                    // Touch Events
                                                    onTouchStart={(e) => {
                                                        if (existingEvent || isSleep) return;
                                                        // Prevent default scroll if we are hitting a valid cell to allow drag
                                                        // But we might want scroll if we tap? 
                                                        // "touchAction: none" on the container handles blocking scroll.
                                                        handleMouseDown(d, h, currMin);
                                                    }}
                                                    // Note: onTouchMove is handled by parent for performance/ correctness
                                                    onClick={() => !existingEvent && !isSleep && toggleSlot(d, h, currMin)}
                                                    style={style}
                                                />
                                            );
                                        })}
                                    </div>
                                ))
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingBottom: '40px' }}>
                            <button onClick={() => setStep(1)} className="btn btn-secondary" style={{ flex: 1 }}>Back</button>
                            <button onClick={() => setSelectedSlots(new Set())} className="btn btn-secondary" style={{ flex: 1, color: 'var(--color-error)', borderColor: 'var(--color-error)' }} disabled={selectedSlots.size === 0}>
                                Clear
                            </button>
                            <button onClick={handleFinish} className="btn btn-primary" style={{ flex: 2 }}>
                                {editClassId ? 'Save' : 'Finish'}
                            </button>
                        </div>
                    </>
                )
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
