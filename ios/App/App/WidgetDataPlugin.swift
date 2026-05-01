import Foundation
import Capacitor
import WidgetKit

@objc(WidgetDataPlugin)
public class WidgetDataPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetDataPlugin"
    public let jsName = "WidgetData"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "writeWidgetData",         returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readPendingCompletions",  returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearPendingCompletions", returnType: CAPPluginReturnPromise),
    ]

    private let suiteName   = "group.com.morikuma.habitas"
    private let dataKey     = "habitasWidgetData"
    private let pendingKey  = "habitasPendingCompletions"

    @objc func writeWidgetData(_ call: CAPPluginCall) {
        guard let json = call.getString("data") else {
            call.reject("Missing data parameter")
            return
        }
        if let defaults = UserDefaults(suiteName: suiteName) {
            defaults.set(json, forKey: dataKey)
            defaults.synchronize()
        }
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }

    @objc func readPendingCompletions(_ call: CAPPluginCall) {
        let pending = UserDefaults(suiteName: suiteName)?.stringArray(forKey: pendingKey) ?? []
        call.resolve(["ids": pending])
    }

    @objc func clearPendingCompletions(_ call: CAPPluginCall) {
        if let defaults = UserDefaults(suiteName: suiteName) {
            defaults.removeObject(forKey: pendingKey)
            defaults.synchronize()
        }
        call.resolve()
    }
}
