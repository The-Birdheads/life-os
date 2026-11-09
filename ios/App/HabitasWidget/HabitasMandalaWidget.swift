import WidgetKit
import SwiftUI

// MARK: - Data Models
// アプリ側の src/lib/mandala/widget.ts と同じ形

struct WidgetMandalaCell: Codable {
    let text: String
    /// -1=空き・休止中、0=未着手、1〜3=進み具合(〜30% / 〜70% / 70%〜)
    let level: Int
}

struct WidgetMandalaElement: Codable {
    let name: String
    let color: String
    /// 0〜100。未着手は -1
    let rate: Int
    let level: Int
    let cells: [WidgetMandalaCell]
}

struct WidgetMandala: Codable {
    let title: String
    let elements: [WidgetMandalaElement]
    /// 今日、習慣・タスクを完了にした行動目標の数
    let todayCount: Int

    static var placeholder: WidgetMandala {
        let names = ["運動", "睡眠", "食事", "仕事", "学び", "お金", "家族", "心"]
        let colors = ["#1D4ED8", "#C2410C", "#0F766E", "#6D28D9", "#BE185D", "#A16207", "#15803D", "#475569"]
        let rates = [72, 40, 15, 55, -1, 30, 85, 8]
        return WidgetMandala(
            title: "健康で、毎日を楽しむ",
            elements: (0..<8).map { i in
                WidgetMandalaElement(
                    name: names[i], color: colors[i], rate: rates[i], level: levelOf(rates[i]),
                    cells: (0..<8).map { a in WidgetMandalaCell(text: "", level: (i + a) % 5 - 1) }
                )
            },
            todayCount: 3
        )
    }

    static func levelOf(_ rate: Int) -> Int {
        if rate < 0 { return 0 }
        if rate < 30 { return 1 }
        if rate < 70 { return 2 }
        return 3
    }
}

// MARK: - Colors

extension Color {
    init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        let v = UInt64(s, radix: 16) ?? 0x475569
        self.init(
            red:   Double((v >> 16) & 0xFF) / 255,
            green: Double((v >> 8)  & 0xFF) / 255,
            blue:  Double(v         & 0xFF) / 255
        )
    }
}

/// 進み具合の段階 → マスの色(色だけに頼らないよう、小・中では % も出す)
private func mandalaTint(_ level: Int, _ color: Color) -> Color {
    switch level {
    case ..<0: return Color.primary.opacity(0.04)
    case 0:    return Color.primary.opacity(0.09)
    case 1:    return color.opacity(0.28)
    case 2:    return color.opacity(0.60)
    default:   return color
    }
}

/// 大目標のマス(アプリのチャートの中心と同じ濃いスレート)
private let kSlate = Color(red: 0.118, green: 0.161, blue: 0.231)

/// 3×3 の位置(0〜8)のうち、中心(4)以外。番号 i の要素・行動目標は kAround[i] の位置に置く(chart.ts の AROUND)
private let kAround = [0, 1, 2, 3, 5, 6, 7, 8]
private func indexAt(_ pos: Int) -> Int? { kAround.firstIndex(of: pos) }

// MARK: - Shared

struct MandalaTodayLabel: View {
    let count: Int
    var body: some View {
        if count > 0 {
            Text("今日 \(count)マス前進")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Color.wSoon)
        } else {
            Text("今日はこれから")
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.secondary)
        }
    }
}

/// 中心の3×3(要素の進み具合)
struct MandalaCenterGrid: View {
    let mandala: WidgetMandala
    var spacing: CGFloat = 3
    var nameSize: CGFloat = 9

    var body: some View {
        VStack(spacing: spacing) {
            ForEach(0..<3, id: \.self) { row in
                HStack(spacing: spacing) {
                    ForEach(0..<3, id: \.self) { col in
                        cell(row * 3 + col)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func cell(_ pos: Int) -> some View {
        if pos == 4 {
            RoundedRectangle(cornerRadius: 6).fill(kSlate)
                .overlay(
                    Text(mandala.title)
                        .font(.system(size: nameSize - 1, weight: .bold))
                        .foregroundColor(.white)
                        .multilineTextAlignment(.center)
                        .lineLimit(3)
                        .minimumScaleFactor(0.7)
                        .padding(3)
                )
        } else if let i = indexAt(pos), i < mandala.elements.count, !mandala.elements[i].name.isEmpty {
            let el = mandala.elements[i]
            let strong = el.level >= 3
            RoundedRectangle(cornerRadius: 6).fill(mandalaTint(el.level, Color(hex: el.color)))
                .overlay(
                    VStack(alignment: .leading, spacing: 1) {
                        Text(el.name)
                            .font(.system(size: nameSize, weight: .bold))
                            .lineLimit(2)
                            .minimumScaleFactor(0.7)
                        Spacer(minLength: 0)
                        Text(el.rate < 0 ? "未着手" : "\(el.rate)%")
                            .font(.system(size: nameSize + 1, weight: .heavy))
                            .minimumScaleFactor(0.7)
                    }
                    .foregroundStyle(strong ? Color.white : Color.primary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .padding(4)
                )
        } else {
            RoundedRectangle(cornerRadius: 6).fill(Color.primary.opacity(0.04))
        }
    }
}

/// 全体の9×9(色だけ)
struct MandalaFullGrid: View {
    let mandala: WidgetMandala

    var body: some View {
        VStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { br in
                HStack(spacing: 4) {
                    ForEach(0..<3, id: \.self) { bc in
                        block(br * 3 + bc)
                    }
                }
            }
        }
    }

    private func block(_ bp: Int) -> some View {
        VStack(spacing: 2) {
            ForEach(0..<3, id: \.self) { r in
                HStack(spacing: 2) {
                    ForEach(0..<3, id: \.self) { c in
                        tiny(bp, r * 3 + c)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func tiny(_ bp: Int, _ q: Int) -> some View {
        let shape = RoundedRectangle(cornerRadius: 3)
        if bp == 4 {
            // 中心のブロック: 大目標と要素
            if q == 4 {
                shape.fill(kSlate)
            } else if let i = indexAt(q), i < mandala.elements.count, !mandala.elements[i].name.isEmpty {
                let el = mandala.elements[i]
                shape.fill(mandalaTint(el.level, Color(hex: el.color)))
            } else {
                shape.fill(Color.primary.opacity(0.04))
            }
        } else if let i = indexAt(bp), i < mandala.elements.count, !mandala.elements[i].name.isEmpty {
            let el = mandala.elements[i]
            if q == 4 {
                // 各ブロックの中心は要素(名前を小さく出す)
                shape.fill(Color(hex: el.color))
                    .overlay(
                        Text(el.name)
                            .font(.system(size: 7, weight: .bold))
                            .foregroundColor(.white)
                            .lineLimit(2)
                            .minimumScaleFactor(0.6)
                            .multilineTextAlignment(.center)
                            .padding(1)
                    )
            } else if let a = indexAt(q), a < el.cells.count {
                shape.fill(mandalaTint(el.cells[a].level, Color(hex: el.color)))
            } else {
                shape.fill(Color.primary.opacity(0.04))
            }
        } else {
            shape.fill(Color.primary.opacity(0.04))
        }
    }
}

struct MandalaEmptyView: View {
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "square.grid.3x3")
                .font(.system(size: 22))
                .foregroundColor(.habitBlue)
            Text("目標タブでマンダラチャートを作ると、ここに出ます")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Sizes

struct MandalaSmallView: View {
    let mandala: WidgetMandala
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            MandalaCenterGrid(mandala: mandala, spacing: 3, nameSize: 8)
            MandalaTodayLabel(count: mandala.todayCount)
        }
    }
}

struct MandalaMediumView: View {
    let mandala: WidgetMandala
    private var named: [WidgetMandalaElement] { mandala.elements.filter { !$0.name.isEmpty } }
    /// 要素の平均(未着手は除く)
    private var average: Int? {
        let rates = named.map(\.rate).filter { $0 >= 0 }
        return rates.isEmpty ? nil : Int((Double(rates.reduce(0, +)) / Double(rates.count)).rounded())
    }

    var body: some View {
        HStack(spacing: 12) {
            MandalaCenterGrid(mandala: mandala, spacing: 3, nameSize: 9)
                .aspectRatio(1, contentMode: .fit)
            VStack(alignment: .leading, spacing: 6) {
                Text("大目標").font(.system(size: 10)).foregroundStyle(.secondary)
                Text(mandala.title)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.primary)
                    .lineLimit(3)
                    .minimumScaleFactor(0.8)
                Spacer(minLength: 0)
                VStack(alignment: .leading, spacing: 2) {
                    Text("直近7日").font(.system(size: 10)).foregroundStyle(.secondary)
                    Text(average.map { "\($0)%" } ?? "未着手")
                        .font(.system(size: 22, weight: .heavy))
                        .foregroundStyle(.primary)
                }
                MandalaTodayLabel(count: mandala.todayCount)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct MandalaLargeView: View {
    let mandala: WidgetMandala
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(mandala.title)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Spacer()
                MandalaTodayLabel(count: mandala.todayCount)
            }
            MandalaFullGrid(mandala: mandala)
                .aspectRatio(1, contentMode: .fit)
                .frame(maxWidth: .infinity)
        }
    }
}

// MARK: - Widget

struct MandalaWidgetEntryView: View {
    let entry: HabitasEntry
    @Environment(\.widgetFamily) var family

    @ViewBuilder
    private var content: some View {
        if let m = entry.data.mandala {
            switch family {
            case .systemMedium: MandalaMediumView(mandala: m)
            case .systemLarge:  MandalaLargeView(mandala: m)
            default:            MandalaSmallView(mandala: m)
            }
        } else {
            MandalaEmptyView()
        }
    }

    var body: some View {
        content
            .widgetURL(URL(string: "habitas://goal"))
    }
}

struct HabitasMandalaWidget: Widget {
    let kind = "HabitasMandalaWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HabitasProvider()) { entry in
            MandalaWidgetEntryView(entry: entry)
                .containerBackground(for: .widget) { WidgetBackground() }
        }
        .configurationDisplayName("Habitas 目標")
        .description("マンダラチャートの進み具合を確認できます。")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
