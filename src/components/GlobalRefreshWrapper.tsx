'use client';

import { useApp } from '@/context/AppContext';
import PullToRefresh from './PullToRefresh';

export default function GlobalRefreshWrapper({ children }: { children: React.ReactNode }) {
    const { refreshData } = useApp();

    return (
        <PullToRefresh onRefresh={async () => {
            console.log('Global Refresh Triggered');
            await refreshData();
        }}>
            {children}
        </PullToRefresh>
    );
}
