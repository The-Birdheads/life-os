import { browser, expect } from '@wdio/globals'
import { waitForAppReady } from '../helpers/context'
import { sleep } from '../helpers/wait'

describe('ハンバーガーメニュー', () => {
  before(async () => {
    await waitForAppReady(browser)
  })

  it('ハンバーガーアイコンをタップするとメニューが開くこと', async () => {
    // aria-label="メニュー" が iOS アクセシビリティラベルとして露出される
    const hamburgerBtn = await browser.$('~メニュー')
    await hamburgerBtn.waitForDisplayed({ timeout: 10000 })
    await hamburgerBtn.click()
    await sleep(500)

    // aria-label="ハンバーガーメニュー" で確認
    const menu = await browser.$('~ハンバーガーメニュー')
    await expect(menu).toBeDisplayed()
  })
})
