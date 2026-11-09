import { useState } from "react";
import { theme } from "../../../lib/ui/theme";
import type { MandalaChart, MandalaReview } from "../../../lib/types";
import type { ChartModel } from "../../../lib/mandala/chart";
import { localDateLabel } from "../../../lib/mandala/dates";
import { buildSnapshot } from "../../../lib/mandala/review";
import type { MandalaState } from "../../../lib/mandala/useMandala";
import ChartHistory, { HistoryHeader, SnapshotView } from "./ChartHistory";

/**
 * 過去のチャート(終えたチャート)の一覧と、それぞれの履歴。見るだけ。
 */
export default function PastCharts({
    mandala,
    onBack,
    backLabel,
}: {
    mandala: MandalaState;
    onBack: () => void;
    backLabel: string;
}) {
    const [open, setOpen] = useState<{ chart: MandalaChart; model: ChartModel; reviews: MandalaReview[] } | null>(null);

    const period = (c: MandalaChart) =>
        `${c.start_date ? c.start_date.replace(/-/g, "/") : ""}〜${c.updated_at ? localDateLabel(c.updated_at) : ""}`;

    if (open) {
        const back = () => setOpen(null);
        // 保存した記録が無いチャートは、中身だけ出す(進み具合は残っていない)
        if (open.reviews.length === 0) {
            const snap = buildSnapshot(open.model, new Map(), new Map(), {
                from: open.chart.start_date ?? "", to: (open.chart.updated_at ?? "").slice(0, 10),
            });
            return (
                <div style={{ display: "grid", gap: 12 }}>
                    <HistoryHeader title={open.chart.title} backLabel="一覧へ" onBack={back} />
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: theme.subtext, background: theme.card, borderRadius: 14, padding: 14 }}>
                        このチャートは、進み具合を保存せずに終えました。チャートの中身だけを表示します。
                    </p>
                    <SnapshotView snap={snap} model={null} intro="終えたときのチャート" />
                </div>
            );
        }
        return (
            <ChartHistory
                title={open.chart.title}
                backLabel="一覧へ"
                onBack={back}
                records={open.reviews}
                model={open.model}
                emptyText=""
            />
        );
    }

    return (
        <div style={{ display: "grid", gap: 12 }}>
            <HistoryHeader title="過去のチャート" backLabel={backLabel} onBack={onBack} />
            {mandala.pastCharts.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: theme.subtext, background: theme.card, borderRadius: 14, padding: 14 }}>
                    終えたチャートはまだありません。
                </p>
            )}
            {mandala.pastCharts.map((c) => (
                <button key={c.id} type="button"
                    onClick={async () => {
                        const data = await mandala.loadPastChart(c);
                        if (data) setOpen({ chart: c, ...data });
                    }}
                    style={{
                        border: `1px solid ${theme.border}`, borderRadius: 14, background: theme.card, color: "var(--text)",
                        textAlign: "left", padding: "12px 14px", display: "grid", gap: 4, cursor: "pointer", fontFamily: "inherit",
                    }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{c.title}</span>
                    <span style={{ fontSize: 12, color: theme.subtext }}>{period(c)}</span>
                </button>
            ))}
        </div>
    );
}
