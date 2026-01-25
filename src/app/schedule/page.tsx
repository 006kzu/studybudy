'use client';

import { useApp, ScheduleItem } from '@/context/AppContext';
import Link from 'next/link';
import Modal from '@/components/Modal';
import { useState, useEffect, useRef } from 'react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);
const COLORS = ['#666666', '#FF5733', '#33FF57', '#3357FF', '#F1C40F', '#8E44AD', '#E74C3C'];

export default function SchedulePage() {
    const {
        state,
        addScheduleItem,
        clearStudySchedule,
        removeScheduleItem,
        updateScheduleItem
    } = useApp();

    const containerRef = useRef<HTMLDivElement>(null);

    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showClearModal, setShowClearModal] = useState(false);

    // Responsive View State
    const [viewDays, setViewDays] = useState(7);
    const [startDayIndex, setStartDayIndex] = useState(0);
    const [weekOffset, setWeekOffset] = useState(0);

    // Smart Scroll Effect
    useEffect(() => {
        if (containerRef.current) {
            let targetHour = 8; // Default to 8am
            let targetMin = 0;

            if (state.sleepSettings?.enabled) {
                // Parse Wake Time (End of Sleep)
                const [endH, endM] = state.sleepSettings.end.split(':').map(Number);
                targetHour = endH;
                targetMin = endM;
            }

            // Height logic: 24px per 15 min slot.
            // 4 slots per hour = 96px.
            const pixelOffset = (targetHour * 96) + ((targetMin / 15) * 24);

            // Scroll to it immediately
            // Add 120px (1 hour 15 mins) as requested
            containerRef.current.scrollTop = Math.max(0, pixelOffset + 120);
        }
    }, [state.sleepSettings]);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setViewDays(3);
            } else {
                setViewDays(7);
                setStartDayIndex(0);
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const getVisibleIndices = () => {
        const indices = [];
        for (let i = 0; i < viewDays; i++) {
            let idx = startDayIndex + i;
            if (idx > 6) idx = idx - 7;
            indices.push(idx);
        }
        return indices;
    };

    const visibleIndices = getVisibleIndices();

    // Blocking Interaction
    const [isDragging, setIsDragging] = useState(false);
    const [dragSelection, setDragSelection] = useState<{ day: string, time: string }[]>([]);

    // Modal State
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [blockName, setBlockName] = useState('');
    const [isRecurring, setIsRecurring] = useState(true);
    const [blockColor, setBlockColor] = useState('#666666');
    const [editingEventId, setEditingEventId] = useState<string | null>(null);

    // Sleep Helper
    const isSleepTime = (h: number, m: number) => {
        if (!state.sleepSettings?.enabled) return false;
        const { start, end } = state.sleepSettings;
        const [sH, sM] = start.split(':').map(Number);
        const [eH, eM] = end.split(':').map(Number);

        const currVal = h * 60 + m;
        const startVal = sH * 60 + sM;
        const endVal = eH * 60 + eM;

        if (startVal > endVal) {
            // e.g. 22:00 to 06:00
            if (currVal >= startVal || currVal < endVal) return true;
        } else {
            // e.g. 01:00 to 08:00
            if (currVal >= startVal && currVal < endVal) return true;
        }
        return false;
    };

    const getWeekDate = (dayIndex: number) => {
        const today = new Date();
        const currentDay = today.getDay();
        const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
        const mondayDate = new Date(today);
        mondayDate.setDate(today.getDate() + mondayOffset + (weekOffset * 7));
        const targetDate = new Date(mondayDate);
        targetDate.setDate(mondayDate.getDate() + dayIndex);
        return targetDate;
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const formatISO = (date: Date) => {
        return date.toISOString().split('T')[0];
    };

    const format12h = (h: number) => {
        const p = h >= 12 ? 'pm' : 'am';
        const hr = h % 12 || 12;
        return `${hr}${p}`;
    };

    const nextView = () => {
        if (viewDays === 7) {
            setWeekOffset(w => w + 1);
        } else {
            let next = startDayIndex + viewDays;
            if (next > 6) {
                setWeekOffset(w => w + 1);
                setStartDayIndex(next % 7);
            } else {
                setStartDayIndex(next);
            }
        }
    };

    const prevView = () => {
        if (viewDays === 7) {
            setWeekOffset(w => w - 1);
        } else {
            let prev = startDayIndex - viewDays;
            if (prev < 0) {
                setWeekOffset(w => w - 1);
                setStartDayIndex(7 + prev);
            } else {
                setStartDayIndex(prev);
            }
        }
    };

    const handleAutoSchedule = () => {
        let currentDayIndex = 0;
        let currentHour = 8;

        state.classes.forEach(cls => {
            let minutesNeeded = cls.weeklyGoalMinutes;
            let attempts = 0;

            while (minutesNeeded > 0 && attempts < 1000) {
                attempts++;
                const day = DAYS[currentDayIndex];

                if (isSleepTime(currentHour, 0)) {
                    currentHour++;
                    if (currentHour >= 24) {
                        currentHour = 0;
                        currentDayIndex = (currentDayIndex + 1) % 7;
                    }
                    continue;
                }

                const newItem: ScheduleItem = {
                    id: crypto.randomUUID(),
                    day: day as any,
                    startTime: `${currentHour}:00`,
                    endTime: `${currentHour + 1}:00`,
                    type: 'study',
                    label: `Study ${cls.name}`,
                    classId: cls.id,
                    isRecurring: true,
                    startDate: formatISO(getWeekDate(currentDayIndex))
                };
                addScheduleItem(newItem);
                minutesNeeded -= 60;
                currentHour += 1;
                if (currentHour >= 24) {
                    currentHour = 0;
                    currentDayIndex = (currentDayIndex + 1) % 7;
                }
            }
        });
        setShowSuccessModal(true);
    };

    // Drag Handlers
    const handleMouseDown = (day: string, h: number, m: number) => {
        if (isSleepTime(h, m)) return;

        setIsDragging(true);
        setDragSelection([{ day, time: `${h}:${m}` }]);
        setEditingEventId(null);
    };

    const handleMouseEnter = (day: string, h: number, m: number) => {
        if (!isDragging) return;
        if (isSleepTime(h, m)) return;

        if (dragSelection.length > 0 && dragSelection[0].day === day) {
            setDragSelection(prev => [...prev, { day, time: `${h}:${m}` }]);
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        if (dragSelection.length > 0) {
            setBlockName('');
            setIsRecurring(true);
            setBlockColor('#666666');
            setEditingEventId(null);
            setShowBlockModal(true);
        }
    };

    const handleEventClick = (event: ScheduleItem) => {
        if (event.type === 'block') {
            setEditingEventId(event.id);
            setBlockName(event.label || '');
            setIsRecurring(event.isRecurring !== false);
            setBlockColor(event.color || '#666666');
            setShowBlockModal(true);
        }
    };

    const deleteBlock = () => {
        if (editingEventId) {
            removeScheduleItem(editingEventId);
            setShowBlockModal(false);
            setEditingEventId(null);
        }
    };

    const saveBlock = () => {
        if (!blockName) return;

        if (editingEventId) {
            const original = state.schedule.find(s => s.id === editingEventId);
            if (original) {
                const updated = {
                    ...original,
                    label: blockName,
                    isRecurring: isRecurring,
                    color: blockColor,
                    specificDate: !isRecurring ? (original.specificDate || original.startDate || formatISO(new Date())) : undefined
                };
                updateScheduleItem(updated);
            }
            setShowBlockModal(false);
            setEditingEventId(null);
            return;
        }

        if (dragSelection.length === 0) return;

        const sortedTimes = dragSelection.sort((a, b) => {
            const [h1, m1] = a.time.split(':').map(Number);
            const [h2, m2] = b.time.split(':').map(Number);
            return (h1 * 60 + m1) - (h2 * 60 + m2);
        });

        const start = sortedTimes[0];
        const last = sortedTimes[sortedTimes.length - 1];

        const [lH, lM] = last.time.split(':').map(Number);
        let eM = lM + 15;
        let eH = lH;
        if (eM >= 60) { eM = 0; eH++; }

        const dayIndex = DAYS.indexOf(start.day);
        const selectedDateISO = formatISO(getWeekDate(dayIndex));

        const newItem: ScheduleItem = {
            id: crypto.randomUUID(),
            day: start.day as any,
            startTime: start.time.split(':').map(t => t.toString().padStart(2, '0')).join(':'),
            endTime: `${eH}:${eM.toString().padStart(2, '0')}`,
            type: 'block',
            label: blockName,
            isRecurring: isRecurring,
            specificDate: !isRecurring ? selectedDateISO : undefined,
            startDate: isRecurring ? selectedDateISO : undefined,
            color: blockColor
        };

        addScheduleItem(newItem);
        setShowBlockModal(false);
        setDragSelection([]);
        setBlockName('');
        setIsRecurring(true);
    };

    useEffect(() => {
        const upHandler = () => {
            if (isDragging) setIsDragging(false);
        };
        window.addEventListener('mouseup', upHandler);
        return () => window.removeEventListener('mouseup', upHandler);
    }, [isDragging]);

    const hasStudyItems = state.schedule.some(s => s.type === 'study');
    const gridStyle = {
        gridTemplateColumns: `60px repeat(${viewDays}, 1fr)`
    };

    return (
        <main className="container" onMouseUp={() => isDragging && handleMouseUp()}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h1 className="text-h1">Schedule</h1>
                <Link href="/dashboard" className="btn btn-secondary">Done</Link>
            </header>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontWeight: 'bold' }}>
                <button className="btn btn-secondary" onClick={prevView}>← Prev</button>
                <span>
                    {formatDate(getWeekDate(visibleIndices[0]))} - {formatDate(getWeekDate(visibleIndices[visibleIndices.length - 1]))}
                </span>
                <button className="btn btn-secondary" onClick={nextView}>Next →</button>
            </div>

            <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
                <button onClick={handleAutoSchedule} className="btn btn-primary" style={{ flex: 1 }}>
                    ✨ Auto-Fill
                </button>
                {hasStudyItems && (
                    <button
                        onClick={() => setShowClearModal(true)}
                        className="btn"
                        style={{ background: 'var(--color-error)', color: 'white', flex: 1 }}
                    >
                        🗑️ Clear
                    </button>
                )}
            </div>

            <div
                ref={containerRef}
                className="card"
                style={{
                    overflow: 'auto',
                    maxHeight: 'calc(100vh - 220px)',
                    position: 'relative',
                    padding: 0
                }}
            >
                <div style={{ display: 'grid', ...gridStyle, gap: '0', background: '#f0f0f0' }}>
                    <div style={{
                        position: 'sticky',
                        top: 0,
                        left: 0,
                        zIndex: 30,
                        background: 'white',
                        borderBottom: '1px solid #ddd',
                        borderRight: '1px solid #ddd'
                    }} />

                    {visibleIndices.map(dayIdx => {
                        const d = DAYS[dayIdx];
                        return (
                            <div key={`head-${d}-${dayIdx}`} style={{
                                textAlign: 'center',
                                position: 'sticky',
                                top: 0,
                                zIndex: 10,
                                background: 'white',
                                borderBottom: '1px solid #ddd',
                                padding: '8px 0',
                                minWidth: 0
                            }}>
                                <div style={{ fontWeight: 700 }}>{d}</div>
                                <div style={{ fontSize: '0.7rem', color: '#888' }}>{formatDate(getWeekDate(dayIdx))}</div>
                            </div>
                        );
                    })}

                    {ALL_HOURS.map(h => (
                        [0, 15, 30, 45].map((currMin, idx) => (
                            <div key={`row-${h}-${currMin}`} style={{ display: 'contents' }}>
                                {/* Time Column */}
                                <div style={{
                                    fontSize: '0.75rem',
                                    color: '#888',
                                    textAlign: 'right',
                                    paddingRight: '8px',
                                    paddingTop: '4px',
                                    position: 'sticky',
                                    left: 0,
                                    zIndex: 20,
                                    background: 'white',
                                    borderRight: '1px solid #f0f0f0',
                                    visibility: currMin === 0 ? 'visible' : 'hidden'
                                }}>
                                    {currMin === 0 ? format12h(h) : ''}
                                </div>
                                {visibleIndices.map(dayIdx => {
                                    const d = DAYS[dayIdx];
                                    const colDateStr = formatISO(getWeekDate(dayIdx));
                                    const isSelected = dragSelection.some(s => s.day === d && s.time === `${h}:${currMin}`);
                                    const isSleep = (state.sleepSettings?.enabled && isSleepTime(h, currMin));

                                    // Find existing event
                                    const event = state.schedule.find(s => {
                                        if (s.day !== d) return false;

                                        // Default isRecurring to true if null/undefined
                                        const isRecurring = s.isRecurring !== false;

                                        if (isRecurring) {
                                            if (s.startDate && colDateStr < s.startDate) return false;
                                        } else {
                                            if (s.specificDate !== colDateStr) return false;
                                        }
                                        const [sH, sM] = s.startTime.split(':').map(Number);
                                        const [eH, eM] = s.endTime.split(':').map(Number);
                                        const startVal = sH * 60 + sM;
                                        const endVal = eH * 60 + eM;
                                        const currVal = h * 60 + currMin;
                                        return currVal >= startVal && currVal < endVal;
                                    });

                                    let bgColor = '#fff';
                                    let textColor = 'transparent';
                                    let label = '';
                                    let isStart = false;
                                    let bgStyle: any = { background: '#fff' };
                                    let borderStyle = {
                                        borderBottom: idx === 3 ? '1px solid #ddd' : '1px solid #f9f9f9',
                                        borderRight: '1px solid #f9f9f9'
                                    };

                                    if (isSleep) {
                                        bgStyle = {
                                            background: '#F3E8FF'
                                        };
                                        // Remove borders for seamless look
                                        borderStyle = {
                                            borderBottom: 'none',
                                            borderRight: 'none'
                                        };
                                    } else if (isSelected) {
                                        bgStyle = { background: '#ddd' };
                                    } else if (event) {
                                        textColor = 'white';
                                        const assoc = state.classes.find(c => c.name === event.label || event.label?.endsWith(c.name));

                                        if (event.type === 'block') {
                                            bgStyle = { background: event.color || '#666' };
                                        } else if (assoc) {
                                            bgStyle = { background: assoc.color };
                                        } else if (event.type === 'study') {
                                            bgStyle = { background: 'var(--color-primary)' };
                                        } else {
                                            bgStyle = { background: 'var(--color-secondary)' };
                                        }

                                        const [sH, sM] = event.startTime.split(':').map(Number);
                                        if (sH === h && sM === currMin) {
                                            label = event.label || '';
                                            isStart = true;
                                            if (!event.isRecurring && event.isRecurring !== undefined) label += ' (1x)';
                                        }
                                    }

                                    return (
                                        <div
                                            key={`${d}-${dayIdx}-${h}-${currMin}`}
                                            onMouseDown={() => {
                                                if (event) handleEventClick(event);
                                                else handleMouseDown(d, h, currMin);
                                            }}
                                            onMouseEnter={() => !event && handleMouseEnter(d, h, currMin)}
                                            style={{
                                                height: '24px',
                                                ...bgStyle,
                                                fontSize: '0.7rem',
                                                padding: '2px 4px',
                                                color: textColor,
                                                ...borderStyle,
                                                opacity: (event?.type === 'study' || event?.type === 'block') ? 0.9 : 1,
                                                overflow: 'hidden',
                                                whiteSpace: 'nowrap',
                                                textOverflow: 'ellipsis',
                                                cursor: isSleep ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            {isStart && label}
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    ))}
                </div>
            </div>

            <Modal
                isOpen={showBlockModal}
                onClose={() => setShowBlockModal(false)}
                title={editingEventId ? "Edit Block" : "Block Time"}
                actions={
                    <div style={{ display: 'flex', width: '100%', gap: '8px', justifyContent: 'flex-end' }}>
                        {editingEventId && (
                            <button
                                className="btn"
                                style={{ background: 'var(--color-error)', color: 'white', marginRight: 'auto' }}
                                onClick={deleteBlock}
                            >
                                Delete
                            </button>
                        )}
                        <button className="btn btn-secondary" onClick={() => setShowBlockModal(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={saveBlock}>Save</button>
                    </div>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Event Name</label>
                        <input
                            className="input"
                            value={blockName}
                            onChange={e => setBlockName(e.target.value)}
                            placeholder="e.g. Work, Gym, Doctor"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Color</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {COLORS.map(c => (
                                <div
                                    key={c}
                                    onClick={() => setBlockColor(c)}
                                    style={{
                                        width: '30px',
                                        height: '30px',
                                        borderRadius: '50%',
                                        backgroundColor: c,
                                        cursor: 'pointer',
                                        border: blockColor === c ? '3px solid #333' : '1px solid #ddd'
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            type="checkbox"
                            checked={isRecurring}
                            onChange={e => setIsRecurring(e.target.checked)}
                            id="recurring-check"
                            style={{ width: '20px', height: '20px' }}
                        />
                        <label htmlFor="recurring-check">Repeats every week?</label>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                title="Schedule Optimized"
                type="success"
                actions={
                    <button className="btn btn-primary" onClick={() => setShowSuccessModal(false)}>Awesome</button>
                }
            >
                We've analyzed your academic goals and curated a study plan to maximize your efficiency. Your calendar is now populated with optimal study blocks. Good luck! 📅✨
            </Modal>

            <Modal
                isOpen={showClearModal}
                onClose={() => setShowClearModal(false)}
                title="Clear Schedule?"
                type="danger"
                actions={
                    <>
                        <button className="btn btn-secondary" onClick={() => setShowClearModal(false)}>Cancel</button>
                        <button className="btn" style={{ background: 'var(--color-error)', color: 'white' }} onClick={() => {
                            clearStudySchedule();
                            setShowClearModal(false);
                        }}>Clear All</button>
                    </>
                }
            >
                Are you sure you want to remove all auto-generated study blocks?
            </Modal>
        </main>
    );
}
