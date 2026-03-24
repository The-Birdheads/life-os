import type { Browser } from 'webdriverio'

/** WebView コンテキストに切り替える */
export async function switchToWebView(driver: Browser): Promise<void> {
  // WebView が表示されるまで最大10秒待機
  await driver.waitUntil(
    async () => {
      const contexts = (await driver.getContexts()) as string[]
      return contexts.some((c) => c.startsWith('WEBVIEW'))
    },
    { timeout: 10000, timeoutMsg: 'WebView context が見つかりませんでした' }
  )

  const contexts = (await driver.getContexts()) as string[]
  const webviewCtx = contexts.find((c) => c.startsWith('WEBVIEW'))
  if (!webviewCtx) throw new Error('WebView context が見つかりません')
  await driver.switchContext(webviewCtx)
}

/** ネイティブコンテキストに戻す */
export async function switchToNative(driver: Browser): Promise<void> {
  await driver.switchContext('NATIVE_APP')
}
