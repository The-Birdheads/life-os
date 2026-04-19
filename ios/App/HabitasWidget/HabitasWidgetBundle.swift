//
//  HabitasWidgetBundle.swift
//  HabitasWidget
//
//  Created by USER on 2026/04/17.
//

import WidgetKit
import SwiftUI

@main
struct HabitasWidgetBundle: WidgetBundle {
    var body: some Widget {
        HabitasWidget()
        HabitasWidgetControl()
        HabitasWidgetLiveActivity()
    }
}
