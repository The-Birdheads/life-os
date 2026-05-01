import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { sqliteRepo } from './db/instance';
import { todayJST } from './day';
import { addDaysJST } from './dayNav';
import { Capacitor } from '@capacitor/core';
import type { Task } from './types';

export async function cancelAllNotifications() {
    if (Capacitor.getPlatform() === 'web') return;
    try {
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
            await LocalNotifications.cancel(pending);
        }
    } catch (e) {
        console.error('[Notifications] Cancel all error:', e);
    }
}

export async function requestNotificationPermissions(): Promise<boolean> {
    if (Capacitor.getPlatform() === 'web') return false;
    try {
        const permStatus = await LocalNotifications.requestPermissions();
        console.log('[Notifications] Permission status:', permStatus.display);
        return permStatus.display === 'granted';
    } catch (e) {
        console.error('[Notifications] Request permission error:', e);
        return false;
    }
}

export async function checkOrRequestNotifPermission(): Promise<boolean> {
    if (Capacitor.getPlatform() === 'web') return true;
    try {
        const status = await LocalNotifications.checkPermissions();
        if (status.display === 'granted') return true;
        if (status.display === 'prompt') {
            const result = await LocalNotifications.requestPermissions();
            return result.display === 'granted';
        }
        return false;
    } catch (e) {
        console.error('[Notifications] checkOrRequestNotifPermission error:', e);
        return false;
    }
}

export async function scheduleNotifications(userId: string) {
    if (Capacitor.getPlatform() === 'web') return;
    if (!userId) return;

    try {
        // 権限チェック（許可されていなければスケジュールしない）
        const permStatus = await LocalNotifications.checkPermissions();
        console.log('[Notifications] Current permission status:', permStatus.display);
        if (permStatus.display !== 'granted') {
            console.log('[Notifications] Permission not granted, skipping schedule.');
            return;
        }

        // Clear all existing
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
            await LocalNotifications.cancel(pending);
        }

        const todayDate = todayJST();

        const tasks = await sqliteRepo.getTasks(userId);
        const todayHabitEntries = await sqliteRepo.getTodayTaskEntries(userId, todayDate);
        const doneTodaySet = new Set(todayHabitEntries.filter(e => e.status === 'done').map(e => e.task_id));

        // --- 4. Per-Habit Reminders (notification_settings 不要) ---
        const habitsList = tasks.filter(t => t.task_type === 'habit');
        await schedulePerHabitReminders(habitsList, doneTodaySet);

        // グローバル通知設定が未作成の場合はデフォルト値を使用
        const settings = await sqliteRepo.getNotificationSettings(userId) ?? {
            habit_remind_on: true,
            habit_remind_hour: 18,
            habit_remind_minute: 0,
            task_remind_on: true,
            task_remind_hour: 10,
            task_remind_minute: 0,
            task_remind_timing: '[1]',
            review_remind_on: true,
            review_remind_hour: 21,
            review_remind_minute: 0,
        };

        // --- 1. Habit Reminder ---
        if (settings.habit_remind_on) {
            try {
                const habits = tasks.filter(t => t.task_type === 'habit' && !t.is_hidden && t.is_active);
                const uncompletedHabits = habits.filter(h => !doneTodaySet.has(h.id)).length;
                const hour = settings.habit_remind_hour ?? 18;
                const minute = settings.habit_remind_minute ?? 0;

                await scheduleForDays(101, hour, minute, (daysFromToday) => {
                    if (daysFromToday === 0) {
                        if (uncompletedHabits > 0) return `本日未完了の習慣が${uncompletedHabits}件あります！`;
                        return null;
                    }
                    return "未完了の習慣が残っていないか確認しましょう！";
                });
                console.log('[Notifications] Habit remind scheduled.');
            } catch (e) {
                console.error('[Notifications] Habit remind error:', e);
            }
        }

        // --- 2. Task Reminder ---
        if (settings.task_remind_on) {
            try {
                const timings = settings.task_remind_timing ? JSON.parse(settings.task_remind_timing) as number[] : [];
                const doneTaskIds = await sqliteRepo.getDoneTaskEntryIds(userId);
                const doneSet = new Set(doneTaskIds);
                const oneoffTasks = tasks.filter(t => t.task_type === 'oneoff' && !t.is_hidden && t.is_active && t.due_date && !doneSet.has(t.id));
                const hour = settings.task_remind_hour ?? 10;
                const minute = settings.task_remind_minute ?? 0;

                await scheduleForDays(201, hour, minute, (daysFromToday) => {
                    if (daysFromToday === 0) {
                        let notifyMessages: string[] = [];
                        const sortedTimings = [...timings].sort((a,b)=>a-b);
                        for (const timing of sortedTimings) {
                            const targetDate = addDaysJST(todayDate, timing);
                            const dueTasks = oneoffTasks.filter(t => t.due_date === targetDate);
                            if (dueTasks.length > 0) {
                                if (timing === 1) notifyMessages.push(`明日期限のタスクが${dueTasks.length}件あります！`);
                                else notifyMessages.push(`${timing}日後に期限のタスクが${dueTasks.length}件あります！`);
                            }
                        }
                        if (notifyMessages.length > 0) return notifyMessages.join(" ");
                        return null;
                    }
                    return "期限が近いタスクがないか確認しましょう！";
                });
                console.log('[Notifications] Task remind scheduled.');
            } catch (e) {
                console.error('[Notifications] Task remind error:', e);
            }
        }

        // --- 3. Review Reminder ---
        if (settings.review_remind_on) {
            try {
                const dailyLog = await sqliteRepo.getDailyLog(userId, todayDate);
                const isReviewed = dailyLog?.note || dailyLog?.satisfaction;
                const hour = settings.review_remind_hour ?? 21;
                const minute = settings.review_remind_minute ?? 0;

                await scheduleForDays(301, hour, minute, (daysFromToday) => {
                    if (daysFromToday === 0) {
                        if (!isReviewed) return "本日の振り返りをしましょう！";
                        return null;
                    }
                    return "本日の振り返りをしましょう！";
                });
                console.log('[Notifications] Review remind scheduled.');
            } catch (e) {
                console.error('[Notifications] Review remind error:', e);
            }
        }

    } catch (e) {
        console.error('[Notifications] Scheduling error:', e);
    }
}

// Hash a task UUID to a notification base ID in the 10000–18999 range.
// Each habit occupies 7 consecutive IDs (days 0-6). 9000 slots / 7 ≈ 1285 habits.
function habitIdToNotifBase(taskId: string): number {
    let hash = 0;
    for (let i = 0; i < taskId.length; i++) {
        hash = (hash * 31 + taskId.charCodeAt(i)) >>> 0;
    }
    return 10000 + (hash % 1285) * 7;
}

async function schedulePerHabitReminders(habits: Task[], doneTodaySet: Set<string>) {
    const remindHabits = habits.filter(h => h.remind_on && !h.is_hidden && h.is_active);
    if (remindHabits.length === 0) return;

    const now = new Date();
    const notificationsToSchedule: any[] = [];

    for (const habit of remindHabits) {
        const baseId = habitIdToNotifBase(habit.id);
        const hour = habit.remind_hour ?? 8;
        const minute = habit.remind_minute ?? 0;

        for (let i = 0; i < 7; i++) {
            // Day 0: skip if already done today
            if (i === 0 && doneTodaySet.has(habit.id)) continue;

            const scheduledTime = new Date();
            scheduledTime.setDate(scheduledTime.getDate() + i);
            scheduledTime.setHours(hour, minute, 0, 0);

            if (scheduledTime <= now) continue;

            notificationsToSchedule.push({
                id: baseId + i,
                title: "Habitas",
                body: `「${habit.title}」の時間です！`,
                schedule: { at: scheduledTime, allowWhileIdle: true },
                sound: 'default',
                extra: { type: 1 },
            });
        }
    }

    if (notificationsToSchedule.length > 0) {
        await LocalNotifications.schedule({ notifications: notificationsToSchedule });
    }
}

async function scheduleForDays(baseId: number, hour: number, minute: number, getMessage: (daysFromToday: number) => string | null) {
    const notificationsToSchedule = [];
    const now = new Date();

    for (let i = 0; i < 7; i++) {
        const msg = getMessage(i);
        if (!msg) continue;

        const scheduledTime = new Date();
        scheduledTime.setDate(scheduledTime.getDate() + i);
        scheduledTime.setHours(hour, minute, 0, 0);

        if (scheduledTime > now) {
            notificationsToSchedule.push({
                id: baseId + i,
                title: "Habitas",
                body: msg,
                schedule: { at: scheduledTime, allowWhileIdle: true },
                sound: 'default',
                extra: { type: Math.floor(baseId / 100) } // 1: habit, 2: task, 3: review
            });
        }
    }

    if (notificationsToSchedule.length > 0) {
        await LocalNotifications.schedule({ notifications: notificationsToSchedule });
    }
}

export async function cancelAllNotifications() {
    if (Capacitor.getPlatform() === 'web') return;
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
        await LocalNotifications.cancel(pending);
    }
}

export function setupNotificationListeners() {
    if (Capacitor.getPlatform() === 'web') return () => {};

    let appStateListener: any;
    let notifListener: any;

    const setup = async () => {
        appStateListener = await App.addListener('appStateChange', (state) => {
            if (!state.isActive) {
                // User put app in background, reschedule notifications based on current data
                window.dispatchEvent(new CustomEvent('lifeos:scheduleNotifications'));
            }
        });

        notifListener = await LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
            const extra = notification.notification.extra;
            if (extra && extra.type) {
                // type 1: habit, 2: task, 3: review
                window.dispatchEvent(new CustomEvent('lifeos:notificationClick', { detail: extra.type }));
            }
        });
    };

    setup();

    return () => {
        if (appStateListener) appStateListener.remove();
        if (notifListener) notifListener.remove();
    };
}
