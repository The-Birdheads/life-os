import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Constants

private let kAppGroup   = "group.com.morikuma.habitas"
private let kDataKey    = "habitasWidgetData"
private let kPendingKey = "habitasPendingCompletions"

// MARK: - Colors
// 端末のライト・ダークに合わせる(背景は containerBackground、文字は primary / secondary)

extension Color {
    /// 習慣の色(アプリの theme.habit)
    static let habitBlue = Color(red: 0.231, green: 0.510, blue: 0.965)
    /// タスクの色(アプリの theme.task)
    static let taskGreen = Color(red: 0.063, green: 0.725, blue: 0.506)
    static let wOverdue  = Color(red: 0.937, green: 0.267, blue: 0.267)
    static let wSoon     = Color(red: 0.961, green: 0.620, blue: 0.043)
}

/// ウィジェットの背景(ライト: 白、ダーク: アプリのヘッダーと同じスレート)
struct WidgetBackground: View {
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        scheme == .dark ? Color(red: 0.090, green: 0.118, blue: 0.169) : Color.white
    }
}

/// 行の区切りや、未完了の丸の色
private let kLine = Color.primary.opacity(0.10)
private let kRing = Color.primary.opacity(0.28)

// MARK: - Data Models

struct WidgetHabit: Codable, Identifiable {
    let id: String
    let title: String
    var done: Bool
    let priority: Int
}

struct WidgetTask: Codable, Identifiable {
    let id: String
    let title: String
    let daysUntilDue: Int
    let priority: Int
    /// ウィジェットから完了にした(アプリで読み直すまで、チェックを付けて残す)
    var done: Bool?

    var isDone: Bool { done ?? false }
    var isOverdue: Bool { daysUntilDue < 0 }

    var dueLabel: String {
        if daysUntilDue >= 9999 { return "" }
        switch daysUntilDue {
        case ..<0: return "\(-daysUntilDue)日超過"
        case 0:    return "今日"
        case 1:    return "明日"
        default:   return "\(daysUntilDue)日後"
        }
    }

    var dueColor: Color {
        if daysUntilDue <= 0 { return .wOverdue }
        if daysUntilDue <= 2 { return .wSoon }
        return .secondary
    }
}

struct WidgetData: Codable {
    let today: String
    let updatedAt: String
    let habits: [WidgetHabit]
    let habitsDone: Int
    let habitsTotal: Int
    let tasks: [WidgetTask]
    /// 期限を過ぎたタスクの数(古いデータには無い)
    var tasksOverdue: Int? = nil
    /// マンダラチャート(チャートが無いときは無い)
    var mandala: WidgetMandala? = nil

    static var placeholder: WidgetData {
        WidgetData(
            today: "2026-10-30", updatedAt: "",
            habits: [
                WidgetHabit(id: "1", title: "朝ラン 3km",   done: true,  priority: 0),
                WidgetHabit(id: "2", title: "英語を15分",   done: false, priority: 0),
                WidgetHabit(id: "3", title: "本を10ページ", done: false, priority: 0),
                WidgetHabit(id: "4", title: "ストレッチ",   done: true,  priority: 0),
                WidgetHabit(id: "5", title: "日記を書く",   done: false, priority: 0),
            ],
            habitsDone: 2, habitsTotal: 5,
            tasks: [
                WidgetTask(id: "t1", title: "請求書を送る",   daysUntilDue: -1, priority: 0),
                WidgetTask(id: "t2", title: "資料を提出する", daysUntilDue: 0,  priority: 0),
                WidgetTask(id: "t3", title: "歯医者を予約",   daysUntilDue: 3,  priority: 0),
                WidgetTask(id: "t4", title: "週次レビュー",   daysUntilDue: 9999, priority: 0),
            ],
            tasksOverdue: 1,
            mandala: .placeholder
        )
    }

    static func load() -> WidgetData? {
        guard let d = UserDefaults(suiteName: kAppGroup),
              let s = d.string(forKey: kDataKey),
              let b = s.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WidgetData.self, from: b)
    }

    /// 未完了 → 完了 の順
    var habitsUndoneFirst: [WidgetHabit] { habits.filter { !$0.done } + habits.filter { $0.done } }
    var tasksOpen: [WidgetTask] { tasks.filter { !$0.isDone } }
    var overdueCount: Int { tasksOverdue ?? tasksOpen.filter(\.isOverdue).count }
}

// MARK: - App Intent

/// 完了にした id を、アプリが次に開いたときに記録するよう残し、ウィジェットは先にチェックを付ける
private func markDone(listKey: String, id: String, recount: Bool) {
    guard let d = UserDefaults(suiteName: kAppGroup) else { return }
    guard let s = d.string(forKey: kDataKey),
          let raw = s.data(using: .utf8),
          var obj = try? JSONSerialization.jsonObject(with: raw) as? [String: Any],
          var list = obj[listKey] as? [[String: Any]] else { return }

    // 既に完了済みなら何もしない(タップを受け止めて、アプリが開かないようにするだけ)
    if list.first(where: { $0["id"] as? String == id })?["done"] as? Bool == true { return }

    var pending = d.stringArray(forKey: kPendingKey) ?? []
    if !pending.contains(id) {
        pending.append(id)
        d.set(pending, forKey: kPendingKey)
    }
    for i in 0..<list.count where list[i]["id"] as? String == id {
        list[i]["done"] = true
    }
    obj[listKey] = list
    if recount { obj["habitsDone"] = list.filter { $0["done"] as? Bool == true }.count }
    if let u = try? JSONSerialization.data(withJSONObject: obj),
       let us = String(data: u, encoding: .utf8) {
        d.set(us, forKey: kDataKey); d.synchronize()
    }
}

struct CompleteHabitIntent: AppIntent {
    static var title: LocalizedStringResource = "習慣を完了にする"

    @Parameter(title: "Habit ID") var habitId: String

    init() {}
    init(habitId: String) { self.habitId = habitId }

    func perform() async throws -> some IntentResult {
        markDone(listKey: "habits", id: habitId, recount: true)
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

struct CompleteTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "タスクを完了にする"

    @Parameter(title: "Task ID") var taskId: String

    init() {}
    init(taskId: String) { self.taskId = taskId }

    func perform() async throws -> some IntentResult {
        markDone(listKey: "tasks", id: taskId, recount: false)
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

// MARK: - Timeline

struct HabitasEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

struct HabitasProvider: TimelineProvider {
    func placeholder(in context: Context) -> HabitasEntry { .init(date: .now, data: .placeholder) }
    func getSnapshot(in context: Context, completion: @escaping (HabitasEntry) -> Void) {
        completion(.init(date: .now, data: context.isPreview ? .placeholder : (WidgetData.load() ?? .placeholder)))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<HabitasEntry>) -> Void) {
        let entry = HabitasEntry(date: .now, data: WidgetData.load() ?? .placeholder)
        let next  = Calendar.current.date(byAdding: .minute, value: 30, to: .now) ?? .now
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Shared Components

/// 見出し(アイコン + 名前)
struct WidgetHeader: View {
    let title: String
    let symbol: String
    let color: Color
    var size: CGFloat = 13

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: symbol)
                .font(.system(size: size - 1, weight: .bold))
                .foregroundStyle(color)
                .widgetAccentable()
            Text(title)
                .font(.system(size: size, weight: .bold))
                .foregroundStyle(.primary)
        }
    }
}

/// 今日の習慣の進み具合(輪)
struct ProgressRing: View {
    let done: Int
    let total: Int
    let color: Color
    var lineWidth: CGFloat = 6

    private var ratio: Double { total > 0 ? Double(done) / Double(total) : 0 }

    var body: some View {
        ZStack {
            Circle().stroke(color.opacity(0.18), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: ratio)
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .widgetAccentable()
        }
    }
}

/// 大きな数字(例: 2 / 5)
struct BigCount: View {
    let value: Int
    var total: Int? = nil
    var unit: String? = nil
    var size: CGFloat = 34

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 2) {
            Text("\(value)")
                .font(.system(size: size, weight: .bold, design: .rounded))
                .foregroundStyle(.primary)
                .contentTransition(.numericText())
            if let total {
                Text("/\(total)")
                    .font(.system(size: size * 0.5, weight: .semibold, design: .rounded))
                    .foregroundStyle(.secondary)
            }
            if let unit {
                Text(unit)
                    .font(.system(size: size * 0.4, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
        }
    }
}

/// チェックの丸(習慣)・四角(タスク)
struct CheckMark: View {
    let done: Bool
    let color: Color
    var round = true
    var size: CGFloat = 18

    var body: some View {
        Image(systemName: done ? (round ? "checkmark.circle.fill" : "checkmark.square.fill") : (round ? "circle" : "square"))
            .font(.system(size: size, weight: .regular))
            .foregroundStyle(done ? color : kRing)
            .widgetAccentable(done)
    }
}

/// 押すと完了になる行
struct IntentRow<I: AppIntent, Content: View>: View {
    let intent: I
    @ViewBuilder let content: () -> Content

    var body: some View {
        Button(intent: intent) { content().contentShape(Rectangle()) }
            .buttonStyle(.plain)
    }
}

struct HabitRow: View {
    let habit: WidgetHabit
    var font: CGFloat = 14
    var check: CGFloat = 18

    var body: some View {
        IntentRow(intent: CompleteHabitIntent(habitId: habit.id)) {
            HStack(spacing: 8) {
                CheckMark(done: habit.done, color: .habitBlue, size: check)
                Text(habit.title)
                    .font(.system(size: font, weight: habit.done ? .regular : .medium))
                    .foregroundStyle(habit.done ? .secondary : .primary)
                    .strikethrough(habit.done, color: .secondary)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
        }
    }
}

struct TaskRow: View {
    let task: WidgetTask
    var font: CGFloat = 14
    var check: CGFloat = 18
    var showDue = true

    var body: some View {
        IntentRow(intent: CompleteTaskIntent(taskId: task.id)) {
            HStack(spacing: 8) {
                CheckMark(done: task.isDone, color: .taskGreen, round: false, size: check)
                Text(task.title)
                    .font(.system(size: font, weight: task.isDone ? .regular : .medium))
                    .foregroundStyle(task.isDone ? .secondary : .primary)
                    .strikethrough(task.isDone, color: .secondary)
                    .lineLimit(1)
                Spacer(minLength: 4)
                if showDue && !task.isDone && !task.dueLabel.isEmpty {
                    Text(task.dueLabel)
                        .font(.system(size: font - 3, weight: .semibold))
                        .foregroundStyle(task.dueColor)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(task.dueColor.opacity(0.12)))
                }
            }
        }
    }
}

/// 何も無いとき
struct EmptyState: View {
    let symbol: String
    let message: String
    let color: Color

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: symbol)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(color)
                .widgetAccentable()
            Text(message)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// 「ほか ◯件」
struct MoreLabel: View {
    let count: Int
    var body: some View {
        if count > 0 {
            Text("ほか \(count)件")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
        }
    }
}

/// 一覧(区切り線つき)
struct RowList<Item: Identifiable, Row: View>: View {
    let items: [Item]
    var spacing: CGFloat = 0
    var divider = true
    @ViewBuilder let row: (Item) -> Row

    var body: some View {
        VStack(spacing: spacing) {
            ForEach(Array(items.enumerated()), id: \.element.id) { i, item in
                row(item)
                if divider && i < items.count - 1 {
                    Rectangle().fill(kLine).frame(height: 1).padding(.leading, 26)
                }
            }
        }
    }
}

private func todayLabel(_ day: String) -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "ja_JP")
    f.dateFormat = "yyyy-MM-dd"
    guard let date = f.date(from: day) else { return "" }
    f.dateFormat = "M月d日(E)"
    return f.string(from: date)
}

// MARK: - Habit: Small

struct HabitSmallView: View {
    let entry: HabitasEntry
    private var data: WidgetData { entry.data }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                WidgetHeader(title: "習慣", symbol: "repeat", color: .habitBlue)
                Spacer()
                ProgressRing(done: data.habitsDone, total: data.habitsTotal, color: .habitBlue, lineWidth: 4)
                    .frame(width: 22, height: 22)
            }
            BigCount(value: data.habitsDone, total: data.habitsTotal, size: 30)
                .padding(.top, 2)
            Spacer(minLength: 6)
            if data.habitsTotal == 0 {
                Text("今日の習慣はありません").font(.system(size: 12)).foregroundStyle(.secondary)
            } else if data.habitsDone >= data.habitsTotal {
                Label("すべて完了", systemImage: "checkmark.seal.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.habitBlue)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(data.habits.filter { !$0.done }.prefix(2)) { h in
                        HabitRow(habit: h, font: 13, check: 16)
                    }
                }
            }
        }
    }
}

// MARK: - Habit: Medium

struct HabitMediumView: View {
    let entry: HabitasEntry
    private var data: WidgetData { entry.data }

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 0) {
                WidgetHeader(title: "今日の習慣", symbol: "repeat", color: .habitBlue)
                Spacer(minLength: 8)
                ZStack {
                    ProgressRing(done: data.habitsDone, total: data.habitsTotal, color: .habitBlue, lineWidth: 8)
                    VStack(spacing: 0) {
                        BigCount(value: data.habitsDone, size: 26)
                        Text("/ \(data.habitsTotal)")
                            .font(.system(size: 11, weight: .semibold, design: .rounded))
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(width: 82, height: 82)
                Spacer(minLength: 0)
            }
            .frame(width: 96, alignment: .leading)

            if data.habitsTotal == 0 {
                EmptyState(symbol: "sun.max", message: "今日の習慣はありません", color: .habitBlue)
            } else {
                let list = Array(data.habitsUndoneFirst.prefix(4))
                VStack(alignment: .leading, spacing: 0) {
                    RowList(items: list) { h in
                        HabitRow(habit: h, font: 14, check: 18).padding(.vertical, 5)
                    }
                    Spacer(minLength: 0)
                    MoreLabel(count: data.habits.count - list.count)
                }
            }
        }
    }
}

// MARK: - Habit: Large

struct HabitLargeView: View {
    let entry: HabitasEntry
    private var data: WidgetData { entry.data }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    WidgetHeader(title: "今日の習慣", symbol: "repeat", color: .habitBlue, size: 15)
                    Text(todayLabel(data.today))
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.secondary)
                }
                Spacer()
                BigCount(value: data.habitsDone, total: data.habitsTotal, size: 28)
                ProgressRing(done: data.habitsDone, total: data.habitsTotal, color: .habitBlue, lineWidth: 6)
                    .frame(width: 34, height: 34)
            }

            if data.habitsTotal == 0 {
                EmptyState(symbol: "sun.max", message: "今日の習慣はありません", color: .habitBlue)
            } else {
                let list = Array(data.habitsUndoneFirst.prefix(7))
                RowList(items: list) { h in
                    HabitRow(habit: h, font: 15, check: 21).padding(.vertical, 8)
                }
                Spacer(minLength: 0)
                MoreLabel(count: data.habits.count - list.count)
            }
        }
    }
}

// MARK: - Task: Small

struct TaskSmallView: View {
    let entry: HabitasEntry
    private var data: WidgetData { entry.data }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            WidgetHeader(title: "タスク", symbol: "checklist", color: .taskGreen)
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                BigCount(value: data.tasksOpen.count, unit: "件", size: 30)
                if data.overdueCount > 0 {
                    Text("超過 \(data.overdueCount)")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.wOverdue)
                }
            }
            .padding(.top, 2)
            Spacer(minLength: 6)
            if data.tasksOpen.isEmpty {
                Label("やることはありません", systemImage: "checkmark.seal.fill")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.taskGreen)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(data.tasksOpen.prefix(2)) { t in
                        TaskRow(task: t, font: 13, check: 16, showDue: false)
                    }
                }
            }
        }
    }
}

// MARK: - Task: Medium

struct TaskMediumView: View {
    let entry: HabitasEntry
    private var data: WidgetData { entry.data }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                WidgetHeader(title: "タスク", symbol: "checklist", color: .taskGreen)
                Spacer()
                if data.overdueCount > 0 {
                    Text("期限超過 \(data.overdueCount)")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.wOverdue)
                }
                Text("\(data.tasksOpen.count)件")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(.secondary)
            }
            if data.tasks.isEmpty {
                EmptyState(symbol: "checkmark.seal", message: "やることはありません", color: .taskGreen)
            } else {
                let list = Array(data.tasks.prefix(4))
                RowList(items: list) { t in
                    TaskRow(task: t, font: 14, check: 17).padding(.vertical, 4)
                }
                Spacer(minLength: 0)
            }
        }
    }
}

// MARK: - Task: Large

struct TaskLargeView: View {
    let entry: HabitasEntry
    private var data: WidgetData { entry.data }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 2) {
                    WidgetHeader(title: "タスク", symbol: "checklist", color: .taskGreen, size: 15)
                    Text(data.overdueCount > 0 ? "期限超過 \(data.overdueCount)件" : todayLabel(data.today))
                        .font(.system(size: 12, weight: data.overdueCount > 0 ? .bold : .medium))
                        .foregroundStyle(data.overdueCount > 0 ? Color.wOverdue : .secondary)
                }
                Spacer()
                BigCount(value: data.tasksOpen.count, unit: "件", size: 28)
            }

            if data.tasks.isEmpty {
                EmptyState(symbol: "checkmark.seal", message: "やることはありません", color: .taskGreen)
            } else {
                let list = Array(data.tasks.prefix(7))
                RowList(items: list) { t in
                    TaskRow(task: t, font: 15, check: 20).padding(.vertical, 8)
                }
                Spacer(minLength: 0)
                MoreLabel(count: data.tasks.count - list.count)
            }
        }
    }
}

// MARK: - Widget Entry Views

struct HabitWidgetEntryView: View {
    let entry: HabitasEntry
    @Environment(\.widgetFamily) var family

    @ViewBuilder
    private var content: some View {
        switch family {
        case .systemSmall:  HabitSmallView(entry: entry)
        case .systemMedium: HabitMediumView(entry: entry)
        case .systemLarge:  HabitLargeView(entry: entry)
        default:            HabitSmallView(entry: entry)
        }
    }

    var body: some View {
        content
            .widgetURL(URL(string: "habitas://today"))
    }
}

struct TaskWidgetEntryView: View {
    let entry: HabitasEntry
    @Environment(\.widgetFamily) var family

    @ViewBuilder
    private var content: some View {
        switch family {
        case .systemSmall:  TaskSmallView(entry: entry)
        case .systemMedium: TaskMediumView(entry: entry)
        case .systemLarge:  TaskLargeView(entry: entry)
        default:            TaskSmallView(entry: entry)
        }
    }

    var body: some View {
        content
            .widgetURL(URL(string: "habitas://today"))
    }
}

// MARK: - Widget Configurations

struct HabitasHabitWidget: Widget {
    let kind = "HabitasHabitWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HabitasProvider()) { entry in
            HabitWidgetEntryView(entry: entry)
                .containerBackground(for: .widget) { WidgetBackground() }
        }
        .configurationDisplayName("Habitas 習慣")
        .description("今日の習慣を確認して、その場で完了にできます。")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct HabitasTaskWidget: Widget {
    let kind = "HabitasTaskWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HabitasProvider()) { entry in
            TaskWidgetEntryView(entry: entry)
                .containerBackground(for: .widget) { WidgetBackground() }
        }
        .configurationDisplayName("Habitas タスク")
        .description("未完了のタスクを確認して、その場で完了にできます。")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
