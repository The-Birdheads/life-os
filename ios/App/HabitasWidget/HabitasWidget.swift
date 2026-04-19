import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Constants

private let kAppGroup   = "group.com.morikuma.habitas"
private let kDataKey    = "habitasWidgetData"
private let kPendingKey = "habitasPendingCompletions"

// MARK: - Colors

extension Color {
    static let habitBlue  = Color(red: 0.231, green: 0.510, blue: 0.965)
    static let taskGreen  = Color(red: 0.063, green: 0.725, blue: 0.506)
    static let wBg        = Color(red: 0.118, green: 0.161, blue: 0.231)
    static let wText      = Color(red: 0.973, green: 0.984, blue: 0.992)
    static let wSub       = Color(red: 0.973, green: 0.984, blue: 0.992).opacity(0.5)
    static let wOverdue   = Color(red: 1.0,   green: 0.42,  blue: 0.21)
    static let wUrgent    = Color(red: 1.0,   green: 0.70,  blue: 0.0)
}

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

    var isOverdue: Bool { daysUntilDue < 0 }
    var isUrgent:  Bool { daysUntilDue >= 0 && daysUntilDue <= 3 }

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
        if daysUntilDue < 0  { return .wOverdue }
        if daysUntilDue == 0 { return .wOverdue }
        if daysUntilDue == 1 { return .wUrgent  }
        return .wSub
    }
}

struct WidgetData: Codable {
    let today: String
    let updatedAt: String
    let habits: [WidgetHabit]
    let habitsDone: Int
    let habitsTotal: Int
    let tasks: [WidgetTask]

    static var placeholder: WidgetData {
        WidgetData(
            today: "2026-04-18", updatedAt: "",
            habits: [
                WidgetHabit(id: "1", title: "運動",     done: true,  priority: 1),
                WidgetHabit(id: "2", title: "読書",     done: false, priority: 2),
                WidgetHabit(id: "3", title: "英語学習", done: false, priority: 3),
                WidgetHabit(id: "4", title: "瞑想",     done: true,  priority: 1),
                WidgetHabit(id: "5", title: "日記",     done: false, priority: 2),
            ],
            habitsDone: 2, habitsTotal: 5,
            tasks: [
                WidgetTask(id: "t1", title: "資料提出",   daysUntilDue: 1,  priority: 1),
                WidgetTask(id: "t2", title: "請求書確認", daysUntilDue: 3,  priority: 2),
                WidgetTask(id: "t3", title: "週次レビュー", daysUntilDue: 5, priority: 3),
            ]
        )
    }

    static func load() -> WidgetData? {
        guard let d = UserDefaults(suiteName: kAppGroup),
              let s = d.string(forKey: kDataKey),
              let b = s.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WidgetData.self, from: b)
    }
}

// MARK: - App Intent (iOS 17+)

@available(iOS 17.0, *)
struct CompleteHabitIntent: AppIntent {
    static var title: LocalizedStringResource = "習慣を完了にする"

    @Parameter(title: "Habit ID") var habitId: String

    init() {}
    init(habitId: String) { self.habitId = habitId }

    func perform() async throws -> some IntentResult {
        guard let d = UserDefaults(suiteName: kAppGroup) else { return .result() }

        // 既に完了済みなら何もしない（タップ捕捉のみでアプリ遷移を防ぐ）
        if let s = d.string(forKey: kDataKey),
           let raw = s.data(using: .utf8),
           let obj = try? JSONSerialization.jsonObject(with: raw) as? [String: Any],
           let habits = obj["habits"] as? [[String: Any]],
           let habit = habits.first(where: { $0["id"] as? String == habitId }),
           habit["done"] as? Bool == true {
            return .result()
        }

        var pending = d.stringArray(forKey: kPendingKey) ?? []
        if !pending.contains(habitId) {
            pending.append(habitId)
            d.set(pending, forKey: kPendingKey)
        }
        // 楽観的更新
        if let s = d.string(forKey: kDataKey),
           let raw = s.data(using: .utf8),
           var obj = try? JSONSerialization.jsonObject(with: raw) as? [String: Any],
           var habits = obj["habits"] as? [[String: Any]] {
            for i in 0..<habits.count where habits[i]["id"] as? String == habitId {
                habits[i]["done"] = true
            }
            obj["habits"]     = habits
            obj["habitsDone"] = habits.filter { $0["done"] as? Bool == true }.count
            if let u = try? JSONSerialization.data(withJSONObject: obj),
               let us = String(data: u, encoding: .utf8) {
                d.set(us, forKey: kDataKey); d.synchronize()
            }
        }
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
        completion(.init(date: .now, data: WidgetData.load() ?? .placeholder))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<HabitasEntry>) -> Void) {
        let entry = HabitasEntry(date: .now, data: WidgetData.load() ?? .placeholder)
        let next  = Calendar.current.date(byAdding: .minute, value: 30, to: .now) ?? .now
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Shared Components

struct HabitRow: View {
    let habit: WidgetHabit
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: habit.done ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 12))
                .foregroundColor(habit.done ? .habitBlue : Color.wSub.opacity(0.5))
            Text(habit.title)
                .font(.system(size: 12))
                .foregroundColor(habit.done ? .wSub : .wText)
                .strikethrough(habit.done, color: .wSub)
                .lineLimit(1)
        }
    }
}

struct TaskRow: View {
    let task: WidgetTask
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: task.isOverdue ? "exclamationmark.circle.fill" : "square")
                .font(.system(size: 11))
                .foregroundColor(task.isOverdue ? .wOverdue : .taskGreen)
            Text(task.title)
                .font(.system(size: 12))
                .foregroundColor(task.isOverdue ? .wOverdue : .wText)
                .lineLimit(1)
            Spacer()
            Text(task.dueLabel)
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(task.dueColor)
        }
    }
}

// MARK: - Habit: Small

struct HabitSmallView: View {
    let entry: HabitasEntry
    private var sorted: [WidgetHabit] {
        let undone = entry.data.habits.filter { !$0.done }
        let done   = entry.data.habits.filter {  $0.done }
        return undone + done
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("習慣").font(.system(size: 12, weight: .bold)).foregroundColor(.wText)
                Spacer()
                Text("\(entry.data.habitsDone)/\(entry.data.habitsTotal)完了")
                    .font(.system(size: 10, weight: .semibold)).foregroundColor(.habitBlue)
            }
            Rectangle().fill(Color.wSub.opacity(0.2)).frame(height: 1).padding(.vertical, 6)

            let show = Array(sorted.prefix(3))
            VStack(alignment: .leading, spacing: 5) {
                ForEach(show) { h in HabitRow(habit: h) }
            }
            Spacer(minLength: 4)
            let rest = sorted.count - 3
            if rest > 0 {
                Text("…他\(rest)件").font(.system(size: 10)).foregroundColor(.wSub)
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

// MARK: - Habit: Medium

struct HabitMediumView: View {
    let entry: HabitasEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("今日の習慣").font(.system(size: 13, weight: .bold)).foregroundColor(.wText)
                Spacer()
                Text("\(entry.data.habitsDone)/\(entry.data.habitsTotal)完了")
                    .font(.system(size: 11, weight: .semibold)).foregroundColor(.habitBlue)
            }
            // プログレスバー
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.1)).frame(height: 4)
                    Capsule().fill(Color.habitBlue)
                        .frame(
                            width: entry.data.habitsTotal > 0
                                ? geo.size.width * CGFloat(entry.data.habitsDone) / CGFloat(entry.data.habitsTotal) : 0,
                            height: 4
                        )
                }
            }.frame(height: 4)

            // 2列レイアウト
            let all = entry.data.habits
            let left  = Array(all.prefix(3))
            let right = all.count > 3 ? Array(all[3..<min(6, all.count)]) : []
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 5) {
                    ForEach(left)  { h in HabitRow(habit: h) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if !right.isEmpty {
                    VStack(alignment: .leading, spacing: 5) {
                        ForEach(right) { h in HabitRow(habit: h) }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(8)
    }
}

// MARK: - Habit: Large

struct HabitLargeView: View {
    let entry: HabitasEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("今日の習慣").font(.system(size: 14, weight: .bold)).foregroundColor(.wText)
                Spacer()
                Text("\(entry.data.habitsDone)/\(entry.data.habitsTotal)完了")
                    .font(.system(size: 12, weight: .semibold)).foregroundColor(.habitBlue)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.1)).frame(height: 5)
                    Capsule().fill(Color.habitBlue)
                        .frame(
                            width: entry.data.habitsTotal > 0
                                ? geo.size.width * CGFloat(entry.data.habitsDone) / CGFloat(entry.data.habitsTotal) : 0,
                            height: 5
                        )
                }
            }.frame(height: 5).padding(.vertical, 10)

            Rectangle().fill(Color.wSub.opacity(0.2)).frame(height: 1).padding(.bottom, 8)

            VStack(spacing: 0) {
                ForEach(entry.data.habits.prefix(8)) { habit in
                    LargeHabitRow(habit: habit)
                    if habit.id != entry.data.habits.prefix(8).last?.id {
                        Divider().background(Color.wSub.opacity(0.12))
                    }
                }
            }
            Spacer()
        }
        .padding(8)
    }
}

struct LargeHabitRow: View {
    let habit: WidgetHabit
    var body: some View {
        if #available(iOS 17.0, *) {
            Button(intent: CompleteHabitIntent(habitId: habit.id)) { rowContent }
                .buttonStyle(.plain)
        } else { rowContent }
    }
    private var rowContent: some View {
        HStack(spacing: 10) {
            Image(systemName: habit.done ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 17))
                .foregroundColor(habit.done ? .habitBlue : Color.wSub.opacity(0.4))
            Text(habit.title)
                .font(.system(size: 14))
                .foregroundColor(habit.done ? .wSub : .wText)
                .strikethrough(habit.done, color: .wSub)
                .lineLimit(1)
            Spacer()
        }
        .padding(.vertical, 7).contentShape(Rectangle())
    }
}

// MARK: - Task: Small

struct TaskSmallView: View {
    let entry: HabitasEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("タスク").font(.system(size: 12, weight: .bold)).foregroundColor(.wText)
                Spacer()
                Text("\(entry.data.tasks.count)件")
                    .font(.system(size: 10, weight: .semibold)).foregroundColor(.taskGreen)
            }
            Rectangle().fill(Color.wSub.opacity(0.2)).frame(height: 1).padding(.vertical, 6)

            if entry.data.tasks.isEmpty {
                Text("タスクなし").font(.system(size: 11)).foregroundColor(.wSub)
            } else {
                let show = Array(entry.data.tasks.prefix(3))
                VStack(alignment: .leading, spacing: 5) {
                    ForEach(show) { t in TaskRow(task: t) }
                }
                Spacer(minLength: 4)
                let rest = entry.data.tasks.count - 3
                if rest > 0 {
                    Text("…他\(rest)件").font(.system(size: 10)).foregroundColor(.wSub)
                }
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

// MARK: - Task: Medium

struct TaskMediumView: View {
    let entry: HabitasEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("タスク").font(.system(size: 13, weight: .bold)).foregroundColor(.wText)
                Spacer()
                Text("\(entry.data.tasks.count)件")
                    .font(.system(size: 11, weight: .semibold)).foregroundColor(.taskGreen)
            }
            Rectangle().fill(Color.wSub.opacity(0.2)).frame(height: 1)

            if entry.data.tasks.isEmpty {
                Text("タスクなし").font(.system(size: 12)).foregroundColor(.wSub)
                    .padding(.top, 4)
            } else {
                VStack(spacing: 6) {
                    ForEach(entry.data.tasks.prefix(5)) { t in TaskRow(task: t) }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(8)
    }
}

// MARK: - Task: Large

struct TaskLargeView: View {
    let entry: HabitasEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("タスク").font(.system(size: 14, weight: .bold)).foregroundColor(.wText)
                Spacer()
                Text("\(entry.data.tasks.count)件")
                    .font(.system(size: 12, weight: .semibold)).foregroundColor(.taskGreen)
            }
            Rectangle().fill(Color.wSub.opacity(0.2)).frame(height: 1).padding(.vertical, 8)

            if entry.data.tasks.isEmpty {
                Text("タスクなし").font(.system(size: 13)).foregroundColor(.wSub)
            } else {
                VStack(spacing: 0) {
                    ForEach(entry.data.tasks.prefix(8)) { t in
                        LargeTaskRow(task: t)
                        if t.id != entry.data.tasks.prefix(8).last?.id {
                            Divider().background(Color.wSub.opacity(0.12))
                        }
                    }
                }
            }
            Spacer()
        }
        .padding(8)
    }
}

struct LargeTaskRow: View {
    let task: WidgetTask
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: task.isOverdue ? "exclamationmark.circle.fill" : "square")
                .font(.system(size: 15))
                .foregroundColor(task.isOverdue ? .wOverdue : .taskGreen)
            Text(task.title)
                .font(.system(size: 14))
                .foregroundColor(task.isOverdue ? .wOverdue : .wText)
                .lineLimit(1)
            Spacer()
            Text(task.dueLabel)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(task.dueColor)
        }
        .padding(.vertical, 7)
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
                .containerBackground(Color.wBg, for: .widget)
        }
        .configurationDisplayName("Habitas 習慣")
        .description("今日の習慣の進捗を確認できます。")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct HabitasTaskWidget: Widget {
    let kind = "HabitasTaskWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HabitasProvider()) { entry in
            TaskWidgetEntryView(entry: entry)
                .containerBackground(Color.wBg, for: .widget)
        }
        .configurationDisplayName("Habitas タスク")
        .description("登録中のタスクを優先度順に確認できます。")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}
