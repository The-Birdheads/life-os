import { useEffect, useState } from "react";
import type { Task } from "../../../lib/types";
import { frequencyAt, frequencyLabel } from "../../../lib/mandala/frequency";
import { doneDaysByTask, weekCountStatus } from "../../../lib/mandala/progress";
import { weekStart } from "../../../lib/mandala/dates";
import { sqliteRepo } from "../../../lib/db/instance";

/**
 * 習慣のカードに出す頻度の補足(曜日指定・週n回。週n回は「今週 n/m回」も)を返す関数。
 * 記録タブ・振り返りタブで共通
 */
export function useHabitFrequencyNote(userId: string | null, day: string, doneTaskIds: Set<string>) {
    // 週n回の習慣の「今週 n/m回」のため、選択中の日を含む週(月曜〜選択中の日)の完了日
    const [weekDoneDays, setWeekDoneDays] = useState<Map<string, Set<string>>>(new Map());
    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        sqliteRepo.getTaskEntriesBetween(userId, weekStart(day), day).then((entries) => {
            if (!cancelled) setWeekDoneDays(doneDaysByTask(entries));
        }).catch(() => { /* 表示だけなので失敗は無視 */ });
        return () => { cancelled = true; };
    }, [userId, day, doneTaskIds]);

    return (t: Task): string | null => {
        const freq = frequencyAt(t, day);
        if (freq.kind === "weekly_count") {
            // チェックは保存より先に画面へ反映されるため、選択中の日は画面の状態(doneTaskIds)を使う
            const doneDays = new Set(weekDoneDays.get(t.id));
            if (doneTaskIds.has(t.id)) doneDays.add(day); else doneDays.delete(day);
            const { done, target } = weekCountStatus(t, doneDays, day);
            return `${frequencyLabel(freq)} ・ 今週 ${done}/${target}回${done >= target ? "（達成）" : ""}`;
        }
        if (freq.kind === "weekdays") return frequencyLabel(freq);
        return null;
    };
}
