'use client';

import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { purchaseItem } from '@/lib/iap';
import Link from 'next/link';
import Modal from '@/components/Modal';

interface StudySession {
    id: string;
    timestamp: number;
    durationMinutes: number;
    classId: string;
    userId: string;
}

interface ClassData {
    id: string;
    name: string;
    color: string;
    weeklyGoalMinutes: number;
}

export default function ParentDashboard() {
    const { user, state, signOut } = useApp();
    const router = useRouter();
    const [childProfile, setChildProfile] = useState<any>(null);
    const [childClasses, setChildClasses] = useState<ClassData[]>([]);
    const [childSessions, setChildSessions] = useState<StudySession[]>([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);

    // Linking State
    const [linkId, setLinkId] = useState('');
    const [isLinking, setIsLinking] = useState(false);
    const [linkError, setLinkError] = useState('');

    // Calculate start of week (Monday)
    const getStartOfWeek = () => {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday.getTime();
    };

    const startOfWeek = getStartOfWeek();

    // Realtime Updates & Notifications
    const [celebrateSession, setCelebrateSession] = useState<StudySession | null>(null);

    useEffect(() => {
        const fetchChild = async () => {
            if (!user) return;

            let linkedId = state.linkedUserId;
            if (!linkedId) {
                const { data } = await supabase.from('profiles').select('linked_user_id').eq('id', user.id).single();
                linkedId = data?.linked_user_id;
            }

            if (linkedId) {
                // ... (Existing Fetch Logic - fetching profile, classes, sessions) ...
                // Note: I will just re-implement the fetch here to ensure we have the vars needed for the realtime setup down below
                // or I can assume the previous fetch ran.
                // Better to keep the fetch logic as is and Add the Realtime subscription in a separate effect that depends on linkedId.

                // Fetch Child Profile
                const { data: child } = await supabase.from('profiles').select('*').eq('id', linkedId).single();
                if (child) setChildProfile(child);

                // Fetch Classes
                const { data: classes } = await supabase.from('classes').select('*').eq('user_id', linkedId).eq('is_archived', false);
                if (classes) {
                    setChildClasses(classes.map((c: any) => ({
                        id: c.id, name: c.name, color: c.color, weeklyGoalMinutes: c.weekly_goal_minutes || 0
                    })));
                }

                // Fetch Sessions
                const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString();
                const { data: sessions } = await supabase.from('study_sessions').select('*').eq('user_id', linkedId).gte('created_at', thirtyDaysAgo).order('created_at', { ascending: false });

                if (sessions) {
                    setChildSessions(sessions.map((s: any) => ({
                        id: s.id, classId: s.class_id, durationMinutes: s.duration_minutes, timestamp: new Date(s.created_at).getTime(), userId: s.user_id
                    })));
                }
            }
            setLoading(false);
        };
        fetchChild();
    }, [user, state.linkedUserId, state.lastRefreshed]);

    // Realtime Subscription Effect
    useEffect(() => {
        let channel: any;
        const linkedId = state.linkedUserId || (childProfile ? childProfile.id : null);

        if (user && linkedId) {
            console.log('[Parent] Subscribing to sessions for:', linkedId);
            channel = supabase
                .channel('parent-dashboard-sessions')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'study_sessions',
                        filter: `user_id=eq.${linkedId}`
                    },
                    (payload) => {
                        console.log('[Parent] New Session Received!', payload);
                        const newS = payload.new;
                        const session: StudySession = {
                            id: newS.id,
                            classId: newS.class_id,
                            durationMinutes: newS.duration_minutes,
                            timestamp: new Date(newS.created_at).getTime(),
                            userId: newS.user_id
                        };

                        // 1. Update List
                        setChildSessions(prev => [session, ...prev]);

                        // 2. Trigger Celebration / Notification
                        setCelebrateSession(session);

                        // 3. Send Local Notification
                        import('@capacitor/local-notifications').then(async ({ LocalNotifications }) => {
                            await LocalNotifications.schedule({
                                notifications: [{
                                    id: Math.floor(Math.random() * 100000),
                                    title: "Task Complete! 🎓",
                                    body: `${childProfile?.full_name || 'Your student'} just studied for ${session.durationMinutes} mins!`,
                                    schedule: { at: new Date(Date.now() + 1000) }, // 1 sec delay
                                    sound: 'default'
                                }]
                            });
                        });
                    }
                )
                .subscribe();
        }

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [user, state.linkedUserId, childProfile]);

    const handlePurchase = async (productId: string, type: 'coins' | 'time', amount: number) => {
        if (!childProfile) return;
        setPurchasing(true);
        try {
            const success = await purchaseItem(productId);
            if (success) {
                await supabase.from('gifts').insert({
                    recipient_user_id: childProfile.id,
                    sender_name: 'Parent',
                    gift_type: type === 'coins' ? 'coins' : 'game_time',
                    amount: amount
                });
                alert('Gift Sent Successfully! 🎉');
            }
        } catch (e) {
            console.error(e);
            alert('Purchase failed');
        }
        setPurchasing(false);
    };

    const handleSendReward = (rewardId: string) => {
        if (rewardId === 'coins_10000') {
            handlePurchase('com.learnloop.reward.coins_10k', 'coins', 10000);
        } else if (rewardId === 'break_15') {
            handlePurchase('com.learnloop.reward.break_15', 'time', 15);
        }
    };

    const handleLinkStudent = async () => {
        const cleanedId = linkId.trim();
        if (!cleanedId) { setLinkError('Please enter an ID'); return; }

        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!UUID_REGEX.test(cleanedId)) {
            setLinkError('Invalid ID format');
            return;
        }

        setIsLinking(true);
        setLinkError('');

        try {
            if (!user) throw new Error('NoUser');

            // 1. Verify child
            const { data: child, error } = await supabase.from('profiles').select('id').eq('id', cleanedId).single();
            if (error || !child) throw new Error('ChildNotFound');

            // 2. Link
            await supabase.from('profiles').update({
                linked_user_id: child.id,
                role: 'parent' // ensure role
            }).eq('id', user.id);

            // 3. Reload
            alert('Connected! 🎉');
            window.location.reload();

        } catch (e: any) {
            console.error(e);
            setIsLinking(false);
            if (e.message === 'ChildNotFound') setLinkError('Student ID not found');
            else setLinkError('Connection failed');
        }
    };

    // Calculate stats
    const totalStudyTimeMinutes = childSessions.reduce((acc, s) => acc + s.durationMinutes, 0);
    const weeklyStudyMinutes = childSessions
        .filter(s => s.timestamp >= startOfWeek)
        .reduce((acc, s) => acc + s.durationMinutes, 0);
    const totalWeeklyGoal = childClasses.reduce((acc, c) => acc + c.weeklyGoalMinutes, 0);
    const weeklyPercent = totalWeeklyGoal > 0 ? Math.min(100, (weeklyStudyMinutes / totalWeeklyGoal) * 100) : 0;
    const totalSessions = childSessions.length;
    const avgSessionMinutes = totalSessions > 0 ? Math.round(totalStudyTimeMinutes / totalSessions) : 0;

    // Get recent sessions (last 7)
    const recentSessions = childSessions.slice(0, 7);

    // Sessions per class
    const classStats = childClasses.map(cls => {
        const classSessions = childSessions.filter(s => s.classId === cls.id);
        const classMinutes = classSessions.reduce((acc, s) => acc + s.durationMinutes, 0);
        const weeklyClassMinutes = classSessions
            .filter(s => s.timestamp >= startOfWeek)
            .reduce((acc, s) => acc + s.durationMinutes, 0);
        return {
            ...cls,
            totalMinutes: classMinutes,
            weeklyMinutes: weeklyClassMinutes,
            sessionCount: classSessions.length
        };
    });

    if (loading) return <div className="container text-center" style={{ paddingTop: '40vh' }}>Loading...</div>;

    return (
        <main className="container" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', paddingBottom: '40px' }}>
            <header style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '24px', paddingTop: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <img src="/icons/parent_header.png?v=3" alt="Family" style={{ width: '96px', height: '96px' }} />
                    <h1 className="text-h2" style={{ margin: 0 }}>Parent Dashboard</h1>
                </div>
            </header>

            {!childProfile ? (
                <div className="card text-center" style={{ padding: '40px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎓</div>
                    <h2 className="text-h3">Connect Student</h2>
                    <p className="text-body" style={{ color: '#666', marginBottom: '24px' }}>
                        Enter your child's Student ID found in their <strong>Settings → Account</strong>.
                    </p>

                    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                        <input
                            type="text"
                            placeholder="Student ID (e.g. 550e...)"
                            value={linkId}
                            onChange={(e) => setLinkId(e.target.value)}
                            className="input"
                            style={{ width: '100%', marginBottom: '12px' }}
                        />
                        {linkError && <p style={{ color: 'red', fontSize: '0.9rem', marginBottom: '12px' }}>{linkError}</p>}
                        <button
                            onClick={handleLinkStudent}
                            disabled={isLinking}
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                        >
                            {isLinking ? 'Connecting...' : 'Link Account'}
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '20px' }}>
                    {/* Child Overview */}
                    <div style={{ marginBottom: '16px' }}>
                        <div className="card" style={{ background: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)', color: 'white' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ position: 'relative' }}>
                                    <img
                                        src={childProfile.avatar_url || "/assets/avatar_cool.png"}
                                        alt="Child"
                                        style={{ width: '64px', height: '64px', borderRadius: '50%', border: '3px solid white' }}
                                    />
                                    <div style={{
                                        position: 'absolute', bottom: 0, right: 0,
                                        background: 'var(--color-success)',
                                        width: '16px', height: '16px',
                                        borderRadius: '50%',
                                        border: '2px solid white'
                                    }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h2 style={{ fontSize: '1.4rem', margin: 0 }}>{childProfile.full_name || 'My Student'}</h2>
                                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                                        This Week (Goal: {totalWeeklyGoal}m)
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', background: 'rgba(255,255,255,0.2)', padding: '8px 12px', borderRadius: '12px', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <img src="/icons/coins.png" alt="Coins" style={{ width: '32px', height: '32px' }} />
                                    <div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{childProfile.points?.toLocaleString() || 0}</div>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>Coins Earned</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Weekly Progress Card */}
                    <Link href="/parent/activity" style={{ textDecoration: 'none', color: 'inherit', WebkitTapHighlightColor: 'transparent' }}>
                        <div className="card animate-fade-in" style={{
                            transition: 'transform 0.1s ease',
                            cursor: 'pointer',
                            background: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)', // Red to Orange
                            color: 'white'
                        }}
                            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.96)'}
                            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.96)'}
                            onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <img src="/icons/focus.png" alt="Progress" style={{ width: '48px', height: '48px' }} />
                                    Weekly Progress
                                </span>
                                <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>View Activity →</span>
                            </h3>

                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                                <span style={{ fontSize: '3rem', fontWeight: 800 }}>{Math.round(weeklyStudyMinutes)}</span>
                                <span style={{ fontSize: '1rem', opacity: 0.9 }}>/ {totalWeeklyGoal} mins</span>
                            </div>

                            {/* Progress Bar */}
                            <div style={{
                                width: '100%',
                                height: '16px',
                                background: 'rgba(255,255,255,0.3)',
                                borderRadius: 'var(--radius-full)',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${Math.min(100, (weeklyStudyMinutes / (totalWeeklyGoal || 1)) * 100)}%`,
                                    height: '100%',
                                    background: 'white',
                                    borderRadius: 'var(--radius-full)',
                                    transition: 'width 1s ease-out'
                                }} />
                            </div>
                        </div>
                    </Link>
                    {/* Quick Stats Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        <div className="card" style={{ textAlign: 'center', padding: '16px', background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)', color: 'white' }}>
                            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Total Hours</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{Math.round(childProfile.total_minutes / 60)}h</div>
                        </div>
                        <div className="card" style={{ textAlign: 'center', padding: '16px', background: 'linear-gradient(135deg, #fb923c 0%, #fdba74 100%)', color: 'white' }}>
                            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Sessions</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{state.studySessions.filter(s => s.userId === childProfile?.id).length}</div>
                        </div>
                        <div className="card" style={{ textAlign: 'center', padding: '16px', background: 'linear-gradient(135deg, #fdba74 0%, #fed7aa 100%)', color: 'white' }}>
                            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Avg Mins</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{Math.round(childProfile.average_session_minutes || 0)}m</div>
                        </div>
                    </div>

                    {/* Class Breakdown */}
                    {classStats.length > 0 && (
                        <div className="card" style={{
                            background: 'linear-gradient(135deg, #fb923c 0%, #FF7E36 100%)', // Orange
                            color: 'white'
                        }}>
                            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <img src="/icons/icon_books.png" alt="Classes" style={{ width: '48px', height: '48px' }} />
                                Class Breakdown
                            </h3>
                            <div style={{ display: 'grid', gap: '12px' }}>
                                {classStats.map(cls => (
                                    <div key={cls.id} style={{
                                        background: 'rgba(255,255,255,0.2)',
                                        borderRadius: '16px',
                                        padding: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        backdropFilter: 'blur(4px)'
                                    }}>
                                        <div style={{
                                            width: '12px', height: '12px', borderRadius: '50%',
                                            background: cls.color, marginRight: '12px',
                                            border: '2px solid white'
                                        }} />
                                        <div style={{ flex: 1, fontWeight: 600 }}>{cls.name}</div>
                                        <div style={{ fontWeight: 800 }}>{Math.round(cls.totalMinutes)}m</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Activity */}
                    {recentSessions.length > 0 && (
                        <div className="card" style={{
                            background: 'linear-gradient(135deg, #FF7E36 0%, #ea580c 100%)', // App Primary
                            color: 'white'
                        }}>
                            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <img src="/icons/parent_history.png" alt="Recent" style={{ width: '48px', height: '48px' }} />
                                Recent Activity
                            </h3>
                            <div style={{ display: 'grid', gap: '8px' }}>
                                {recentSessions.map(session => {
                                    const cls = childClasses.find(c => c.id === session.classId);
                                    return (
                                        <div key={session.id} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '12px',
                                            background: 'rgba(255,255,255,0.2)',
                                            borderRadius: '12px',
                                            backdropFilter: 'blur(4px)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    width: '40px', height: '40px',
                                                    borderRadius: '10px',
                                                    background: 'rgba(255,255,255,0.3)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: 'bold', fontSize: '1.2rem'
                                                }}>
                                                    {cls?.name.substring(0, 1) || '?'}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>{cls?.name || 'Unknown Class'}</div>
                                                    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                                                        {new Date(session.timestamp).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                                                +{session.durationMinutes}m
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Send Rewards Section */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', marginBottom: '16px' }}>
                        <img src="/icons/parent_gift.png" alt="Rewards" style={{ width: '48px', height: '48px' }} />
                        <h3 className="text-h2" style={{ margin: 0, fontSize: '1.5rem' }}>Send Rewards</h3>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                        <div className="card" style={{
                            textAlign: 'center',
                            background: 'linear-gradient(135deg, #fff9c4 0%, #fff 50%, #f1c40f 100%)', // Golden Munchkin Style
                            color: '#78350f',
                            border: '2px solid #f1c40f',
                            boxShadow: '0 0 15px rgba(241, 196, 15, 0.5)',
                            maxWidth: '400px',
                            width: '100%'
                        }}>
                            <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src="/icons/parent_controller.png" alt="Play" style={{ height: '48px', width: 'auto' }} />
                            </div>
                            <h4 style={{ margin: '8px 0', fontWeight: 800 }}>Break Time</h4>
                            <p style={{ fontSize: '0.8rem', opacity: 0.9, marginBottom: '12px' }}>15 Minutes</p>
                            <button
                                onClick={() => handleSendReward('break_15')}
                                className="btn"
                                style={{
                                    width: '100%',
                                    background: 'white',
                                    color: '#b45309',
                                    fontWeight: 'bold',
                                    border: 'none',
                                    fontSize: '0.9rem'
                                }}
                            >
                                Send Gift ($1.99)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ marginTop: '40px', paddingBottom: '40px', textAlign: 'center' }}>
                <button onClick={signOut} className="btn" style={{
                    background: 'transparent',
                    color: 'var(--color-text-secondary)',
                    textDecoration: 'underline',
                    fontSize: '0.9rem'
                }}>
                    Sign Out
                </button>
            </div>

            {/* Celebrate Session Modal */}
            <Modal
                isOpen={!!celebrateSession}
                onClose={() => setCelebrateSession(null)}
                title="Mission Accomplished! 🚀"
                type="success"
                actions={
                    <>
                        <button className="btn btn-secondary" onClick={() => setCelebrateSession(null)}>Later</button>
                    </>
                }
            >
                {celebrateSession && (
                    <div style={{ textAlign: 'center' }}>
                        <p className="text-body" style={{ marginBottom: '24px' }}>
                            <strong>{childProfile?.full_name || 'Your student'}</strong> just finished studying for <strong>{celebrateSession.durationMinutes} minutes</strong>!
                        </p>

                        <div style={{ background: '#fffbeb', padding: '16px', borderRadius: '12px', marginBottom: '24px', border: '2px solid #fef3c7' }}>
                            <p style={{ fontSize: '0.85rem', color: '#92400e', marginBottom: '12px', fontWeight: 'bold' }}>
                                Send a reward to say "Great Job!"?
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <button
                                    onClick={() => { handleSendReward('break_15'); setCelebrateSession(null); }}
                                    className="btn"
                                    style={{ background: 'white', border: '1px solid #d97706', color: '#d97706', fontSize: '0.8rem', padding: '8px' }}
                                >
                                    ☕️ Break (15m)
                                </button>
                                <button
                                    onClick={() => { handlePurchase('com.learnloop.reward.coins_10k', 'coins', 2500); setCelebrateSession(null); }}
                                    className="btn"
                                    style={{ background: 'white', border: '1px solid #d97706', color: '#d97706', fontSize: '0.8rem', padding: '8px' }}
                                >
                                    💰 2,500 Coins
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </main>
    );
}
