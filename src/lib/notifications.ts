import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { sqliteRepo } from './db/instance';
import { todayJST } from './day';
import { addDaysJST } from './dayNav';
import { Capacitor } from '@capacitor/core';

export async function requestNotificationPermissions() {
    if (Capacitor.getPlatform() === 'web') return;
    try {
        const permStatus = await LocalNotifications.requestPermissions();
        console.log('[Notifications] Permission status:', permStatus.display);
    } catch (e) {
        console.error('[Notifications] Request permission error:', e);
    }
}

export async function scheduleNotifications(userId: string) {
    if (Capacitor.getPlatform() === 'web') return;
    if (!userId) return;

    try {
        // Clear all existing
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
            await LocalNotifications.cancel(pending);
        }

        const settings = await sqliteRepo.getNotificationSettings(userId);
        if (!settings) return; // No settings configured yet

        const todayDate = todayJST();
        
        const tasks = await sqliteRepo.getTasks(userId);
        
        // --- 1. Habit Reminder ---
        if (settings.habit_remind_on) {
            const todayHabitEntries = await sqliteRepo.getTodayTaskEntries(userId, todayDate);
            const habits = tasks.filter(t => t.task_type === 'habit' && !t.is_hidden && t.is_active);
            
            // To get uncompleted habits for *today* accurately:
            // The user hasn't completed them if there's no taskEntry for today or it's not "done"
            const doneTodaySet = new Set(todayHabitEntries.filter(e => e.status === 'done').map(e => e.task_id));
            const uncompletedHabits = habits.filter(h => !doneTodaySet.has(h.id)).length;

            await scheduleForDays(101, settings.habit_remind_hour, (daysFromToday) => {
                if (daysFromToday === 0) {
                    if (uncompletedHabits > 0) return `本日未完了の習慣が${uncompletedHabits}件あります！`;
                    return null; // Don't notify today if completed
                }
                return "未完了の習慣が残っていないか確認しましょう！"; // Generic
            });
        }

        // --- 2. Task Reminder ---
        if (settings.task_remind_on) {
            const timings = settings.task_remind_timing ? JSON.parse(settings.task_remind_timing) as number[] : [];
            const doneTaskIds = await sqliteRepo.getDoneTaskEntryIds(userId);
            const doneSet = new Set(doneTaskIds);
            const oneoffTasks = tasks.filter(t => t.task_type === 'oneoff' && !t.is_hidden && t.is_active && t.due_date && !doneSet.has(t.id));

            await scheduleForDays(201, settings.task_remind_hour, (daysFromToday) => {
                if (daysFromToday === 0) {
                    // Check for TODAY
                    let notifyMessages: string[] = [];
                    // Ensure timing array is sorted correctly, e.g. [1, 2, 3]
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
                    return null; // No task reminding needed today
                }
                return "期限が近いタスクがないか確認しましょう！";
            });
        }

        // --- 3. Review Reminder ---
        if (settings.review_remind_on) {
            const dailyLog = await sqliteRepo.getDailyLog(userId, todayDate);
            const isReviewed = dailyLog?.note || dailyLog?.satisfaction;

            await scheduleForDays(301, settings.review_remind_hour, (daysFromToday) => {
                if (daysFromToday === 0) {
                    if (!isReviewed) return "本日の振り返りをしましょう！";
                    return null;
                }
                return "本日の振り返りをしましょう！";
            });
        }

    } catch (e) {
        console.error('[Notifications] Scheduling error:', e);
    }
}

async function scheduleForDays(baseId: number, hour: number, getMessage: (daysFromToday: number) => string | null) {
    const notificationsToSchedule = [];
    const now = new Date();
    
    for (let i = 0; i < 7; i++) {
        const msg = getMessage(i);
        if (!msg) continue;

        const scheduledTime = new Date();
        scheduledTime.setDate(scheduledTime.getDate() + i);
        scheduledTime.setHours(hour, 0, 0, 0);

        if (scheduledTime > now) {
            notificationsToSchedule.push({
                id: baseId + i,
                title: "Habitas",
                body: msg,
                schedule: { at: scheduledTime },
                extra: { type: Math.floor(baseId / 100) } // 1: habit, 2: task, 3: review
            });
        }
    }

    if (notificationsToSchedule.length > 0) {
        await LocalNotifications.schedule({ notifications: notificationsToSchedule });
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
