import { browser, expect } from '@wdio/globals'
import { waitForAppReady } from '../helpers/context'

describe('スモークテスト', () => {
  before(async () => {
    await waitForAppReady(browser)
  })

  it('アプリが起動して WebView が表示されること', async () => {
    const webView = await browser.$('//XCUIElementTypeWebView')
    await expect(webView).toBeDisplayed()
  })
})
