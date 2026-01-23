'use client';

import { useApp, ScheduleItem } from '@/context/AppContext';
import Link from 'next/link';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6am to 11pm (24h)

export default function SchedulePage() {
    const { state, addScheduleItem } = useApp();

    const handleAutoSchedule = () => {
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
                    label: `Study ${cls.name}`
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

    return (
        <main className="container">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 className="text-h1">Schedule</h1>
                <Link href="/dashboard" className="btn btn-secondary">Done</Link>
            </header>

            <div style={{ marginBottom: '24px' }}>
                <button onClick={handleAutoSchedule} className="btn btn-primary" style={{ width: '100%' }}>
                    ✨ Auto-Fill Study Schedule
                </button>
            </div>

            <div className="card" style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '50px repeat(7, 100px)', gap: '8px' }}>
                    {/* Header */}
                    <div />
                    {DAYS.map(d => <div key={d} style={{ fontWeight: 700, textAlign: 'center' }}>{d}</div>)}

                    {/* Grid */}
                    {HOURS.map(h => (
                        <>
                            <div key={`time-${h}`} style={{ fontSize: '0.8rem', color: '#888', textAlign: 'right', paddingRight: '8px' }}>
                                {h}:00
                            </div>
                            {DAYS.map(d => {
                                // Find event
                                const event = state.schedule.find(s => s.day === d && parseInt(s.startTime) === h);

                                return (
                                    <div key={`${d}-${h}`} style={{
                                        height: '50px',
                                        background: event ? (event.type === 'study' ? 'var(--color-primary)' : 'var(--color-secondary)') : '#f5f5f5',
                                        borderRadius: '4px',
                                        fontSize: '0.7rem',
                                        padding: '4px',
                                        color: event ? 'white' : 'transparent',
                                        border: '1px solid var(--color-border)'
                                    }}>
                                        {event?.label}
                                    </div>
                                );
                            })}
                        </>
                    ))}
                </div>
            </div>
        </main>
    );
}
