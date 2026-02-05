import { Capacitor } from '@capacitor/core';
import { NativePurchases, Transaction } from '@capgo/native-purchases';

// Product ID Mapping
// Internal App ID -> App Store / Play Store ID
// REPLACE these with your actual IDs from App Store Connect
export const PRODUCT_MAP: Record<string, string> = {
    // Generic Tier Consumables for Avatar Unlocks
    'avatar_tier1': 'com.learnloop.learnloop.avatar.tier1', // $0.99 (Starter)
    'avatar_tier2': 'com.learnloop.learnloop.avatar.tier2', // $1.99 (Rare)
    'avatar_tier3': 'com.learnloop.learnloop.avatar.tier3', // $4.99 (Legendary)

    // Parent Gifting Rewards
    'com.learnloop.reward.break_15': 'com.learnloop.learnloop.reward.break_15', // 15m Break Gift

    // One-time non-consumables (Avatars/Items if sold directly)
    // currently we only sell coin packs or "Premium"
    'premium_upgrade': 'com.learnloop.learnloop.premium', // Remove Ads
};

export async function initializeIAP() {
    if (!Capacitor.isNativePlatform()) {
        console.log('[IAP] Web platform detected. Skipping initialization.');
        return;
    }

    try {
        await NativePurchases.restorePurchases();
        console.log('[IAP] Purchases restored/synced');
    } catch (err) {
        console.error('[IAP] Failed to restore/init purchases:', err);
    }
}

export async function purchaseItem(internalId: string): Promise<boolean> {
    const storeId = PRODUCT_MAP[internalId];

    if (!storeId) {
        console.error(`[IAP] No store ID found for ${internalId}`);
        alert(`Developer Error: No Store ID for ${internalId}`);
        return false;
    }

    console.log(`[IAP] Initiating purchase for ${internalId} -> ${storeId}...`);

    if (!Capacitor.isNativePlatform()) {
        // Fallback for Web Testing
        return new Promise((resolve) => {
            const ok = confirm(`[WEB MOCK] Purchase ${internalId} (${storeId})?`);
            resolve(ok);
        });
    }

    try {
        // 1. Initiate Purchase
        const response: Transaction = await NativePurchases.purchaseProduct({
            productIdentifier: storeId,
            planIdentifier: '', // Not used for one-time
            quantity: 1,
        });

        // 2. Validate Response
        if (response && response.transactionId) {
            console.log('[IAP] Purchase Successful:', response);
            return true;
        } else {
            console.warn('[IAP] Purchase finished but no transaction ID?', response);
            return false;
        }

    } catch (err: any) {
        console.error('[IAP] Purchase Failed:', err);
        if (err.message && err.message.includes('User cancelled')) {
            // User cancelled, suppress alert
        } else {
            alert('Purchase failed or cancelled.');
        }
        return false;
    }
}

export async function restorePurchases(): Promise<any[]> {
    if (!Capacitor.isNativePlatform()) return [];
    try {
        await NativePurchases.restorePurchases();
        // Result structure depends on platform, usually returns list of verified purchases?
        // simple logging for now
        console.log('[IAP] Restored Triggered');
        return [];
    } catch (e) {
        console.error(e);
        return [];
    }
}
