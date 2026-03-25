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

/**
 * リリースノートモーダルをオーバーレイの角をタップして閉じる。
 * モーダルカード幅は min(92vw, 720px)。390pt 端末では ≈359pt なので
 * 左端の約 15pt がオーバーレイのみの領域となる。x=5 でタップする。
 */
async function closeReleaseModal(): Promise<void> {
  await browser.action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: 5, y: 400 })
    .down()
    .pause(100)
    .up()
    .perform()
  await sleep(500)
}

describe('リリースノートモーダル', () => {
  before(async () => {
    await waitForAppReady(browser)
  })

  it('「リリースノート」をタップするとモーダルが開くこと', async () => {
    await openHamburgerMenu()

    const releaseBtn = await browser.$('~リリースノート')
    await releaseBtn.waitForDisplayed({ timeout: 5000 })
    await releaseBtn.click()
    await sleep(500)

    // ハンバーガーメニューが閉じ、モーダル内の「リリースノート」見出しが表示される
    // <b>リリースノート</b> → StaticText label="リリースノート"
    const heading = await browser.$('~リリースノート')
    await heading.waitForDisplayed({ timeout: 5000 })
    await expect(heading).toBeDisplayed()

    await closeReleaseModal()
  })

  it('モーダルにバージョン情報が表示されること', async () => {
    await openHamburgerMenu()
    await (await browser.$('~リリースノート')).click()
    await sleep(500)

    // RELEASE_NOTES の先頭バージョン "v0.9.3" が StaticText として露出される
    // <b>v{r.version}</b> → StaticText label="v0.9.3"
    const versionText = await browser.$('~v0.9.3')
    await versionText.waitForDisplayed({ timeout: 5000 })
    await expect(versionText).toBeDisplayed()

    await closeReleaseModal()
  })

  it('モーダル外をタップすると閉じること', async () => {
    await openHamburgerMenu()
    await (await browser.$('~リリースノート')).click()
    await sleep(500)

    // モーダルが開いていることを確認
    const heading = await browser.$('~リリースノート')
    await expect(heading).toBeDisplayed()

    // オーバーレイ端をタップして閉じる
    await closeReleaseModal()

    // モーダルが閉じた後は「リリースノート」見出し StaticText が消える。
    // 代わりに「バージョン」ラベル（ハンバーガーメニュー内）も消えているため
    // 「リリースノート」要素全体が非表示になる。
    await browser.waitUntil(
      async () => {
        const el = await browser.$('~リリースノート')
        return !(await el.isExisting())
      },
      { timeout: 5000, timeoutMsg: 'リリースノートモーダルが閉じませんでした' }
    )
  })
})
