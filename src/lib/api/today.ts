type FetchTodayEntriesResult = {
    doneTaskIds: Set<string>;
    doneTaskIdsAnyDay: Set<string>;
    todayActionEntries: any[];
};

export async function fetchTodayEntries(params: {
    supabase: any;
    userId: string;
    day: string;
}): Promise<FetchTodayEntriesResult> {
    const { supabase, userId, day } = params;

    // 今日の task_entries
    const { data: te, error: teErr } = await supabase
        .from("task_entries")
        .select("task_id,status")
        .eq("user_id", userId)
        .eq("day", day);

    if (teErr) throw teErr;

    const doneTaskIds = new Set<string>();
    (te ?? []).forEach((r: any) => {
        if (r.status === "done") doneTaskIds.add(r.task_id);
    });

    // 過去いつでも done の task_id
    const { data: teAll, error: teAllErr } = await supabase
        .from("task_entries")
        .select("task_id, status")
        .eq("user_id", userId)
        .eq("status", "done");

    if (teAllErr) throw teAllErr;

    const doneTaskIdsAnyDay = new Set<string>();
    (teAll ?? []).forEach((r: any) => doneTaskIdsAnyDay.add(r.task_id));

    // 今日の action_entries
    const { data: ae, error: aeErr } = await supabase
        .from("action_entries")
        .select("id, action_id, note, volume, created_at")
        .eq("user_id", userId)
        .eq("day", day)
        .order("created_at", { ascending: true });

    if (aeErr) throw aeErr;

    return {
        doneTaskIds,
        doneTaskIdsAnyDay,
        todayActionEntries: ae ?? [],
    };
}
