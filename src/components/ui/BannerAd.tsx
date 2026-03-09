import { useEffect, useRef } from 'react';
import { AdMob, BannerAdSize, BannerAdPosition, BannerAdPluginEvents } from '@capacitor-community/admob';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';

type Props = {
    onStatusChange?: (height: number) => void;
};

export default function BannerAd({ onStatusChange }: Props) {
    const handles = useRef<PluginListenerHandle[]>([]);

    useEffect(() => {
        // ネイティブ環境（Android/iOS）以外では何もしない
        if (Capacitor.getPlatform() === 'web') return;

        const setupListeners = async () => {
            const h1 = await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
                console.log('AdMob: Banner loaded');
                // 初期ロード時はデフォルトの高さを想定（後でSizeChangedで上書きされる）
            });
            const h2 = await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (err) => {
                console.error('AdMob: Banner failed to load', err);
                onStatusChange?.(0);
            });
            const h3 = await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (info) => {
                console.log('AdMob: Banner size changed', info);
                onStatusChange?.(info.height);
            });
            handles.current = [h1, h2, h3];
        };

        const initAndShow = async () => {
            try {
                // 既存のバナーを一度確実に削除してリセット
                await AdMob.removeBanner().catch(() => { });
                await new Promise(r => setTimeout(r, 800));

                // 広告を表示
                // ADAPTIVE_BANNER を使用して横幅いっぱいに広げる
                await AdMob.showBanner({
                    adId: Capacitor.getPlatform() === 'android'
                        ? 'ca-app-pub-3940256099942544/6300978111'
                        : 'ca-app-pub-3940256099942544/2934735716',
                    adSize: BannerAdSize.ADAPTIVE_BANNER,
                    position: BannerAdPosition.TOP_CENTER,
                    margin: 0, // マージンは0にし、JS側でヘッダー位置を制御する
                    isTesting: true,
                });
            } catch (err) {
                console.error('AdMob show banner error:', err);
                onStatusChange?.(0);
            }
        };

        setupListeners();
        initAndShow();

        // クリーンアップ
        return () => {
            handles.current.forEach(h => h.remove());
            if (Capacitor.getPlatform() !== 'web') {
                AdMob.hideBanner().catch(console.error);
                AdMob.removeBanner().catch(console.error);
            }
        };
    }, [onStatusChange]);

    return null;
}
