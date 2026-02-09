'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { App as CapApp, URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Browser } from '@capacitor/browser';

// --- Types ---
export type ClassItem = {
    id: string;
    name: string;
    weeklyGoalMinutes: number;
    color: string;
    isArchived?: boolean;
};

// ... ScheduleItem ...
export type ScheduleItem = {
    id: string;
    day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
    startTime: string;
    endTime: string;
    type: 'class' | 'study' | 'study_manual' | 'extracurricular' | 'sleep' | 'block';
    label?: string;
    classId?: string;
    isRecurring?: boolean;
    specificDate?: string;
    startDate?: string;
    color?: string;
};

// ... StudySession ...
export type StudySession = {
    id: string;
    classId: string;
    durationMinutes: number;
    timestamp: number;
    pointsEarned: number;
    userId?: string;
    notes?: string;
};

type AppState = {
    classes: ClassItem[];
    schedule: ScheduleItem[];
    studySessions: StudySession[];
    points: number;
    inventory: string[];
    equippedAvatar: string;
    isOnboarded: boolean;
    sleepSettings?: {
        enabled: boolean;
        start: string;
        end: string;
    };
    notifications: {
        studyBreaksEnabled: boolean;
        classRemindersEnabled: boolean;
    };
    zenMode: boolean;
    isPremium: boolean;
    musicEnabled?: boolean;
    // 4096 Game State
    game4096?: {
        grid: number[][];
        score: number;
        gameOver: boolean;
        won: boolean;
    } | null;
    // Break Timer Global State
    breakTimer: {
        isActive: boolean;
        endTime: number | null; // Timestamp
        hasClaimedAd: boolean;
    };
    // Game Time Bank (Persistent)
    gameTimeBank: number;
    // Persist active session during breaks
    activeSession: {
        classId: string;
        elapsedSeconds: number;
    } | null;
    // High Scores
    highScores: Record<string, number>;
    role: 'student' | 'parent';
    isRoleSet: boolean; // True if role is saved in DB, false if using default
    linkedUserId?: string;
    lastRefreshed?: number;
    notificationTier: 'none' | 'summary' | 'all';
    // Character Tier Credits (Consumable)
    characterCredits: {
        legendary: number;
        epic: number;
        rare: number;
    };
};

type AppContextType = {
    state: AppState;
    user: User | null;
    isLoading: boolean;
    addClass: (cls: ClassItem) => Promise<void>;
    updateClass: (cls: ClassItem) => Promise<void>;
    removeClass: (id: string) => Promise<void>;
    addScheduleItem: (item: ScheduleItem) => Promise<void>;
    replaceClassSchedule: (classId: string, newItems: ScheduleItem[]) => Promise<void>;
    clearSchedule: () => Promise<void>;
    clearStudySchedule: () => Promise<void>;
    removeScheduleItem: (id: string) => Promise<void>;
    updateScheduleItem: (item: ScheduleItem) => Promise<void>;
    recordSession: (session: StudySession) => Promise<void>;
    addPoints: (amount: number) => Promise<void>;
    removePoints: (amount: number) => Promise<void>;
    buyItem: (itemName: string, cost: number) => Promise<void>;
    redeemCharacterCredit: (tier: 'legendary' | 'epic' | 'rare', itemName: string) => Promise<void>;
    equipAvatar: (avatarName: string) => Promise<void>;
    completeOnboarding: (role?: 'student' | 'parent') => Promise<void>;
    updateSleepSettings: (settings: { enabled: boolean; start: string; end: string }) => Promise<void>;
    updateSettings: (settings: { sleepSettings?: AppState['sleepSettings']; notifications?: AppState['notifications']; zenMode?: boolean; musicEnabled?: boolean; notificationTier?: 'none' | 'summary' | 'all' }) => Promise<void>;
    scheduleStudyNotification: (minutes: number) => Promise<void>;
    cancelStudyNotification: () => Promise<void>;
    testNotification: () => Promise<void>;
    resetData: () => Promise<void>;
    signOut: () => Promise<void>;
    refreshData: () => Promise<void>;
    resetClassProgress: (classId: string) => Promise<void>;
    archiveAllClasses: () => Promise<void>;
    scheduleClassReminders: (minutesBefore: number) => Promise<void>;
    cancelClassReminders: () => Promise<void>;
    goPremium: () => Promise<void>;
    deleteAccount: () => Promise<void>;
    startBreak: (durationMinutes: number) => void;
    endBreak: () => void;
    updateGame4096: (gameState: AppState['game4096']) => void;
    extendBreak: (minutes: number) => void;
    saveActiveSession: (classId: string, elapsedSeconds: number) => void;
    clearActiveSession: () => void;
    updateHighScore: (gameId: string, score: number) => void;
    submitGameScore: (gameId: string, score: number) => Promise<number | null>; // Returns rank if on leaderboard, null otherwise
    claimPendingGifts: () => Promise<{ coins: number; gameMinutes: number; senderName: string; giftCredits?: { legendary: number; epic: number; rare: number } } | null>; // Claims any pending gifts
    consumeGameTime: (minutes: number) => Promise<void>; // Decrement Game Bank
};

const initialState: AppState = {
    classes: [],
    schedule: [],
    studySessions: [],
    points: 0,
    inventory: ['Default Cat'], // Default unlocked
    equippedAvatar: 'Default Cat',
    isOnboarded: false,
    sleepSettings: { enabled: false, start: '23:00', end: '07:00' },
    notifications: { studyBreaksEnabled: true, classRemindersEnabled: true },
    zenMode: false,
    isPremium: false,
    breakTimer: { isActive: false, endTime: null, hasClaimedAd: false },
    gameTimeBank: 0,
    game4096: null,
    activeSession: null,
    highScores: {},
    role: 'student',
    isRoleSet: false,
    linkedUserId: undefined,
    lastRefreshed: 0,
    notificationTier: 'summary',
    characterCredits: {
        legendary: 0,
        epic: 0,
        rare: 0
    }
};


const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AppState>(initialState);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const isMounted = useRef(false);
    const lastFetchedUserId = useRef<string | null>(null);
    const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
    const CACHE_KEY_PREFIX = 'study_budy_cache_v3_'; // Bumped version to force refresh
    const router = useRouter(); // Define router

    // 1. Auth & Initial Load
    useEffect(() => {
        isMounted.current = true;

        // Native Deep Link Handling
        if (Capacitor.isNativePlatform()) {
            import('@/lib/admob').then(({ AdMobService }) => {
                AdMobService.initialize();
            });

            // Initialize IAP
            import('@/lib/iap').then(({ initializeIAP }) => {
                initializeIAP();
            });

            CapApp.addListener('appUrlOpen', async (event: URLOpenListenerEvent) => {
                if (event.url.includes('google-auth')) {
                    // Supabase sends tokens in the hash or query
                    const url = new URL(event.url);
                    const hash = url.hash.substring(1); // remove #
                    const query = url.search.substring(1); // remove ?
                    const params = new URLSearchParams(hash || query);

                    const access_token = params.get('access_token');
                    const refresh_token = params.get('refresh_token');
                    const errorChar = params.get('error_description');

                    if (errorChar) {
                        try { await Browser.close(); } catch (e) { }
                        setTimeout(() => {
                            alert(`Login Error: ${decodeURIComponent(errorChar)}`);
                        }, 500);
                        return;
                    }

                    if (access_token && refresh_token) {
                        try {
                            // Attempt to close browser immediately
                            await Browser.close();
                        } catch (e) { console.log('Browser close error (ignored):', e); }

                        const { error } = await supabase.auth.setSession({
                            access_token,
                            refresh_token
                        });

                        if (!error) {
                            // Session set successfully
                            console.log('[DeepLink] Session set, redirecting to Dashboard...');
                            // Force hard reload or router replace? Router replace is smoother.
                            router.replace('/dashboard');
                        } else {
                            console.error('[DeepLink] Failed to set session:', error);
                            // Retry close just in case
                            setTimeout(() => Browser.close().catch(() => { }), 500);
                        }
                    }
                }
            });
        }
        // ... remaining code ...

        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setUser(session?.user || null);

            if (session?.user) {
                if (lastFetchedUserId.current !== session.user.id) {
                    lastFetchedUserId.current = session.user.id;
                    await loadRemoteData(session.user.id);
                }
            } else {
                loadLocalData();
            }
            setIsLoading(false);
        };

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                setUser(session.user);
                if (lastFetchedUserId.current !== session.user.id) {
                    lastFetchedUserId.current = session.user.id;
                    setIsLoading(true); // Show loading while fetching
                    await loadRemoteData(session.user.id);
                    setIsLoading(false);
                }
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                lastFetchedUserId.current = null;
                loadLocalData(); // Fallback to local
                setIsLoading(false);
            }
        });

        init();

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);




    // 2. Loaders
    const loadLocalData = () => {
        const saved = localStorage.getItem('study_budy_data');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setState({ ...initialState, ...parsed });
            } catch (e) {
                console.error('Local data parse error', e);
            }
        }
    };

    const loadRemoteData = async (userId: string, forceRefresh: boolean = false) => {
        // Default to loading ONLY if we don't find cache
        if (forceRefresh) setIsLoading(true);

        // 1. Try Cache First (if not forcing refresh)
        if (!forceRefresh) {
            try {
                const cacheKey = CACHE_KEY_PREFIX + userId;
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const { timestamp, data } = JSON.parse(cached);
                    // SWR: Always use cache if available for immediate display
                    if (data) {
                        console.log(`[AppContext] Cache Found. Displaying immediately.`);
                        setState({ ...initialState, ...data });
                        setIsLoading(false); // <--- Hides spinner immediately

                        // Check freshness to decide if we stop or revalidate
                        const age = Date.now() - timestamp;
                        if (age < CACHE_DURATION) {
                            console.log(`[AppContext] Cache is fresh (${Math.round(age / 1000)}s). Skipping background fetch.`);
                            return; // Exit early
                        }
                        console.log(`[AppContext] Cache is stale (${Math.round(age / 1000)}s). Revalidating in background...`);
                    }
                }
            } catch (e) {
                console.warn('[AppContext] Cache parse error', e instanceof Error ? e.message : JSON.stringify(e, null, 2));
            }
        }

        // 2. Fetch from DB (Cache Miss or Revalidation)
        // Only set loading if we haven't already shown cached data
        // We know we haven't returned, so we are here. 
        // If isLoading was set to false by cache, don't set it to true again (prevents flashing).
        // Check current loading state? setState is async. 
        // Safer: If we didn't hit cache return, we proceed. 
        // If we displayed cache, we don't want spinner. 
        // But we didn't track that locally in a var.
        // Let's just trust that if we are revalidating, we don't want spinner.

        // Correct Logic:
        // We can't easily check 'state' here inside the function.
        // We'll rely on our code path.
        // If we fell through:
        // Case A: Cache Hit (Stale) -> setIsLoading(false) called. 
        // Case B: No Cache -> setIsLoading(true) should be called?

        // Refactored flow:
        // We removed 'setIsLoading(true)' from top. We need it for Case B.


        // 2. Fetch from DB (Cache Miss or Stale)

        // 2. Fetch from DB
        // If we didn't show cache (we can't easily check react state sync, so let's check localstorage again or just assume?)
        // Better: We did 'setIsLoading(false)' if cache found. 
        // If we are here, we either showed cache (stale) OR we have no cache.
        // If we have no cache, we should show spinner.

        const hasCache = !forceRefresh && !!localStorage.getItem(CACHE_KEY_PREFIX + userId);
        if (!hasCache) setIsLoading(true);

        // Safety Timeout: If DB fetch hangs for 10s, stop loading to allow UI to show (likely empty/offline)
        const safetyTimeout = setTimeout(() => {
            if (isLoading) {
                console.warn('[AppContext] Data fetch timed out (10s). forcing loading false.');
                setIsLoading(false);
            }
        }, 10000);

        // Helper for individual fetches to prevent one failure blocking others
        const fetchTable = async (table: string, query: any) => {
            try {
                // console.log(`[AppContext] Fetching ${table}...`);
                const { data, error } = await query;
                if (error) {
                    console.error(`[AppContext] Supabase Error on ${table}:`, JSON.stringify(error, null, 2));
                    // throw error; // Don't throw, just return null so other fetches can succeed
                    return null;
                }
                // console.log(`[AppContext] ${table} loaded. Rows:`, data?.length);
                return data;
            } catch (e: any) {
                console.error(`[AppContext] ${table} EXCEPTION:`, e);
                return null;
            }
        };

        try {
            // Execute in parallel
            // Fetch Profile as array (limit 1) to avoid .single() 406 error on missing rows
            const [profileData, classes, schedule, sessions] = await Promise.all([
                fetchTable('Profile', supabase.from('profiles').select('*').eq('id', userId).limit(1)),
                fetchTable('Classes', supabase.from('classes').select('*').eq('user_id', userId)),
                fetchTable('Schedule', supabase.from('schedule_items').select('*').eq('user_id', userId)),
                fetchTable('Sessions', supabase.from('study_sessions').select('*').eq('user_id', userId))
            ]);

            const profile = profileData && profileData.length > 0 ? profileData[0] : null;

            console.log('[AppContext] Loaded Remote Data (Count):', {
                profile: profile ? 'Found' : 'Null',
                classes: classes?.length || 0,
                schedule: schedule?.length || 0,
                sessions: sessions?.length || 0
            });

            // Map DB structure to AppState (safely handling nulls)
            const newState: AppState = {
                classes: (classes as any[])?.map(c => ({
                    id: c.id,
                    name: c.name,
                    weeklyGoalMinutes: c.weekly_goal_minutes,
                    color: c.color,
                    isArchived: c.is_archived
                })) || [],
                schedule: (schedule as any[])?.map(s => {
                    // Debug individual item mapping if needed
                    // console.log('Mapping schedule item:', s);
                    return {
                        id: s.id,
                        day: s.day as any,
                        startTime: s.start_time,
                        endTime: s.end_time,
                        type: s.type as any,
                        label: s.label,
                        classId: s.class_id,
                        isRecurring: s.is_recurring,
                        specificDate: s.specific_date,
                        startDate: s.start_date,
                        color: s.color
                    };
                }) || [],
                studySessions: (sessions as any[])?.map(s => ({
                    id: s.id,
                    classId: s.class_id,
                    durationMinutes: s.duration_minutes,
                    pointsEarned: s.points_earned,
                    timestamp: new Date(s.created_at).getTime(),
                    notes: s.notes // Map notes field
                })) || [],
                points: (profile as any)?.points || 0,
                inventory: (profile as any)?.inventory || [],
                equippedAvatar: (profile as any)?.equipped_avatar || 'Default Dog',
                isOnboarded: (profile as any)?.is_onboarded || false,
                sleepSettings: (profile as any)?.sleep_settings || initialState.sleepSettings,
                notifications: (profile as any)?.notifications || initialState.notifications,
                zenMode: (profile as any)?.zen_mode || initialState.zenMode,
                isPremium: (profile as any)?.is_premium || false,
                breakTimer: initialState.breakTimer,
                gameTimeBank: (profile as any)?.game_time_bank || 0, // Load from DB
                game4096: null,
                activeSession: null,
                highScores: {},
                role: (profile as any)?.role || 'student',
                isRoleSet: !!((profile as any)?.role),
                linkedUserId: (profile as any)?.linked_user_id || undefined,
                notificationTier: (profile as any)?.notification_tier || 'summary',
                characterCredits: {
                    legendary: (profile as any)?.tier_legendary_credits || 0,
                    epic: (profile as any)?.tier_epic_credits || 0,
                    rare: (profile as any)?.tier_rare_credits || 0
                }
            };

            // Restore activeSession from local storage explicitly if we are overwriting state
            const savedLocal = localStorage.getItem('study_budy_data');
            if (savedLocal) {
                try {
                    const parsed = JSON.parse(savedLocal);
                    if (parsed.activeSession) {
                        newState.activeSession = parsed.activeSession;
                    }
                    if (parsed.highScores) {
                        newState.highScores = parsed.highScores;
                    }
                } catch (e) { }
            }

            // console.log('[AppContext] New State Set:', newState);
            setState(newState);

            // Only cache if NO errors occurred (all fetches returned valid data or empty arrays, but not null from catch)
            // But fetchTable returns null on error. 
            // Profile returning null might be valid (first login). 
            // Classes/Schedule returning null is an error.
            const anyErrors = classes === null || schedule === null || sessions === null;

            if (!anyErrors) {
                const cacheData = {
                    classes: newState.classes,
                    schedule: newState.schedule,
                    studySessions: newState.studySessions,
                    points: newState.points,
                    inventory: newState.inventory,
                    equippedAvatar: newState.equippedAvatar,
                    isOnboarded: newState.isOnboarded, // Added missing property
                    isRoleSet: newState.isRoleSet,
                    sleepSettings: newState.sleepSettings,
                    activeSession: newState.activeSession,
                    highScores: newState.highScores,
                    timestamp: Date.now()
                };
                localStorage.setItem(CACHE_KEY_PREFIX + userId, JSON.stringify(cacheData));
            } else {
                console.warn('[AppContext] Skipping cache update due to fetch errors.');
            }

        } catch (error) {
            console.error('Error loading remote data (critical):', error);

        } finally {
            clearTimeout(safetyTimeout);
            // Ensure loading stops no matter what
            setIsLoading(false);

            // Update lastRefreshed to signal listeners
            if (forceRefresh) {
                setState(prev => ({ ...prev, lastRefreshed: Date.now() }));
            }
        }
    };

    const migrateGuestData = async (userId: string, localState: AppState) => {
        // Upsert Profile
        await supabase.from('profiles').upsert({
            id: userId,
            points: localState.points,
            inventory: localState.inventory,
            equipped_avatar: localState.equippedAvatar,
            sleep_settings: localState.sleepSettings,
            is_onboarded: localState.isOnboarded,
            game_time_bank: localState.gameTimeBank // Migrate bank
        });

        // Insert Classes
        if (localState.classes.length > 0) {
            const classesToInsert = localState.classes.map(c => ({
                id: c.id, // Keep UUID
                user_id: userId,
                name: c.name,
                weekly_goal_minutes: c.weeklyGoalMinutes,
                color: c.color
            }));
            await supabase.from('classes').upsert(classesToInsert);
        }

        // Insert Schedule
        if (localState.schedule.length > 0) {
            const scheduleToInsert = localState.schedule.map(s => ({
                id: s.id,
                user_id: userId,
                day: s.day,
                start_time: s.startTime,
                end_time: s.endTime,
                type: s.type,
                label: s.label,
                class_id: s.classId || null, // handle optional
                is_recurring: s.isRecurring,
                specific_date: s.specificDate,
                start_date: s.startDate,
                color: s.color
            }));
            await supabase.from('schedule_items').upsert(scheduleToInsert);
        }

        // Insert Sessions
        if (localState.studySessions.length > 0) {
            const sessionsToInsert = localState.studySessions.map(s => ({
                id: s.id,
                user_id: userId,
                class_id: s.classId,
                duration_minutes: s.durationMinutes,
                points_earned: s.pointsEarned,
                created_at: new Date(s.timestamp).toISOString(),
                notes: s.notes // Include notes in migration
            }));
            await supabase.from('study_sessions').upsert(sessionsToInsert);
        }
    };


    // 3. Modifiers (Optimistic UI + Async Sync)
    // Helper to sync specific changes if user is logged in
    // Else sync entire state to LocalStorage (Guest)
    // AND: Sync to Cache if logged in (for next load)
    useEffect(() => {
        if (!isLoading) {
            if (user) {
                // Logged In: Save to User Cache
                const cacheKey = CACHE_KEY_PREFIX + user.id;
                const cacheData = {
                    timestamp: Date.now(),
                    data: state
                };
                localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            } else {
                // Guest: Save to Guest Data
                localStorage.setItem('study_budy_data', JSON.stringify(state));
            }
        }
    }, [state, user, isLoading]);


    // --- Actions ---

    const addClass = async (cls: ClassItem) => {
        console.log('[AppContext] addClass called:', cls);
        setState(prev => ({ ...prev, classes: [...prev.classes, cls] }));

        if (user) {
            console.log('[AppContext] User exists, saving to Supabase:', user.id);
            const { data, error } = await supabase.from('classes').insert({
                id: cls.id, user_id: user.id, name: cls.name, weekly_goal_minutes: cls.weeklyGoalMinutes, color: cls.color
            }).select(); // Select forces return of data/error immediately

            if (error) {
                console.error('[AppContext] Supabase insert error:', error);
                alert(`Error saving class: ${error.message}`);
            } else if (!data || data.length === 0) {
                console.error('[AppContext] Insert succeeded but returned no data. RLS blocking?');
                alert('Database Security blocked this save! \n\nPlease run the "supabase_schema.sql" script in your Supabase SQL Editor.');
            } else {
                console.log('[AppContext] Class saved to Supabase:', data);
            }
        } else {
            console.warn('[AppContext] No user logged in, skipping Supabase save');
        }
    };

    const updateClass = async (updatedCls: ClassItem) => {
        setState(prev => ({
            ...prev,
            classes: prev.classes.map(c => (c.id === updatedCls.id ? updatedCls : c)),
        }));
        if (user) {
            await supabase.from('classes').update({
                name: updatedCls.name, weekly_goal_minutes: updatedCls.weeklyGoalMinutes, color: updatedCls.color
            }).eq('id', updatedCls.id).then(({ error }) => {
                if (error) console.error(error);
            });
        }
    };

    const removeClass = async (id: string) => {
        // Soft Delete: Mark as archived
        setState(prev => ({
            ...prev,
            classes: prev.classes.map(c => c.id === id ? { ...c, isArchived: true } : c),
            // Remove from schedule locally
            schedule: prev.schedule.filter(s => s.classId !== id && s.label !== prev.classes.find(c => c.id === id)?.name)
        }));

        if (user) {
            // 1. Mark class as archived
            await supabase.from('classes').update({ is_archived: true }).eq('id', id).then(({ error }) => {
                if (error) console.error('Error archiving class:', error);
            });

            // 2. Delete future/current schedule items for this class to clean up calendar
            // We can delete by class_id
            await supabase.from('schedule_items').delete().eq('class_id', id).then(({ error }) => {
                if (error) console.error('Error removing schedule items for archived class:', error);
            });

            // Also try to delete items by label just in case (legacy) - optional but good for consistency
            // const cls = state.classes.find(c => c.id === id);
            // if (cls) {
            //    await supabase.from('schedule_items').delete().eq('label', cls.name).then(...)
            // }
        }
    };

    const archiveAllClasses = async () => {
        console.log('[AppContext] Archiving all classes...');
        const activeClasses = state.classes.filter(c => !c.isArchived);

        // Optimistic Update
        setState(prev => ({
            ...prev,
            classes: prev.classes.map(c => ({ ...c, isArchived: true })),
            schedule: prev.schedule.filter(s => s.type !== 'class') // Remove all class schedule items
        }));

        if (user) {
            // 1. Bulk Update Classes
            await supabase.from('classes').update({ is_archived: true }).eq('user_id', user.id);

            // 2. Bulk Delete Schedule Items (only type='class' or linked to classes)
            // Ideally we delete where class_id is not null OR type is 'class'
            await supabase.from('schedule_items').delete().eq('user_id', user.id).eq('type', 'class');
        }
    };

    const addScheduleItem = async (item: ScheduleItem) => {
        setState(prev => ({ ...prev, schedule: [...prev.schedule, item] }));
        if (user) {
            const { error } = await supabase.from('schedule_items').insert({
                id: item.id, user_id: user.id, day: item.day, start_time: item.startTime, end_time: item.endTime,
                type: item.type, label: item.label, class_id: item.classId, is_recurring: item.isRecurring,
                specific_date: item.specificDate, start_date: item.startDate, color: item.color
            }).select(); // Force Select

            if (error) console.error(error);
        }
    };

    const replaceClassSchedule = async (classId: string, newItems: ScheduleItem[]) => {
        // This is tricky. Delete old items, insert new ones.
        setState(prev => {
            const cls = prev.classes.find(c => c.id === classId);
            const className = cls ? cls.name : '';
            const filteredSchedule = prev.schedule.filter(s => s.classId !== classId && (className ? s.label !== className : true));
            return { ...prev, schedule: [...filteredSchedule, ...newItems] };
        });

        if (user) {
            // Transaction-like: Delete where classId = id, then insert?
            // Or delete where label matches? The DB schema links via class_id mostly.
            // Let's assume class_id is sufficient for new items.
            // For legacy label matching, might need extra query.
            const doSync = async () => {
                console.log(`[AppContext] Replacing schedule for class ${classId}. New items:`, newItems.length);

                const deleteRes = await supabase.from('schedule_items').delete().eq('class_id', classId);
                if (deleteRes.error) {
                    console.error('[AppContext] Error deleting old schedule items:', deleteRes.error);
                } else {
                    console.log('[AppContext] Deleted old items.');
                }

                const itemsToInsert = newItems.map(item => ({
                    id: item.id, user_id: user.id, day: item.day, start_time: item.startTime, end_time: item.endTime,
                    type: item.type, label: item.label, class_id: item.classId, is_recurring: item.isRecurring,
                    specific_date: item.specificDate, start_date: item.startDate, color: item.color
                }));

                if (itemsToInsert.length > 0) {
                    const insertRes = await supabase.from('schedule_items').insert(itemsToInsert).select();
                    if (insertRes.error) {
                        console.error('[AppContext] Error inserting new schedule items:', insertRes.error);
                        alert(`Error saving schedule: ${insertRes.error.message}`);
                    } else if (!insertRes.data || insertRes.data.length === 0) {
                        console.error('[AppContext] Schedule insert returned no data. RLS Blocking?');
                        alert('Schedule not saved! Database Security blocked it. Please run the SQL script.');
                    } else {
                        console.log('[AppContext] Schedule saved successfully:', insertRes.data.length, 'items');
                    }
                }
            };
            await doSync().catch(err => console.error('[AppContext] Critical error in replaceClassSchedule:', err));
        }
    };

    const clearSchedule = async () => {
        setState(prev => ({ ...prev, schedule: [] }));
        if (user) {
            await supabase.from('schedule_items').delete().eq('user_id', user.id).then(({ error }) => {
                if (error) console.error(error);
            });
        }
    };

    const clearStudySchedule = async () => {
        setState(prev => ({ ...prev, schedule: prev.schedule.filter(s => s.type !== 'study') }));
        if (user) {
            await supabase.from('schedule_items').delete().eq('user_id', user.id).eq('type', 'study').then(({ error }) => {
                if (error) console.error(error);
            });
        }
    };

    const removeScheduleItem = async (id: string) => {
        setState(prev => ({ ...prev, schedule: prev.schedule.filter(s => s.id !== id) }));
        if (user) {
            await supabase.from('schedule_items').delete().eq('id', id).then(({ error }) => {
                if (error) console.error(error);
            });
        }
    };

    const updateScheduleItem = async (updatedItem: ScheduleItem) => {
        setState(prev => ({ ...prev, schedule: prev.schedule.map(s => s.id === updatedItem.id ? updatedItem : s) }));
        if (user) {
            await supabase.from('schedule_items').update({
                day: updatedItem.day, start_time: updatedItem.startTime, end_time: updatedItem.endTime,
                type: updatedItem.type, label: updatedItem.label, is_recurring: updatedItem.isRecurring,
                specific_date: updatedItem.specificDate, start_date: updatedItem.startDate, color: updatedItem.color
            }).eq('id', updatedItem.id).then(({ error }) => {
                if (error) console.error(error);
            });
        }
    };

    const recordSession = async (session: StudySession) => {
        console.log('[AppContext] recordSession called:', session);

        // NOTE: Game time accrual removed - earned time is now use-it-or-lose-it
        // Only gifted time persists in gameTimeBank

        // Updates sessions and points (NO gameTimeBank update)
        setState(prev => ({
            ...prev,
            studySessions: [...prev.studySessions, session],
            points: prev.points + session.pointsEarned
        }));

        if (user) {
            await supabase.from('study_sessions').insert({
                id: session.id, user_id: user.id, class_id: session.classId, duration_minutes: session.durationMinutes,
                points_earned: session.pointsEarned, created_at: new Date(session.timestamp).toISOString(),
                notes: session.notes
            });

            // Update Profile Points only (no game_time_bank)
            const { data: currentProfile } = await supabase.from('profiles').select('points').eq('id', user.id).single();
            const currentPoints = currentProfile?.points || 0;

            await supabase.from('profiles').update({
                points: currentPoints + session.pointsEarned
            }).eq('id', user.id);
        }
    };

    const addPoints = async (amount: number) => {
        // Optimistic UI Update
        const newPoints = state.points + amount;
        setState(prev => ({ ...prev, points: newPoints }));

        if (user) {
            // Try Secure RPC first
            const { error: rpcError } = await supabase.rpc('add_points', { amount });

            if (rpcError) {
                console.warn('[AppContext] Secure RPC failed (likely not installed), falling back to client-update:', rpcError.message);
                // Fallback: Client-side update (Legacy/Insecure)
                await supabase.from('profiles').update({ points: newPoints }).eq('id', user.id);
            }
        }
    };

    const removePoints = async (amount: number) => {
        // Same logic as addPoints (negative amount via RPC or manual)
        // Optimistic
        const newPoints = Math.max(0, state.points - amount);
        setState(prev => ({ ...prev, points: newPoints }));

        if (user) {
            const { error: rpcError } = await supabase.rpc('add_points', { amount: -amount });
            if (rpcError) {
                await supabase.from('profiles').update({ points: newPoints }).eq('id', user.id);
            }
        }
    };

    const consumeGameTime = async (minutes: number) => {
        // Don't allow negative values
        if (state.gameTimeBank < minutes) {
            console.warn('[AppContext] Attempted to consume more game time than available');
            return;
        }

        // Update local state
        setState(prev => ({ ...prev, gameTimeBank: Math.max(0, prev.gameTimeBank - minutes) }));

        // Persist to database
        if (user) {
            const { data: profile } = await supabase.from('profiles').select('game_time_bank').eq('id', user.id).single();
            if (profile) {
                const newBank = Math.max(0, profile.game_time_bank - minutes);
                await supabase.from('profiles').update({ game_time_bank: newBank }).eq('id', user.id);
            }
        }
    };

    const buyItem = async (itemName: string, cost: number) => {
        // Optimistic UI
        const newPoints = Math.max(0, state.points - cost);
        const newInventory = [...(state.inventory || []), itemName];
        setState(prev => ({ ...prev, points: newPoints, inventory: newInventory }));

        if (user) {
            // Try Secure RPC
            const { data, error: rpcError } = await supabase.rpc('purchase_item', { item_name: itemName, cost });

            if (rpcError) {
                console.warn('[AppContext] Secure RPC purchase failed, falling back:', rpcError.message);
                // Fallback
                await supabase.from('profiles').update({ points: newPoints, inventory: newInventory }).eq('id', user.id);
            } else if (data === false) {
                // RPC returned false (insufficient funds on server)
                // We should revert the optimistic update here!
                console.error('[AppContext] Secure Purchase Rejected by Server (Insufficient Funds)');
                // Revert state (fetch fresh)
                await refreshData();
                alert('Transaction Rejected: Insufficient Server-Side Funds. Stop hacking! 😉');
            }
        }
    };

    const redeemCharacterCredit = async (tier: 'legendary' | 'epic' | 'rare', itemName: string) => {
        const currentCredits = state.characterCredits[tier];
        if (currentCredits <= 0) {
            console.error('[AppContext] No credits to redeem');
            return;
        }

        const newCredits = { ...state.characterCredits, [tier]: currentCredits - 1 };
        const newInventory = [...(state.inventory || []), itemName];

        setState(prev => ({
            ...prev,
            characterCredits: newCredits,
            inventory: newInventory,
            equippedAvatar: itemName
        }));

        if (user) {
            const updates: any = {
                inventory: newInventory,
                equipped_avatar: itemName
            };
            if (tier === 'legendary') updates.tier_legendary_credits = newCredits.legendary;
            if (tier === 'epic') updates.tier_epic_credits = newCredits.epic;
            if (tier === 'rare') updates.tier_rare_credits = newCredits.rare;

            const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
            if (error) {
                console.error('[AppContext] Error redeeming credit:', error);
                await refreshData();
            }
        }
    };

    const equipAvatar = async (avatarName: string) => {
        setState(prev => ({ ...prev, equippedAvatar: avatarName }));
        if (user) {
            await supabase.from('profiles').update({ equipped_avatar: avatarName }).eq('id', user.id).then(({ error }) => {
                if (error) console.error(error);
            });
        }
    };

    const completeOnboarding = async (userRole?: 'student' | 'parent') => {
        console.log('[AppContext] completeOnboarding called with:', userRole);
        const finalRole = userRole || state.role || 'student';

        // Optimistic Update
        setState(prev => ({ ...prev, isOnboarded: true, role: finalRole, isRoleSet: true }));

        if (user) {
            console.log('[AppContext] Updating Supabase profile for user:', user.id);
            const { error } = await supabase.from('profiles').update({
                is_onboarded: true,
                role: finalRole
            }).eq('id', user.id);

            if (error) {
                console.error('[AppContext] Supabase Update Error:', error);
                throw error; // Throw so UI knows
            } else {
                console.log('[AppContext] Supabase Profile Updated Successfully.');
            }
        } else {
            console.warn('[AppContext] completeOnboarding called but NO USER found.');
        }
    };

    const updateSleepSettings = async (settings: { enabled: boolean; start: string; end: string }) => {
        // Wrapper for new generic method
        await updateSettings({ sleepSettings: settings });
    };

    const updateSettings = async (settings: { sleepSettings?: AppState['sleepSettings']; notifications?: AppState['notifications']; zenMode?: boolean }) => {
        setState(prev => {
            const next = { ...prev };
            if (settings.sleepSettings) next.sleepSettings = settings.sleepSettings;
            if (settings.notifications) next.notifications = settings.notifications;
            if (settings.zenMode !== undefined) next.zenMode = settings.zenMode;

            localStorage.setItem('study_budy_data', JSON.stringify({
                classes: next.classes,
                schedule: next.schedule,
                studySessions: next.studySessions,
                points: next.points,
                inventory: next.inventory,
                equippedAvatar: next.equippedAvatar,
                isOnboarded: next.isOnboarded,
                sleepSettings: next.sleepSettings,
                notifications: next.notifications,
                zenMode: next.zenMode,
                activeSession: next.activeSession
            }));

            return next;
        });

        if (settings.notifications?.studyBreaksEnabled || settings.notifications?.classRemindersEnabled) {
            try {
                const perm = await LocalNotifications.requestPermissions();
                if (perm.display !== 'granted') {
                    console.warn('Notification permission denied');
                }
            } catch (e) {
                console.error('Error requesting notification permissions:', e);
            }
        }

        if (user) {
            const updates: any = {};
            if (settings.sleepSettings) updates.sleep_settings = settings.sleepSettings;
            // Note: If we had a 'settings' column, we would update it here.
            // For now, notification settings are Local/Guest preferred or need schema update.
            // We'll trust LocalStorage/Cache for general persistence of preferences if DB column missing.

            if (Object.keys(updates).length > 0) {
                await supabase.from('profiles').update(updates).eq('id', user.id).then(({ error }) => {
                    if (error) console.error(error);
                });
            }
        }
    };

    const scheduleStudyNotification = async (minutes: number) => {
        // 1. Check State
        if (!state.notifications?.studyBreaksEnabled) {
            console.warn('[AppContext] Study Break Notifications disabled in settings, skipping schedule.');
            return;
        }

        try {
            // 2. Check Native Permissions
            let perm = await LocalNotifications.checkPermissions();
            if (perm.display !== 'granted') {
                perm = await LocalNotifications.requestPermissions();
                if (perm.display !== 'granted') {
                    console.warn('[AppContext] Notification permission not granted by OS.');
                    return;
                }
            }

            // 3. Schedule
            console.log(`[AppContext] Scheduling notification for ${minutes} minutes from now.`);
            await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });

            const endAt = new Date(Date.now() + minutes * 60 * 1000);
            await LocalNotifications.schedule({
                notifications: [{
                    id: 1001,
                    title: "Study Session Complete! 🎉",
                    body: "Time for a break. Great work!",
                    schedule: { at: endAt },
                    sound: 'beep.caf', // Default sound
                }]
            });
            console.log('[AppContext] Notification scheduled successfully for:', endAt.toLocaleTimeString());
        } catch (e) {
            console.error('[AppContext] Error scheduling notification:', e);
        }
    };

    const testNotification = async () => {
        console.log('[AppContext] Testing notification...');
        await scheduleStudyNotification(0.1); // 6 seconds
        alert('Test notification scheduled for 6 seconds from now. Please put the app in background!');
    };

    const cancelStudyNotification = async () => {
        try {
            await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
        } catch (e) { console.error(e); }
    };



    const scheduleClassReminders = async (minutesBefore: number) => {
        if (!state.notifications?.classRemindersEnabled) {
            console.warn('[AppContext] Notifications (Class) disabled, skipping class reminders.');
            return;
        }

        try {
            // Permission check
            let perm = await LocalNotifications.checkPermissions();
            if (perm.display !== 'granted') {
                perm = await LocalNotifications.requestPermissions();
                if (perm.display !== 'granted') return;
            }

            // Cancel existing class reminders (ids 10000+)
            const pending = await LocalNotifications.getPending();
            const classNotifs = pending.notifications.filter(n => n.id >= 10000);
            if (classNotifs.length > 0) {
                await LocalNotifications.cancel({ notifications: classNotifs });
            }

            const notifs = [];
            const dayMap: Record<string, number> = { 'Sun': 1, 'Mon': 2, 'Tue': 3, 'Wed': 4, 'Thu': 5, 'Fri': 6, 'Sat': 7 };

            // Iterate class schedule
            for (const item of state.schedule) {
                if (item.type !== 'class') continue;

                const [h, m] = item.startTime.split(':').map(Number);
                const classTime = new Date();
                classTime.setHours(h, m, 0, 0);

                // Subtract minutesBefore
                const remindTime = new Date(classTime.getTime() - minutesBefore * 60 * 1000);

                // Construct schedule object
                // Capacitor LocalNotifications schedule: { on: { weekday: n, hour: h, minute: m } }
                const weekday = dayMap[item.day];

                // Generate unique ID based on a hash of the item ID or random
                // Let's use a simple counter + offset
                const id = 10000 + Math.floor(Math.random() * 90000);

                notifs.push({
                    id: id,
                    title: `Upcoming Class: ${item.label}`,
                    body: `Class starts in ${minutesBefore} minutes!`,
                    schedule: {
                        on: {
                            weekday: weekday,
                            hour: remindTime.getHours(),
                            minute: remindTime.getMinutes()
                        }
                    },
                    sound: 'beep.caf',
                    extra: { classId: item.classId }
                });
            }

            if (notifs.length > 0) {
                await LocalNotifications.schedule({ notifications: notifs });
                console.log(`[AppContext] Scheduled ${notifs.length} class reminders.`);
            }

        } catch (e) {
            console.error('[AppContext] Error scheduling class reminders:', e);
        }
    };

    const cancelClassReminders = async () => {
        try {
            const pending = await LocalNotifications.getPending();
            const classNotifs = pending.notifications.filter(n => n.id >= 10000);
            if (classNotifs.length > 0) {
                await LocalNotifications.cancel({ notifications: classNotifs });
            }
        } catch (e) { console.error(e); }
    };

    const resetData = async () => {
        setState(initialState);
        localStorage.removeItem('study_budy_data');
        if (user) {
            // Delete everything? Dangerous but requested.
            // Cascades should handle many things if we deleted user, but we are just clearing data.
            // Delete classes (cascades schedule-class), delete non-class schedule, etc.
            // For MVP Reset:
            const resetAsync = async () => {
                await supabase.from('classes').delete().eq('user_id', user.id);
                await supabase.from('schedule_items').delete().eq('user_id', user.id);
                await supabase.from('study_sessions').delete().eq('user_id', user.id);
                await supabase.from('profiles').update({
                    points: 0, inventory: [], equipped_avatar: 'Default Dog', is_onboarded: false
                }).eq('id', user.id);
            };
            await resetAsync();
        }
    };

    const refreshData = async () => {
        if (user) {
            console.log('[AppContext] Manual refresh triggered');
            await loadRemoteData(user.id, true);
        } else {
            console.log('[AppContext] Manual refresh skipped (no user)');
            loadLocalData();
        }
    };

    const signOut = async () => {
        console.log('[AppContext] Signing out...');
        try {
            await supabase.auth.signOut();
            setState(initialState);
            setUser(null);
            router.push('/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const resetClassProgress = async (classId: string) => {
        // Remove sessions for this class from local state
        setState(prev => ({
            ...prev,
            studySessions: prev.studySessions.filter(s => s.classId !== classId)
        }));

        if (user) {
            // Delete from DB
            const { error } = await supabase.from('study_sessions').delete().eq('user_id', user.id).eq('class_id', classId);
            if (error) console.error('Error resetting class progress:', error);
        }
    };


    const goPremium = async () => {
        const BONUS_COINS = 25000;
        const newPoints = state.points + BONUS_COINS;

        setState(prev => ({ ...prev, isPremium: true, points: newPoints }));

        // Persist
        if (user) {
            await supabase.from('profiles').update({ is_premium: true, points: newPoints }).eq('id', user.id).then(({ error }) => {
                if (error) console.error('Error upgrading to premium:', error);
            });
        }

        // Also update local storage immediately for guest/cache
        const nextState = { ...state, isPremium: true, points: newPoints };
        localStorage.setItem('study_budy_data', JSON.stringify(nextState));
    };

    const deleteAccount = async () => {
        if (!user) return;
        console.log('[AppContext] Deleting account...');

        try {
            // 1. Call RPC function (Server-side deletion of auth.users + cascading data)
            const { error } = await supabase.rpc('delete_account');

            if (error) {
                console.error('[AppContext] Error deleting account:', error);
                throw error;
            }

            // 2. Clear Local State
            await signOut(); // This handles state clearing and redirect        
        } catch (error) {
            console.error('Failed to delete account:', error);
            alert('Failed to delete account. Please try again.');
        }
    };

    const startBreak = (durationMinutes: number) => {
        const endTime = Date.now() + durationMinutes * 60 * 1000;
        setState(prev => ({
            ...prev,
            breakTimer: { isActive: true, endTime, hasClaimedAd: false }
        }));
    };

    const endBreak = () => {
        setState(prev => ({
            ...prev,
            breakTimer: { isActive: false, endTime: null, hasClaimedAd: false }
        }));
    };

    const extendBreak = (minutes: number) => {
        setState(prev => {
            let newEndTime = prev.breakTimer.endTime;
            const now = Date.now();
            const addMs = minutes * 60 * 1000;

            if (!newEndTime || newEndTime < now) {
                // If expired or null, start fresh from now
                newEndTime = now + addMs;
            } else {
                // Extend existing
                newEndTime += addMs;
            }

            return {
                ...prev,
                breakTimer: { isActive: true, endTime: newEndTime, hasClaimedAd: true }
            };
        });
    };

    const updateGame4096 = (gameState: AppState['game4096']) => {
        setState(prev => ({ ...prev, game4096: gameState }));
        // Auto-persist to local storage automatically via useEffect hooks
    };

    return (
        <AppContext.Provider
            value={{
                state,
                user,
                isLoading,
                addClass,
                updateClass,
                removeClass,
                addScheduleItem,
                replaceClassSchedule,
                clearSchedule,
                clearStudySchedule,
                removeScheduleItem,
                updateScheduleItem,
                recordSession,
                addPoints,
                removePoints,
                buyItem,
                redeemCharacterCredit,
                equipAvatar,
                completeOnboarding,
                updateSettings,
                scheduleStudyNotification,
                cancelStudyNotification,
                testNotification,
                updateSleepSettings, // Deprecated but kept for now to avoid breaking references elsewhere until refactored
                resetData,
                signOut,
                refreshData,
                resetClassProgress,
                archiveAllClasses,
                scheduleClassReminders,
                cancelClassReminders,
                goPremium,
                deleteAccount,
                startBreak,
                endBreak,
                updateGame4096,
                extendBreak,
                saveActiveSession: (classId: string, elapsedSeconds: number) => {
                    setState(prev => {
                        const next = { ...prev, activeSession: { classId, elapsedSeconds } };
                        // Persist explicitly to localStorage for immediate safety
                        const existing = localStorage.getItem('study_budy_data');
                        const data = existing ? JSON.parse(existing) : {};
                        data.activeSession = next.activeSession;
                        localStorage.setItem('study_budy_data', JSON.stringify(data));
                        return next;
                    });
                },
                clearActiveSession: () => {
                    setState(prev => {
                        const next = { ...prev, activeSession: null };
                        const existing = localStorage.getItem('study_budy_data');
                        if (existing) {
                            const data = JSON.parse(existing);
                            delete data.activeSession;
                            localStorage.setItem('study_budy_data', JSON.stringify(data));
                        }
                        return next;
                    });
                },
                updateHighScore: (gameId: string, score: number) => {
                    setState(prev => {
                        const currentHigh = prev.highScores[gameId] || 0;
                        if (score > currentHigh) {
                            const next = {
                                ...prev,
                                highScores: { ...prev.highScores, [gameId]: score }
                            };
                            return next;
                        }
                        return prev;
                    });
                },
                consumeGameTime,
                submitGameScore: async (gameId: string, score: number): Promise<number | null> => {
                    // Submit score to Supabase for global leaderboard
                    if (!user) return null;
                    try {
                        // Insert the score
                        const { error: insertError } = await supabase.from('game_scores').insert({
                            user_id: user.id,
                            game_id: gameId,
                            score: score
                        });

                        if (insertError) {
                            console.error('Error inserting score:', insertError);
                            return null;
                        }

                        // Check rank: count how many scores are higher
                        const { count, error: countError } = await supabase
                            .from('game_scores')
                            .select('*', { count: 'exact', head: true })
                            .eq('game_id', gameId)
                            .gt('score', score);

                        if (countError) {
                            console.error('Error checking rank:', countError);
                            return null;
                        }

                        const rank = (count || 0) + 1;

                        // Only return rank if in top 100
                        if (rank <= 100) {
                            return rank;
                        }
                        return null;
                    } catch (err) {
                        console.error('Error submitting game score:', err);
                        return null;
                    }
                },
                claimPendingGifts: async () => {
                    if (!user) return null;
                    try {
                        // Fetch unclaimed gifts
                        const { data: gifts, error: fetchError } = await supabase
                            .from('gifts')
                            .select('*')
                            .eq('recipient_user_id', user.id)
                            .eq('redeemed', false);

                        if (fetchError || !gifts || gifts.length === 0) return null;

                        let totalCoins = 0;
                        let totalGameMinutes = 0;
                        let senderName = '';
                        let legendaryCount = 0;
                        let epicCount = 0;
                        let rareCount = 0;

                        for (const gift of gifts) {
                            if (gift.gift_type === 'coins') {
                                totalCoins += gift.amount;
                            } else if (gift.gift_type === 'game_time') {
                                totalGameMinutes += gift.amount;
                            } else if (gift.gift_type === 'character_legendary') {
                                legendaryCount += 1;
                            } else if (gift.gift_type === 'character_epic') {
                                epicCount += 1;
                            } else if (gift.gift_type === 'character_rare') {
                                rareCount += 1;
                            }
                            if (!senderName && gift.sender_name) {
                                senderName = gift.sender_name;
                            }

                            // Mark as redeemed
                            await supabase
                                .from('gifts')
                                .update({ redeemed: true })
                                .eq('id', gift.id);
                        }

                        // Add coins if any
                        if (totalCoins > 0) {
                            const currentPoints = state.points;
                            const newPoints = currentPoints + totalCoins;
                            setState(prev => ({ ...prev, points: newPoints }));

                            if (user) {
                                await supabase.from('profiles').upsert({
                                    id: user.id,
                                    points: newPoints
                                });
                            }
                        }

                        // Update Credits
                        if (legendaryCount > 0 || epicCount > 0 || rareCount > 0) {
                            const newCredits = {
                                legendary: state.characterCredits.legendary + legendaryCount,
                                epic: state.characterCredits.epic + epicCount,
                                rare: state.characterCredits.rare + rareCount
                            };

                            setState(prev => ({ ...prev, characterCredits: newCredits }));

                            if (user) {
                                // For credits, we should increment the DB values.
                                // We can use the new state values since we just fetched profile on refresh.
                                await supabase.from('profiles').update({
                                    tier_legendary_credits: newCredits.legendary,
                                    tier_epic_credits: newCredits.epic,
                                    tier_rare_credits: newCredits.rare
                                }).eq('id', user.id);
                            }
                        }

                        // Add game time to bank if any
                        if (totalGameMinutes > 0) {
                            const newGameTimeBank = state.gameTimeBank + totalGameMinutes;
                            setState(prev => ({ ...prev, gameTimeBank: newGameTimeBank }));

                            if (user) {
                                await supabase.from('profiles').update({
                                    game_time_bank: newGameTimeBank
                                }).eq('id', user.id);
                            }
                        }

                        return {
                            coins: totalCoins,
                            gameMinutes: totalGameMinutes,
                            senderName,
                            giftCredits: {
                                legendary: legendaryCount,
                                epic: epicCount,
                                rare: rareCount
                            }
                        };
                    } catch (err) {
                        console.error('Error claiming gifts:', err);
                        return null;
                    }
                }
            }}
        >
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}
