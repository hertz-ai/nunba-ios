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
// RN 0.81 codegen pod — supplies RCTAppDependencyProvider class
// referenced below. With use_frameworks!:static, this pod is
// importable as a Swift module.
import ReactAppDependencyProvider

@main
class AppDelegate: RCTAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Disable RN dev mode at the RCTBundleURLProvider level BEFORE
    // super.application is invoked. Without this, Debug builds set
    // RCT_enableDev=1 in NSUserDefaults, which makes RN ignore our
    // bundleURL() override and try to fetch from Metro at
    // localhost:8081 — failing in CI and showing the "Connect to
    // Metro to develop JavaScript" placeholder forever.
    //
    // The simulator console captured this in run 25244593266:
    //   [User Defaults] setting new value 1 for key RCT_enableDev
    // Setting it to false here forces production-style behavior:
    // load main.jsbundle from the .app bundle, no packager probe.
    let provider = RCTBundleURLProvider.sharedSettings()
    provider.enableDev = false
    provider.enableMinification = true
    UserDefaults.standard.set(false, forKey: "RCT_enableDev")
    UserDefaults.standard.set(true, forKey: "RCT_enableMinification")

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

  // (Remote notification methods moved below — see new section.)

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
    // Prefer the embedded bundle when present. CI runs (no Metro)
    // hit RCTBundleURLProvider's "Connect to Metro" placeholder
    // because the dev path tries the packager first and either
    // hangs or thinks localhost:8081 is reachable; the fallback
    // block is documented to be invoked but isn't actually used in
    // the RN 0.81 path on macos-15 simulators. Bypassing the
    // dev-server probe entirely fixes that.
    //
    // For local dev, manually delete ios/main.jsbundle (it's
    // gitignored) — the absence of the embedded bundle drops us
    // into the Metro-probing branch as before.
    if let embedded = Bundle.main.url(forResource: "main", withExtension: "jsbundle") {
      NSLog("[AppDelegate] bundleURL -> embedded %@", embedded.absoluteString)
      return embedded
    }

    #if DEBUG
    let url = RCTBundleURLProvider.sharedSettings().jsBundleURL(
      forBundleRoot: "index",
      fallbackURLProvider: { nil }
    )
    NSLog("[AppDelegate] bundleURL -> Metro %@", url?.absoluteString ?? "nil")
    return url
    #else
    NSLog("[AppDelegate] bundleURL -> nil (release build, no embedded bundle)")
    return nil
    #endif
  }

  // MARK: — Background remote notification handler.
  // RN 0.81's RCTAppDelegate DOES implement these UIApplicationDelegate
  // methods (verified by the Swift compiler insisting we mark them
  // `override`). Earlier pre-flight audit incorrectly assumed the
  // public header was authoritative — the actual RCTAppDelegate.mm
  // file overrides them. Marking `override` is required.
  override func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    FleetCommandReceiver.shared.handleRemoteNotification(userInfo: userInfo) { fetched in
      completionHandler(fetched ? .newData : .noData)
    }
  }

  // MARK: — APNs token + registration callbacks
  // (Same `override` requirement as above.)

  override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
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
}
