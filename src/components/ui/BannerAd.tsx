import { useEffect, useRef } from 'react';
import { AdMob, BannerAdSize, BannerAdPosition, BannerAdPluginEvents } from '@capacitor-community/admob';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';

// ADAPTIVE_BANNER のフォールバック高さ（SizeChanged が遅延した場合に使用）
const FALLBACK_BANNER_HEIGHT = 50;

type Props = {
    onStatusChange?: (height: number) => void;
};

export default function BannerAd({ onStatusChange }: Props) {
    const handles = useRef<PluginListenerHandle[]>([]);

    useEffect(() => {
        if (Capacitor.getPlatform() === 'web') return;

        let cancelled = false;

        const run = async () => {
            // 1. リスナーを先に登録してからバナーを表示する
            const h1 = await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
                console.log('AdMob: Banner loaded');
                // SizeChanged が遅延した場合のフォールバック高さを設定
                if (!cancelled) onStatusChange?.(FALLBACK_BANNER_HEIGHT);
            });
            const h2 = await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (err) => {
                console.error('AdMob: Banner failed to load', err);
                if (!cancelled) onStatusChange?.(0);
            });
            const h3 = await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (info) => {
                console.log('AdMob: Banner size changed', info);
                // 実際の高さで上書き
                if (!cancelled) onStatusChange?.(info.height);
            });
            handles.current = [h1, h2, h3];

            // 2. 既存バナーをクリアしてから表示
            try {
                await AdMob.removeBanner().catch(() => {});
                await AdMob.showBanner({
                    adId: Capacitor.getPlatform() === 'android'
                        ? 'ca-app-pub-1540759813512306/2916673146'
                        : 'ca-app-pub-1540759813512306/2335131946',
                    adSize: BannerAdSize.ADAPTIVE_BANNER,
                    position: BannerAdPosition.TOP_CENTER,
                    margin: 0,
                    isTesting: false,
                });
            } catch (err) {
                console.error('AdMob show banner error:', err);
                if (!cancelled) onStatusChange?.(0);
            }
        };

        run();

        return () => {
            cancelled = true;
            handles.current.forEach(h => h.remove());
            handles.current = [];
            AdMob.hideBanner().catch(console.error);
            AdMob.removeBanner().catch(console.error);
        };
    }, [onStatusChange]);

    return null;
}
