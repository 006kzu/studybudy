'use client';

import { useApp } from '@/context/AppContext';
import PullToRefresh from './PullToRefresh';
import { usePathname } from 'next/navigation';

export default function GlobalRefreshWrapper({ children }: { children: React.ReactNode }) {
    const { refreshData } = useApp();
    const pathname = usePathname();

    // Disable Pull-to-Refresh on Game Pages to prevent scroll/refresh interference
    if (pathname?.startsWith('/games')) {
        return <>{children}</>;
    }

    return (
        <PullToRefresh onRefresh={async () => {
            console.log('Global Refresh Triggered');
            await refreshData();
        }}>
            {children}
        </PullToRefresh>
    );
}
