import type { Browser, ChainablePromiseElement } from 'webdriverio'

/** 指定セレクタの要素が表示されるまで待機 */
export async function waitForVisible(
  driver: Browser,
  selector: string,
  timeout = 10000
): Promise<ChainablePromiseElement> {
  const el = driver.$(selector)
  await el.waitForDisplayed({ timeout })
  return el
}

/** 指定ミリ秒待機 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
