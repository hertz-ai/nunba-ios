//
//  AppDelegate.swift
//  Nunba Companion
//
//  React Native 0.81 boot sequence + iOS-native lifecycle hooks.
//  Native modules are auto-registered via the @objc(...) annotation
//  in their .swift files plus a corresponding .m bridge — see
//  Modules/ for the registry pattern.
//

import UIKit
import React
import React_RCTAppDelegate

@main
class AppDelegate: RCTAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    self.moduleName = "NunbaCompanion"
    self.dependencyProvider = RCTAppDependencyProvider()
    self.initialProps = [:]

    // Open the long-lived WAMP session. Without this, every
    // `OnboardingModule.publishToWamp` call from JS silently no-ops
    // (review C4). The connection runs on its own queue and won't
    // block app launch.
    AutobahnConnectionManager.shared.connect()

    // Register for APNs so background fleet commands actually reach
    // FleetCommandReceiver. Without this we never receive the device
    // token + the OS doesn't deliver remote-notifications to us
    // (review M25).
    application.registerForRemoteNotifications()

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // MARK: — APNs token + registration callbacks

  override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    // Hex-encode the APNs token. The JS layer (deviceApi.js) uploads
    // this to HARTOS so backend can address this physical install.
    let token = deviceToken.map { String(format: "%02x", $0) }.joined()
    NSLog("[AppDelegate] APNs registration succeeded; token bytes=\(deviceToken.count)")
    APNsTokenStore.shared.token = token
  }

  override func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    NSLog("[AppDelegate] APNs registration failed: \(error.localizedDescription)")
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
    #if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(
      forBundleRoot: "index"
    )
    #else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    #endif
  }

  // MARK: — Background remote notification handler.
  // FCM data messages routed through APNs land here; the iOS sibling
  // of Android's MyFirebaseMessagingService.onMessageReceived. The
  // FleetCommandReceiver module re-broadcasts the payload as a JS
  // event named 'fleetCommand' so services/fleetCommandHandler.js
  // can consume it unchanged.
  override func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    FleetCommandReceiver.shared.handleRemoteNotification(userInfo: userInfo) { fetched in
      completionHandler(fetched ? .newData : .noData)
    }
  }
}
