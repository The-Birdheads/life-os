import { browser, expect } from '@wdio/globals'
import { waitForAppReady } from '../helpers/context'
import { sleep } from '../helpers/wait'

/**
 * 記録タブへ移動する。
 * 他テストが別タブに遷移した後でも呼び出せるようにする。
 */
async function goToTodayTab(): Promise<void> {
  const tab = await browser.$('~記録')
  await tab.waitForDisplayed({ timeout: 10000 })
  await tab.click()
  await sleep(500)
}

describe('フィルターセグメント（記録タブ）', () => {
  before(async () => {
    await waitForAppReady(browser)
  })

  it('記録タブにフィルターバーが表示されること', async () => {
    await goToTodayTab()

    const filterBar = await browser.$('~記録の表示切り替え')
    await filterBar.waitForDisplayed({ timeout: 10000 })
    await expect(filterBar).toBeDisplayed()
  })

  it('「すべて」「習慣」「タスク」「行動」の4つのタブが表示されること', async () => {
    await goToTodayTab()

    // SegmentedBar の各タブは role="tab" のボタン。
    // XPath で type と label を組み合わせて一意に特定する。
    const allTab = await browser.$('//XCUIElementTypeButton[@label="すべて"]')
    const habitTab = await browser.$('//XCUIElementTypeButton[@label="習慣"]')
    const taskTab = await browser.$('//XCUIElementTypeButton[@label="タスク"]')
    const actionTab = await browser.$('//XCUIElementTypeButton[@label="行動"]')

    await expect(allTab).toBeDisplayed()
    await expect(habitTab).toBeDisplayed()
    await expect(taskTab).toBeDisplayed()
    await expect(actionTab).toBeDisplayed()
  })

  it('「習慣」フィルターをタップすると習慣セクションのみ表示されること', async () => {
    await goToTodayTab()

    // 「習慣」タブをタップ
    const habitTab = await browser.$('//XCUIElementTypeButton[@label="習慣"]')
    await habitTab.waitForDisplayed({ timeout: 5000 })
    await habitTab.click()
    await sleep(500)

    // 習慣セクションの空状態メッセージが表示される（データなしの場合）
    const habitEmptyMsg = await browser.$('~まだありません（タスクタブで追加）')
    await expect(habitEmptyMsg).toBeDisplayed()

    // タスクセクションは DOM から除去されているはず
    const taskEmptyMsg = await browser.$('~タスクがありません（タスクタブで追加）')
    expect(await taskEmptyMsg.isExisting()).toBe(false)
  })

  it('「タスク」フィルターをタップするとタスクセクションのみ表示されること', async () => {
    await goToTodayTab()

    // 「タスク」タブをタップ
    const taskTab = await browser.$('//XCUIElementTypeButton[@label="タスク"]')
    await taskTab.waitForDisplayed({ timeout: 5000 })
    await taskTab.click()
    await sleep(500)

    // タスクセクションの空状態メッセージが表示される（データなしの場合）
    const taskEmptyMsg = await browser.$('~タスクがありません（タスクタブで追加）')
    await expect(taskEmptyMsg).toBeDisplayed()

    // 習慣セクションは DOM から除去されているはず
    const habitEmptyMsg = await browser.$('~まだありません（タスクタブで追加）')
    expect(await habitEmptyMsg.isExisting()).toBe(false)
  })

  it('「行動」フィルターをタップすると行動セクションのみ表示されること', async () => {
    await goToTodayTab()

    // 「行動」タブをタップ
    const actionTab = await browser.$('//XCUIElementTypeButton[@label="行動"]')
    await actionTab.waitForDisplayed({ timeout: 5000 })
    await actionTab.click()
    await sleep(500)

    // 行動セクションの空状態メッセージが表示される（データなしの場合）
    const actionEmptyMsg = await browser.$('~まだありません')
    await expect(actionEmptyMsg).toBeDisplayed()

    // 習慣・タスクセクションは DOM から除去されているはず
    const habitEmptyMsg = await browser.$('~まだありません（タスクタブで追加）')
    expect(await habitEmptyMsg.isExisting()).toBe(false)

    const taskEmptyMsg = await browser.$('~タスクがありません（タスクタブで追加）')
    expect(await taskEmptyMsg.isExisting()).toBe(false)
  })

  it('「すべて」フィルターに戻すと全セクションが表示されること', async () => {
    await goToTodayTab()

    // まず「習慣」に切り替えてから「すべて」に戻す
    const habitTab = await browser.$('//XCUIElementTypeButton[@label="習慣"]')
    await habitTab.click()
    await sleep(300)

    const allTab = await browser.$('//XCUIElementTypeButton[@label="すべて"]')
    await allTab.click()
    await sleep(500)

    // 習慣・タスク両セクションの空状態メッセージが表示される
    const habitEmptyMsg = await browser.$('~まだありません（タスクタブで追加）')
    await expect(habitEmptyMsg).toBeDisplayed()

    const taskEmptyMsg = await browser.$('~タスクがありません（タスクタブで追加）')
    await expect(taskEmptyMsg).toBeDisplayed()
  })
})
