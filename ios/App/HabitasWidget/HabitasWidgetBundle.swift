import WidgetKit
import SwiftUI

@main
struct HabitasWidgetBundle: WidgetBundle {
    var body: some Widget {
        HabitasHabitWidget()
        HabitasTaskWidget()
        HabitasMandalaWidget()
    }
}
