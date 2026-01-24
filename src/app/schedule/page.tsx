'use client';

import { useApp, ScheduleItem } from '@/context/AppContext';
import Link from 'next/link';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6am to 11pm (24h)

export default function SchedulePage() {
    const { state, addScheduleItem, clearStudySchedule } = useApp();

    const handleAutoSchedule = () => {
        // ... (existing auto schedule logic)
        // Basic greedy algorithm
        // 1. Identify study needs per class (goal - current). For MVP just schedule 'Goal' amount.
        // 2. Find empty slots.

        // Simplification: Just add 1 hour blocks for each class in the evening until goal is met.
        let currentDayIndex = 0;
        let currentHour = 16; // Start scheduling at 4 PM

        state.classes.forEach(cls => {
            let minutesNeeded = cls.weeklyGoalMinutes;

            while (minutesNeeded > 0) {
                // Find a slot
                const day = DAYS[currentDayIndex];

                // Add schedule item
                const newItem: ScheduleItem = {
                    id: crypto.randomUUID(),
                    day: day as any,
                    startTime: `${currentHour}:00`,
                    endTime: `${currentHour + 1}:00`,
                    type: 'study',
                    label: `Study ${cls.name}`,
                    classId: cls.id
                };

                addScheduleItem(newItem);

                minutesNeeded -= 60;
                currentHour += 1;

                if (currentHour >= 22) { // Too late, move to next day
                    currentHour = 16;
                    currentDayIndex = (currentDayIndex + 1) % 7;
                }
            }
        });

        alert('Schedule updated with study blocks!');
    };

    const hasStudyItems = state.schedule.some(s => s.type === 'study');

    return (
        <main className="container">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 className="text-h1">Schedule</h1>
                <Link href="/dashboard" className="btn btn-secondary">Done</Link>
            </header>

            <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
                <button onClick={handleAutoSchedule} className="btn btn-primary" style={{ flex: 1 }}>
                    ✨ Auto-Fill Study Schedule
                </button>
                {hasStudyItems && (
                    <button
                        onClick={() => {
                            if (confirm('Clear all auto-generated study blocks? Your class schedule will remain.')) {
                                clearStudySchedule();
                            }
                        }}
                        className="btn"
                        style={{ background: 'var(--color-error)', color: 'white', flex: 1 }}
                    >
                        🗑️ Clear Study Times
                    </button>
                )}
            </div>

            <div className="card" style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '50px repeat(7, 100px)', gap: '8px' }}>
                    {/* Header */}
                    <div />
                    {DAYS.map(d => <div key={d} style={{ fontWeight: 700, textAlign: 'center' }}>{d}</div>)}

                    {/* Grid */}
                    {HOURS.map(h => (
                        <div key={`row-${h}`} style={{ display: 'contents' }}>
                            <div style={{ fontSize: '0.8rem', color: '#888', textAlign: 'right', paddingRight: '8px' }}>
                                {h}:00
                            </div>
                            {DAYS.map(d => {
                                // Find event
                                const event = state.schedule.find(s => s.day === d && parseInt(s.startTime) === h);

                                // Determine Color
                                let bgColor = '#f5f5f5';
                                let textColor = 'transparent';
                                let borderColor = 'var(--color-border)';

                                if (event) {
                                    textColor = 'white';
                                    borderColor = 'transparent';

                                    // Try to match label to a class
                                    const associatedClass = state.classes.find(c =>
                                        c.name === event.label || event.label?.endsWith(c.name)
                                    );

                                    if (associatedClass) {
                                        bgColor = associatedClass.color;
                                    } else if (event.type === 'study') {
                                        bgColor = 'var(--color-primary)';
                                    } else {
                                        bgColor = 'var(--color-secondary)';
                                    }
                                }

                                return (
                                    <div key={`${d}-${h}`} style={{
                                        height: '50px',
                                        background: bgColor,
                                        borderRadius: '4px',
                                        fontSize: '0.7rem',
                                        padding: '4px',
                                        color: textColor,
                                        border: `1px solid ${borderColor}`,
                                        // Slight opacity if it's a "Study" block to differentiate from class
                                        opacity: event?.type === 'study' ? 0.8 : 1
                                    }}>
                                        {event?.label}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
