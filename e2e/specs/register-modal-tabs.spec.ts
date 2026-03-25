import { browser, expect } from '@wdio/globals'
import { waitForAppReady } from '../helpers/context'
import { sleep } from '../helpers/wait'

/** 記録タブに移動する（FAB は記録タブ限定） */
async function goToTodayTab(): Promise<void> {
  const tab = await browser.$('~記録')
  await tab.waitForDisplayed({ timeout: 10000 })
  await tab.click()
  await sleep(400)
}

/** FAB をタップしてメニューを開く */
async function openFABMenu(): Promise<void> {
  await goToTodayTab()
  const fab = await browser.$('~新規登録')
  await fab.waitForDisplayed({ timeout: 10000 })
  await fab.click()
  await sleep(300)
}

/** モーダルの × ボタンで閉じる */
async function closeModal(): Promise<void> {
  const closeBtn = await browser.$('~モーダルを閉じる')
  await closeBtn.waitForDisplayed({ timeout: 5000 })
  await closeBtn.click()
  await sleep(500)
}

describe('登録モーダルのタブ切り替え', () => {
  before(async () => {
    await waitForAppReady(browser)
  })

  it('習慣登録モーダルに「表示中」「非表示」タブが表示されること', async () => {
    await openFABMenu()
    await (await browser.$('~習慣の登録')).click()
    await sleep(500)

    // TaskListModal 内の SegmentedBar ariaLabel="表示切り替え"
    const filterBar = await browser.$('~表示切り替え')
    await filterBar.waitForDisplayed({ timeout: 8000 })
    await expect(filterBar).toBeDisplayed()

    // 「表示中」「非表示」タブの存在確認
    const shownTab = await browser.$('//XCUIElementTypeButton[@label="表示中"]')
    const hiddenTab = await browser.$('//XCUIElementTypeButton[@label="非表示"]')
    await expect(shownTab).toBeDisplayed()
    await expect(hiddenTab).toBeDisplayed()

    await closeModal()
  })

  it('習慣登録モーダルで「非表示」タブをタップすると切り替わること', async () => {
    await openFABMenu()
    await (await browser.$('~習慣の登録')).click()
    await sleep(500)

    // 「非表示」タブをタップ
    const hiddenTab = await browser.$('//XCUIElementTypeButton[@label="非表示"]')
    await hiddenTab.waitForDisplayed({ timeout: 8000 })
    await hiddenTab.click()
    await sleep(400)

    // 非表示タブに切り替わった後、「新しい習慣を追加」ボタンは引き続き表示される
    const addBtn = await browser.$('~新しい習慣を追加')
    await expect(addBtn).toBeDisplayed()

    // 「表示中」タブに戻す
    const shownTab = await browser.$('//XCUIElementTypeButton[@label="表示中"]')
    await shownTab.click()
    await sleep(300)

    await closeModal()
  })

  it('タスク登録モーダルに「表示中」「非表示」タブが表示されること', async () => {
    await openFABMenu()
    await (await browser.$('~タスクの登録')).click()
    await sleep(500)

    const filterBar = await browser.$('~表示切り替え')
    await filterBar.waitForDisplayed({ timeout: 8000 })
    await expect(filterBar).toBeDisplayed()

    const shownTab = await browser.$('//XCUIElementTypeButton[@label="表示中"]')
    const hiddenTab = await browser.$('//XCUIElementTypeButton[@label="非表示"]')
    await expect(shownTab).toBeDisplayed()
    await expect(hiddenTab).toBeDisplayed()

    await closeModal()
  })

  it('行動登録モーダルに「行動ログを追加」ボタンが表示されること', async () => {
    await openFABMenu()
    await (await browser.$('~行動の登録')).click()
    await sleep(500)

    // ActionEntryModal: <h2>行動の登録</h2> → StaticText
    const modalTitle = await browser.$('~行動の登録')
    await modalTitle.waitForDisplayed({ timeout: 8000 })
    await expect(modalTitle).toBeDisplayed()

    // 行動種類が未登録の場合でもボタン自体は DOM に存在する
    // PrimaryBtn type="submit" text="行動ログを追加"
    const submitBtn = await browser.$('~行動ログを追加')
    await expect(submitBtn).toBeDisplayed()

    await closeModal()
  })

  it('行動登録モーダルに「種類の管理」リンクが表示されること', async () => {
    await openFABMenu()
    await (await browser.$('~行動の登録')).click()
    await sleep(500)

    // 「種類の管理」テキストリンクボタン
    const manageLinkBtn = await browser.$('~種類の管理')
    await manageLinkBtn.waitForDisplayed({ timeout: 8000 })
    await expect(manageLinkBtn).toBeDisplayed()

    await closeModal()
  })
})
