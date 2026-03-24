import { browser, expect } from '@wdio/globals'
import { switchToWebView } from '../helpers/context'
import { sleep } from '../helpers/wait'

describe('ハンバーガーメニュー', () => {
  before(async () => {
    await switchToWebView(browser)
    await sleep(2000)
  })

  it('ハンバーガーアイコンをタップするとメニューが開くこと', async () => {
    const hamburgerBtn = await browser.$('[aria-label="メニュー"]')
    await hamburgerBtn.waitForDisplayed({ timeout: 10000 })
    await hamburgerBtn.click()
    await sleep(500)

    const menu = await browser.$('[data-testid="hamburger-menu"]')
    await expect(menu).toBeDisplayed()
  })
})
