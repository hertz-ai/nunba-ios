//
//  FleetCommandReceiver.swift
//  NunbaCompanion
//
//  iOS sibling of MyFirebaseMessagingService.onMessageReceived (Android).
//
//  When an APNs background notification arrives carrying a fleet
//  command (cmd_type ∈ {tts_stream, agent_consent, ui_navigate,
//  ui_overlay_show, ui_overlay_dismiss}), this receiver re-emits it
//  as a JS-side DeviceEventEmitter event named 'fleetCommand' so that
//  js/shared/services/fleetCommandHandler.js can consume the same
//  event shape it consumes on Android.
//
//  THIS FILE IS A STUB. Real APNs wiring lands under task #172
//  (FCM → APNs adapter). Today:
//    - Provides .shared singleton + handleRemoteNotification entry
//      that AppDelegate.didReceiveRemoteNotification calls.
//    - Logs and reports "newData=false" so the OS doesn't penalize
//      background fetch budget while the real implementation is
//      pending.
//

import Foundation
import React

@objc(FleetCommandReceiver)
final class FleetCommandReceiver: RCTEventEmitter {

  /// Process-wide singleton — instantiated by RN's bridge factory but
  /// also reachable directly so AppDelegate (which runs before the
  /// JS bridge is up) can hold a reference.
  @objc static let shared = FleetCommandReceiver()

  // MARK: — RCTEventEmitter contract

  override func supportedEvents() -> [String] {
    ["fleetCommand"]
  }

  override static func requiresMainQueueSetup() -> Bool { false }

  override init() {
    super.init()
  }

  // MARK: — APNs entry (stubbed)

  /// Called from AppDelegate.didReceiveRemoteNotification.
  /// Decodes the notification's `data` field and emits 'fleetCommand'
  /// so JS-side fleetCommandHandler.js can dispatch.
  ///
  /// - Parameter userInfo: APNs payload dictionary.
  /// - Parameter completion: true ⇒ UIBackgroundFetchResult.newData,
  ///   false ⇒ .noData.
  func handleRemoteNotification(
    userInfo: [AnyHashable: Any],
    completion: @escaping (Bool) -> Void
  ) {
    NSLog("[FleetCommandReceiver STUB] received \(userInfo.count) keys; passthrough not yet wired (#172)")
    // TODO(#172): parse cmd_type, validate against allowlist, emit
    // 'fleetCommand' DeviceEvent, ack via deviceApi if commandId present.
    completion(false)
  }
}
