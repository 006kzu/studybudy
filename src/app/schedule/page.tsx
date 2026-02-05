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
    const [eventType, setEventType] = useState<'block' | 'study_manual'>('block');
    const [selectedClassId, setSelectedClassId] = useState<string>('');

    // Drag-and-Drop Move State
    const [movingEventId, setMovingEventId] = useState<string | null>(null);
    const [moveGhost, setMoveGhost] = useState<{ day: string, startTime: string } | null>(null);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);

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
        { name: '🚫 No Evenings', type: 'no_evenings' },
        { name: '🏖️ Weekend Warrior', type: 'weekend' },
        { name: '🤓 The Grinder', type: 'grinder' },
    ];

    const handleAutoSchedule = async () => {
        const currentMode = MODES[autoFillIndex.current % MODES.length];
        setAutoFillMode(currentMode.name);
        autoFillIndex.current += 1;

        // 1. Clear existing study sessions (Smart Re-roll)
        // clearStudySchedule only deletes type='study'. 'study_manual' is preserved.
        await clearStudySchedule();

        // 2. Generate New Schedule
        const newItems: ScheduleItem[] = [];

        // Helper to check collision with ANY existing item (class, sleep, or newly added study)
        // AND enforce 30 min buffer
        const isOccupied = (day: string, h: number, m: number) => {
            const checkVal = h * 60 + m;
            const BUFFER_MINS = 30;

            const checkRangeStart = checkVal - BUFFER_MINS; // e.g. checking 10:00 (600), overlap if event ends > 570
            const checkRangeEnd = checkVal + 60 + BUFFER_MINS; // checking 1 hr block (600-660), overlap if event starts < 690

            // Helper: do intervals [startA, endA] and [startB, endB] overlap?
            // Overlap if startA < endB && startB < endA
            const hasOverlap = (sA: number, eA: number, sB: number, eB: number) => {
                return sA < eB && sB < eA;
            };

            // 1. Check classes/blocks (existing state)
            const collision = state.schedule.some(s => {
                if (s.day !== day) return false;

                // IGNORE other generated study items if we were re-running (but we cleared them)
                // We MUST respect study_manual
                if (s.type === 'study') return false; // Should be gone, but just in case

                const [sH, sM] = s.startTime.split(':').map(Number);
                const [eH, eM] = s.endTime.split(':').map(Number);
                const sVal = sH * 60 + sM;
                const eVal = eH * 60 + eM;

                // Check strict time collision + buffer
                // We are trying to place a block from checkVal to checkVal + 60
                // So we need clear space in [checkVal - 30, checkVal + 60 + 30]?
                // Actually, simply: distance between (checkVal+60) and sVal must be >= 30
                // AND distance between eVal and checkVal must be >= 30.

                // Effective blocked range of existing event is [sVal - 30, eVal + 30]
                return hasOverlap(checkVal, checkVal + 60, sVal - BUFFER_MINS, eVal + BUFFER_MINS);
            });

            if (collision) return true;

            // 2. Check Sleep (No buffer needed for sleep? Maybe user wants to wake up and study immediately? 
            // Let's enforce buffer for sleep too to be safe/relaxed)
            // But isSleepTime takes point (h,m). We need range check.
            // Simple check: check start, end, and middle points?
            // Let's iterate hours in range? No, efficient way:
            // If any minute in the candidate block is a sleep minute.
            // Simplified: Check start time and end time against sleep? 
            // Better: loop through the candidate hour in 15m steps?
            for (let cm = 0; cm < 60; cm += 15) {
                if (isSleepTime(Math.floor((checkVal + cm) / 60), (checkVal + cm) % 60)) return true;
            }

            // 3. Check against newly added items in this batch
            return newItems.some(s => {
                if (s.day !== day) return false;
                const [sH, sM] = s.startTime.split(':').map(Number);
                const [eH, eM] = s.endTime.split(':').map(Number);
                const sVal = sH * 60 + sM;
                const eVal = eH * 60 + eM;

                return hasOverlap(checkVal, checkVal + 60, sVal - BUFFER_MINS, eVal + BUFFER_MINS);
            });
        };

        const tryFillBlock = (cls: any, day: string, preferredHours: number[], minutesNeeded: number) => {
            if (minutesNeeded <= 0) return 0;
            let filled = 0;

            // Try preferred hours first
            for (let h of preferredHours) {
                if (filled >= minutesNeeded) break;

                // Check full hour availability (0,15,30,45) - actually we place on hour boundaries usually
                // User said "pick a study time" - usually implies hourly blocks.
                // Let's look for slots on the hour :00.
                const m = 0;

                if (!isOccupied(day, h, m)) {
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
                    // If balanced, maybe skip next hour? Loop order handles it.
                }
            }
            return filled;
        };

        // Define Priority Arrays
        // standard: > 5pm (17:00 - 23:00) then 8am-5pm
        // standard: > 5pm (17:00 - 23:00) then 8am-5pm
        const hoursPost5pm = [17, 18, 19, 20, 21, 22];
        const hoursDay = [12, 13, 14, 15, 16]; // Afternoon
        const hoursEarly = [5, 6, 7, 8, 9, 10, 11]; // Aggressive Morning Focus

        // No Evenings: 9am - 5pm prioritized.
        const hoursNoEvenings = [9, 10, 11, 12, 13, 14, 15, 16];

        // Iterate Classes
        const activeClasses = state.classes.filter(c => !c.isArchived);

        for (const cls of activeClasses) {
            let minutesNeeded = cls.weeklyGoalMinutes;

            // DEDUCT MANUAL STUDY TIME
            // Find all study_manual items for this class
            const existingManual = state.schedule.filter(s => s.type === 'study_manual' && s.classId === cls.id);
            let manualMinutes = 0;
            existingManual.forEach(s => {
                const [sH, sM] = s.startTime.split(':').map(Number);
                const [eH, eM] = s.endTime.split(':').map(Number);
                const sVal = sH * 60 + sM;
                const eVal = eH * 60 + eM;

                // Handle crossing midnight? Assuming study sessions don't wrap midnight for now or eH > sH
                // If eVal < sVal (e.g. 23:00 to 01:00), treat as +24h?
                // For now assuming simple same-day blocks or correct 24h format logic if simplified
                let duration = eVal - sVal;
                if (duration < 0) duration += 24 * 60; // Wrap around

                manualMinutes += duration;
            });

            minutesNeeded = Math.max(0, minutesNeeded - manualMinutes);

            // Determine Hours Strategy
            let primaryHours: number[] = [];
            let secondaryHours: number[] = [];
            let daysToUse = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']; // Default weekdays

            if (currentMode.type === 'no_evenings') {
                primaryHours = hoursNoEvenings; // 9-5
                secondaryHours = hoursEarly; // Fallback to early, but avoid evening
            } else if (currentMode.type === 'early') {
                daysToUse.sort(() => Math.random() - 0.5);
                // STRICTLY Morning first
                primaryHours = hoursEarly;
                // Then afternoon/evening if needed
                secondaryHours = [...hoursDay, ...hoursPost5pm];
            } else if (currentMode.type === 'night') {
                daysToUse.sort(() => Math.random() - 0.5);
                primaryHours = [20, 21, 22, 23, 19, 18];
                secondaryHours = hoursDay;
            } else if (currentMode.type === 'weekend') {
                daysToUse = ['Sat', 'Sun'];
                primaryHours = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
            } else {
                // Balanced / Default / Grinder
                // Prioritize > 5pm
                primaryHours = hoursPost5pm;
                secondaryHours = hoursDay;
                daysToUse.sort(() => Math.random() - 0.5);
            }

            // Execute Fill
            // Pass 1: Primary Hours on Target Days
            for (const day of daysToUse) {
                minutesNeeded -= tryFillBlock(cls, day, primaryHours, minutesNeeded);
            }

            // Pass 2: Secondary Hours on Target Days (if still needed)
            if (minutesNeeded > 0) {
                for (const day of daysToUse) {
                    minutesNeeded -= tryFillBlock(cls, day, secondaryHours, minutesNeeded);
                }
            }

            // Pass 3: Weekends fallback (if not weekend mode)
            if (minutesNeeded > 0 && currentMode.type !== 'weekend') {
                const weekend = ['Sat', 'Sun'];
                for (const day of weekend) {
                    minutesNeeded -= tryFillBlock(cls, day, [...primaryHours, ...secondaryHours], minutesNeeded);
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
            setEventType('block');
            setSelectedClassId('');
            setEditingEventId(null);
            setShowBlockModal(true);
        }
    };

    const handleEventClick = (event: ScheduleItem) => {
        if (event.type === 'block' || event.type === 'study' || event.type === 'study_manual') {
            setEditingEventId(event.id);
            setBlockName(event.label || '');
            setIsRecurring(event.isRecurring !== false);
            setBlockColor(event.color || '#666666');

            // Map type
            if (event.type === 'study' || event.type === 'study_manual') {
                setEventType('study_manual');
                setSelectedClassId(event.classId || '');
            } else {
                setEventType('block');
                setSelectedClassId('');
            }

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
        // Validation
        if (eventType === 'block' && !blockName) return;
        if (eventType === 'study_manual' && !selectedClassId) return;

        let finalLabel = blockName;
        let finalColor = blockColor;
        let finalClassId: string | undefined = undefined;

        if (eventType === 'study_manual') {
            const cls = state.classes.find(c => c.id === selectedClassId);
            if (cls) {
                finalLabel = `Study ${cls.name}`;
                finalColor = cls.color;
                finalClassId = cls.id;
            }
        }

        if (editingEventId) {
            const original = state.schedule.find(s => s.id === editingEventId);
            if (original) {
                const updated: ScheduleItem = {
                    ...original,
                    label: finalLabel,
                    type: eventType === 'study_manual' ? 'study_manual' : 'block',
                    classId: finalClassId,
                    isRecurring: isRecurring,
                    color: finalColor,
                    specificDate: !isRecurring ? (original.specificDate || original.startDate || formatISO(new Date())) : undefined,
                    // Remove manual flag if standard block? No, type handles it.
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
            type: eventType === 'study_manual' ? 'study_manual' : 'block',
            label: finalLabel,
            classId: finalClassId,
            isRecurring: isRecurring,
            specificDate: !isRecurring ? selectedDateISO : undefined,
            startDate: isRecurring ? selectedDateISO : undefined,
            color: finalColor
        };

        addScheduleItem(newItem);
        setShowBlockModal(false);
        setDragSelection([]);
        setBlockName('');
        setIsRecurring(true);
        setEventType('block');
        setSelectedClassId('');
    };

    useEffect(() => {
        const upHandler = () => {
            if (isDragging) setIsDragging(false);

            // Clear timer on global up
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }

            // Drop Logic
            if (movingEventId && moveGhost) {
                const event = state.schedule.find(s => s.id === movingEventId);
                if (event) {
                    const [sH, sM] = event.startTime.split(':').map(Number);
                    const [eH, eM] = event.endTime.split(':').map(Number);
                    const durationMin = (eH * 60 + eM) - (sH * 60 + sM);

                    const [newSH, newSM] = moveGhost.startTime.split(':').map(Number);
                    let newEM = newSM + durationMin;
                    let newEH = newSH + Math.floor(newEM / 60);
                    newEM = newEM % 60;

                    const updated = {
                        ...event,
                        day: moveGhost.day as any,
                        startTime: moveGhost.startTime,
                        endTime: `${newEH}:${newEM.toString().padStart(2, '0')}`,
                    };
                    updateScheduleItem(updated);
                }
            }
            // Always reset move state on up
            if (movingEventId) {
                setMovingEventId(null);
                setMoveGhost(null);
            }
        };
        window.addEventListener('mouseup', upHandler);
        window.addEventListener('touchend', upHandler);
        return () => {
            window.removeEventListener('mouseup', upHandler);
            window.removeEventListener('touchend', upHandler);
        };
    }, [isDragging, movingEventId, moveGhost, state.schedule]);

    const handleEventPointerDown = (eventId: string) => {
        longPressTimer.current = setTimeout(() => {
            setMovingEventId(eventId);
            if (navigator && navigator.vibrate) navigator.vibrate(50);
        }, 500);
    };

    const handleEventPointerUp = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

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
                    <img src="/icons/icon_magic_wand.png" alt="Auto-Generate" style={{ width: '48px', height: '48px' }} />
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
                        gap: '0px', // Use gap for grid lines
                        background: 'transparent', // Darker grid lines (container background showing through gap)
                        border: 'none',
                        minWidth: '100%'
                    }}
                    onTouchMove={(e) => {
                        // Global Touch Move handler
                        const touch = e.touches[0];
                        const target = document.elementFromPoint(touch.clientX, touch.clientY);

                        if (movingEventId) {
                            if (target && target instanceof HTMLElement && target.dataset.day) {
                                // Snap to 15m
                                const h = target.dataset.hour;
                                const m = target.dataset.min;
                                if (h && m) {
                                    setMoveGhost({
                                        day: target.dataset.day,
                                        startTime: `${h}:${m}`
                                    });
                                }
                            }
                            return;
                        }

                        if (!isAddMode) return;

                        if (target && target instanceof HTMLElement) {
                            const day = target.dataset.day;
                            const h = target.dataset.hour;
                            const m = target.dataset.min;

                            if (day && h && m) {
                                if (isDragging) {
                                    handleMouseEnter(day, parseInt(h), parseInt(m));
                                }
                            }
                        }
                    }}
                    onMouseMove={(e) => {
                        if (movingEventId) {
                            const target = e.target as HTMLElement;
                            if (target.dataset.day && target.dataset.hour) {
                                setMoveGhost({
                                    day: target.dataset.day,
                                    startTime: `${target.dataset.hour}:${target.dataset.min}`
                                });
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
                                    borderTop: idx === 0 ? '1px solid #e5e5e5' : '1px solid #fbfbfb',
                                    visibility: currMin === 0 ? 'visible' : 'hidden'
                                }}>
                                    {currMin === 0 ? format12h(h) : ''}
                                </div>
                                {visibleIndices.map(dayIdx => {
                                    const d = DAYS[dayIdx];
                                    const colDateStr = formatISO(getWeekDate(dayIdx));
                                    const isSelected = dragSelection.some(s => s.day === d && s.time === `${h}:${currMin}`);
                                    const isSleep = (state.sleepSettings?.enabled && isSleepTime(h, currMin));

                                    const event = state.schedule.find(s => s.id === movingEventId ? false : (s.day !== d ? false : (() => {
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
                                    })()));

                                    // Ghost Logic
                                    let isGhost = false;
                                    let ghostEvent: ScheduleItem | undefined = undefined;
                                    if (movingEventId && moveGhost && moveGhost.day === d) {
                                        const original = state.schedule.find(s => s.id === movingEventId);
                                        if (original) {
                                            const [sH, sM] = original.startTime.split(':').map(Number);
                                            const [eH, eM] = original.endTime.split(':').map(Number);
                                            const duration = (eH * 60 + eM) - (sH * 60 + sM);

                                            const [ghH, ghM] = moveGhost.startTime.split(':').map(Number);
                                            const ghostStartVal = ghH * 60 + ghM;
                                            const ghostEndVal = ghostStartVal + duration;
                                            const currVal = h * 60 + currMin;

                                            if (currVal >= ghostStartVal && currVal < ghostEndVal) {
                                                isGhost = true;
                                                ghostEvent = original;
                                            }
                                        }
                                    }

                                    // Display Logic
                                    // If isGhost, show ghost style (dimmed original color?)
                                    // If event (and not moving), show event
                                    // If movingEvent is this cell (original position), show dimmed/hidden?
                                    // Actually, we filtered out movingEventId from 'event' search above to hide original.
                                    // But we should probably show original dimmed until dropped?
                                    // The filter above `s.id === movingEventId ? false` hides it. 
                                    // So we only see Ghost.
                                    // Wait, if we hide original, we lose the 'source' reference visuals. 
                                    // Better to show original as semi-transparent, and Ghost as full?
                                    // Let's hide original for 'drag' feel (it moves with you).

                                    const displayEvent = isGhost ? ghostEvent : event;

                                    let bgColor = '#fff';
                                    let textColor = 'transparent';
                                    let label = '';
                                    let isStart = false;
                                    let bgStyle: any = { background: '#fff' };
                                    let borderStyle = {
                                        borderTop: idx === 0 ? '1px solid #e5e5e5' : '1px solid #fbfbfb',
                                        borderRight: '1px solid #f9f9f9'
                                    };

                                    if (isSleep) {
                                        bgStyle = { background: '#F3E8FF' };
                                        borderStyle = { borderTop: 'none', borderRight: 'none' };
                                    } else if (isSelected) {
                                        bgStyle = { background: '#ddd' };
                                    } else if (displayEvent) {
                                        textColor = 'white';
                                        const assoc = state.classes.find(c => c.id === displayEvent.classId || c.name === displayEvent.label || displayEvent.label?.endsWith(c.name));

                                        if (displayEvent.type === 'block') {
                                            bgStyle = { background: displayEvent.color || '#666' };
                                        } else if (assoc) {
                                            bgStyle = { background: assoc.color };
                                        } else if (displayEvent.type === 'study') {
                                            bgStyle = { background: 'var(--color-primary)' };
                                        } else {
                                            bgStyle = { background: 'var(--color-secondary)' };
                                        }

                                        if (isGhost) {
                                            bgStyle.opacity = 0.6;
                                            bgStyle.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                                            bgStyle.zIndex = 50;
                                            bgStyle.transform = 'scale(1.02)';
                                        }

                                        // Determine start time for label
                                        // For Ghost: match moveGhost.startTime
                                        // For Event: match event.startTime
                                        const startTimeToCheck = isGhost && moveGhost ? moveGhost.startTime : displayEvent.startTime;
                                        const [sH, sM] = startTimeToCheck.split(':').map(Number);

                                        if (sH === h && sM === currMin) {
                                            label = displayEvent.label || '';
                                            isStart = true;
                                            if (!displayEvent.isRecurring && displayEvent.isRecurring !== undefined) label += ' (1x)';
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
                                            onPointerDown={(e) => {
                                                // If clicking an existing event, try to move
                                                if (event) {
                                                    handleEventPointerDown(event.id);
                                                }
                                                // Add mode logic
                                                if (!event && !isGhost && isAddMode) {
                                                    handleMouseDown(d, h, currMin);
                                                }
                                            }}
                                            onPointerUp={(e) => {
                                                handleEventPointerUp(); // Clear long press
                                                // If we were adding, finish
                                                // If we were moving, global up handles it
                                                // If clicking event to edit:
                                                if (event && !movingEventId) { // Only edit if not moving
                                                    handleEventClick(event);
                                                }
                                            }}
                                            onMouseEnter={() => !displayEvent && isAddMode && handleMouseEnter(d, h, currMin)}

                                            style={{
                                                height: '18px',
                                                ...bgStyle,
                                                fontSize: '0.7rem',
                                                padding: '2px 4px',
                                                color: textColor,
                                                ...borderStyle,
                                                opacity: (isGhost) ? 0.7 : ((displayEvent?.type === 'study' || displayEvent?.type === 'block') ? 0.9 : 1),
                                                overflow: 'hidden',
                                                whiteSpace: 'nowrap',
                                                textOverflow: 'ellipsis',
                                                cursor: isSleep ? 'not-allowed' : (isAddMode || event ? 'pointer' : 'default'),
                                                userSelect: 'none',
                                                touchAction: movingEventId ? 'none' : 'auto'
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

                    {/* Event Type Selector */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Event Type</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => setEventType('block')}
                                className="btn"
                                style={{
                                    flex: 1,
                                    background: eventType === 'block' ? 'var(--color-primary)' : '#f0f0f0',
                                    color: eventType === 'block' ? 'white' : '#333',
                                    border: 'none'
                                }}
                            >
                                General Info
                            </button>
                            <button
                                onClick={() => setEventType('study_manual')}
                                className="btn"
                                style={{
                                    flex: 1,
                                    background: eventType === 'study_manual' ? 'var(--color-primary)' : '#f0f0f0',
                                    color: eventType === 'study_manual' ? 'white' : '#333',
                                    border: 'none'
                                }}
                            >
                                Study Session
                            </button>
                        </div>
                    </div>

                    {eventType === 'block' ? (
                        <>
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
                                                e.preventDefault();
                                                setBlockColor(c);
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
                        </>
                    ) : (
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Select Class</label>
                            <select
                                className="input"
                                value={selectedClassId}
                                onChange={e => setSelectedClassId(e.target.value)}
                                style={{ width: '100%' }}
                            >
                                <option value="" disabled>-- Choose a Class --</option>
                                {state.classes.map(c => (
                                    !c.isArchived && (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    )
                                ))}
                            </select>
                            <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '8px' }}>
                                This study session will be locked and respected by the auto-scheduler.
                            </p>
                        </div>
                    )}

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
