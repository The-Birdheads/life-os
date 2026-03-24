import type { Browser } from 'webdriverio'

/**
 * Capacitor の WKWebView が表示されるまで待機する。
 * WebView context への切り替えは行わず、NATIVE_APP コンテキストのまま操作する。
 * iOS の accessibility ツリーを通じて WebView 内の要素にアクセスできる。
 */
export async function waitForAppReady(driver: Browser): Promise<void> {
  await driver.waitUntil(
    async () => {
      const webViews = await driver.$$('//XCUIElementTypeWebView')
      return (await webViews.length) > 0
    },
    { timeout: 30000, timeoutMsg: 'アプリの WebView が表示されませんでした' }
  )
  // WebView 内の React コンテンツが描画されるまで少し待機
  await new Promise((resolve) => setTimeout(resolve, 2000))
}
