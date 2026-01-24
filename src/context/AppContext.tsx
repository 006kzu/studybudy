'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

// --- Types ---
export type ClassItem = {
    id: string;
    name: string;
    weeklyGoalMinutes: number; // Stored in minutes for easier calc
    color: string;
};

export type ScheduleItem = {
    id: string;
    day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
    startTime: string; // "HH:mm" 24h format
    endTime: string;
    type: 'class' | 'study' | 'extracurricular' | 'sleep';
    label?: string; // e.g. "Math 101" or "Soccer Practice"
    classId?: string; // Optional link to a class
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
};

type AppContextType = {
    state: AppState;
    addClass: (cls: ClassItem) => void;
    updateClass: (cls: ClassItem) => void;
    removeClass: (id: string) => void;
    addScheduleItem: (item: ScheduleItem) => void;
    replaceClassSchedule: (classId: string, newItems: ScheduleItem[]) => void;
    clearSchedule: () => void;
    clearStudySchedule: () => void;
    recordSession: (session: StudySession) => void;
    addPoints: (amount: number) => void;
    removePoints: (amount: number) => void;
    buyItem: (itemName: string, cost: number) => void;
    equipAvatar: (avatarName: string) => void;
    completeOnboarding: () => void;
    resetData: () => void;
};

// --- Initial State ---
const initialState: AppState = {
    classes: [],
    schedule: [],
    studySessions: [],
    points: 0,
    inventory: [],
    equippedAvatar: 'Default Dog',
    isOnboarded: false,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AppState>(initialState);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from LocalStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('study_budy_data');
        if (saved) {
            try {
                setState(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to load data', e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Save to LocalStorage on change
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('study_budy_data', JSON.stringify(state));
        }
    }, [state, isLoaded]);

    const addClass = (cls: ClassItem) => {
        setState((prev) => ({ ...prev, classes: [...prev.classes, cls] }));
    };

    const updateClass = (updatedCls: ClassItem) => {
        setState((prev) => ({
            ...prev,
            classes: prev.classes.map((c) => (c.id === updatedCls.id ? updatedCls : c)),
        }));
    };

    const removeClass = (id: string) => {
        setState((prev) => ({
            ...prev,
            classes: prev.classes.filter((c) => c.id !== id),
            // Also remove associated schedule items
            schedule: prev.schedule.filter((s) => s.classId !== id && s.label !== prev.classes.find(c => c.id === id)?.name)
        }));
    };

    const addScheduleItem = (item: ScheduleItem) => {
        setState((prev) => ({ ...prev, schedule: [...prev.schedule, item] }));
    };

    const replaceClassSchedule = (classId: string, newItems: ScheduleItem[]) => {
        setState((prev) => {
            // Remove old items for this class (check classId OR label match for legacy support)
            const cls = prev.classes.find((c) => c.id === classId);
            const className = cls ? cls.name : '';

            const filteredSchedule = prev.schedule.filter(
                (s) => s.classId !== classId && (className ? s.label !== className : true)
            );

            return {
                ...prev,
                schedule: [...filteredSchedule, ...newItems],
            };
        });
    };

    const clearSchedule = () => {
        setState((prev) => ({ ...prev, schedule: [] }));
    };

    const clearStudySchedule = () => {
        setState((prev) => ({
            ...prev,
            schedule: prev.schedule.filter(s => s.type !== 'study')
        }));
    };

    const recordSession = (session: StudySession) => {
        setState((prev) => ({
            ...prev,
            studySessions: [...prev.studySessions, session],
            points: prev.points + session.pointsEarned,
        }));
    };

    const addPoints = (amount: number) => {
        setState((prev) => ({ ...prev, points: prev.points + amount }));
    };

    const removePoints = (amount: number) => {
        setState((prev) => ({ ...prev, points: Math.max(0, prev.points - amount) }));
    };

    const buyItem = (itemName: string, cost: number) => {
        setState((prev) => ({
            ...prev,
            points: Math.max(0, prev.points - cost),
            inventory: [...(prev.inventory || []), itemName]
        }));
    };

    const equipAvatar = (avatarName: string) => {
        setState((prev) => ({ ...prev, equippedAvatar: avatarName }));
    };

    const completeOnboarding = () => {
        setState((prev) => ({ ...prev, isOnboarded: true }));
    };

    const resetData = () => {
        setState(initialState);
        localStorage.removeItem('study_budy_data');
    };

    if (!isLoaded) {
        return null; // Or a loading spinner
    }

    return (
        <AppContext.Provider
            value={{
                state,
                addClass,
                updateClass,
                removeClass,
                addScheduleItem,
                replaceClassSchedule,
                clearSchedule,
                clearStudySchedule,
                recordSession,
                addPoints,
                removePoints,
                buyItem,
                equipAvatar,
                completeOnboarding,
                resetData,
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
