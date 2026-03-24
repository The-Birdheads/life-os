import type { Browser } from 'webdriverio'

/** WebView コンテキストに切り替える */
export async function switchToWebView(driver: Browser): Promise<void> {
  // アプリ起動直後は WebView の初期化に時間がかかるため待機
  await new Promise((resolve) => setTimeout(resolve, 5000))

  // WebView が表示されるまで最大 30 秒待機
  await driver.waitUntil(
    async () => {
      const contexts = (await driver.getContexts()) as string[]
      console.log('Available contexts:', contexts)
      return contexts.some((c) => c.startsWith('WEBVIEW'))
    },
    { timeout: 30000, timeoutMsg: 'WebView context が見つかりませんでした' }
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
