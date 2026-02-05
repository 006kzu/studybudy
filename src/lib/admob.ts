import { AdMob, BannerAdSize, BannerAdPosition, AdMobBannerSize, AdOptions, BannerAdOptions, AdLoadInfo, RewardAdOptions, RewardAdPluginEvents } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

export class AdMobService {
    // Test Unit IDs (Google Provided)
    // https://developers.google.com/admob/android/test-ads
    private static readonly TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111'; // Android/iOS Test Banner
    private static readonly TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712'; // Android/iOS Test Interstitial
    private static readonly TEST_REWARD_ID = 'ca-app-pub-3940256099942544/5224354917'; // Android/iOS Test Reward Video

    private static isInitialized = false;

    static async initialize() {
        if (!Capacitor.isNativePlatform()) {
            console.log('[AdMob] Web platform detected - skipping initialization');
            return;
        }

        try {
            await AdMob.initialize({
                // requestTrackingAuthorization: true, // Not in type?
                testingDevices: ['2077ef9a63d2b398840261c8221a0c9b'], // Add device IDs if needed
                initializeForTesting: true,
            });
            this.isInitialized = true;
            console.log('[AdMob] Initialized');
        } catch (e) {
            console.error('[AdMob] Initialization failed', e);
        } finally {
            // Even if init fails, mark as true so we don't retry locally forever or block
            this.isInitialized = true;
        }
    }

    private static mockBannerEl: HTMLElement | null = null;

    static async showBanner() {
        if (!Capacitor.isNativePlatform()) {
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
            return;
        }

        try {
            const options: BannerAdOptions = {
                adId: this.TEST_BANNER_ID, // Use Real ID in Prod
                adSize: BannerAdSize.BANNER,
                position: BannerAdPosition.BOTTOM_CENTER,
                margin: 0,
                // isTesting: true
            };
            await AdMob.showBanner(options);
        } catch (e) {
            console.error('[AdMob] showBanner failed', e);
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
        // Reuse hide logic for web
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
                adId: this.TEST_INTERSTITIAL_ID,
                // isTesting: true
            };
            await AdMob.prepareInterstitial(options);
            console.log('[AdMob] Interstitial Prepared');
        } catch (e) {
            console.error('[AdMob] prepareInterstitial failed', e);
        }
    }

    static async showInterstitial(): Promise<boolean> {
        if (!Capacitor.isNativePlatform()) {
            console.log('[AdMob] showInterstitial (Web Mock)');
            // Simulate ad watching for web
            return new Promise(resolve => setTimeout(() => {
                const confirmed = confirm("[WEB MOCK] Ad Playing... \n\n(Imagine a video here)\n\nClose Ad?");
                resolve(true);
            }, 500));
        }

        try {
            // Ensure prepared
            // Note: In a real app, you might check 'AdMob.addListener(InterstitialLoaded)' etc.
            // For simplicity, we just try show.
            await AdMob.showInterstitial();
            return true;
        } catch (e) {
            console.error('[AdMob] showInterstitial failed', e);
            // If failed to show (e.g. not loaded), try to load one for next time
            this.prepareInterstitial();
            return false;
        }
    }
    static async prepareRewardVideo() {
        if (!Capacitor.isNativePlatform()) return;
        try {
            const options: RewardAdOptions = {
                adId: this.TEST_REWARD_ID,
                // isTesting: true
            };
            await AdMob.prepareRewardVideoAd(options);
            console.log('[AdMob] Reward Video Prepared');
        } catch (e) {
            console.error('[AdMob] prepareRewardVideo failed', e);
        }
    }

    static async showRewardVideo(): Promise<boolean> {
        if (!Capacitor.isNativePlatform()) {
            console.log('[AdMob] showRewardVideo (Web Mock)');
            return new Promise(resolve => setTimeout(() => {
                const confirmed = confirm("[WEB MOCK] Watch 30s Ad for Reward? \n\n(Video Playing...)\n\nClose Ad?");
                resolve(true); // Always reward in mock
            }, 1000));
        }

        try {
            await AdMob.showRewardVideoAd();
            return true;
        } catch (e) {
            console.error('[AdMob] showRewardVideo failed', e);
            this.prepareRewardVideo(); // Retry prep
            return false;
        }
    }
}
