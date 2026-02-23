import Capacitor
import WidgetKit

@objc(WidgetBridge)
public class WidgetBridge: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridge"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "updateWidgetData", returnType: CAPPluginReturnPromise)
    ]

    @objc func updateWidgetData(_ call: CAPPluginCall) {
        let timerSeconds = call.getInt("timerSeconds") ?? 0
        let avatarName = call.getString("avatarName") ?? "idle"
        let className = call.getString("className") ?? ""
        let isActive = call.getBool("isActive") ?? false

        // Write to shared storage (App Group)
        let defaults = UserDefaults(suiteName: "group.com.loopylearn.shared")
        defaults?.set(timerSeconds, forKey: "timerSeconds")
        defaults?.set(avatarName, forKey: "avatarName")
        defaults?.set(className, forKey: "className")
        defaults?.set(isActive, forKey: "isActive")
        defaults?.set(Date(), forKey: "lastUpdated")

        // Tell iOS to refresh the widget
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }

        call.resolve()
    }
}
