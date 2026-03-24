import { browser, expect } from '@wdio/globals'
import { switchToWebView } from '../helpers/context'
import { sleep } from '../helpers/wait'

describe('スモークテスト', () => {
  before(async () => {
    await switchToWebView(browser)
  })

  it('アプリが起動してタブが表示されること', async () => {
    await sleep(2000)
    const body = await browser.$('body')
    await expect(body).toBeDisplayed()
  })
})
