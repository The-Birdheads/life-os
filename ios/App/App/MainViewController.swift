import UIKit
import Capacitor

/// Capacitor のデフォルト ViewController を継承し、
/// iOS 16.4+ で WebView を Appium / Safari Web Inspector から
/// 検出できるよう isInspectable を強制的に有効化する。
class MainViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        setWebViewInspectable()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        setWebViewInspectable()
    }

    private func setWebViewInspectable() {
        if #available(iOS 16.4, *) {
            webView?.isInspectable = true
        }
    }
}
