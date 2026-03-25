import { browser, expect } from '@wdio/globals'
import { waitForAppReady } from '../helpers/context'
import { sleep } from '../helpers/wait'

describe('タブナビゲーション', () => {
  before(async () => {
    await waitForAppReady(browser)
  })

  it('「振り返り」タブをタップすると振り返り画面に遷移すること', async () => {
    const reviewTab = await browser.$('~振り返り')
    await reviewTab.waitForDisplayed({ timeout: 10000 })
    await reviewTab.click()
    await sleep(500)

    // 振り返り画面固有の要素：aria-label="振り返りの表示切り替え"
    const filterBar = await browser.$('~振り返りの表示切り替え')
    await expect(filterBar).toBeDisplayed()
  })

  it('「週」タブをタップすると週表示画面に遷移すること', async () => {
    const weekTab = await browser.$('~週')
    await weekTab.waitForDisplayed({ timeout: 10000 })
    await weekTab.click()
    await sleep(500)

    // 週ビュー固有の要素：日付列ヘッダー
    const dateHeader = await browser.$('~日付')
    await expect(dateHeader).toBeDisplayed()
  })

  it('「記録」タブをタップすると記録画面に戻ること', async () => {
    const todayTab = await browser.$('~記録')
    await todayTab.waitForDisplayed({ timeout: 10000 })
    await todayTab.click()
    await sleep(500)

    // 記録画面固有の要素：aria-label="記録の表示切り替え"
    const filterBar = await browser.$('~記録の表示切り替え')
    await expect(filterBar).toBeDisplayed()
  })
})
