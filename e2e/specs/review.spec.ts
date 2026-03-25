import { browser, expect } from '@wdio/globals'
import { waitForAppReady } from '../helpers/context'
import { sleep } from '../helpers/wait'

/** 振り返りタブへ移動する */
async function goToReviewTab(): Promise<void> {
  const tab = await browser.$('~振り返り')
  await tab.waitForDisplayed({ timeout: 10000 })
  await tab.click()
  await sleep(500)
}

describe('振り返りビュー', () => {
  before(async () => {
    await waitForAppReady(browser)
  })

  it('振り返りタブをタップするとフィルターバーが表示されること', async () => {
    await goToReviewTab()

    const filterBar = await browser.$('~振り返りの表示切り替え')
    await filterBar.waitForDisplayed({ timeout: 10000 })
    await expect(filterBar).toBeDisplayed()
  })

  it('未記入時に「振り返りを記入」ボタンが表示されること', async () => {
    await goToReviewTab()

    // 振り返りが未登録の場合に表示されるプレースホルダーボタン
    const writeBtn = await browser.$('~振り返りを記入')
    await writeBtn.waitForDisplayed({ timeout: 10000 })
    await expect(writeBtn).toBeDisplayed()
  })

  it('「振り返りを記入」をタップすると入力フォームが表示されること', async () => {
    await goToReviewTab()

    const writeBtn = await browser.$('~振り返りを記入')
    await writeBtn.waitForDisplayed({ timeout: 10000 })
    await writeBtn.click()
    await sleep(500)

    // フォーム内の「保存」ボタンが現れることで入力フォームの展開を確認
    const saveBtn = await browser.$('~保存')
    await saveBtn.waitForDisplayed({ timeout: 5000 })
    await expect(saveBtn).toBeDisplayed()
  })

  it('振り返りビューに「ダッシュボード」セクションが表示されること', async () => {
    await goToReviewTab()

    // SectionTitle title="ダッシュボード" → h3 テキストがアクセシビリティラベルになる
    const dashboardTitle = await browser.$('~ダッシュボード')
    await dashboardTitle.waitForDisplayed({ timeout: 10000 })
    await expect(dashboardTitle).toBeDisplayed()
  })

  it('振り返りビューに「実施したこと一覧」セクションが表示されること', async () => {
    await goToReviewTab()

    const listTitle = await browser.$('~実施したこと一覧')
    await listTitle.waitForDisplayed({ timeout: 10000 })
    await expect(listTitle).toBeDisplayed()
  })
})
