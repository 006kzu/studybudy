'use client';

import { useApp } from '@/context/AppContext';
import ParentalGate from '@/components/ParentalGate';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { purchaseItem } from '@/lib/iap';
import Link from 'next/link';
import Modal from '@/components/Modal';
import { generateDailySummary } from '@/lib/ai-summary';
import { AdMobService } from '@/lib/admob';

interface StudySession {
    id: string;
    timestamp: number;
    durationMinutes: number;
    classId: string;
    userId: string;
    notes?: string;
}

interface ClassData {
    id: string;
    name: string;
    color: string;
    weeklyGoalMinutes: number;
}

export default function ParentDashboard() {
    const { user, state, signOut, refreshData, deleteAccount } = useApp();
    const router = useRouter();
    const [childProfile, setChildProfile] = useState<any>(null);
    const [childClasses, setChildClasses] = useState<ClassData[]>([]);
    const [childSessions, setChildSessions] = useState<StudySession[]>([]);
    const [gifts, setGifts] = useState<any[]>([]); // New state for gifts
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);

    // Notification Toggle State (on = summary, off = none)
    const [summariesEnabled, setSummariesEnabled] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const summariesEnabledRef = useRef(true);

    // AI Summary State
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [aiSummaryLoading, setAiSummaryLoading] = useState(false);

    // Feedback State
    const [showFeedback, setShowFeedback] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackSending, setFeedbackSending] = useState(false);
    const [feedbackSent, setFeedbackSent] = useState(false);

    // Linking State
    const [linkId, setLinkId] = useState('');
    const [isLinking, setIsLinking] = useState(false);
    const [linkError, setLinkError] = useState('');

    // Free Gift State
    const [hasSentFreeGiftToday, setHasSentFreeGiftToday] = useState(false);

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
    const [celebrateSession, setCelebrateSession] = useState<any>(null);
    const [showLinkSuccess, setShowLinkSuccess] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showWhereIsId, setShowWhereIsId] = useState(false);
    const [showFullHistory, setShowFullHistory] = useState(false);


    useEffect(() => {
        // Hide any persisting banner ad from student dashboard
        AdMobService.hideBanner();

        const fetchChild = async () => {
            if (!user) return;

            // Fetch Parent's Profile for Notification Settings
            const { data: parentProfile } = await supabase.from('profiles').select('notification_tier').eq('id', user.id).single();
            if (parentProfile) {
                const isOn = parentProfile.notification_tier !== 'none';
                setSummariesEnabled(isOn);
                summariesEnabledRef.current = isOn;
            }

            let linkedId = state.linkedUserId;
            if (!linkedId) {
                const { data } = await supabase.from('profiles').select('linked_user_id').eq('id', user.id).single();
                linkedId = data?.linked_user_id;
            }

            if (linkedId) {
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

                // Fetch Gifts (Recent Activity & Thanks Count)
                const { data: giftsData } = await supabase
                    .from('gifts')
                    .select('*')
                    .eq('sender_id', user.id)
                    .order('created_at', { ascending: false });

                if (giftsData) setGifts(giftsData);

                if (sessions) {
                    setChildSessions(sessions.map((s: any) => ({
                        id: s.id,
                        classId: s.class_id,
                        durationMinutes: s.duration_minutes,
                        timestamp: new Date(s.created_at).getTime(),
                        userId: s.user_id,
                        notes: s.notes // Include notes
                    })));
                }

                // Check if parent has sent a free gift today
                const startOfToday = new Date();
                startOfToday.setHours(0, 0, 0, 0);
                const { data: todaysGifts } = await supabase
                    .from('gifts')
                    .select('id')
                    .eq('sender_id', user.id)
                    .gte('created_at', startOfToday.toISOString())
                    .limit(1);

                setHasSentFreeGiftToday((todaysGifts?.length || 0) > 0);
            }
            setLoading(false);
        };
        fetchChild();
    }, [user, state.linkedUserId, state.lastRefreshed]);

    // Update Notification Setting (toggle)
    const toggleSummaries = async () => {
        const newVal = !summariesEnabled;
        setSummariesEnabled(newVal);
        summariesEnabledRef.current = newVal;
        if (user) {
            await supabase.from('profiles').update({ notification_tier: newVal ? 'summary' : 'none' }).eq('id', user.id);
        }
    };

    // Generate AI Summary on load
    useEffect(() => {
        if (!summariesEnabled || !childProfile || !childSessions.length || aiSummary) return;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todaySessions = childSessions.filter(s => s.timestamp >= todayStart.getTime());
        if (todaySessions.length === 0) return;

        setAiSummaryLoading(true);
        const todayGifts = gifts.filter(g => new Date(g.created_at).getTime() >= todayStart.getTime()).length;
        generateDailySummary({
            studentName: childProfile.full_name || 'Your student',
            totalStudyMinutes: todaySessions.reduce((sum, s) => sum + s.durationMinutes, 0),
            sessions: todaySessions.map(s => {
                const cls = childClasses.find(c => c.id === s.classId);
                return { className: cls?.name || 'Unknown', durationMinutes: s.durationMinutes, notes: s.notes };
            }),
            giftsReceived: todayGifts
        }).then(summary => {
            setAiSummary(summary);
            setAiSummaryLoading(false);
        }).catch(() => setAiSummaryLoading(false));
    }, [summariesEnabled, childProfile, childSessions, childClasses, gifts, aiSummary]);

    // Submit Feedback
    const handleSubmitFeedback = async () => {
        if (!feedbackText.trim() || !user) return;
        setFeedbackSending(true);
        try {
            await supabase.from('feedback').insert({ user_id: user.id, message: feedbackText.trim() });
            setFeedbackSent(true);
            setFeedbackText('');
            setTimeout(() => { setFeedbackSent(false); setShowFeedback(false); }, 1500);
        } catch (e) {
            console.error('Feedback error:', e);
            alert('Failed to send feedback. Please try again.');
        }
        setFeedbackSending(false);
    };

    // Realtime Subscription Effect
    useEffect(() => {
        let channel: any;
        const linkedId = state.linkedUserId || (childProfile ? childProfile.id : null);
        // Keep ref in sync
        summariesEnabledRef.current = summariesEnabled;

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
                            userId: newS.user_id,
                            notes: newS.notes
                        };

                        // 1. Update List (Always)
                        setChildSessions(prev => [session, ...prev]);

                        // 2. Handle Notifications based on toggle
                        if (!summariesEnabledRef.current) {
                            return;
                        }

                        // Show In-App Celebration
                        setCelebrateSession(session);

                        // Invalidate cached AI summary so it regenerates
                        setAiSummary(null);
                    }
                )
                .subscribe();
        }

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [user, state.linkedUserId, childProfile]); // Don't depend on notificationTier, use Ref

    const handlePurchase = async (productId: string, type: 'time', amount: number, isFree: boolean = false) => {
        if (!childProfile || !user) return;
        setPurchasing(true);
        try {
            let success = true;

            // Only process IAP if not free
            if (!isFree) {
                success = await purchaseItem(productId);
            }

            if (success) {
                await supabase.from('gifts').insert({
                    recipient_user_id: childProfile.id,
                    sender_id: user.id,
                    sender_name: 'Parent',
                    gift_type: 'game_time',
                    amount: amount
                });

                if (isFree) {
                    setHasSentFreeGiftToday(true);
                }

                alert(isFree ? 'Free Gift Sent! 🎉' : 'Gift Sent Successfully! 🎉');
            }
        } catch (e) {
            console.error(e);
            alert('Gift sending failed');
        }
        setPurchasing(false);
    };

    const handleSendReward = (rewardId: string, isFree: boolean = false) => {
        if (rewardId === 'break_15') {
            handlePurchase('com.learnloop.reward.break_15', 'time', 15, isFree);
        }
    };

    const handleSendCharacterTier = async (tier: 'legendary' | 'epic' | 'rare', productId: string) => {
        if (!childProfile || !user) return;

        setPurchasing(true);
        try {
            // Process real IAP purchase
            const success = await purchaseItem(productId);
            if (!success) { setPurchasing(false); return; }

            await supabase.from('gifts').insert({
                recipient_user_id: childProfile.id,
                sender_id: user.id,
                sender_name: 'Parent',
                gift_type: `character_${tier}`,
                amount: 1
            });

            alert(`${tier.charAt(0).toUpperCase() + tier.slice(1)} Character Unlock Sent! 🎉`);
        } catch (e) {
            console.error(e);
            alert('Gift sending failed');
        }
        setPurchasing(false);
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

            // 1. Verify child exists
            const { data: child, error: findError } = await supabase.from('profiles').select('id').eq('id', cleanedId).single();
            if (findError || !child) throw new Error('ChildNotFound');

            // 2. Link - upsert profile (creates row if it doesn't exist yet)
            const { error: updateError } = await supabase.from('profiles').upsert({
                id: user.id,
                linked_user_id: child.id,
                role: 'parent',
                is_onboarded: true
            });

            if (updateError) {
                console.error('[Parent] Link upsert error:', updateError);
                throw new Error('UpdateFailed');
            }

            // 3. Verify the link persisted
            const { data: verify } = await supabase.from('profiles').select('linked_user_id').eq('id', user.id).single();
            if (!verify?.linked_user_id) {
                console.error('[Parent] linked_user_id did not persist!');
                throw new Error('LinkNotPersisted');
            }

            // 4. Show loading screen with confetti
            setShowLinkSuccess(true);
            await refreshData();
            // Wait a moment for the loading animation
            await new Promise(r => setTimeout(r, 2500));
            window.location.reload();

        } catch (e: any) {
            console.error('[Parent] Link error:', e);
            setIsLinking(false);
            if (e.message === 'ChildNotFound') setLinkError('Student ID not found');
            else if (e.message === 'LinkNotPersisted') setLinkError('Link failed to save. Check Supabase permissions.');
            else setLinkError('Connection failed. Please try again.');
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

    // Calculate Thanks Count
    const thanksCount = gifts ? gifts.filter((g: any) => g.thanked).length : 0;

    // Merge & Sort Activity Feed (Sessions + Gifts)
    const activityFeed = [
        ...childSessions.map(s => ({ type: 'session' as const, data: s, date: new Date(s.timestamp) })),
        ...(gifts || []).map((g: any) => ({ type: 'gift' as const, data: g, date: new Date(g.created_at) }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10); // Show last 10 items

    if (loading) return <div className="container text-center" style={{ paddingTop: '40vh' }}>Loading...</div>;

    return (
        <main className="container" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', paddingBottom: '40px' }}>
            {/* Header with Settings Button */}
            <header style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '24px', paddingTop: '16px', position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <img src="/icons/parent_header.png?v=3" alt="Family" style={{ width: '96px', height: '96px' }} />
                    <h1 className="text-h2" style={{ margin: 0 }}>Parent Dashboard</h1>
                </div>

                {/* Notifications Toggle */}
                {childProfile && (
                    <button
                        onClick={() => setShowSettings(true)}
                        style={{
                            position: 'absolute', right: 0, top: '16px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '4px'
                        }}
                    >
                        <img src="/icons/notifications.png" alt="Notifications" style={{ width: '36px', height: '36px' }} />
                    </button>
                )}

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
                            style={{ width: '100%', marginBottom: '12px' }}
                        >
                            {isLinking ? 'Connecting...' : 'Link Account'}
                        </button>
                        <button
                            onClick={() => setShowWhereIsId(true)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-primary)',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                textDecoration: 'underline'
                            }}
                        >
                            Where is my Student ID?
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
                                    {thanksCount > 0 && (
                                        <div style={{
                                            marginTop: '4px',
                                            background: 'rgba(255,255,255,0.2)',
                                            padding: '4px 8px',
                                            borderRadius: '8px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '0.7rem'
                                        }}>
                                            <span>❤️</span>
                                            <span style={{ fontWeight: 600 }}>
                                                Thanks: <strong>{thanksCount}</strong>
                                            </span>
                                        </div>
                                    )}
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



                    {/* Weekly Progress Card */}
                    <Link href="/parent/activity" style={{ textDecoration: 'none', color: 'inherit', WebkitTapHighlightColor: 'transparent' }}>
                        <div className="card animate-fade-in" style={{
                            transition: 'transform 0.1s ease',
                            cursor: 'pointer',
                            background: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)',
                            color: 'white'
                        }}
                            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.96)'}
                            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.96)'}
                            onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}>
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

                    {/* Send Rewards Section - 2x2 Grid */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', marginBottom: '16px' }}>
                        <img src="/icons/parent_gift.png" alt="Rewards" style={{ width: '48px', height: '48px' }} />
                        <h3 className="text-h2" style={{ margin: 0, fontSize: '1.5rem' }}>Send Rewards</h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                        {/* Game Time Card */}
                        <div className="card" style={{
                            textAlign: 'center',
                            background: 'linear-gradient(135deg, #fff9c4 0%, #fff 50%, #f1c40f 100%)',
                            color: '#78350f',
                            border: '2px solid #f1c40f',
                            boxShadow: '0 0 15px rgba(241, 196, 15, 0.5)'
                        }}>
                            <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src="/icons/parent_controller.png" alt="Play" style={{ height: '48px', width: 'auto' }} />
                            </div>
                            <h4 style={{ margin: '8px 0', fontWeight: 800 }}>Game Time</h4>
                            <p style={{ fontSize: '0.8rem', opacity: 0.9, marginBottom: '12px' }}>15 Minutes</p>
                            {!hasSentFreeGiftToday ? (
                                <>
                                    <button
                                        onClick={() => handleSendReward('break_15', true)}
                                        disabled={purchasing}
                                        className="btn"
                                        style={{
                                            width: '100%',
                                            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                            color: 'white',
                                            fontWeight: 'bold',
                                            border: 'none',
                                            fontSize: '0.9rem',
                                            marginBottom: '8px',
                                            opacity: purchasing ? 0.6 : 1
                                        }}
                                    >
                                        {purchasing ? 'Sending...' : '🎁 Send game time for a good day of studying!'}
                                    </button>
                                    <p style={{ fontSize: '0.7rem', opacity: 0.7, margin: 0 }}>
                                        First gift each day is free!
                                    </p>
                                </>
                            ) : (
                                <button
                                    onClick={() => handleSendReward('break_15', false)}
                                    disabled={purchasing}
                                    className="btn"
                                    style={{
                                        width: '100%',
                                        background: 'white',
                                        color: '#b45309',
                                        fontWeight: 'bold',
                                        border: 'none',
                                        fontSize: '0.9rem',
                                        opacity: purchasing ? 0.6 : 1
                                    }}
                                >
                                    {purchasing ? 'Sending...' : 'Send Gift ($1.99)'}
                                </button>
                            )}
                        </div>

                        {/* Rare Character */}
                        <div className="card" style={{
                            textAlign: 'center',
                            background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
                            color: '#1e3a8a',
                            border: '2px solid #3b82f6',
                            boxShadow: '0 0 15px rgba(59, 130, 246, 0.5)'
                        }}>
                            <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ fontSize: '3rem' }}>⭐</div>
                            </div>
                            <h4 style={{ margin: '8px 0', fontWeight: 800 }}>Rare</h4>
                            <p style={{ fontSize: '0.8rem', opacity: 0.9, marginBottom: '12px' }}>Character Unlock</p>
                            <button
                                onClick={() => handleSendCharacterTier('rare', 'com.learnloop.gift.rare')}
                                disabled={purchasing}
                                className="btn"
                                style={{
                                    width: '100%',
                                    background: 'white',
                                    color: '#1e40af',
                                    fontWeight: 'bold',
                                    border: 'none',
                                    fontSize: '0.9rem',
                                    opacity: purchasing ? 0.6 : 1
                                }}
                            >
                                {purchasing ? 'Sending...' : 'Send Gift ($1.99)'}
                            </button>
                        </div>

                        {/* Epic Character */}
                        <div className="card" style={{
                            textAlign: 'center',
                            background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
                            color: '#4c1d95',
                            border: '2px solid #8b5cf6',
                            boxShadow: '0 0 15px rgba(139, 92, 246, 0.5)'
                        }}>
                            <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ fontSize: '3rem' }}>💎</div>
                            </div>
                            <h4 style={{ margin: '8px 0', fontWeight: 800 }}>Epic</h4>
                            <p style={{ fontSize: '0.8rem', opacity: 0.9, marginBottom: '12px' }}>Character Unlock</p>
                            <button
                                onClick={() => handleSendCharacterTier('epic', 'com.learnloop.gift.epic')}
                                disabled={purchasing}
                                className="btn"
                                style={{
                                    width: '100%',
                                    background: 'white',
                                    color: '#5b21b6',
                                    fontWeight: 'bold',
                                    border: 'none',
                                    fontSize: '0.9rem',
                                    opacity: purchasing ? 0.6 : 1
                                }}
                            >
                                {purchasing ? 'Sending...' : 'Send Gift ($2.99)'}
                            </button>
                        </div>

                        {/* Legendary Character */}
                        <div className="card" style={{
                            textAlign: 'center',
                            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                            color: '#78350f',
                            border: '2px solid #f59e0b',
                            boxShadow: '0 0 15px rgba(245, 158, 11, 0.5)'
                        }}>
                            <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ fontSize: '3rem' }}>👑</div>
                            </div>
                            <h4 style={{ margin: '8px 0', fontWeight: 800 }}>Legendary</h4>
                            <p style={{ fontSize: '0.8rem', opacity: 0.9, marginBottom: '12px' }}>Character Unlock</p>
                            <button
                                onClick={() => handleSendCharacterTier('legendary', 'com.learnloop.gift.legendary')}
                                disabled={purchasing}
                                className="btn"
                                style={{
                                    width: '100%',
                                    background: 'white',
                                    color: '#92400e',
                                    fontWeight: 'bold',
                                    border: 'none',
                                    fontSize: '0.9rem',
                                    opacity: purchasing ? 0.6 : 1
                                }}
                            >
                                {purchasing ? 'Sending...' : 'Send Gift ($4.99)'}
                            </button>
                        </div>
                    </div>

                    {/* Premium Upgrade for Student */}
                    {childProfile && !childProfile.is_premium && (
                        <div className="card" style={{
                            background: 'linear-gradient(135deg, #FFD700 0%, #FDB931 100%)',
                            border: 'none',
                            marginBottom: '16px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontWeight: 800, color: '#5e4002', fontSize: '1.1rem' }}>
                                        💎 Go Premium
                                    </h3>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#78350f', opacity: 0.9 }}>
                                        Remove ads for {childProfile.full_name || 'your student'}
                                    </p>
                                </div>
                                <button
                                    onClick={async () => {
                                        setPurchasing(true);
                                        try {
                                            const success = await purchaseItem('premium_upgrade');
                                            if (success) {
                                                // Update the student's premium status
                                                await supabase.from('profiles').update({ is_premium: true }).eq('id', childProfile.id);
                                                alert('Premium activated for ' + (childProfile.full_name || 'your student') + '! 🎉');
                                                window.location.reload();
                                            }
                                        } catch (e) {
                                            console.error(e);
                                            alert('Purchase failed. Please try again.');
                                        }
                                        setPurchasing(false);
                                    }}
                                    disabled={purchasing}
                                    className="btn"
                                    style={{
                                        background: 'white',
                                        color: '#5e4002',
                                        border: 'none',
                                        fontWeight: 'bold',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                        opacity: purchasing ? 0.6 : 1,
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {purchasing ? '...' : '$4.99/mo'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Quick Stats Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        <div className="card" style={{ textAlign: 'center', padding: '16px', background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)', color: 'white' }}>
                            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Total Hours</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{Math.round(childSessions.reduce((sum, s) => sum + s.durationMinutes, 0) / 60)}h</div>
                        </div>
                        <div className="card" style={{ textAlign: 'center', padding: '16px', background: 'linear-gradient(135deg, #fb923c 0%, #fdba74 100%)', color: 'white' }}>
                            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Sessions</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{childSessions.length}</div>
                        </div>
                        <div className="card" style={{ textAlign: 'center', padding: '16px', background: 'linear-gradient(135deg, #fdba74 0%, #fed7aa 100%)', color: 'white' }}>
                            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Avg Mins</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{childSessions.length > 0 ? Math.round(childSessions.reduce((sum, s) => sum + s.durationMinutes, 0) / childSessions.length) : 0}m</div>
                        </div>
                    </div>

                    {/* Class Breakdown */}
                    {
                        classStats.length > 0 && (
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
                        )
                    }

                    {/* Recent Activity */}
                    {
                        activityFeed.length > 0 && (
                            <div className="card" style={{
                                background: 'linear-gradient(135deg, #FF7E36 0%, #ea580c 100%)', // App Primary
                                color: 'white'
                            }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <img src="/icons/parent_history.png" alt="Recent" style={{ width: '48px', height: '48px' }} />
                                    Recent Activity
                                </h3>
                                <div style={{ display: 'grid', gap: '8px' }}>
                                    {activityFeed.slice(0, 3).map((item: any, i) => {
                                        if (item.type === 'session') {
                                            const session = item.data;
                                            const cls = childClasses.find(c => c.id === session.classId);
                                            return (
                                                <div key={i} style={{
                                                    display: 'flex', flexDirection: 'column', gap: '4px',
                                                    padding: '12px',
                                                    background: 'rgba(255,255,255,0.2)',
                                                    borderRadius: '12px',
                                                    backdropFilter: 'blur(4px)'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <div style={{
                                                                width: '32px', height: '32px', borderRadius: '50%',
                                                                background: cls?.color || '#eee',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontWeight: 'bold', fontSize: '0.9rem',
                                                                border: '2px solid white'
                                                            }}>
                                                                {cls?.name.substring(0, 1) || '?'}
                                                            </div>
                                                            <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                                                                {cls?.name || 'Unknown Class'}
                                                            </div>
                                                        </div>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                                                            {session.durationMinutes}m
                                                        </div>
                                                    </div>
                                                    {session.notes && (
                                                        <div style={{
                                                            fontSize: '0.9rem', background: 'rgba(255,255,255,0.2)',
                                                            padding: '8px', borderRadius: '8px', marginTop: '4px',
                                                            fontStyle: 'italic'
                                                        }}>
                                                            "{session.notes}"
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '0.75rem', opacity: 0.8, textAlign: 'right', marginTop: '4px' }}>
                                                        {new Date(session.timestamp).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            );
                                        } else {
                                            const g = item.data;
                                            const isCoins = g.gift_type === 'coins';
                                            const isTime = g.gift_type === 'game_time';
                                            return (
                                                <div key={i} style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '12px',
                                                    background: 'rgba(255,255,255,0.9)', // White bg for gifts to pop
                                                    borderRadius: '12px',
                                                    color: '#333'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{ fontSize: '1.5rem' }}>🎁</div>
                                                        <div>
                                                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                                                Sent {isCoins ? 'Coins' : (isTime ? 'Game Time' : 'Character')}
                                                            </div>
                                                            <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                                                {isCoins ? `${g.amount} coins` : (isTime ? `${g.amount}m` : 'Rare Unlock')}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {g.thanked ? (
                                                        <div style={{
                                                            background: '#dcfce7', color: '#166534',
                                                            padding: '4px 8px', borderRadius: '8px',
                                                            fontSize: '0.75rem', fontWeight: 800,
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            Thanked! ❤️
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: '0.75rem', color: '#999' }}>Sent</div>
                                                    )}
                                                </div>
                                            );
                                        }
                                    })}
                                </div>
                                {activityFeed.length > 3 && (
                                    <button
                                        onClick={() => setShowFullHistory(true)}
                                        className="btn"
                                        style={{
                                            width: '100%',
                                            marginTop: '12px',
                                            background: 'rgba(255,255,255,0.2)',
                                            color: 'white',
                                            border: '1px solid rgba(255,255,255,0.3)',
                                            fontWeight: 600
                                        }}
                                    >
                                        View Entire History ({activityFeed.length} items) →
                                    </button>
                                )}
                            </div>
                        )
                    }
                </div>
            )}

            {/* AI Daily Summary Card */}
            {childProfile && summariesEnabled && (
                <div className="card" style={{ marginTop: '24px', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '1.2rem' }}>✨</span>
                        <h3 className="text-h3" style={{ margin: 0 }}>Today's AI Summary</h3>
                    </div>
                    {aiSummaryLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888' }}>
                            <div style={{ width: '16px', height: '16px', border: '2px solid #ddd', borderTop: '2px solid var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            Generating summary...
                        </div>
                    ) : aiSummary ? (
                        <p style={{ color: '#555', lineHeight: 1.6, fontSize: '0.95rem', margin: 0 }}>{aiSummary}</p>
                    ) : (
                        <p style={{ color: '#999', fontSize: '0.9rem', margin: 0 }}>No study activity yet today. Check back later!</p>
                    )}
                </div>
            )}

            <div style={{ marginTop: '40px', paddingBottom: '40px', textAlign: 'center' }}>
                <button
                    onClick={() => setShowFeedback(true)}
                    className="btn"
                    style={{
                        width: '100%',
                        marginBottom: '16px',
                        background: '#eff6ff',
                        border: '1px solid #93c5fd',
                        color: '#1d4ed8',
                        fontWeight: 600,
                        fontSize: '0.9rem'
                    }}
                >
                    💬 Send Feedback
                </button>
                <button onClick={signOut} className="btn" style={{
                    background: 'transparent',
                    color: 'var(--color-text-secondary)',
                    textDecoration: 'underline',
                    fontSize: '0.9rem'
                }}>
                    Sign Out
                </button>
                <button
                    onClick={() => setShowDeleteModal(true)}
                    className="btn"
                    style={{
                        width: '100%',
                        marginTop: '12px',
                        background: '#fee2e2',
                        border: '1px solid #f87171',
                        color: '#991b1b',
                        fontWeight: 600,
                        fontSize: '0.9rem'
                    }}
                >
                    Delete Account
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

                        {celebrateSession.notes && (
                            <div style={{
                                background: '#fef3c7',
                                border: '1px solid #fcd34d',
                                borderRadius: '8px',
                                padding: '12px',
                                marginBottom: '24px',
                                textAlign: 'left',
                                fontSize: '0.9rem'
                            }}>
                                <strong style={{ color: '#d97706', display: 'block', marginBottom: '4px' }}>Student Note:</strong>
                                "{celebrateSession.notes}"
                            </div>
                        )}

                        <div style={{ background: '#fffbeb', padding: '16px', borderRadius: '12px', marginBottom: '24px', border: '2px solid #fef3c7' }}>
                            <p style={{ fontSize: '0.85rem', color: '#92400e', marginBottom: '12px', fontWeight: 'bold' }}>
                                Send a reward to say "Great Job!"?
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <button
                                    onClick={() => { handleSendReward('break_15', !hasSentFreeGiftToday); setCelebrateSession(null); }}
                                    className="btn"
                                    style={{ background: 'white', border: '1px solid #d97706', color: '#d97706', fontSize: '0.8rem', padding: '8px' }}
                                >
                                    {hasSentFreeGiftToday ? '☕️ 15m ($1.99)' : '🎁 15m (Free!)'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Settings Modal (Toggle) */}
            <Modal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                title="Notifications"
            >
                <div style={{ padding: '8px' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '20px',
                        background: summariesEnabled ? '#fff7ed' : '#f9fafb',
                        borderRadius: '16px',
                        border: summariesEnabled ? '2px solid var(--color-primary)' : '1px solid #e5e7eb',
                        transition: 'all 0.3s ease'
                    }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#333' }}>Daily AI Summary</div>
                            <div style={{ fontSize: '0.82rem', color: '#888', marginTop: '4px' }}>
                                {summariesEnabled ? 'Get an AI-powered summary of your student\'s day' : 'Summaries are off'}
                            </div>
                        </div>
                        <div
                            onClick={toggleSummaries}
                            style={{
                                width: '52px', height: '28px',
                                borderRadius: '14px',
                                background: summariesEnabled ? 'var(--color-primary)' : '#d1d5db',
                                cursor: 'pointer',
                                position: 'relative',
                                transition: 'background 0.3s ease',
                                flexShrink: 0
                            }}
                        >
                            <div style={{
                                width: '22px', height: '22px',
                                borderRadius: '50%',
                                background: 'white',
                                position: 'absolute',
                                top: '3px',
                                left: summariesEnabled ? '27px' : '3px',
                                transition: 'left 0.3s ease',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                            }} />
                        </div>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '12px', textAlign: 'center' }}>
                        When enabled, an AI summary appears on your dashboard each day.
                    </p>
                </div>
                <div style={{ marginTop: '20px' }}>
                    <button onClick={() => setShowSettings(false)} className="btn btn-primary" style={{ width: '100%' }}>
                        Done
                    </button>
                </div>
            </Modal>

            {/* Feedback Modal */}
            <Modal
                isOpen={showFeedback}
                onClose={() => { setShowFeedback(false); setFeedbackSent(false); }}
                title="Send Feedback"
            >
                {feedbackSent ? (
                    <div style={{ textAlign: 'center', padding: '24px' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>✅</div>
                        <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>Thank you!</p>
                        <p style={{ color: '#666', fontSize: '0.9rem' }}>Your feedback has been recorded.</p>
                    </div>
                ) : (
                    <div>
                        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '16px' }}>
                            Let us know how we can improve Study Budy!
                        </p>
                        <textarea
                            value={feedbackText}
                            onChange={e => setFeedbackText(e.target.value)}
                            placeholder="What's on your mind?"
                            rows={4}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '12px',
                                border: '1px solid #ddd',
                                fontSize: '0.95rem',
                                resize: 'vertical',
                                fontFamily: 'inherit'
                            }}
                        />
                        <button
                            onClick={handleSubmitFeedback}
                            disabled={feedbackSending || !feedbackText.trim()}
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '12px', opacity: feedbackSending || !feedbackText.trim() ? 0.5 : 1 }}
                        >
                            {feedbackSending ? 'Sending...' : 'Submit Feedback'}
                        </button>
                    </div>
                )}
            </Modal>

            {/* Delete Account Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Delete Account?"
                type="danger"
                actions={
                    <>
                        <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                        <button
                            className="btn"
                            style={{ background: '#dc2626', color: 'white' }}
                            onClick={async () => {
                                await deleteAccount();
                            }}
                        >
                            Confirm Delete
                        </button>
                    </>
                }
            >
                <p><strong>Warning: This action is permanent!</strong></p>
                <p style={{ marginTop: '12px' }}>
                    Deleting your account will remove your parent profile and unlink from your student.
                </p>
            </Modal>

            {/* Where is my Student ID? Modal */}
            <Modal
                isOpen={showWhereIsId}
                onClose={() => setShowWhereIsId(false)}
                title="Finding the Student ID"
            >
                <div style={{ textAlign: 'center', padding: '16px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🔍</div>
                    <div style={{ textAlign: 'left', lineHeight: 1.8 }}>
                        <p style={{ marginBottom: '12px', fontWeight: 600 }}>On your student's phone:</p>
                        <ol style={{ paddingLeft: '20px', color: '#555' }}>
                            <li>Open <strong>Study Budy</strong></li>
                            <li>Go to <strong>Settings</strong> (bottom of dashboard)</li>
                            <li>Scroll to the <strong>Account</strong> section</li>
                            <li>Copy the <strong>Student ID</strong> or tap <strong>Invite Parent</strong></li>
                        </ol>
                    </div>
                    <div style={{
                        marginTop: '20px',
                        padding: '16px',
                        background: '#f0f9ff',
                        borderRadius: '12px',
                        border: '1px solid #bae6fd'
                    }}>
                        <p style={{ fontSize: '0.85rem', color: '#0369a1', fontWeight: 600 }}>
                            📹 Video walkthrough coming soon!
                        </p>
                    </div>
                </div>
                <div style={{ marginTop: '16px', textAlign: 'right' }}>
                    <button onClick={() => setShowWhereIsId(false)} className="btn btn-primary" style={{ width: '100%' }}>
                        Got it!
                    </button>
                </div>
            </Modal>

            {/* Full History Modal */}
            <Modal
                isOpen={showFullHistory}
                onClose={() => setShowFullHistory(false)}
                title="Activity History"
            >
                <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'grid', gap: '8px' }}>
                    {activityFeed.map((item: any, i) => {
                        if (item.type === 'session') {
                            const session = item.data;
                            const cls = childClasses.find(c => c.id === session.classId);
                            return (
                                <div key={i} style={{
                                    display: 'flex', flexDirection: 'column', gap: '4px',
                                    padding: '12px',
                                    background: '#fff7ed',
                                    borderRadius: '12px',
                                    border: '1px solid #fed7aa'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '32px', height: '32px', borderRadius: '50%',
                                                background: cls?.color || '#eee',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: 'bold', fontSize: '0.9rem',
                                                color: 'white'
                                            }}>
                                                {cls?.name.substring(0, 1) || '?'}
                                            </div>
                                            <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                                                {cls?.name || 'Unknown Class'}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                                            {session.durationMinutes}m
                                        </div>
                                    </div>
                                    {session.notes && (
                                        <div style={{
                                            fontSize: '0.85rem', background: '#fef3c7',
                                            padding: '8px', borderRadius: '8px', marginTop: '4px',
                                            fontStyle: 'italic', color: '#92400e'
                                        }}>
                                            "{session.notes}"
                                        </div>
                                    )}
                                    <div style={{ fontSize: '0.75rem', color: '#999', textAlign: 'right', marginTop: '4px' }}>
                                        {new Date(session.timestamp).toLocaleDateString()} {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            );
                        } else {
                            const g = item.data;
                            const isCoins = g.gift_type === 'coins';
                            const isTime = g.gift_type === 'game_time';
                            return (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '12px',
                                    background: '#f0fdf4',
                                    borderRadius: '12px',
                                    border: '1px solid #bbf7d0'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ fontSize: '1.5rem' }}>🎁</div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                                Sent {isCoins ? 'Coins' : (isTime ? 'Game Time' : 'Character')}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                                {isCoins ? `${g.amount} coins` : (isTime ? `${g.amount}m` : 'Rare Unlock')}
                                            </div>
                                        </div>
                                    </div>
                                    {g.thanked ? (
                                        <div style={{
                                            background: '#dcfce7', color: '#166534',
                                            padding: '4px 8px', borderRadius: '8px',
                                            fontSize: '0.75rem', fontWeight: 800
                                        }}>
                                            Thanked! ❤️
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '0.75rem', color: '#999' }}>Sent</div>
                                    )}
                                </div>
                            );
                        }
                    })}
                </div>
            </Modal>

            {/* Link Success Overlay with Confetti */}
            {showLinkSuccess && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0,
                    width: '100vw', height: '100vh',
                    zIndex: 9999,
                    background: 'linear-gradient(180deg, #fff5ee 0%, #ffe4d4 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                }}>
                    {/* Confetti pieces */}
                    {Array.from({ length: 50 }).map((_, i) => (
                        <div
                            key={i}
                            style={{
                                position: 'absolute',
                                top: '-10px',
                                left: `${Math.random() * 100}%`,
                                width: `${8 + Math.random() * 8}px`,
                                height: `${8 + Math.random() * 8}px`,
                                background: ['#f43f5e', '#fb923c', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'][i % 7],
                                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                                animation: `confetti-fall ${2 + Math.random() * 3}s ease-in forwards`,
                                animationDelay: `${Math.random() * 1.5}s`,
                                transform: `rotate(${Math.random() * 360}deg)`
                            }}
                        />
                    ))}
                    <img
                        src="/assets/avatar_golden_munchkin.png"
                        alt="Connected!"
                        style={{
                            width: '200px',
                            height: '200px',
                            objectFit: 'contain',
                            imageRendering: 'pixelated',
                            animation: 'splash-bounce 1.5s ease-in-out infinite',
                            filter: 'drop-shadow(0 12px 32px rgba(255, 126, 54, 0.4))'
                        }}
                    />
                    <p style={{
                        marginTop: '28px',
                        fontSize: '1.4rem',
                        fontWeight: 800,
                        color: '#E84545',
                        animation: 'splash-fade 1.5s ease-in-out infinite'
                    }}>Connected! 🎉</p>
                    <style jsx>{`
                        @keyframes confetti-fall {
                            0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                        }
                        @keyframes splash-bounce {
                            0%, 100% { transform: scale(1); }
                            50% { transform: scale(1.06); }
                        }
                        @keyframes splash-fade {
                            0%, 100% { opacity: 0.7; }
                            50% { opacity: 1; }
                        }
                    `}</style>
                </div>
            )}
        </main >
    );
}
