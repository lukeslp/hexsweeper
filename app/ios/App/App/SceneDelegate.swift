import UIKit
import Capacitor

// Apps built with the iOS 27 SDK must use the UIScene life cycle or UIKit refuses
// to launch them (Apple TN3187). Info.plist's UIApplicationSceneManifest names
// this class and Main.storyboard, so UIKit builds the window from the storyboard
// (root: HexBridgeViewController) and hands it to `window` before
// scene(_:willConnectTo:options:) runs; nothing here creates a window.
//
// Under scenes, links that open the app arrive here instead of the AppDelegate.
// This Capacitor version has no SceneDelegateProxy (8.5 adds one), so they go to
// ApplicationDelegateProxy, as the AppDelegate did.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts {
            var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
            if let source = context.options.sourceApplication {
                options[.sourceApplication] = source
            }
            if let annotation = context.options.annotation {
                options[.annotation] = annotation
            }
            options[.openInPlace] = context.options.openInPlace
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: options)
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
}
