import WidgetKit
import SwiftUI

// The data model for each widget refresh
struct StudyEntry: TimelineEntry {
    let date: Date
    let timerSeconds: Int
    let avatarName: String
    let className: String
    let isActive: Bool
}

// Provides data to the widget
struct Provider: TimelineProvider {

    func placeholder(in context: Context) -> StudyEntry {
        StudyEntry(date: Date(), timerSeconds: 1500,
                   avatarName: "idle", className: "Math", isActive: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (StudyEntry) -> Void) {
        completion(readEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<StudyEntry>) -> Void) {
        let entry = readEntry()
        let nextUpdate = Calendar.current.date(byAdding: .second, value: 30, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func readEntry() -> StudyEntry {
        let defaults = UserDefaults(suiteName: "group.com.loopylearn.shared")
        return StudyEntry(
            date: Date(),
            timerSeconds: defaults?.integer(forKey: "timerSeconds") ?? 0,
            avatarName: defaults?.string(forKey: "avatarName") ?? "idle",
            className: defaults?.string(forKey: "className") ?? "",
            isActive: defaults?.bool(forKey: "isActive") ?? false
        )
    }
}

// Widget Views
struct LoopyLearnWidgetEntryView: View {
    var entry: StudyEntry
    @Environment(\.widgetFamily) var family

    var timerText: String {
        let m = entry.timerSeconds / 60
        let s = entry.timerSeconds % 60
        return String(format: "%d:%02d", m, s)
    }

    var body: some View {
        switch family {

        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 2) {
                    Image(systemName: entry.isActive ? "book.fill" : "pause.fill")
                        .font(.system(size: 12))
                    Text(timerText)
                        .font(.system(size: 14, weight: .bold, design: .monospaced))
                }
            }

        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Image(systemName: "book.fill")
                    Text("Loopy Learn")
                        .font(.headline)
                }
                Text(entry.className.isEmpty ? "No active session" : entry.className)
                    .font(.caption)
                Text(entry.isActive ? "⏱ \(timerText)" : "Paused")
                    .font(.system(size: 16, weight: .bold, design: .monospaced))
            }

        default:
            VStack {
                Text("📚 \(entry.className)")
                    .font(.caption)
                Text(timerText)
                    .font(.system(size: 28, weight: .bold, design: .monospaced))
                Text(entry.isActive ? "Studying..." : "Paused")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .padding()
        }
    }
}

// Widget Registration
@main
struct LoopyLearnWidget: Widget {
    let kind: String = "LoopyLearnWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            if #available(iOS 17.0, *) {
                LoopyLearnWidgetEntryView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                LoopyLearnWidgetEntryView(entry: entry)
                    .padding()
                    .background()
            }
        }
        .configurationDisplayName("Study Timer")
        .description("Shows your current study session timer.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryRectangular,
            .systemSmall
        ])
    }
}
