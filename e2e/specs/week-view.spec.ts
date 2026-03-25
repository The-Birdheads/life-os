import { browser, expect } from '@wdio/globals'
import { waitForAppReady } from '../helpers/context'
import { sleep } from '../helpers/wait'

/** 週タブへ移動する */
async function goToWeekTab(): Promise<void> {
  const tab = await browser.$('~週')
  await tab.waitForDisplayed({ timeout: 10000 })
  await tab.click()
  await sleep(800) // データ読み込み待機を含む
}

describe('週表示ビュー', () => {
  before(async () => {
    await waitForAppReady(browser)
  })

  it('週タブをタップするとテーブルのカラムヘッダーが表示されること', async () => {
    await goToWeekTab()

    // 週テーブルの列ヘッダー（th 要素のテキスト）
    await expect(await browser.$('~日付')).toBeDisplayed()
    await expect(await browser.$('~習慣')).toBeDisplayed()
    await expect(await browser.$('~タスク')).toBeDisplayed()
    await expect(await browser.$('~行動')).toBeDisplayed()
    await expect(await browser.$('~充実度')).toBeDisplayed()
  })

  it('週テーブルに7日分の行ボタンが表示されること', async () => {
    await goToWeekTab()

    // データ読み込みが完了するまで待機（weekLoading が false になる）
    await browser.waitUntil(
      async () => {
        const btns = await browser.$$('//XCUIElementTypeButton[contains(@label, "の振り返りを開く")]')
        return btns.length >= 7
      },
      { timeout: 10000, timeoutMsg: '7日分の行ボタンが表示されませんでした' }
    )

    const finalBtns = await browser.$$('//XCUIElementTypeButton[contains(@label, "の振り返りを開く")]')
    expect(finalBtns.length).toBe(7)
  })

  it('週テーブルの行ボタンをタップすると振り返りビューに遷移すること', async () => {
    await goToWeekTab()

    // データ読み込み待機
    await browser.waitUntil(
      async () => {
        const btns = await browser.$$('//XCUIElementTypeButton[contains(@label, "の振り返りを開く")]')
        return btns.length >= 1
      },
      { timeout: 10000, timeoutMsg: '行ボタンが表示されませんでした' }
    )

    // 最初の行ボタンをタップ
    const firstRowBtn = await browser.$('//XCUIElementTypeButton[contains(@label, "の振り返りを開く")]')
    await firstRowBtn.click()
    await sleep(800)

    // 振り返りビューに遷移したことを確認
    const reviewFilterBar = await browser.$('~振り返りの表示切り替え')
    await reviewFilterBar.waitForDisplayed({ timeout: 10000 })
    await expect(reviewFilterBar).toBeDisplayed()

    // 週タブに戻る
    const weekTab = await browser.$('~週')
    await weekTab.click()
    await sleep(500)
  })
})
