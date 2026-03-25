import { browser, expect } from '@wdio/globals'
import { waitForAppReady } from '../helpers/context'
import { sleep } from '../helpers/wait'

/** ハンバーガーメニューを開く */
async function openHamburgerMenu(): Promise<void> {
  const btn = await browser.$('~メニュー')
  await btn.waitForDisplayed({ timeout: 10000 })
  await btn.click()
  await sleep(500)
}

/** ハンバーガーボタンを再タップしてメニューを閉じる */
async function closeHamburgerMenu(): Promise<void> {
  const btn = await browser.$('~メニュー')
  await btn.click()
  await sleep(300)
}

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

    await closeHamburgerMenu()
  })

  it('メニューに「リリースノート」ボタンが表示されること', async () => {
    await openHamburgerMenu()

    const releaseBtn = await browser.$('~リリースノート')
    await expect(releaseBtn).toBeDisplayed()

    await closeHamburgerMenu()
  })

  it('ログイン未設定時に「オフラインモード」ステータスが表示されること', async () => {
    await openHamburgerMenu()

    // オフラインモード or メールアドレス が表示される領域
    const offlineText = await browser.$('~オフラインモード')
    await expect(offlineText).toBeDisplayed()

    await closeHamburgerMenu()
  })

  it('ログイン未設定時に「Googleでログイン」ボタンが表示されること', async () => {
    await openHamburgerMenu()

    const loginBtn = await browser.$('~Googleでログイン')
    await expect(loginBtn).toBeDisplayed()

    await closeHamburgerMenu()
  })

  it('ハンバーガーボタンを再タップするとメニューが閉じること', async () => {
    await openHamburgerMenu()

    // メニューが開いていることを確認
    const menu = await browser.$('~ハンバーガーメニュー')
    await expect(menu).toBeDisplayed()

    // 再タップで閉じる
    const hamburgerBtn = await browser.$('~メニュー')
    await hamburgerBtn.click()
    await sleep(500)

    // メニューが消えていること
    const menuAfter = await browser.$('~ハンバーガーメニュー')
    expect(await menuAfter.isExisting()).toBe(false)
  })
})
