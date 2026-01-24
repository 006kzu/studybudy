'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp, ScheduleItem } from '@/context/AppContext';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8am to 8pm

function OnboardingContent() {
    const { state, addClass, updateClass, addScheduleItem, replaceClassSchedule, completeOnboarding } = useApp();
    const router = useRouter();
    const searchParams = useSearchParams();
    const editClassId = searchParams.get('classId');

    const [step, setStep] = useState(1);

    // Step 1 State
    const [className, setClassName] = useState('');
    const [durationGoal, setDurationGoal] = useState(2);
    const [color, setColor] = useState('#FF7E36');
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);

    // Step 2 State: Set of "Day-Hour" strings (e.g., "Mon-10")
    const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
    const isDragging = useRef(false);
    const addMode = useRef(true); // true = adding, false = removing

    // Load existing data if editing
    useEffect(() => {
        if (editClassId && state.classes.length > 0) {
            const cls = state.classes.find(c => c.id === editClassId);
            if (cls) {
                setClassName(cls.name);
                setDurationGoal(Math.round(cls.weeklyGoalMinutes / 60));
                setColor(cls.color);

                // Load Schedule: Find items by classId OR by matching label/type (legacy support)
                const classSchedule = state.schedule.filter(s =>
                    s.classId === editClassId || (s.label === cls.name && s.type === 'class')
                );

                const slots = new Set<string>();
                classSchedule.forEach(s => {
                    const hour = parseInt(s.startTime); // "10:00" -> 10
                    slots.add(`${s.day}-${hour}`);
                });
                setSelectedSlots(slots);
            }
        }
    }, [editClassId, state.classes, state.schedule]);

    const toggleSlot = (day: string, hour: number, forceAdd?: boolean) => {
        const key = `${day}-${hour}`;
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

    const handleMouseDown = (day: string, hour: number) => {
        isDragging.current = true;
        const key = `${day}-${hour}`;
        addMode.current = !selectedSlots.has(key);
        toggleSlot(day, hour, addMode.current);
    };

    const handleMouseEnter = (day: string, hour: number) => {
        if (isDragging.current) {
            toggleSlot(day, hour, addMode.current);
        }
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    const handleFinish = () => {
        const classId = editClassId || crypto.randomUUID();

        const classData = {
            id: classId,
            name: className,
            weeklyGoalMinutes: durationGoal * 60,
            color: color,
        };

        const newScheduleItems: ScheduleItem[] = [];
        selectedSlots.forEach(slot => {
            const [day, hourStr] = slot.split('-');
            const startHour = parseInt(hourStr);

            newScheduleItems.push({
                id: crypto.randomUUID(),
                day: day as any,
                startTime: `${startHour}:00`,
                endTime: `${startHour + 1}:00`,
                type: 'class',
                label: className,
                classId: classId
            });
        });

        if (editClassId) {
            updateClass(classData);
            replaceClassSchedule(classId, newScheduleItems);
        } else {
            addClass(classData);
            newScheduleItems.forEach(item => addScheduleItem(item));
        }

        completeOnboarding();
        router.push('/dashboard');
    };

    useEffect(() => {
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);

    return (
        <div className="card animate-fade-in" style={{ marginTop: '5vh', maxWidth: '600px', margin: '5vh auto' }}>
            {step === 1 ? (
                <>
                    <h1 className="text-h1 text-center">{editClassId ? 'Edit Class' : 'Class Details'}</h1>
                    <p className="text-body text-center" style={{ marginBottom: '24px', opacity: 0.7 }}>
                        Step 1 of 2
                    </p>

                    <div style={{ marginBottom: '20px' }}>
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
                            // Duplicate Check (skip if editing same class)
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
                        style={{ width: '100%', marginTop: '24px' }}
                        disabled={!className}
                    >
                        Next: Set Schedule
                    </button>

                    {/* Duplicate Class Modal */}
                    {showDuplicateModal && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
                        }} onClick={() => setShowDuplicateModal(false)}>
                            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', textAlign: 'center', width: '90%', maxWidth: '300px' }} onClick={e => e.stopPropagation()}>
                                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
                                <h3 className="text-h2" style={{ marginTop: 0 }}>Class Exists</h3>
                                <p className="text-body" style={{ marginBottom: '24px' }}>
                                    You already have a class named <strong>{className}</strong>. Please choose a different name.
                                </p>
                                <button
                                    onClick={() => setShowDuplicateModal(false)}
                                    className="btn btn-primary"
                                    style={{ width: '100%' }}
                                >
                                    Okay, Got It
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <>
                    <h1 className="text-h1 text-center">Class Schedule</h1>
                    <p className="text-body text-center" style={{ marginBottom: '16px', opacity: 0.7 }}>
                        Click & Drag to select when this class meets.
                    </p>

                    {/* Calendar Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '40px repeat(5, 1fr)',
                        gap: '4px',
                        userSelect: 'none',
                        touchAction: 'none'
                    }}>
                        {/* Header */}
                        <div></div>
                        {DAYS.map(d => (
                            <div key={d} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.8rem', paddingBottom: '4px' }}>
                                {d}
                            </div>
                        ))}

                        {/* Body */}
                        {HOURS.map(h => (
                            <div key={`row-${h}`} style={{ display: 'contents' }}>
                                <div style={{ textAlign: 'right', paddingRight: '4px', fontSize: '0.7rem', color: '#999', paddingTop: '6px' }}>
                                    {h > 12 ? h - 12 : h}{h >= 12 && h < 24 ? 'pm' : 'am'}
                                </div>
                                {DAYS.map(d => {
                                    const key = `${d}-${h}`;

                                    // Check if occupied by OTHER classes
                                    const existingEvent = state.schedule.find(s =>
                                        s.day === d && parseInt(s.startTime) === h &&
                                        (editClassId ? s.classId !== editClassId && s.label !== className : true)
                                    );

                                    const isSelected = selectedSlots.has(key);

                                    // Determine background color
                                    let bg = '#f5f5f5';
                                    let opacity = 1;
                                    let border = isSelected ? '2px solid white' : 'none';
                                    let boxShadow = isSelected ? '0 0 0 2px var(--color-primary)' : 'none';

                                    if (existingEvent) {
                                        const associatedClass = state.classes.find(c => c.name === existingEvent.label);
                                        bg = associatedClass ? associatedClass.color : '#e0e0e0';
                                        opacity = 0.5; // Faded transparency for taken slots
                                    } else if (isSelected) {
                                        bg = color;
                                    }

                                    return (
                                        <div
                                            key={key}
                                            onMouseDown={() => !existingEvent && handleMouseDown(d, h)}
                                            onMouseEnter={() => !existingEvent && handleMouseEnter(d, h)}
                                            // Mobile Support (Simple Tap)
                                            onClick={() => !existingEvent && toggleSlot(d, h)}
                                            style={{
                                                height: '30px',
                                                background: bg,
                                                borderRadius: '4px',
                                                cursor: existingEvent ? 'not-allowed' : 'pointer',
                                                transition: 'background 0.1s',
                                                opacity,
                                                border,
                                                boxShadow
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                        <button
                            onClick={() => setStep(1)}
                            className="btn btn-secondary"
                            style={{ flex: 1 }}
                        >
                            Back
                        </button>
                        <button
                            onClick={() => setSelectedSlots(new Set())}
                            className="btn btn-secondary"
                            style={{ flex: 1, color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                            disabled={selectedSlots.size === 0}
                        >
                            Clear Selection
                        </button>
                        <button
                            onClick={handleFinish}
                            className="btn btn-primary"
                            style={{ flex: 2 }}
                        >
                            {editClassId ? 'Save Changes' : 'Finish Setup'}
                        </button>
                    </div>
                </>
            )}
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
