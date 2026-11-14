import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    // URL opens and universal links: UIKit delivers them to SceneDelegate under
    // the scene life cycle, so they are forwarded to Capacitor there.

}

// MARK: - HexShare: share the finished-board card as an image, not a file
//
// The web game's share button hands the card to navigator.share() as a File.
// WKWebView forwards that to UIActivityViewController as a document, so the
// sheet offers Files/AirDrop/Mail and hides the image-capable apps (Messages,
// Instagram, Bluesky…) that are the point of sharing. This local plugin takes
// the PNG as base64 and presents the sheet with a UIImage activity item, which
// gets the full roster. Registered below via HexBridgeViewController (the
// storyboard's root view controller) so no project-file edit is needed.
@objc(HexSharePlugin)
public class HexSharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HexSharePlugin"
    public let jsName = "HexShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "shareImage", returnType: CAPPluginReturnPromise)
    ]

    @objc func shareImage(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64"),
              let data = Data(base64Encoded: base64, options: [.ignoreUnknownCharacters]),
              let image = UIImage(data: data) else {
            call.reject("HexShare: no image")
            return
        }
        DispatchQueue.main.async {
            guard let host = self.bridge?.viewController else {
                call.reject("HexShare: no view controller")
                return
            }
            let sheet = UIActivityViewController(activityItems: [image], applicationActivities: nil)
            sheet.completionWithItemsHandler = { activity, completed, _, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                call.resolve(["completed": completed, "activity": activity?.rawValue ?? ""])
            }
            if let pop = sheet.popoverPresentationController {
                pop.sourceView = host.view
                pop.sourceRect = CGRect(x: host.view.bounds.midX, y: host.view.bounds.maxY - 96, width: 1, height: 1)
                pop.permittedArrowDirections = [.down]
            }
            host.present(sheet, animated: true)
        }
    }
}

class HexBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HexSharePlugin())
    }
}
