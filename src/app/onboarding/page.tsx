'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp, ScheduleItem } from '@/context/AppContext';
import Modal from '@/components/Modal';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
// HOURS is now dynamic inside component

function OnboardingContent() {
    const { state, addClass, updateClass, addScheduleItem, replaceClassSchedule, completeOnboarding, removeClass } = useApp();
    const router = useRouter();
    const searchParams = useSearchParams();
    const editClassId = searchParams.get('classId');

    const [step, setStep] = useState(1);

    // Step 1 State
    const [className, setClassName] = useState('');
    const [durationGoal, setDurationGoal] = useState(2);
    const [color, setColor] = useState('#FF7E36');
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
            const classId = editClassId || crypto.randomUUID();
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
                    id: crypto.randomUUID(),
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

    return (
        <div className="card animate-fade-in" style={{ maxWidth: '800px', margin: '5vh auto' }}>
            {step === 1 ? (
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
                            {['#FF7E36', '#4A90E2', '#34C759', '#FF3B30', '#9013FE'].map((c) => (
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
                            const duplicate = state.classes.find(c =>
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
                        Click & Drag
                    </p>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '60px repeat(5, 1fr)',
                        gap: '0',
                        userSelect: 'none',
                        touchAction: 'none'
                    }}>
                        <div></div>
                        {DAYS.map(d => (
                            <div key={d} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem', paddingBottom: '8px' }}>{d}</div>
                        ))}

                        {HOURS.map(h => (
                            [0, 15, 30, 45].map((currMin, idx) => (
                                <div key={`row-${h}-${currMin}`} style={{ display: 'contents' }}>
                                    <div style={{
                                        textAlign: 'right',
                                        paddingRight: '8px',
                                        fontSize: '0.75rem',
                                        color: '#999',
                                        paddingTop: '2px',
                                        visibility: currMin === 0 ? 'visible' : 'hidden',
                                        transform: 'translateY(-50%)'
                                    }}>
                                        {format12h(h)}
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
                                            height: '20px',
                                            cursor: (existingEvent || isSleep) ? 'not-allowed' : 'pointer',
                                            borderBottom: idx === 3 ? '1px solid #ddd' : '1px solid #f0f0f0',
                                            borderRight: '1px solid #f0f0f0',
                                            opacity: existingEvent ? 0.5 : 1
                                        };

                                        if (isSleep) {
                                            style.background = '#F3E8FF';
                                            style.borderBottom = 'none';
                                            style.borderRight = 'none';
                                            style.borderLeft = 'none'; // Ensure no left border from previous cell if needed, though grid handles this.
                                        } else if (existingEvent) {
                                            const assoc = state.classes.find(c => c.name === existingEvent.label || existingEvent.label?.includes(c.name));
                                            let bg = assoc ? assoc.color : '#ccc';
                                            style.background = bg + '40';
                                        } else if (isSelected) {
                                            style.background = color;
                                        } else {
                                            style.background = '#f9f9f9';
                                        }

                                        return (
                                            <div
                                                key={key}
                                                onMouseDown={() => !existingEvent && !isSleep && handleMouseDown(d, h, currMin)}
                                                onMouseEnter={() => !existingEvent && !isSleep && handleMouseEnter(d, h, currMin)}
                                                onClick={() => !existingEvent && !isSleep && toggleSlot(d, h, currMin)}
                                                style={style}
                                            />
                                        );
                                    })}
                                </div>
                            ))
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                        <button onClick={() => setStep(1)} className="btn btn-secondary" style={{ flex: 1 }}>Back</button>
                        <button onClick={() => router.push('/dashboard')} className="btn" style={{ flex: 1, background: 'transparent', border: '1px solid #ddd', color: '#666' }}>Cancel</button>
                        <button onClick={() => setSelectedSlots(new Set())} className="btn btn-secondary" style={{ flex: 1, color: 'var(--color-error)', borderColor: 'var(--color-error)' }} disabled={selectedSlots.size === 0}>
                            Clear
                        </button>
                        <button onClick={handleFinish} className="btn btn-primary" style={{ flex: 2 }}>
                            {editClassId ? 'Save Changes' : 'Finish Setup'}
                        </button>
                    </div>
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
        </div>
    );
}

export default function Onboarding() {
    return (
        <main className="container">
            <Suspense fallback={<div className="text-center p-8">Loading...</div>}>
                <OnboardingContent />
            </Suspense>
        </main>
    );
}
