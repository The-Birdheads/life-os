"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { toPng } from "html-to-image";

// ── iPhone dimensions (design at largest, export at selected) ──
const IPHONE_SIZES = [
  { label: '6.9"', w: 1320, h: 2868 },
  { label: '6.5"', w: 1284, h: 2778 },
  { label: '6.3"', w: 1206, h: 2622 },
  { label: '6.1"', w: 1125, h: 2436 },
] as const;

// ── Mockup pre-measured offsets (from SKILL.md) ─────────────────
const MK_W = 1022;
const MK_H = 2082;
const SC_L = (52 / MK_W) * 100;
const SC_T = (46 / MK_H) * 100;
const SC_W = (918 / MK_W) * 100;
const SC_H = (1990 / MK_H) * 100;
const SC_RX = (126 / 918) * 100;
const SC_RY = (126 / 1990) * 100;

// ── Slide definitions ────────────────────────────────────────────
const SLIDES = [
  {
    id: "01_record",
    src: "/screenshots/01_record.png",
    label: "習慣・タスク・行動",
    headline: ["忘れたくない", "習慣・タスクを", "わかりやすく管理"],
    bg: "linear-gradient(155deg, #E8F8F3 0%, #A8DCC8 100%)",
    textColor: "#0F2D22",
    labelColor: "#3A9E7A",
    pillStyle: true,
    decorColor: "rgba(109,202,166,0.18)",
  },
  {
    id: "02_check",
    src: "/screenshots/02_check.png",
    label: "1タップで完了",
    headline: ["やることを", "1タップで", "完了済みに"],
    bg: "linear-gradient(150deg, #6DCAA6 0%, #38A07C 100%)",
    textColor: "#FFFFFF",
    labelColor: "rgba(255,255,255,0.80)",
    pillStyle: false,
    decorColor: "rgba(255,255,255,0.08)",
  },
  {
    id: "03_review",
    src: "/screenshots/03_review.png",
    label: "毎日の振り返り",
    headline: ["一日を振り返り", "スコアを記録。", "継続が力になる"],
    bg: "linear-gradient(160deg, #1A3A2E 0%, #0A1F18 100%)",
    textColor: "#FFFFFF",
    labelColor: "#6DCAA6",
    pillStyle: false,
    decorColor: "rgba(109,202,166,0.07)",
  },
  {
    id: "04_week",
    src: "/screenshots/04_week.png",
    label: "週間ビュー",
    headline: ["7日間の軌跡が", "モチベーションを", "作る"],
    bg: "linear-gradient(150deg, #F4FCF8 0%, #C2EDD8 100%)",
    textColor: "#0F2D22",
    labelColor: "#3A9E7A",
    pillStyle: true,
    decorColor: "rgba(109,202,166,0.15)",
  },
  {
    id: "05_menu",
    src: "/screenshots/05_menu.png",
    label: "クラウド同期",
    headline: ["データはクラウドに。", "いつでも", "どこでも同期"],
    bg: "linear-gradient(160deg, #2E7259 0%, #1A3A2E 100%)",
    textColor: "#FFFFFF",
    labelColor: "#A8DCC8",
    pillStyle: false,
    decorColor: "rgba(255,255,255,0.05)",
  },
] as const;

type SlideConfig = (typeof SLIDES)[number];

// ── Phone Mockup ─────────────────────────────────────────────────
function Phone({
  src,
  alt,
  style,
}: {
  src: string;
  alt: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: `${MK_W}/${MK_H}`,
        ...style,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mockup.png"
        alt=""
        style={{ display: "block", width: "100%", height: "100%" }}
        draggable={false}
      />
      <div
        style={{
          position: "absolute",
          left: `${SC_L}%`,
          top: `${SC_T}%`,
          width: `${SC_W}%`,
          height: `${SC_H}%`,
          borderRadius: `${SC_RX}% / ${SC_RY}%`,
          overflow: "hidden",
          zIndex: 10,
          background: "#F0F0F0",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top",
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

// ── Single Slide (renders at exact W×H) ──────────────────────────
function Slide({ slide, W, H }: { slide: SlideConfig; W: number; H: number }) {
  const labelSize = W * 0.03;
  const headlineSize = W * 0.091;
  const phoneW = W * 0.83;
  const topH = H * 0.37;

  return (
    <div
      style={{
        width: W,
        height: H,
        background: slide.bg,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Noto Sans JP, sans-serif",
      }}
    >
      {/* Decorative blobs */}
      <div
        style={{
          position: "absolute",
          width: W * 1.2,
          height: W * 1.2,
          borderRadius: "50%",
          background: slide.decorColor,
          bottom: -(W * 0.35),
          left: -(W * 0.1),
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: W * 0.7,
          height: W * 0.7,
          borderRadius: "50%",
          background: slide.decorColor,
          top: -(W * 0.12),
          right: -(W * 0.18),
          pointerEvents: "none",
        }}
      />

      {/* ── Text area ── */}
      <div
        style={{
          height: topH,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          paddingLeft: W * 0.1,
          paddingRight: W * 0.08,
          paddingBottom: H * 0.025,
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Category label */}
        <div style={{ marginBottom: H * 0.018 }}>
          <span
            style={{
              fontSize: labelSize,
              fontWeight: 600,
              color: slide.labelColor,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              ...(slide.pillStyle
                ? {
                    background: "rgba(109,202,166,0.15)",
                    border: "1.5px solid rgba(109,202,166,0.35)",
                    borderRadius: labelSize * 2,
                    padding: `${labelSize * 0.3}px ${labelSize * 0.9}px`,
                  }
                : {}),
            }}
          >
            {slide.label}
          </span>
        </div>

        {/* Headline */}
        <div>
          {slide.headline.map((line, i) => (
            <div
              key={i}
              style={{
                fontSize: headlineSize,
                fontWeight: 700,
                color: slide.textColor,
                lineHeight: 1.18,
                letterSpacing: "-0.01em",
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* ── Phone area ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          position: "relative",
          zIndex: 2,
        }}
      >
        <Phone
          src={slide.src}
          alt={slide.label}
          style={{
            width: phoneW,
            transform: "translateY(7%)",
            filter: "drop-shadow(0px 28px 52px rgba(0,0,0,0.28))",
          }}
        />
      </div>
    </div>
  );
}

// ── Per-slide component with preview + offscreen export ──────────
function SlideCard({
  slide,
  index,
  sizeConfig,
  onExport,
  isExporting,
}: {
  slide: SlideConfig;
  index: number;
  sizeConfig: (typeof IPHONE_SIZES)[number];
  onExport: (slide: SlideConfig, el: HTMLElement) => Promise<void>;
  isExporting: boolean;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const offscreenRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.18);

  useEffect(() => {
    if (!previewRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setScale(width / sizeConfig.w);
    });
    obs.observe(previewRef.current);
    return () => obs.disconnect();
  }, [sizeConfig.w]);

  return (
    <div className="flex flex-col gap-2">
      {/* Preview card */}
      <div
        ref={previewRef}
        className="relative overflow-hidden rounded-2xl shadow-xl cursor-pointer group"
        style={{ aspectRatio: `${sizeConfig.w}/${sizeConfig.h}` }}
        onClick={() =>
          offscreenRef.current &&
          !isExporting &&
          onExport(slide, offscreenRef.current)
        }
      >
        <div
          style={{
            width: sizeConfig.w,
            height: sizeConfig.h,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <Slide slide={slide} W={sizeConfig.w} H={sizeConfig.h} />
        </div>
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white font-semibold text-xs bg-black/60 px-3 py-1.5 rounded-full">
            {isExporting ? "処理中…" : "クリックで書き出し"}
          </span>
        </div>
      </div>

      {/* Label */}
      <div className="text-center">
        <p className="text-xs text-gray-400 font-mono">
          {String(index + 1).padStart(2, "0")}
        </p>
        <p className="text-sm font-medium text-gray-700">{slide.label}</p>
      </div>

      {/* Offscreen export target (fixed, off-screen) */}
      <div
        ref={offscreenRef}
        data-offscreen
        data-slideid={slide.id}
        style={{
          position: "fixed",
          left: -9999,
          top: 0,
          width: sizeConfig.w,
          height: sizeConfig.h,
          opacity: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <Slide slide={slide} W={sizeConfig.w} H={sizeConfig.h} />
      </div>
    </div>
  );
}

// ── Image preload helper ──────────────────────────────────────────
// Wait until every <img> inside `el` has finished loading
async function waitForImages(el: HTMLElement): Promise<void> {
  const imgs = Array.from(el.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true }); // don't block on error
      });
    })
  );
}

// ── Main Page ────────────────────────────────────────────────────
export default function ScreenshotsPage() {
  const [sizeIndex, setSizeIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const sizeConfig = IPHONE_SIZES[sizeIndex];

  // Export a single slide
  const exportSlide = useCallback(
    async (slide: SlideConfig, el: HTMLElement) => {
      if (isExporting) return;
      setIsExporting(true);
      setExportStatus(`書き出し中: ${slide.label}…`);
      try {
        // Move on-screen so browser can render & load images
        el.style.left = "0px";
        el.style.opacity = "1";
        el.style.zIndex = "-1";

        // Wait for all <img> tags to fully load before capturing
        await waitForImages(el);
        await new Promise((r) => setTimeout(r, 300));

        const opts = {
          width: sizeConfig.w,
          height: sizeConfig.h,
          pixelRatio: 1,
          // cacheBust removed — caused some images to reload and miss capture window
        };
        await toPng(el, opts); // warm-up (inlines fonts)
        const dataUrl = await toPng(el, opts); // real capture

        el.style.left = "-9999px";
        el.style.opacity = "0";
        el.style.zIndex = "-1";

        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${slide.id}-${sizeConfig.w}x${sizeConfig.h}.png`;
        a.click();
        setExportStatus(`✓ ${slide.label} を書き出しました`);
      } catch (err) {
        console.error(err);
        setExportStatus("書き出しエラー");
      } finally {
        setIsExporting(false);
        setTimeout(() => setExportStatus(""), 3500);
      }
    },
    [isExporting, sizeConfig]
  );

  // Export all slides sequentially
  const exportAll = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    const els = document.querySelectorAll<HTMLElement>("[data-offscreen]");
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      const slideId = el.dataset.slideid ?? String(i + 1).padStart(2, "0");
      setExportStatus(`書き出し中 (${i + 1}/${els.length}): ${slideId}`);

      el.style.left = "0px";
      el.style.opacity = "1";
      el.style.zIndex = "-1";

      // Wait for images to load before capturing
      await waitForImages(el);
      await new Promise((r) => setTimeout(r, 300));

      const opts = {
        width: sizeConfig.w,
        height: sizeConfig.h,
        pixelRatio: 1,
      };
      await toPng(el, opts);
      const dataUrl = await toPng(el, opts);

      el.style.left = "-9999px";
      el.style.opacity = "0";
      el.style.zIndex = "-1";

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${slideId}-${sizeConfig.w}x${sizeConfig.h}.png`;
      a.click();

      await new Promise((r) => setTimeout(r, 350));
    }
    setIsExporting(false);
    setExportStatus(`✓ 全 ${els.length} 枚の書き出し完了`);
    setTimeout(() => setExportStatus(""), 4000);
  }, [isExporting, sizeConfig]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── Toolbar ── */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4 flex-wrap">
          {/* App identity */}
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/app-icon.png"
              alt="Habitas"
              className="w-8 h-8 rounded-xl"
            />
            <span className="font-bold text-gray-800 text-sm">Habitas</span>
          </div>
          <span className="text-gray-300 hidden sm:block">|</span>

          {/* Size selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium">
              書き出しサイズ:
            </label>
            <select
              value={sizeIndex}
              onChange={(e) => setSizeIndex(Number(e.target.value))}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white"
            >
              {IPHONE_SIZES.map((s, i) => (
                <option key={s.label} value={i}>
                  iPhone {s.label} — {s.w}×{s.h}px
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          {/* Status message */}
          {exportStatus && (
            <span className="text-sm text-emerald-600 font-medium">
              {exportStatus}
            </span>
          )}

          {/* Export all button */}
          <button
            onClick={exportAll}
            disabled={isExporting}
            style={{ background: "#6DCAA6" }}
            className="hover:opacity-90 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2 rounded-xl transition-opacity"
          >
            {isExporting ? "書き出し中…" : "全枚まとめて書き出し"}
          </button>
        </div>
      </div>

      {/* ── Slide Grid ── */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
          {SLIDES.map((slide, i) => (
            <SlideCard
              key={slide.id}
              slide={slide}
              index={i}
              sizeConfig={sizeConfig}
              onExport={exportSlide}
              isExporting={isExporting}
            />
          ))}
        </div>

        {/* Instructions */}
        <div className="mt-10 p-5 bg-white rounded-2xl text-sm text-gray-600 space-y-2 shadow-sm">
          <p className="font-bold text-gray-800 text-base">📱 使い方</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              実機/シミュレータでスクリーンショットを撮影し、以下のファイル名で保存:
            </li>
          </ol>
          <div className="bg-gray-50 rounded-xl p-3 font-mono text-xs space-y-0.5 ml-4">
            <p>scripts/app-store-screenshots/public/screenshots/</p>
            {SLIDES.map((s) => (
              <p key={s.id} className="text-gray-500">
                ├── {s.src.replace("/screenshots/", "")}
                <span className="ml-2 text-gray-400">← {s.label}</span>
              </p>
            ))}
          </div>
          <ol className="list-decimal list-inside space-y-1" start={2}>
            <li>上部で書き出しサイズを選択（App Store 6.9" 推奨）</li>
            <li>各スライドをクリックで個別書き出し / 「全枚まとめて書き出し」で一括</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
