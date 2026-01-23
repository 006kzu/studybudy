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
    isOnboarded: boolean;
};

type AppContextType = {
    state: AppState;
    addClass: (cls: ClassItem) => void;
    removeClass: (id: string) => void;
    addScheduleItem: (item: ScheduleItem) => void;
    recordSession: (session: StudySession) => void;
    addPoints: (amount: number) => void;
    completeOnboarding: () => void;
    resetData: () => void;
};

// --- Initial State ---
const initialState: AppState = {
    classes: [],
    schedule: [],
    studySessions: [],
    points: 0,
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

    const removeClass = (id: string) => {
        setState((prev) => ({ ...prev, classes: prev.classes.filter((c) => c.id !== id) }));
    };

    const addScheduleItem = (item: ScheduleItem) => {
        setState((prev) => ({ ...prev, schedule: [...prev.schedule, item] }));
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
                removeClass,
                addScheduleItem,
                recordSession,
                addPoints,
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
