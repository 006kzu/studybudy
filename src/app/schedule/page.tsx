'use client';

import { useApp, ScheduleItem } from '@/context/AppContext';
import Link from 'next/link';
import { generateUUID } from '@/lib/uuid';
import Modal from '@/components/Modal';
import Toast from '@/components/Toast';
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

    const [showClearModal, setShowClearModal] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Responsive View State
    const [viewDays, setViewDays] = useState(7);
    const [startDayIndex, setStartDayIndex] = useState(0);
    const [weekOffset, setWeekOffset] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
            // Always show 7 days now, but use CSS to handle responsiveness
            setViewDays(7);
            setStartDayIndex(0);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Smart Scroll Effect
    useEffect(() => {
        if (isMounted && containerRef.current) {
            let targetHour = 8; // Default to 8am
            let targetMin = 0;

            if (state.sleepSettings?.enabled) {
                const [endH, endM] = state.sleepSettings.end.split(':').map(Number);
                targetHour = endH;
                targetMin = endM;
            }

            // Height logic: 18px per 15 min slot => 72px per hour
            const pixelOffset = (targetHour * 72) + ((targetMin / 15) * 18);

            // Scroll with a slight delay to ensure layout is ready
            setTimeout(() => {
                if (containerRef.current) {
                    containerRef.current.scrollTop = pixelOffset;
                }
            }, 100);
        }
    }, [state.sleepSettings, isMounted]);

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

    // Interaction Mode
    const [isAddMode, setIsAddMode] = useState(false);

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
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus input when modal opens (Mobile Fix)
    useEffect(() => {
        if (showBlockModal) {
            // Tiny delay to allow modal animation/rendering to complete
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showBlockModal]);

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

    const formatDateWithDay = (date: Date) => {
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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

    // Auto-Fill V3 State
    const autoFillIndex = useRef(0);
    const [autoFillMode, setAutoFillMode] = useState<string>('');

    const MODES = [
        { name: '⚖️ Balanced', type: 'balanced' },
        { name: '🌅 Early Bird', type: 'early' },
        { name: '🦉 Night Owl', type: 'night' },
        { name: '🏖️ Weekend Warrior', type: 'weekend' },
        { name: '🤓 The Grinder', type: 'grinder' },
    ];

    const handleAutoSchedule = async () => {
        const currentMode = MODES[autoFillIndex.current % MODES.length];
        setAutoFillMode(currentMode.name);
        autoFillIndex.current += 1;

        // 1. Clear existing study sessions (Smart Re-roll)
        await clearStudySchedule();

        // 2. Generate New Schedule
        const newItems: ScheduleItem[] = [];

        // Helper to check collision with ANY existing item (class, sleep, or newly added study)
        const isOccupied = (day: string, h: number, m: number) => {
            // Check against existing state.schedule (classes/blocks)
            const collision = state.schedule.some(s => {
                if (s.day !== day) return false;
                const [sH, sM] = s.startTime.split(':').map(Number);
                const [eH, eM] = s.endTime.split(':').map(Number);
                const sVal = sH * 60 + sM;
                const eVal = eH * 60 + eM;
                const cVal = h * 60 + m;
                return cVal >= sVal && cVal < eVal;
            }) || isSleepTime(h, m);

            if (collision) return true;

            // Check against newly added items in this batch
            return newItems.some(s => {
                if (s.day !== day) return false;
                const [sH, sM] = s.startTime.split(':').map(Number);
                const [eH, eM] = s.endTime.split(':').map(Number);
                const sVal = sH * 60 + sM;
                const eVal = eH * 60 + eM;
                const cVal = h * 60 + m;
                return cVal >= sVal && cVal < eVal;
            });
        };

        const tryFillBlock = (cls: any, day: string, startH: number, endH: number, minutesNeeded: number) => {
            if (minutesNeeded <= 0) return 0;
            let filled = 0;

            // Try to find 1 hour blocks (60m)
            for (let h = startH; h < endH; h++) {
                if (filled >= minutesNeeded) break;

                // Check full hour availability (0,15,30,45)
                let hourFree = true;
                for (let m of [0, 15, 30, 45]) {
                    if (isOccupied(day, h, m)) hourFree = false;
                }

                if (hourFree) {
                    // Create Study Item
                    const dayIndex = DAYS.indexOf(day);

                    newItems.push({
                        id: generateUUID(),
                        day: day as any,
                        startTime: `${h}:00`,
                        endTime: `${h + 1}:00`,
                        type: 'study',
                        label: `Study ${cls.name}`,
                        classId: cls.id,
                        isRecurring: true,
                        startDate: formatISO(getWeekDate(dayIndex))
                    });

                    filled += 60;
                    if (currentMode.type === 'balanced') h++; // Buffer if balanced
                }
            }
            return filled;
        };

        // Iterate Classes
        const activeClasses = state.classes.filter(c => !c.isArchived);

        for (const cls of activeClasses) {
            let minutesNeeded = cls.weeklyGoalMinutes;

            // Strategy Implementations
            if (currentMode.type === 'balanced') {
                const workDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].sort(() => Math.random() - 0.5);
                for (const day of workDays) {
                    minutesNeeded -= tryFillBlock(cls, day, 9, 17, minutesNeeded);
                }
            }
            else if (currentMode.type === 'early') {
                const workDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].sort(() => Math.random() - 0.5);
                for (const day of workDays) {
                    minutesNeeded -= tryFillBlock(cls, day, 6, 9, minutesNeeded);
                }
            }
            else if (currentMode.type === 'night') {
                const workDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].sort(() => Math.random() - 0.5);
                for (const day of workDays) {
                    minutesNeeded -= tryFillBlock(cls, day, 20, 24, minutesNeeded);
                }
            }
            else if (currentMode.type === 'weekend') {
                const weekends = ['Sat', 'Sun'].sort(() => Math.random() - 0.5);
                for (const day of weekends) {
                    minutesNeeded -= tryFillBlock(cls, day, 10, 20, minutesNeeded);
                }
            }
            else if (currentMode.type === 'grinder') {
                const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][Math.floor(Math.random() * 5)];
                minutesNeeded -= tryFillBlock(cls, day, 8, 22, minutesNeeded);
                if (minutesNeeded > 0) {
                    const day2 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].filter(d => d !== day)[Math.floor(Math.random() * 4)];
                    minutesNeeded -= tryFillBlock(cls, day2, 8, 22, minutesNeeded);
                }
            }

            // Fallback
            if (minutesNeeded > 0) {
                const allDays = [...DAYS].sort(() => Math.random() - 0.5);
                for (const day of allDays) {
                    minutesNeeded -= tryFillBlock(cls, day, 8, 22, minutesNeeded);
                }
            }
        }

        // Batch Add (We iterate and add one by one or we could add a bulk method, but for now loop)
        for (const item of newItems) {
            await addScheduleItem(item);
        }

        // setShowSuccessModal(true); // Removed per user request
        setToast({ message: `Optimized for: ${currentMode.name}`, type: 'success' });
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
            id: generateUUID(),
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

    // Dynamic Column Sizing
    // User requested "smaller" horizontally to see more without scrolling.
    // We will fit all 7 days even on mobile (1fr).
    const columnWidth = '1fr';

    const gridStyle = {
        gridTemplateColumns: `60px repeat(${viewDays}, ${columnWidth})`
    };

    if (!isMounted) return null;

    return (
        <main className="container" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }} onMouseUp={() => isDragging && handleMouseUp()} onTouchEnd={() => isDragging && handleMouseUp()}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h1 className="text-h1">Schedule</h1>
                <Link href="/dashboard" className="btn btn-secondary">Done</Link>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: '16px', fontWeight: 'bold' }}>
                <div style={{ textAlign: 'left' }}>
                    <button className="btn btn-secondary" onClick={prevView} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>← Prev</button>
                </div>
                <div style={{ textAlign: 'center' }}>
                    {formatDateWithDay(getWeekDate(visibleIndices[0]))} - {formatDateWithDay(getWeekDate(visibleIndices[visibleIndices.length - 1]))}
                </div>
                <div style={{ textAlign: 'right' }}>
                    <button className="btn btn-secondary" onClick={nextView} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Next →</button>
                </div>
            </div>

            {/* Toolbar */}
            <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                    onClick={() => setIsAddMode(!isAddMode)}
                    className={`btn ${isAddMode ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                >
                    {isAddMode ? '✅ Done Adding' : '➕ Add Event'}
                </button>

                <button
                    onClick={handleAutoSchedule}
                    className="btn"
                    style={{ flex: 0.5, background: 'var(--color-primary)', color: 'white' }}
                    title={`Current Mode: ${autoFillMode || 'Balanced'}`}
                >
                    ✨
                </button>

                {hasStudyItems && (
                    <button
                        onClick={() => setShowClearModal(true)}
                        className="btn"
                        style={{ background: 'var(--color-error)', color: 'white', flex: 0.5 }}
                    >
                        🗑️
                    </button>
                )}
            </div>

            {isAddMode && (
                <div style={{ textAlign: 'center', marginBottom: '12px', fontSize: '0.85rem', color: 'var(--color-primary)', background: '#e6fffa', padding: '8px', borderRadius: '8px' }}>
                    👆 Tap & Drag on the calendar to create a new block.
                </div>
            )}

            <div
                ref={containerRef}
                className="card"
                style={{
                    overflow: 'auto',
                    maxHeight: 'calc(100vh - 220px)',
                    position: 'relative',
                    padding: 0,
                    // If in Add Mode, prevent default touch actions (scrolling) so we can drag.
                    // If NOT in Add Mode, allow scrolling (auto).
                    touchAction: isAddMode ? 'none' : 'auto'
                }}
            >
                <div
                    style={{
                        display: 'grid',
                        ...gridStyle,
                        gap: '1px', // Use gap for grid lines
                        background: '#999', // Darker grid lines (container background showing through gap)
                        border: '1px solid #999',
                        minWidth: '100%'
                    }}
                    onTouchMove={(e) => {
                        // Global Touch Move handler for the grid when in Add Mode
                        if (!isAddMode) return;

                        const touch = e.touches[0];
                        const target = document.elementFromPoint(touch.clientX, touch.clientY);
                        if (target && target instanceof HTMLElement) {
                            const day = target.dataset.day;
                            const h = target.dataset.hour;
                            const m = target.dataset.min;

                            if (day && h && m) {
                                // Delegate to standard logic
                                // Need to check if we are allowed to drag here (sleep, existing event)
                                // But handleMouseEnter handles the logic of "adding to drag selection if allowed"
                                if (isDragging) {
                                    handleMouseEnter(day, parseInt(h), parseInt(m));
                                }
                            }
                        }
                    }}
                >
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
                                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{d}</div>
                                <div style={{ fontSize: '0.75rem', color: '#666' }}>{formatDate(getWeekDate(dayIdx))}</div>
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
                                            // Data attributes for touch recognition
                                            data-day={d}
                                            data-hour={h}
                                            data-min={currMin}

                                            // Handlers
                                            onMouseDown={() => {
                                                if (event) handleEventClick(event);
                                                else if (isAddMode) handleMouseDown(d, h, currMin);
                                            }}
                                            onMouseEnter={() => !event && isAddMode && handleMouseEnter(d, h, currMin)}

                                            // Touch Start (Only if Add Mode)
                                            onTouchStart={(e) => {
                                                if (event) {
                                                    // Allow clicking events even in non-add mode? Yes, to edit them.
                                                    handleEventClick(event);
                                                    return;
                                                }

                                                if (isAddMode) {
                                                    // e.preventDefault(); // handled by touchAction: none container
                                                    handleMouseDown(d, h, currMin);
                                                }
                                            }}

                                            style={{
                                                height: '18px',
                                                ...bgStyle,
                                                fontSize: '0.7rem',
                                                padding: '2px 4px',
                                                color: textColor,
                                                ...borderStyle,
                                                opacity: (event?.type === 'study' || event?.type === 'block') ? 0.9 : 1,
                                                overflow: 'hidden',
                                                whiteSpace: 'nowrap',
                                                textOverflow: 'ellipsis',
                                                cursor: isSleep ? 'not-allowed' : (isAddMode ? 'crosshair' : 'default')
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
                onClose={() => {
                    setShowBlockModal(false);
                    setDragSelection([]); // Clear selection on close
                    setEditingEventId(null);
                }}
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
                        <button className="btn btn-secondary" onClick={() => {
                            setShowBlockModal(false);
                            setDragSelection([]); // Clear selection on cancel
                            setEditingEventId(null);
                        }}>Cancel</button>
                        <button className="btn btn-primary" onClick={saveBlock}>Save</button>
                    </div>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Event Name</label>
                        <input
                            ref={inputRef}
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
                                    onPointerDown={(e) => {
                                        e.preventDefault(); // Prevent default focus behavior
                                        setBlockColor(c);
                                        // Optional: Blur input to dismiss keyboard if desired, or keep it. 
                                        // User complaint was they "have to" click off. 
                                        // Now the color will set immediately regardless.
                                        (document.activeElement as HTMLElement)?.blur();
                                    }}
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
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </main>
    );
}
