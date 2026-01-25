'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

// --- Types ---
export type ClassItem = {
    id: string;
    name: string;
    weeklyGoalMinutes: number;
    color: string;
};

export type ScheduleItem = {
    id: string;
    day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
    startTime: string;
    endTime: string;
    type: 'class' | 'study' | 'extracurricular' | 'sleep' | 'block';
    label?: string;
    classId?: string;
    isRecurring?: boolean;
    specificDate?: string;
    startDate?: string;
    color?: string;
};

export type StudySession = {
    id: string;
    classId: string;
    durationMinutes: number;
    timestamp: number;
    pointsEarned: number;
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
    equipAvatar: (avatarName: string) => Promise<void>;
    completeOnboarding: () => Promise<void>;
    updateSleepSettings: (settings: { enabled: boolean; start: string; end: string }) => Promise<void>;
    resetData: () => Promise<void>;
    signOut: () => Promise<void>;
    refreshData: () => Promise<void>;
};

const initialState: AppState = {
    classes: [],
    schedule: [],
    studySessions: [],
    points: 0,
    inventory: ['Default Dog'],
    equippedAvatar: 'Default Dog',
    isOnboarded: false,
    sleepSettings: {
        enabled: false,
        start: '22:00',
        end: '06:00'
    }
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AppState>(initialState);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const isMounted = useRef(false);
    const lastFetchedUserId = useRef<string | null>(null);

    // 1. Auth & Initial Load
    useEffect(() => {
        isMounted.current = true;

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

        init();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log(`[AppContext] Auth Event: ${event}`, session?.user?.id);
            const currentUser = session?.user || null;
            setUser(currentUser);

            if (currentUser) {
                // Only load if validation passes and we haven't loaded for this user yet
                if (lastFetchedUserId.current !== currentUser.id) {
                    console.log('[AppContext] User changed (or first load), fetching data...');
                    lastFetchedUserId.current = currentUser.id;

                    // Check if we need to migrate local data
                    const localData = localStorage.getItem('study_budy_data');
                    if (localData) {
                        try {
                            const parsed = JSON.parse(localData);
                            if (parsed.classes.length > 0 || parsed.points > 0) {
                                await migrateGuestData(currentUser.id, parsed);
                            }
                        } catch (e) {
                            console.error('Migration parse error', e);
                        }
                        localStorage.removeItem('study_budy_data'); // Clear after attempt
                    }
                    await loadRemoteData(currentUser.id);
                } else {
                    console.log('[AppContext] Skipping redundant data fetch for same user.');
                }
            } else if (event === 'SIGNED_OUT') {
                // Logged out - Explicitly clear
                console.log('[AppContext] SIGNED_OUT event detected. Wiping state.');
                lastFetchedUserId.current = null;
                setState(initialState);
            } else {
                console.log(`[AppContext] Auth event ${event} with no user. Not wiping state to be safe.`);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // 2. Loaders
    const loadLocalData = () => {
        const saved = localStorage.getItem('study_budy_data');
        if (saved) {
            try {
                setState(JSON.parse(saved));
            } catch (e) { console.error(e); }
        }
    };

    const loadRemoteData = async (userId: string) => {
        setIsLoading(true);

        // Relaxed type to 'any' to handle PostgrestBuilder vs Promise mismatch
        const safeFetch = async <T,>(promise: any, label: string, timeoutMs: number = 5000) => {
            const timeoutPromise = new Promise<{ data: null; error: any }>((_, reject) =>
                setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs)
            );
            try {
                // @ts-ignore
                return await Promise.race([promise, timeoutPromise]) as { data: T | null, error: any };
            } catch (e) {
                console.warn(`[AppContext] ${label} failed/timed-out:`, e);
                return { data: null, error: e };
            }
        };

        try {
            console.log('[AppContext] Starting parallel robust load...');

            // Parallel execution: Max wait time = 5s total, not 20s.
            const [profileRes, classesRes, scheduleRes, sessionsRes] = await Promise.all([
                safeFetch(supabase.from('profiles').select('*').eq('id', userId).maybeSingle(), 'Profile'),
                safeFetch(supabase.from('classes').select('*').eq('user_id', userId), 'Classes'),
                safeFetch(supabase.from('schedule_items').select('*').eq('user_id', userId), 'Schedule'),
                safeFetch(supabase.from('study_sessions').select('*').eq('user_id', userId), 'Sessions')
            ]);

            const profile = profileRes.data;

            console.log('[AppContext] Loaded Remote Data (Count):', {
                profile: profileRes.data ? 'Found' : 'Null',
                classes: (classesRes.data as any[])?.length || 0,
                schedule: (scheduleRes.data as any[])?.length || 0,
                sessions: (sessionsRes.data as any[])?.length || 0
            });

            const hasData = (classesRes.data as any[])?.length > 0 || (scheduleRes.data as any[])?.length > 0;
            if (!hasData) {
                console.warn('[AppContext] Warning: No classes or schedule items found. RLS or Sync issue?');
                console.log('[AppContext] Resetting deduplication ref to allow retry on next Auth event.');
                lastFetchedUserId.current = null;
            }

            // Map DB structure to AppState (safely handling nulls)
            const newState: AppState = {
                classes: (classesRes.data as any[])?.map(c => ({
                    id: c.id,
                    name: c.name,
                    weeklyGoalMinutes: c.weekly_goal_minutes,
                    color: c.color
                })) || [],
                schedule: (scheduleRes.data as any[])?.map(s => ({
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
                })) || [],
                studySessions: (sessionsRes.data as any[])?.map(s => ({
                    id: s.id,
                    classId: s.class_id,
                    durationMinutes: s.duration_minutes,
                    pointsEarned: s.points_earned,
                    timestamp: new Date(s.created_at).getTime()
                })) || [],
                points: (profile as any)?.points || 0,
                inventory: (profile as any)?.inventory || [],
                equippedAvatar: (profile as any)?.equipped_avatar || 'Default Dog',
                isOnboarded: (profile as any)?.is_onboarded || false,
                sleepSettings: (profile as any)?.sleep_settings || initialState.sleepSettings
            };

            console.log('[AppContext] New State Set:', newState);
            setState(newState);
        } catch (error) {
            console.error('Error loading remote data (critical):', error);
        } finally {
            setIsLoading(false);
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
            is_onboarded: localState.isOnboarded
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
                created_at: new Date(s.timestamp).toISOString()
            }));
            await supabase.from('study_sessions').upsert(sessionsToInsert);
        }
    };


    // 3. Modifiers (Optimistic UI + Async Sync)
    // Helper to sync specific changes if user is logged in
    // Else sync entire state to LocalStorage
    useEffect(() => {
        if (!user && !isLoading) { // Only save to local if NOT logged in
            localStorage.setItem('study_budy_data', JSON.stringify(state));
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
        setState(prev => ({
            ...prev,
            classes: prev.classes.filter(c => c.id !== id),
            schedule: prev.schedule.filter(s => s.classId !== id && s.label !== prev.classes.find(c => c.id === id)?.name)
        }));
        if (user) {
            await supabase.from('classes').delete().eq('id', id).then(({ error }) => {
                if (error) console.error(error);
            });
            // Cascade delete handles schedule items in DB
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
        // Updates sessions AND points
        setState(prev => ({
            ...prev,
            studySessions: [...prev.studySessions, session],
            points: prev.points + session.pointsEarned,
        }));

        if (user) {
            await supabase.from('study_sessions').insert({
                id: session.id, user_id: user.id, class_id: session.classId, duration_minutes: session.durationMinutes,
                points_earned: session.pointsEarned, created_at: new Date(session.timestamp).toISOString()
            }).then(() => {
                // Trigger in DB increments points via function? Or we update manually.
                // Let's update profile points manually for now.
                // Need to fetch current points first or increment? Supabase assumes overwrite unless using rpc.
                // Better to read state.points (optimistic) and set it.
                // Danger: Race condition. RPC is better: `increment_points`.
                // For MVP, just updating profile with new total is okay if single user session.
            }).then(() => {
                // Return the update promise to chain correctly
                return supabase.from('profiles').update({ points: state.points + session.pointsEarned }).eq('id', user.id);
            }).then((res) => {
                if (res && res.error) console.error(res.error);
            });
        }
    };

    const addPoints = async (amount: number) => {
        const newPoints = state.points + amount;
        setState(prev => ({ ...prev, points: newPoints }));
        if (user) {
            await supabase.from('profiles').update({ points: newPoints }).eq('id', user.id).then(({ error }) => {
                if (error) console.error(error);
            });
        }
    };

    const removePoints = async (amount: number) => {
        const newPoints = Math.max(0, state.points - amount);
        setState(prev => ({ ...prev, points: newPoints }));
        if (user) {
            await supabase.from('profiles').update({ points: newPoints }).eq('id', user.id).then(({ error }) => {
                if (error) console.error(error);
            });
        }
    };

    const buyItem = async (itemName: string, cost: number) => {
        const newPoints = Math.max(0, state.points - cost);
        const newInventory = [...(state.inventory || []), itemName];
        setState(prev => ({ ...prev, points: newPoints, inventory: newInventory }));
        if (user) {
            await supabase.from('profiles').update({ points: newPoints, inventory: newInventory }).eq('id', user.id).then(({ error }) => {
                if (error) console.error(error);
            });
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

    const completeOnboarding = async () => {
        setState(prev => ({ ...prev, isOnboarded: true }));
        if (user) {
            await supabase.from('profiles').update({ is_onboarded: true }).eq('id', user.id).then(({ error }) => {
                if (error) console.error(error);
            });
        }
    };

    const updateSleepSettings = async (settings: { enabled: boolean; start: string; end: string }) => {
        setState(prev => ({ ...prev, sleepSettings: settings }));
        if (user) {
            await supabase.from('profiles').update({ sleep_settings: settings }).eq('id', user.id).then(({ error }) => {
                if (error) console.error(error);
            });
        }
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
            await loadRemoteData(user.id);
        } else {
            console.log('[AppContext] Manual refresh skipped (no user)');
            loadLocalData();
        }
    };

    const signOut = async () => {
        console.log('[AppContext] Signing out...');
        try {
            await supabase.auth.signOut();
            console.log('[AppContext] Supabase signOut complete');
        } catch (error) {
            console.error('[AppContext] Error signing out:', error);
        } finally {
            // Always clear state and redirect
            setUser(null);
            setState(initialState);
            localStorage.removeItem('study_budy_data');
            // Force hard redirect to login
            window.location.href = '/login';
        }
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
                equipAvatar,
                completeOnboarding,
                updateSleepSettings,
                resetData,
                signOut,
                refreshData,
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
