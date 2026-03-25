import type { Browser } from 'webdriverio'

/**
 * Capacitor アプリの起動を待機する。
 * iOS 26 では WKWebView は XCUIElementTypeWebView ではなく
 * XCUIElementTypeOther として現れるため、そちらで待機する。
 */
export async function waitForAppReady(driver: Browser): Promise<void> {
  // アプリシェル（WKWebView コンテナ）が3階層揃うまで待つ
  await driver.waitUntil(
    async () => {
      const els = await driver.$$('//XCUIElementTypeOther')
      return (await els.length) >= 3
    },
    { timeout: 30000, timeoutMsg: 'アプリが起動しませんでした' }
  )
  // React コンテンツが描画されるまで待機（ATT ダイアログ消去 + hydration）
  await new Promise((resolve) => setTimeout(resolve, 5000))
}
