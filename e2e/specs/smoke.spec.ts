import { browser, expect } from '@wdio/globals'
import { waitForAppReady } from '../helpers/context'

describe('スモークテスト', () => {
  before(async () => {
    await waitForAppReady(browser)
  })

  it('アプリが起動して表示されること', async () => {
    // iOS 26 では WKWebView は XCUIElementTypeOther として現れる
    const appShell = await browser.$('//XCUIElementTypeOther')
    await expect(appShell).toBeDisplayed()
  })
})
