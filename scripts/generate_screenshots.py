#!/usr/bin/env python3
"""
App Store スクリーンショット生成スクリプト
出力サイズ: 1290x2796 (iPhone 6.9" / iPhone 15 Pro Max)
"""

import os
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ============================================================
# 設定
# ============================================================

OUTPUT_W = 1290
OUTPUT_H = 2796

# グラデーション設定（#6DCAA6 → 濃いめの緑青）
GRAD_TOP    = (109, 202, 166)   # #6DCAA6
GRAD_BOTTOM = (45,  130, 110)   # #2D826E

# テキスト設定
TEXT_COLOR      = (255, 255, 255)
TEXT_SHADOW     = (0, 0, 0, 80)  # RGBA
FONT_PATH_BOLD  = "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc"
FONT_PATH_LIGHT = "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc"

# レイアウト比率（全体の高さに対する割合）
TEXT_AREA_RATIO   = 0.28   # 上部テキストエリアの高さ
SCREEN_TOP_RATIO  = 0.26   # スクリーンショット上端の位置
SCREEN_BOT_RATIO  = 0.97   # スクリーンショット下端の位置

# スクリーンショット角丸・影
CORNER_RADIUS = 60
SHADOW_OFFSET = (0, 20)
SHADOW_BLUR   = 40
SHADOW_COLOR  = (0, 0, 0, 100)

# スクリーンショット情報
SCREENSHOTS = [
    {
        "input":  "01_record.png",
        "output": "01_record_store.png",
        "lines":  ["忘れたくない習慣・タスクを", "わかりやすく管理"],
    },
    {
        "input":  "02_check.png",
        "output": "02_check_store.png",
        "lines":  ["習慣・タスク・行動は", "1タップで完了済に！"],
    },
    {
        "input":  "03_review.png",
        "output": "03_review_store.png",
        "lines":  ["一日の終わりには振り返り。", "スコアが継続の燃料に"],
    },
    {
        "input":  "04_week.png",
        "output": "04_week_store.png",
        "lines":  ["7日間の軌跡が", "モチベーションを作る"],
    },
    {
        "input":  "05_menu.png",
        "output": "05_menu_store.png",
        "lines":  ["データはクラウドに。", "いつでも、どこでも同期"],
    },
]

# ============================================================
# ヘルパー関数
# ============================================================

def make_gradient(width: int, height: int) -> Image.Image:
    """縦グラデーション背景を生成"""
    img = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(img)
    for y in range(height):
        t = y / (height - 1)
        r = int(GRAD_TOP[0] + (GRAD_BOTTOM[0] - GRAD_TOP[0]) * t)
        g = int(GRAD_TOP[1] + (GRAD_BOTTOM[1] - GRAD_TOP[1]) * t)
        b = int(GRAD_TOP[2] + (GRAD_BOTTOM[2] - GRAD_TOP[2]) * t)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    return img


def add_subtle_pattern(img: Image.Image) -> Image.Image:
    """薄い円形パターンをオーバーレイしてスタイリッシュに"""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    cx, cy = img.width // 2, img.height // 2

    # 大きな薄い円を複数描画
    circles = [
        (cx - 300, cy - 600, 900, 12),
        (cx + 200, cy + 400, 700, 8),
        (cx - 100, cy + 800, 500, 6),
    ]
    for (x, y, r, alpha) in circles:
        draw.ellipse(
            [(x - r, y - r), (x + r, y + r)],
            outline=(255, 255, 255, alpha),
            width=3,
        )

    base = img.convert("RGBA")
    base = Image.alpha_composite(base, overlay)
    return base.convert("RGB")


def round_corners(img: Image.Image, radius: int) -> Image.Image:
    """角丸マスクを適用"""
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), (w - 1, h - 1)], radius=radius, fill=255)
    result = img.convert("RGBA")
    result.putalpha(mask)
    return result


def add_shadow(screen: Image.Image, offset: tuple, blur: int, color: tuple) -> Image.Image:
    """影付きのスクリーンショットを合成した新しい画像を返す"""
    w, h = screen.size
    # 影用のキャンバス（余白込み）
    pad = blur * 3
    canvas_w = w + pad * 2 + abs(offset[0])
    canvas_h = h + pad * 2 + abs(offset[1])

    shadow = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    shadow_layer = Image.new("RGBA", (w, h), color)
    # スクリーンショットのマスクを影に適用
    mask = screen.split()[3] if screen.mode == "RGBA" else Image.new("L", (w, h), 255)
    shadow_layer.putalpha(mask)
    shadow.paste(shadow_layer, (pad + offset[0], pad + offset[1]))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))

    # スクリーン本体を影の上に重ねる
    shadow.paste(screen, (pad, pad), screen)
    return shadow, (pad, pad)


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        print(f"  [警告] フォント読み込み失敗: {path}、デフォルトフォントを使用")
        return ImageFont.load_default()


def draw_text_with_shadow(
    draw: ImageDraw.ImageDraw,
    pos: tuple,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple,
    shadow_offset: tuple = (4, 4),
    shadow_alpha: int = 80,
):
    """影付きテキストを描画"""
    sx, sy = pos[0] + shadow_offset[0], pos[1] + shadow_offset[1]
    r, g, b = fill
    shadow = (0, 0, 0)
    draw.text((sx, sy), text, font=font, fill=shadow + (shadow_alpha,))
    draw.text(pos, text, font=font, fill=fill)


# ============================================================
# メイン処理
# ============================================================

def generate(input_dir: Path, output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)

    for info in SCREENSHOTS:
        input_path = input_dir / info["input"]
        output_path = output_dir / info["output"]

        if not input_path.exists():
            print(f"  [スキップ] {input_path} が見つかりません")
            continue

        print(f"  処理中: {info['input']} → {info['output']}")

        # 1) 背景（グラデーション + パターン）
        bg = make_gradient(OUTPUT_W, OUTPUT_H)
        bg = add_subtle_pattern(bg)
        canvas = bg.convert("RGBA")

        # 2) スクリーンショットを読み込んでリサイズ
        screen_raw = Image.open(input_path).convert("RGBA")
        screen_top    = int(OUTPUT_H * SCREEN_TOP_RATIO)
        screen_bottom = int(OUTPUT_H * SCREEN_BOT_RATIO)
        max_h = screen_bottom - screen_top
        # アスペクト比を保ってリサイズ
        aspect = screen_raw.width / screen_raw.height
        screen_h = max_h
        screen_w = int(screen_h * aspect)
        # 横幅が出力幅を超えないよう制限（左右余白 80px）
        max_w = OUTPUT_W - 160
        if screen_w > max_w:
            screen_w = max_w
            screen_h = int(screen_w / aspect)
        screen_resized = screen_raw.resize((screen_w, screen_h), Image.LANCZOS)

        # 3) 角丸
        screen_rounded = round_corners(screen_resized, CORNER_RADIUS)

        # 4) 影を付けてキャンバスに貼り付け
        screen_with_shadow, (pad_x, pad_y) = add_shadow(
            screen_rounded, SHADOW_OFFSET, SHADOW_BLUR, SHADOW_COLOR
        )
        paste_x = (OUTPUT_W - screen_with_shadow.width) // 2
        paste_y = screen_top - pad_y
        canvas.paste(screen_with_shadow, (paste_x, paste_y), screen_with_shadow)

        # 5) テキスト描画
        draw = ImageDraw.Draw(canvas)
        text_area_h = int(OUTPUT_H * TEXT_AREA_RATIO)

        # フォントサイズ（行数に応じて調整）
        font_size = 88
        font = load_font(FONT_PATH_BOLD, font_size)

        lines = info["lines"]
        line_spacing = 24  # 行間

        # テキスト全体の高さを計算して縦中央揃え
        total_text_h = 0
        line_heights = []
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=font)
            lh = bbox[3] - bbox[1]
            line_heights.append(lh)
            total_text_h += lh
        total_text_h += line_spacing * (len(lines) - 1)

        y = (text_area_h - total_text_h) // 2 + 40  # 少し下にオフセット

        for i, line in enumerate(lines):
            bbox = draw.textbbox((0, 0), line, font=font)
            lw = bbox[2] - bbox[0]
            x = (OUTPUT_W - lw) // 2
            draw_text_with_shadow(draw, (x, y), line, font, TEXT_COLOR, (3, 5), 100)
            y += line_heights[i] + line_spacing

        # 6) 保存
        canvas.convert("RGB").save(output_path, "PNG", optimize=True)
        print(f"    → 保存: {output_path}")

    print("\n完了！")


if __name__ == "__main__":
    script_dir = Path(__file__).parent
    input_dir  = script_dir / "screenshots"
    output_dir = script_dir / "screenshots" / "output"

    print(f"入力ディレクトリ: {input_dir}")
    print(f"出力ディレクトリ: {output_dir}")
    print()

    generate(input_dir, output_dir)
