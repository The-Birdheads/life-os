/**
 * スポットライト型の案内(Guide)の、位置の計算。
 * 吹き出しは、照らす場所の上か下のうち収まるほうに置き、画面の上の広告・セーフエリアと、
 * 下のホームインジケーターには重ねない。
 */

export type SpotRect = { x: number; y: number; w: number; h: number };

/** 吹き出しを置いてよい縦の範囲(上端・下端からの余白、px) */
export type Insets = { top: number; bottom: number };

export function makeRoundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
    return [
        `M ${x + r} ${y}`,
        `H ${x + w - r}`,
        `Q ${x + w} ${y} ${x + w} ${y + r}`,
        `V ${y + h - r}`,
        `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
        `H ${x + r}`,
        `Q ${x} ${y + h} ${x} ${y + h - r}`,
        `V ${y + r}`,
        `Q ${x} ${y} ${x + r} ${y} Z`,
    ].join(" ");
}

/**
 * 画面の上下に固定された部分(ヘッダー・下のタブ。data-spotlight-cover)に隠れない、縦の範囲。
 * その中にある要素(下のタブ自体を照らすとき)は対象外
 */
function visibleRange(el: Element, insets: Insets): { top: number; bottom: number } {
    let top = insets.top;
    let bottom = window.innerHeight - insets.bottom;
    document.querySelectorAll<HTMLElement>("[data-spotlight-cover]").forEach((cover) => {
        if (cover.contains(el)) return;
        const r = cover.getBoundingClientRect();
        if (r.height === 0) return;
        if (cover.dataset.spotlightCover === "top") top = Math.max(top, r.bottom);
        else bottom = Math.min(bottom, r.top);
    });
    return { top: top + 8, bottom: bottom - 8 };
}

/**
 * 照らす要素を測る。ヘッダー・下のタブ・広告に隠れていれば、見える範囲のまん中まで動かしてから測る
 * (モーダルの中の要素は、そのモーダルのスクロールで動く)
 */
export function measureTarget(target: string, padding: number, insets: Insets): SpotRect | null {
    const el = document.querySelector(`[data-tutorial="${target}"]`);
    if (!el) return null;
    const range = visibleRange(el, insets);
    const before = el.getBoundingClientRect();
    if (before.top < range.top || before.bottom > range.bottom) {
        el.scrollIntoView({ block: "center" });
        // まん中に寄せても固定部分に隠れるとき(画面のいちばん下の要素など)は、ページを足りない分だけ動かす
        const after = el.getBoundingClientRect();
        if (after.bottom > range.bottom) window.scrollBy(0, after.bottom - range.bottom);
        else if (after.top < range.top) window.scrollBy(0, after.top - range.top);
    }
    return rectOf(el, padding);
}

/** 要素の今の位置(動かさずに測る) */
export function rectOf(el: Element, padding: number): SpotRect {
    const r = el.getBoundingClientRect();
    return { x: r.left - padding, y: r.top - padding, w: r.width + padding * 2, h: r.height + padding * 2 };
}

/** セーフエリア(ノッチ・ホームインジケーター)の高さ。CSS の env() を測る */
function safeArea(): Insets {
    const probe = document.createElement("div");
    probe.style.cssText =
        "position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;" +
        "padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const insets = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
    probe.remove();
    return insets;
}

/** 吹き出しを置いてよい範囲。上は セーフエリア + 広告(adHeight)、下は セーフエリア */
export function tooltipInsets(adHeight: number): Insets {
    const safe = safeArea();
    return { top: safe.top + adHeight + 8, bottom: Math.max(safe.bottom, 8) + 8 };
}

/**
 * 吹き出しの top(px)。prefer の側に収まればそこ、だめなら反対側、どちらにも収まらなければ
 * 広いほうに寄せて画面内に収める(照らす場所に少し重なる)。
 */
export function placeTooltip(
    spot: SpotRect | null,
    prefer: "top" | "bottom",
    height: number,
    viewportHeight: number,
    insets: Insets,
    gap = 12
): number {
    const minTop = insets.top;
    const maxBottom = viewportHeight - insets.bottom;
    const lowest = Math.max(minTop, maxBottom - height);
    if (!spot) return Math.min(Math.max(minTop, minTop + (maxBottom - minTop - height) / 2), lowest);

    const above = { fits: spot.y - gap - height >= minTop, top: spot.y - gap - height, room: spot.y - gap - minTop };
    const below = { fits: spot.y + spot.h + gap + height <= maxBottom, top: spot.y + spot.h + gap, room: maxBottom - (spot.y + spot.h + gap) };
    const [first, second] = prefer === "top" ? [above, below] : [below, above];
    if (first.fits) return first.top;
    if (second.fits) return second.top;
    const roomier = above.room > below.room ? above : below;
    return Math.min(Math.max(roomier.top, minTop), lowest);
}
