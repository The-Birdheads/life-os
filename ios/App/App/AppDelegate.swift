import UIKit
import Capacitor
import WidgetKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    private let appGroupId         = "group.com.morikuma.habitas"
    private let prefsPrefix        = "CapacitorStorage."
    private let widgetDataPrefKey  = "widget_data"
    private let widgetPendingPrefKey = "widget_pending"
    private let appGroupDataKey    = "habitasWidgetData"
    private let appGroupPendingKey = "habitasPendingCompletions"

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    // MARK: - App Group リレー

    /// Preferences (UserDefaults.standard に CapacitorStorage.* として保存) →
    /// App Group へ転送し、逆方向の pendingCompletions も書き戻す
    func relayWidgetDataToAppGroup() {
        guard let group = UserDefaults(suiteName: appGroupId) else { return }
        let std = UserDefaults.standard

        // 1. ウィジェット表示データを転送
        if let json = std.string(forKey: prefsPrefix + widgetDataPrefKey) {
            group.set(json, forKey: appGroupDataKey)
            group.synchronize()
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadAllTimelines()
            }
        }

        // 2. ウィジェット側の pending completions を Preferences へ書き戻し
        if let pending = group.stringArray(forKey: appGroupPendingKey), !pending.isEmpty {
            if let data = try? JSONSerialization.data(withJSONObject: pending),
               let json = String(data: data, encoding: .utf8) {
                std.set(json, forKey: prefsPrefix + widgetPendingPrefKey)
            }
            group.removeObject(forKey: appGroupPendingKey)
            group.synchronize()
        }
    }

    // MARK: - UIApplicationDelegate

    func applicationWillResignActive(_ application: UIApplication) {
        relayWidgetDataToAppGroup()
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        relayWidgetDataToAppGroup()
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // フォアグラウンド復帰時に pending completions を Preferences へ書き戻す
        relayWidgetDataToAppGroup()
    }

    func applicationDidBecomeActive(_ application: UIApplication) {}

    func applicationWillTerminate(_ application: UIApplication) {
        relayWidgetDataToAppGroup()
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
