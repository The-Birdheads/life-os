import { browser, expect } from '@wdio/globals'
import { waitForAppReady } from '../helpers/context'
import { sleep } from '../helpers/wait'

/**
 * 記録タブに移動してフィルターを「すべて」に戻す。
 * FAB は記録タブ限定で表示され、前のテストがフィルターを変更している
 * 場合でも登録済みアイテムが見えるようにする。
 */
async function goToTodayTabWithAllFilter(): Promise<void> {
  const tab = await browser.$('~記録')
  await tab.waitForDisplayed({ timeout: 10000 })
  await tab.click()
  await sleep(400)
  // フィルターを「すべて」に戻す
  const allBtn = await browser.$('//XCUIElementTypeButton[@label="すべて"]')
  if (await allBtn.isExisting()) {
    await allBtn.click()
    await sleep(300)
  }
}

/** FAB をタップしてメニューを開く */
async function openFABMenu(): Promise<void> {
  await goToTodayTabWithAllFilter()
  const fab = await browser.$('~新規登録')
  await fab.waitForDisplayed({ timeout: 10000 })
  await fab.click()
  await sleep(300)
}

/**
 * 登録モーダルのアコーディオンを展開してタイトルを入力し追加する。
 * register-item.spec.ts と同じスクロール + タップのパターン。
 */
async function expandFormAndAdd(addButtonLabel: string, title: string): Promise<void> {
  const expandBtn = await browser.$(`~${addButtonLabel}`)
  await expandBtn.waitForDisplayed({ timeout: 8000 })
  await expandBtn.click()
  await sleep(500)

  const titleField = await browser.$('//XCUIElementTypeTextField[@label="アイテムタイトル入力"]')
  await titleField.waitForDisplayed({ timeout: 5000 })
  await titleField.clearValue()
  await titleField.setValue(title)
  await sleep(300)

  // iOS キーボードが「追加」ボタンを隠す場合があるためスワイプアップでスクロール
  await browser.action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: 200, y: 490 })
    .down()
    .pause(100)
    .move({ x: 200, y: 290 })
    .up()
    .perform()
  await sleep(500)

  const addBtn = await browser.$('~追加')
  await addBtn.waitForDisplayed({ timeout: 5000 })
  await addBtn.click()
  await sleep(1200)
}

/** モーダルの × ボタンで閉じる */
async function closeModal(): Promise<void> {
  const closeBtn = await browser.$('~モーダルを閉じる')
  await closeBtn.waitForDisplayed({ timeout: 5000 })
  await closeBtn.click()
  await sleep(500)
}

describe('アイテム編集モーダル（記録タブ）', () => {
  before(async () => {
    await waitForAppReady(browser)
  })

  it('記録タブの習慣アイテムをタップすると編集モーダルが開くこと', async () => {
    const testTitle = 'E2Eテスト習慣（編集）'
    try {
      // 習慣を登録
      await openFABMenu()
      await (await browser.$('~習慣の登録')).click()
      await sleep(500)
      await expandFormAndAdd('新しい習慣を追加', testTitle)
      await closeModal()

      // 記録タブにアイテムが表示されていることを確認
      const item = await browser.$(`~${testTitle}`)
      await item.waitForDisplayed({ timeout: 10000 })

      // アイテムをタップして TodayView 内の編集モーダルを開く
      await item.click()
      await sleep(500)

      // <h2>習慣の編集</h2> → StaticText label="習慣の編集"
      const modalTitle = await browser.$('~習慣の編集')
      await modalTitle.waitForDisplayed({ timeout: 5000 })
      await expect(modalTitle).toBeDisplayed()

      // 「キャンセル」ボタンで閉じる
      const cancelBtn = await browser.$('~キャンセル')
      await cancelBtn.waitForDisplayed({ timeout: 5000 })
      await cancelBtn.click()
      await sleep(500)
    } finally {
      // クリーンアップ: アイテムを削除
      const item = await browser.$(`~${testTitle}`)
      if (await item.isExisting()) {
        await item.click()
        await sleep(500)
        const deleteBtn = await browser.$('~このアイテムを削除')
        if (await deleteBtn.isExisting()) {
          await deleteBtn.click()
          await sleep(800)
        }
      }
    }
  })

  it('編集モーダルに「保存」「キャンセル」「このアイテムを削除」が表示されること', async () => {
    const testTitle = 'E2Eテスト習慣（ボタン確認）'
    try {
      // 習慣を登録
      await openFABMenu()
      await (await browser.$('~習慣の登録')).click()
      await sleep(500)
      await expandFormAndAdd('新しい習慣を追加', testTitle)
      await closeModal()

      // アイテムをタップして編集モーダルを開く
      const item = await browser.$(`~${testTitle}`)
      await item.waitForDisplayed({ timeout: 10000 })
      await item.click()
      await sleep(500)

      // 3つのボタン/アクションを確認
      await expect(await browser.$('~保存')).toBeDisplayed()
      await expect(await browser.$('~キャンセル')).toBeDisplayed()
      await expect(await browser.$('~このアイテムを削除')).toBeDisplayed()

      // キャンセルで閉じる
      await (await browser.$('~キャンセル')).click()
      await sleep(500)
    } finally {
      const item = await browser.$(`~${testTitle}`)
      if (await item.isExisting()) {
        await item.click()
        await sleep(500)
        const deleteBtn = await browser.$('~このアイテムを削除')
        if (await deleteBtn.isExisting()) {
          await deleteBtn.click()
          await sleep(800)
        }
      }
    }
  })

  it('記録タブのタスクアイテムをタップすると「タスクの編集」モーダルが開くこと', async () => {
    const testTitle = 'E2Eテストタスク（編集）'
    try {
      // タスクを登録
      await openFABMenu()
      await (await browser.$('~タスクの登録')).click()
      await sleep(500)
      await expandFormAndAdd('新しいタスクを追加', testTitle)
      await closeModal()

      // 記録タブにアイテムが表示されていることを確認
      const item = await browser.$(`~${testTitle}`)
      await item.waitForDisplayed({ timeout: 10000 })

      // アイテムをタップ
      await item.click()
      await sleep(500)

      // <h2>タスクの編集</h2>
      const modalTitle = await browser.$('~タスクの編集')
      await modalTitle.waitForDisplayed({ timeout: 5000 })
      await expect(modalTitle).toBeDisplayed()

      // キャンセルで閉じる
      await (await browser.$('~キャンセル')).click()
      await sleep(500)
    } finally {
      const item = await browser.$(`~${testTitle}`)
      if (await item.isExisting()) {
        await item.click()
        await sleep(500)
        const deleteBtn = await browser.$('~このアイテムを削除')
        if (await deleteBtn.isExisting()) {
          await deleteBtn.click()
          await sleep(800)
        }
      }
    }
  })
})
