"""まいにちコンパスのアプリアイコンとスプラッシュ画面を描いて、iOS・Android・Web の各サイズに書き出す。

形: コンパスの白い輪の右側(上下の真ん中)を開けて黄色の＋を置き、輪と＋で「C＋」に見せる。
    輪の中に北(上)を指す針。地は明るいミントのグラデーション。
    (Safari のアイコンに似ないよう、目盛りは付けず、針は上向き)

使い方(リポジトリのルートで):
    python3 scripts/app-icon/generate.py

必要なもの: Pillow, numpy
書き出すファイル(既存のファイルの大きさに合わせて上書きする):
    assets/icon.png, assets/splash.png
    ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
    ios/App/App/Assets.xcassets/Splash.imageset/Default@{1,2,3}x~universal~anyany(-dark).png
    android/app/src/main/res/mipmap-*/ic_launcher*.png
    android/app/src/main/res/drawable*/splash.png
    public/assets/icons/icon-*.webp
スプラッシュの地の色(SPLASH_BG)は、LaunchScreen.storyboard と capacitor.config.ts の backgroundColor にも同じ値を入れている。
"""
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]

# --- 色と形 -----------------------------------------------------------------
GRAD_TOP, GRAD_BOTTOM = "#8af0c8", "#3fd3a0"  # アイコンの地(上 → 下)
SPLASH_BG = "#64e1b4"                          # スプラッシュの地(アイコンの地の真ん中の色)
RING = "#ffffff"
PLUS = "#fcd34d"
NEEDLE_TIP = ("#fb923c", "#f97316")            # 北側(明・暗)
NEEDLE_TAIL = ("#ffffff", "#e2f7ef")           # 南側(明・暗)

CX, CY, R, W = 488, 512, 290, 140              # 1024 のときの輪の中心・半径・太さ(気持ち右へ寄せている)
GAP = 30 + W * 0.03 + max(0, W - 100) * 0.25   # 右側の開き(上下それぞれの角度)
PLUS_THICK = 40 + W * 0.34
PLUS_ARM = 118 + W * 0.18

S = 4096                                       # 大きく描いてから縮める(ふちをなめらかに)
K = S / 1024


def k(v):
    return v * K


def rgba(h, a=255):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


def blank():
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def gradient(top, bottom):
    t = np.linspace(0, 1, S, dtype=np.float32)[:, None, None]
    a, b = np.array(rgba(top), np.float32), np.array(rgba(bottom), np.float32)
    img = np.broadcast_to(a + (b - a) * t, (S, S, 4))
    return Image.fromarray(img.astype(np.uint8)).convert("RGBA")


def with_shadow(base, shape, dy, blur, alpha):
    a = shape.getchannel("A").point(lambda v: v * alpha // 255)
    sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sh.putalpha(a)
    sh = sh.filter(ImageFilter.GaussianBlur(k(blur)))
    moved = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    moved.paste(sh, (0, int(k(dy))))
    base.alpha_composite(moved)
    base.alpha_composite(shape)


def circle(d, cx, cy, r, fill):
    d.ellipse([k(cx - r), k(cy - r), k(cx + r), k(cy + r)], fill=fill)


def thick_line(d, pts, w, col):
    for a, b in zip(pts, pts[1:]):
        d.line([k(a[0]), k(a[1]), k(b[0]), k(b[1])], fill=col, width=int(k(w)))
    for p in pts:
        circle(d, p[0], p[1], w / 2, col)


def draw_symbol(base):
    """輪・＋・針を base に描く(base はグラデーションでも透明でもよい)"""
    lay, d = blank()
    steps = int(360 - 2 * GAP)
    pts = [(CX + math.cos(math.radians(-GAP - i)) * R, CY + math.sin(math.radians(-GAP - i)) * R) for i in range(steps + 1)]
    thick_line(d, pts, W, rgba(RING))
    with_shadow(base, lay, 10, 18, 40)

    lay, d = blank()
    px, py, t, a = CX + R + 6, CY, PLUS_THICK, PLUS_ARM
    d.rounded_rectangle([k(px - a), k(py - t / 2), k(px + a), k(py + t / 2)], radius=k(t / 2), fill=rgba(PLUS))
    d.rounded_rectangle([k(px - t / 2), k(py - a), k(px + t / 2), k(py + a)], radius=k(t / 2), fill=rgba(PLUS))
    with_shadow(base, lay, 10, 16, 50)

    lay, d = blank()
    length = min(175, R - W / 2 - 34)
    width = length * 0.64
    tip, tail = (k(CX), k(CY - length)), (k(CX), k(CY + length))
    left, right, c = (k(CX - width / 2), k(CY)), (k(CX + width / 2), k(CY)), (k(CX), k(CY))
    d.polygon([tip, left, c], fill=rgba(NEEDLE_TIP[0]))
    d.polygon([tip, right, c], fill=rgba(NEEDLE_TIP[1]))
    d.polygon([tail, left, c], fill=rgba(NEEDLE_TAIL[0]))
    d.polygon([tail, right, c], fill=rgba(NEEDLE_TAIL[1]))
    circle(d, CX, CY, 20, rgba(RING))
    with_shadow(base, lay, 12, 18, 55)
    return base


def icon_master():
    """角の丸めなしの正方形(iOS が角を丸める)"""
    return draw_symbol(gradient(GRAD_TOP, GRAD_BOTTOM))


def symbol_master():
    """地のない絵だけ(スプラッシュ用)"""
    img, _ = blank()
    return draw_symbol(img)


def round_master(symbol):
    """丸いアイコン用。円に＋が収まるよう、絵を小さくして真ん中に置く"""
    base = gradient(GRAD_TOP, GRAD_BOTTOM)
    s = int(S * 0.84)
    base.alpha_composite(symbol.resize((s, s), Image.LANCZOS), ((S - s) // 2, (S - s) // 2))
    return base


def rounded(img, size, radius_ratio):
    im = img.resize((size, size), Image.LANCZOS)
    m = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], radius=int(size * 4 * radius_ratio), fill=255)
    im.putalpha(m.resize((size, size), Image.LANCZOS))
    return im


def splash(symbol, w, h, scale):
    """地を SPLASH_BG で塗り、真ん中に絵を置く。scale は短い辺に対する絵(1024 の枠)の大きさ"""
    bg = Image.new("RGBA", (w, h), rgba(SPLASH_BG))
    size = max(1, int(min(w, h) * scale))
    sym = symbol.resize((size, size), Image.LANCZOS)
    bg.alpha_composite(sym, ((w - size) // 2, (h - size) // 2))
    return bg.convert("RGB")


def size_of(p):
    with Image.open(p) as im:
        return im.size


def main():
    icon = icon_master()
    symbol = symbol_master()
    round_icon = round_master(symbol)
    written = []

    def save(img, p, **kw):
        p.parent.mkdir(parents=True, exist_ok=True)
        img.save(p, **kw)
        written.append(p.relative_to(ROOT))

    icon1024 = icon.resize((1024, 1024), Image.LANCZOS).convert("RGB")
    save(icon1024, ROOT / "assets/icon.png")
    save(icon1024, ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")

    # iOS のスプラッシュ(正方形を画面いっぱいに拡大して表示する。縦長の画面では左右が切れる)
    save(splash(symbol, 2732, 2732, 0.23), ROOT / "assets/splash.png")
    ios_splash = ROOT / "ios/App/App/Assets.xcassets/Splash.imageset"
    for f in sorted(ios_splash.glob("Default@*~universal~anyany*.png")):
        w, h = size_of(f)
        save(splash(symbol, w, h, 0.23), f)

    # Android のアイコン
    res = ROOT / "android/app/src/main/res"
    for d in sorted(res.glob("mipmap-*dpi")):
        n = d / "ic_launcher.png"
        if n.exists():
            s = size_of(n)[0]
            save(rounded(icon, s, 0.18), n)
            save(rounded(round_icon, s, 0.5), d / "ic_launcher_round.png")
        f = d / "ic_launcher_foreground.png"
        if f.exists():
            s = size_of(f)[0]
            save(icon.resize((s, s), Image.LANCZOS).convert("RGB"), f)
            save(Image.new("RGB", (s, s), rgba(SPLASH_BG)[:3]), d / "ic_launcher_background.png")

    # Android のスプラッシュ(画面の大きさのまま。絵は短い辺の半分)
    for f in sorted(res.glob("drawable*/splash.png")):
        w, h = size_of(f)
        save(splash(symbol, w, h, 0.5), f)

    # Web(PWA)のアイコン
    for f in sorted((ROOT / "public/assets/icons").glob("icon-*.webp")):
        s = size_of(f)[0]
        save(icon.resize((s, s), Image.LANCZOS).convert("RGB"), f, quality=92)

    for p in written:
        print(p)


if __name__ == "__main__":
    main()
