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
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
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
