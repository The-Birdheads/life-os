import { browser, expect } from '@wdio/globals'
import { waitForAppReady } from '../helpers/context'
import { sleep } from '../helpers/wait'

/**
 * ヘッダーに表示されている日付テキストを取得する。
 * 例: "2026 / 03 / 25"
 */
async function getHeaderDateLabel(): Promise<string> {
  // ヘッダーの日付表示は XCUIElementTypeStaticText で取得可能
  const dateTexts = await browser.$$('//XCUIElementTypeStaticText')
  for (const el of dateTexts) {
    const label = await el.getAttribute('label')
    // "YYYY / MM / DD" 形式にマッチ
    if (label && /\d{4} \/ \d{2} \/ \d{2}/.test(label)) {
      return label
    }
  }
  return ''
}

describe('日付ナビゲーション', () => {
  before(async () => {
    await waitForAppReady(browser)
  })

  it('◀ボタンをタップすると前日に移動すること', async () => {
    const dateBefore = await getHeaderDateLabel()

    const prevBtn = await browser.$('//XCUIElementTypeButton[@label="◀"]')
    await prevBtn.waitForDisplayed({ timeout: 10000 })
    await prevBtn.click()
    await sleep(500)

    const dateAfter = await getHeaderDateLabel()
    expect(dateAfter).not.toBe(dateBefore)
    // 前日なので before > after（文字列比較で YYYY/MM/DD は正常に機能する）
    expect(dateAfter < dateBefore).toBe(true)
  })

  it('▶ボタンで翌日（当日方向）に戻れること', async () => {
    // すでに前日にいる状態
    const dateBefore = await getHeaderDateLabel()

    const nextBtn = await browser.$('//XCUIElementTypeButton[@label="▶"]')
    await nextBtn.waitForDisplayed({ timeout: 10000 })
    await nextBtn.click()
    await sleep(500)

    const dateAfter = await getHeaderDateLabel()
    expect(dateAfter > dateBefore).toBe(true)
  })

  it('当日表示時に▶ボタンが非活性（opacity 0.4）になっていること', async () => {
    // 当日に移動済みの状態で確認
    // XCUITest では disabled 属性で確認
    const nextBtn = await browser.$('//XCUIElementTypeButton[@label="▶"]')
    await nextBtn.waitForDisplayed({ timeout: 10000 })

    // 当日の場合 onClick が何もしないが、ボタン自体は enabled のまま opacity だけ変わる
    // → アクセシビリティ的には enabled だが、連続タップしても日付が変わらないことで検証
    const dateBefore = await getHeaderDateLabel()
    await nextBtn.click()
    await sleep(300)
    const dateAfter = await getHeaderDateLabel()

    expect(dateBefore).toBe(dateAfter)
  })
})
