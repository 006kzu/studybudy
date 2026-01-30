'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { App as CapApp, URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// --- Types ---
export type ClassItem = {
    id: string;
    name: string;
    weeklyGoalMinutes: number;
    color: string;
    isArchived?: boolean;
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
    notifications: {
        studyBreaksEnabled: boolean;
        classRemindersEnabled: boolean;
    };
    zenMode: boolean;
    isPremium: boolean;
    musicEnabled?: boolean;
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
    updateSettings: (settings: { sleepSettings?: AppState['sleepSettings']; notifications?: AppState['notifications']; zenMode?: boolean; musicEnabled?: boolean }) => Promise<void>;
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
    },
    notifications: {
        studyBreaksEnabled: false,
        classRemindersEnabled: false,
    },
    zenMode: false,
    isPremium: false,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AppState>(initialState);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const isMounted = useRef(false);
    const lastFetchedUserId = useRef<string | null>(null);
    const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
    const CACHE_KEY_PREFIX = 'study_budy_cache_';
    const router = useRouter(); // Define router

    // 1. Auth & Initial Load
    useEffect(() => {
        isMounted.current = true;

        // Native Deep Link Handling
        if (Capacitor.isNativePlatform()) {
            // Initialize AdMob
            import('@/lib/admob').then(({ AdMobService }) => {
                AdMobService.initialize();
            });

            CapApp.addListener('appUrlOpen', async (event: URLOpenListenerEvent) => {
                if (event.url.includes('google-auth')) {
                    // Supabase sends tokens in the hash or query
                    // e.g. com.studybudy.app://google-auth#access_token=...&refresh_token=...
                    const url = new URL(event.url);
                    const hash = url.hash.substring(1); // remove #
                    const query = url.search.substring(1); // remove ?
                    const params = new URLSearchParams(hash || query);

                    const access_token = params.get('access_token');
                    const refresh_token = params.get('refresh_token');

                    if (access_token && refresh_token) {
                        const { error } = await supabase.auth.setSession({
                            access_token,
                            refresh_token
                        });
                        if (!error) {
                            console.log('Successfully restored session from Deep Link');
                            // Router might be outside context? No, we are in App.
                            // But we are in Context, we can't switch page easily unless we expose a navigation method?
                            // Actually, onAuthStateChange will fire 'SIGNED_IN' and we can handle it there or just reload.
                            // Or better, just let the state update propagate.
                        }
                    }
                }
            });
        }

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

    const loadRemoteData = async (userId: string, forceRefresh: boolean = false) => {
        setIsLoading(true);

        // 1. Try Cache First (if not forcing refresh)
        if (!forceRefresh) {
            try {
                const cacheKey = CACHE_KEY_PREFIX + userId;
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const { timestamp, data } = JSON.parse(cached);
                    const age = Date.now() - timestamp;
                    if (age < CACHE_DURATION && data) {
                        console.log(`[AppContext] Cache Hit! Age: ${Math.round(age / 1000)}s. Skipping DB.`);
                        setState(data);
                        setIsLoading(false);
                        return; // Exit early!
                    } else {
                        console.log(`[AppContext] Cache Found but Stale. Age: ${Math.round(age / 1000)}s. Fetching DB...`);
                    }
                }
            } catch (e) {
                console.warn('[AppContext] Cache parse error', e instanceof Error ? e.message : JSON.stringify(e, null, 2));
            }
        }

        // 2. Fetch from DB (Cache Miss or Stale)



        // Helper for individual fetches to prevent one failure blocking others
        const fetchTable = async (table: string, query: any) => {
            try {
                const { data, error } = await query;
                if (error) throw error;
                return data;
            } catch (e: any) {
                console.warn(`[AppContext] ${table} failed:`, e.message || JSON.stringify(e, null, 2));
                return null; // Null indicates error
            }
        };

        try {
            // Execute in parallel
            const [profile, classes, schedule, sessions] = await Promise.all([
                fetchTable('Profile', supabase.from('profiles').select('*').eq('id', userId).single()),
                fetchTable('Classes', supabase.from('classes').select('*').eq('user_id', userId)),
                fetchTable('Schedule', supabase.from('schedule_items').select('*').eq('user_id', userId)),
                fetchTable('Sessions', supabase.from('study_sessions').select('*').eq('user_id', userId))
            ]);

            console.log('[AppContext] Loaded Remote Data (Count):', JSON.stringify({
                profile: profile ? 'Found' : 'Null',
                classes: classes?.length || 0,
                schedule: schedule?.length || 0,
                sessions: sessions?.length || 0
            }));

            // Map DB structure to AppState (safely handling nulls)
            const newState: AppState = {
                classes: (classes as any[])?.map(c => ({
                    id: c.id,
                    name: c.name,
                    weeklyGoalMinutes: c.weekly_goal_minutes,
                    color: c.color,
                    isArchived: c.is_archived
                })) || [],
                schedule: (schedule as any[])?.map(s => ({
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
                studySessions: (sessions as any[])?.map(s => ({
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
                sleepSettings: (profile as any)?.sleep_settings || initialState.sleepSettings,
                notifications: (profile as any)?.notifications || initialState.notifications,
                zenMode: (profile as any)?.zen_mode || initialState.zenMode,
                isPremium: (profile as any)?.is_premium || false
            };

            console.log('[AppContext] New State Set:', newState);
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
                    sleepSettings: newState.sleepSettings,
                    timestamp: Date.now()
                };
                localStorage.setItem(CACHE_KEY_PREFIX + userId, JSON.stringify(cacheData));
            } else {
                console.warn('[AppContext] Skipping cache update due to fetch errors.');
            }

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
                zenMode: next.zenMode
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
                goPremium
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
