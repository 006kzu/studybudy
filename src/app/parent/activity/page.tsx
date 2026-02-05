'use client';

import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Reusing interfaces - ideally these should be shared, but defining here for speed
interface StudySession {
    id: string;
    timestamp: number;
    durationMinutes: number;
    classId: string;
}

interface ClassData {
    id: string;
    name: string;
    color: string;
}

export default function ParentActivityPage() {
    const { user, state } = useApp();
    const router = useRouter();
    const [sessions, setSessions] = useState<StudySession[]>([]);
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;

            // 1. Get Linked Child ID
            let linkedId = state.linkedUserId;
            if (!linkedId) {
                const { data } = await supabase.from('profiles').select('linked_user_id').eq('id', user.id).single();
                linkedId = data?.linked_user_id;
            }

            if (!linkedId) {
                setLoading(false);
                return;
            }

            // 2. Fetch Sessions (Last 30 days)
            const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString();
            const { data: sessData } = await supabase
                .from('study_sessions')
                .select('*')
                .eq('user_id', linkedId)
                .gte('created_at', thirtyDaysAgo)
                .order('created_at', { ascending: false });

            if (sessData) {
                const mapped: StudySession[] = sessData.map((s: any) => ({
                    id: s.id,
                    classId: s.class_id,
                    durationMinutes: s.duration_minutes,
                    timestamp: new Date(s.created_at).getTime()
                }));
                setSessions(mapped);
            }

            // 3. Fetch Classes (for names/colors)
            const { data: classData } = await supabase
                .from('classes')
                .select('*')
                .eq('user_id', linkedId);

            if (classData) setClasses(classData);

            setLoading(false);
        };
        fetchData();
    }, [user, state.linkedUserId, state.lastRefreshed]);

    // Group sessions by Date
    const groupedSessions: { [date: string]: StudySession[] } = {};
    sessions.forEach(s => {
        const dateStr = new Date(s.timestamp).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
        if (!groupedSessions[dateStr]) groupedSessions[dateStr] = [];
        groupedSessions[dateStr].push(s);
    });

    if (loading) return <div className="p-8 text-center text-gray-500">Loading activity...</div>;

    return (
        <main className="container" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', paddingBottom: '40px', maxWidth: '600px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <button onClick={() => router.back()} className="btn" style={{ marginRight: '16px', padding: '8px 12px' }}>
                    ←
                </button>
                <h1 className="text-h2" style={{ margin: 0 }}>Study History 🕒</h1>
            </div>

            {Object.keys(groupedSessions).length === 0 ? (
                <div className="card text-center p-8 text-gray-500">
                    No study sessions recorded in the last 30 days.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {Object.keys(groupedSessions).map(date => (
                        <div key={date}>
                            <h3 style={{ fontSize: '0.9rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', marginLeft: '4px' }}>
                                {date}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {groupedSessions[date].map(session => {
                                    const cls = classes.find(c => c.id === session.classId) || { name: 'Unknown', color: '#ccc' } as ClassData;
                                    const startTime = new Date(session.timestamp);
                                    const endTime = new Date(session.timestamp + session.durationMinutes * 60 * 1000);

                                    return (
                                        <div key={session.id} className="card animate-fade-in" style={{
                                            padding: 0,
                                            display: 'flex',
                                            overflow: 'hidden',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                                        }}>
                                            {/* Color Strip */}
                                            <div style={{ width: '6px', background: cls.color }}></div>

                                            <div style={{ padding: '16px', flex: 1 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{cls.name}</span>
                                                    <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{session.durationMinutes} min</span>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: '#888' }}>
                                                    {startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {endTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </main>
    );
}
