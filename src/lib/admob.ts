import { AdMob, BannerAdSize, BannerAdPosition, AdOptions, BannerAdOptions, RewardAdOptions } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

export class AdMobService {
    // --- Configuration ---
    // Set to FALSE for Production Release
    private static readonly IS_TESTING = false;

    // Production Unit IDs (Replace with real IDs from AdMob Dashboard)
    // Application ID: ca-app-pub-6833888269762741~1834874429
    private static readonly PROD_BANNER_ID = 'ca-app-pub-6833888269762741/9817160436';
    private static readonly PROD_INTERSTITIAL_ID = 'ca-app-pub-6833888269762741/2760787758';
    private static readonly PROD_REWARD_ID = 'ca-app-pub-6833888269762741/3371161845';

    // Test Unit IDs (Google Provided)
    private static readonly TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
    private static readonly TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';
    private static readonly TEST_REWARD_ID = 'ca-app-pub-3940256099942544/5224354917';

    private static get bannerId() { return this.IS_TESTING ? this.TEST_BANNER_ID : this.PROD_BANNER_ID; }
    private static get interstitialId() { return this.IS_TESTING ? this.TEST_INTERSTITIAL_ID : this.PROD_INTERSTITIAL_ID; }
    private static get rewardId() { return this.IS_TESTING ? this.TEST_REWARD_ID : this.PROD_REWARD_ID; }

    private static isInitialized = false;

    static async initialize() {
        if (!Capacitor.isNativePlatform()) {
            console.log('[AdMob] Web platform detected - skipping initialization');
            return;
        }

        if (this.isInitialized) return;

        try {
            console.log('[AdMob] Initializing...');
            await AdMob.initialize({
                testingDevices: ['2077ef9a63d2b398840261c8221a0c9b'],
                initializeForTesting: this.IS_TESTING,
            });
            this.isInitialized = true;
            console.log('[AdMob] Initialized successfully');
        } catch (e: any) {
            // Log full object to debug "Console Error {}"
            console.error('[AdMob] Initialization failed:', JSON.stringify(e, null, 2));
            // Mark as initialized to prevent constant retries if it's a permanent error
            this.isInitialized = true;
        }
    }

    private static mockBannerEl: HTMLElement | null = null;

    static async showBanner() {
        if (!Capacitor.isNativePlatform()) {
            this.showWebBanner();
            return;
        }

        try {
            const options: BannerAdOptions = {
                adId: this.bannerId,
                adSize: BannerAdSize.BANNER,
                position: BannerAdPosition.BOTTOM_CENTER,
                margin: 0,
                isTesting: this.IS_TESTING
            };
            await AdMob.showBanner(options);
        } catch (e: any) {
            console.error('[AdMob] showBanner failed:', JSON.stringify(e));
        }
    }

    static async hideBanner() {
        if (!Capacitor.isNativePlatform()) {
            if (this.mockBannerEl) {
                this.mockBannerEl.remove();
                this.mockBannerEl = null;
            }
            return;
        }
        try {
            await AdMob.hideBanner();
        } catch (e) {
            // Ignore error if no banner exists
        }
    }

    static async removeBanner() {
        if (!Capacitor.isNativePlatform()) {
            this.hideBanner();
            return;
        }
        try {
            await AdMob.removeBanner();
        } catch (e) {
            // Ignore
        }
    }

    static async prepareInterstitial() {
        if (!Capacitor.isNativePlatform()) return;
        try {
            const options: AdOptions = {
                adId: this.interstitialId,
                isTesting: this.IS_TESTING
            };
            await AdMob.prepareInterstitial(options);
            console.log('[AdMob] Interstitial Prepared');
        } catch (e: any) {
            console.error('[AdMob] prepareInterstitial failed:', JSON.stringify(e));
        }
    }

    static async showInterstitial(): Promise<boolean> {
        if (!Capacitor.isNativePlatform()) return this.showWebInterstitial();

        try {
            await AdMob.showInterstitial();
            return true;
        } catch (e: any) {
            console.error('[AdMob] showInterstitial failed:', JSON.stringify(e));
            // Try to prepare a new one for next time
            this.prepareInterstitial();
            return false;
        }
    }

    static async prepareRewardVideo() {
        if (!Capacitor.isNativePlatform()) return;
        try {
            const options: RewardAdOptions = {
                adId: this.rewardId,
                isTesting: this.IS_TESTING
            };
            await AdMob.prepareRewardVideoAd(options);
            console.log('[AdMob] Reward Video Prepared');
        } catch (e: any) {
            console.error('[AdMob] prepareRewardVideo failed:', JSON.stringify(e));
        }
    }

    static async showRewardVideo(): Promise<boolean> {
        if (!Capacitor.isNativePlatform()) return this.showWebRewardVideo();

        try {
            // Add listener for reward (optional, but good practice)
            // For now, we await the show result
            await AdMob.showRewardVideoAd();
            return true;
        } catch (e: any) {
            console.error('[AdMob] showRewardVideo failed:', JSON.stringify(e));
            this.prepareRewardVideo(); // Retry prep
            return false;
        }
    }

    // --- Web Mock Helpers ---

    private static showWebBanner() {
        console.log('[AdMob] showBanner (Web Mock)');
        if (!this.mockBannerEl) {
            this.mockBannerEl = document.createElement('div');
            this.mockBannerEl.innerText = 'TEST AD BANNER (Web Mock)';
            Object.assign(this.mockBannerEl.style, {
                position: 'fixed',
                bottom: '0',
                left: '0',
                width: '100%',
                height: '50px',
                backgroundColor: '#333',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: '9999',
                fontSize: '14px',
                fontWeight: 'bold',
                boxShadow: '0 -2px 10px rgba(0,0,0,0.2)'
            });
            document.body.appendChild(this.mockBannerEl);
        }
    }

    private static async showWebInterstitial(): Promise<boolean> {
        console.log('[AdMob] showInterstitial (Web Mock)');
        return new Promise(resolve => setTimeout(() => {
            const confirmed = confirm("[WEB MOCK] Ad Playing... \n\n(Imagine a video here)\n\nClose Ad?");
            resolve(true);
        }, 500));
    }

    private static async showWebRewardVideo(): Promise<boolean> {
        console.log('[AdMob] showRewardVideo (Web Mock)');
        return new Promise(resolve => setTimeout(() => {
            const confirmed = confirm("[WEB MOCK] Watch 30s Ad for Reward? \n\n(Video Playing...)\n\nClose Ad?");
            resolve(true);
        }, 1000));
    }
}
