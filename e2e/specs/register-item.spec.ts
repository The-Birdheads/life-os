import { browser, expect } from '@wdio/globals'
import { waitForAppReady } from '../helpers/context'
import { sleep } from '../helpers/wait'

/** FAB（新規登録ボタン）をタップしてメニューを開く */
async function openFABMenu(): Promise<void> {
  const fab = await browser.$('~新規登録')
  await fab.waitForDisplayed({ timeout: 10000 })
  await fab.click()
  await sleep(300)
}

/**
 * 登録モーダルのアコーディオンを展開してタイトルを入力し追加する。
 * モーダルを開いた直後は accordion が折りたたまれているため、
 * 「新しい○○を追加」ボタンで展開してから入力する。
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

  // iOS キーボードが「追加」ボタンを隠す場合がある（特にタスクフォームの date フィールド分だけ
  // ボタンが下にずれる）。スワイプアップでモーダルコンテンツをスクロールしてボタンを
  // キーボードより上に移動してからタップする。
  await browser.action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: 200, y: 490 })   // キーボード直上の空白エリアから
    .down()
    .pause(100)
    .move({ x: 200, y: 290 })   // 上にスワイプ → コンテンツが上にスクロール → ボタンが上へ
    .up()
    .perform()
  await sleep(500)

  const addBtn = await browser.$('~追加')
  await addBtn.waitForDisplayed({ timeout: 5000 })
  await addBtn.click()
  await sleep(1200)
}

/** モーダルの × ボタンで確実に閉じる */
async function closeModal(): Promise<void> {
  const closeBtn = await browser.$('~モーダルを閉じる')
  await closeBtn.waitForDisplayed({ timeout: 5000 })
  await closeBtn.click()
  await sleep(500)
}

/**
 * 登録済みアイテムをタップして編集モーダルを開き削除する（クリーンアップ）。
 * autoAcceptAlerts: true により confirm("本当に削除しますか？") は自動 OK される。
 */
async function deleteItemByTitle(title: string): Promise<void> {
  const item = await browser.$(`~${title}`)
  if (!(await item.isExisting())) return
  await item.click()
  await sleep(500)
  const deleteBtn = await browser.$('~このアイテムを削除')
  if (await deleteBtn.isExisting()) {
    await deleteBtn.click()
    await sleep(800)
  }
}

describe('アイテム登録', () => {
  before(async () => {
    await waitForAppReady(browser)
  })

  it('新規登録ボタンをタップするとFABメニューが展開すること', async () => {
    await openFABMenu()

    await expect(await browser.$('~習慣の登録')).toBeDisplayed()
    await expect(await browser.$('~タスクの登録')).toBeDisplayed()
    await expect(await browser.$('~行動の登録')).toBeDisplayed()

    // オーバーレイをタップしてメニューを閉じる
    await browser.action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: 200, y: 200 })
      .down()
      .pause(100)
      .up()
      .perform()
    await sleep(300)
  })

  it('習慣を登録するとリストに表示されること', async () => {
    const testTitle = 'E2Eテスト習慣'
    try {
      await openFABMenu()
      await (await browser.$('~習慣の登録')).click()
      await sleep(500)

      await expandFormAndAdd('新しい習慣を追加', testTitle)
      await closeModal()

      const item = await browser.$(`~${testTitle}`)
      await item.waitForDisplayed({ timeout: 10000 })
      await expect(item).toBeDisplayed()
    } finally {
      await deleteItemByTitle(testTitle)
    }
  })

  it('タスクを登録するとリストに表示されること', async () => {
    const testTitle = 'E2Eテストタスク'
    try {
      await openFABMenu()
      await (await browser.$('~タスクの登録')).click()
      await sleep(500)

      await expandFormAndAdd('新しいタスクを追加', testTitle)
      await closeModal()

      const item = await browser.$(`~${testTitle}`)
      await item.waitForDisplayed({ timeout: 10000 })
      await expect(item).toBeDisplayed()
    } finally {
      await deleteItemByTitle(testTitle)
    }
  })
})
