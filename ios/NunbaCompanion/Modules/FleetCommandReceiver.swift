//
//  FleetCommandReceiver.swift
//  NunbaCompanion
//
//  iOS sibling of MyFirebaseMessagingService.onMessageReceived
//  + LocalBroadcastManager fan-out (Android).
//
//  When an APNs background notification arrives carrying a fleet
//  command, this receiver:
//    1. Parses the userInfo payload
//    2. Validates it has a recognized cmd_type
//    3. Adds it to the in-memory history (so JS can poll)
//    4. Emits a 'fleetCommand' DeviceEvent so
//       js/shared/services/fleetCommandHandler.js dispatches the
//       same way it does on Android.
//    5. Reports back .newData / .noData via the completion handler
//       so iOS counts the wakeup as productive.
//
//  Recognized cmd_types (must match RN Android side AND HARTOS
//  publisher):
//      tts_stream             — agent-spoken audio
//      agent_consent          — permission prompt with countdown
//      ui_navigate            — push the app to a specific screen
//      ui_overlay_show        — float a server-driven UI card
//      ui_overlay_dismiss     — hide the floating card
//      notification_unconfirmed
//
//  Anything else logs and reports .noData.
//

import Foundation
import React

@objc(FleetCommandReceiver)
final class FleetCommandReceiver: RCTEventEmitter {

  /// Process-wide singleton — created by RN's bridge factory but
  /// also reachable directly so AppDelegate (which runs before the
  /// JS bridge is up) can hold a reference.
  @objc static let shared = FleetCommandReceiver()

  /// All cmd_types we accept. Stored as a Set so cmd_type validation
  /// is O(1) and the list is the single source of truth.
  static let recognizedCommandTypes: Set<String> = [
    "tts_stream",
    "agent_consent",
    "ui_navigate",
    "ui_overlay_show",
    "ui_overlay_dismiss",
    "notification_unconfirmed",
  ]

  /// In-memory buffer of recent commands. Mirrors Android's
  /// fleetCommandStore.commandHistory (last 20). Used so the JS
  /// layer can replay missed events on cold start before the bridge
  /// was wired.
  private(set) var recentCommands: [[String: Any]] = []
  private let maxHistory = 20

  /// Set to true once startObserving has been called by JS — guards
  /// against trying to send events before the JS listener is wired.
  private var hasJSListener = false

  // MARK: — RCTEventEmitter contract

  override func supportedEvents() -> [String] {
    ["fleetCommand"]
  }

  override static func requiresMainQueueSetup() -> Bool { false }

  override func startObserving() {
    hasJSListener = true
  }

  override func stopObserving() {
    hasJSListener = false
  }

  override init() {
    super.init()
  }

  // MARK: — APNs entry

  /// Called from AppDelegate.didReceiveRemoteNotification.
  ///
  /// Returns:
  ///   - true  → fetched useful data; iOS reports .newData
  ///   - false → no useful data; iOS reports .noData (saves background
  ///             budget; Apple penalizes apps that always claim newData)
  @discardableResult
  func handleRemoteNotification(
    userInfo: [AnyHashable: Any],
    completion: @escaping (Bool) -> Void = { _ in }
  ) -> Bool {
    let result = process(userInfo: userInfo)
    completion(result)
    return result
  }

  /// Synchronous core — split from handleRemoteNotification so
  /// XCTest can assert on the boolean return without juggling
  /// completion handlers.
  func process(userInfo: [AnyHashable: Any]) -> Bool {
    // Two payload shapes seen in practice:
    //   1. Direct: {"cmd_type": "...", "id": "...", ...other fields}
    //   2. Nested: {"data": "<json string>"}  (Android FCM 'data' relay)
    let payload = extractPayload(from: userInfo)

    guard let payload else {
      NSLog("[FleetCommandReceiver] payload missing or unparseable")
      return false
    }

    guard let cmdType = payload["cmd_type"] as? String else {
      NSLog("[FleetCommandReceiver] no cmd_type — ignoring")
      return false
    }

    guard Self.recognizedCommandTypes.contains(cmdType) else {
      NSLog("[FleetCommandReceiver] unknown cmd_type=\(cmdType) — ignoring")
      return false
    }

    // Append to history (drop oldest beyond cap).
    recentCommands.append(payload)
    if recentCommands.count > maxHistory {
      recentCommands.removeFirst(recentCommands.count - maxHistory)
    }

    // Emit to JS. The shared fleetCommandHandler.js expects an event
    // body with a `.data` field that's either a JSON string or an
    // already-parsed object — Android sends a string, we send the
    // parsed dictionary directly (it's idiomatic on iOS).
    if hasJSListener {
      sendEvent(withName: "fleetCommand", body: ["data": payload])
    }

    return true
  }

  /// Pulls the cmd_type-bearing payload out of userInfo.
  /// Returns nil if no fleet-command shape is found.
  private func extractPayload(from userInfo: [AnyHashable: Any]) -> [String: Any]? {
    // Direct shape — APNs custom data lives at the top level.
    if userInfo["cmd_type"] != nil {
      return Self.dictWithStringKeys(userInfo)
    }

    // Nested 'data' shape — common when re-routed through HARTOS's
    // generic data-message envelope. Either a JSON string or a dict.
    if let raw = userInfo["data"] {
      if let str = raw as? String,
         let data = str.data(using: .utf8),
         let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
        return json
      }
      if let dict = raw as? [String: Any] {
        return dict
      }
      // 'data' present but not a recognized shape.
      return nil
    }

    return nil
  }

  /// APNs userInfo arrives with [AnyHashable: Any] keys; downstream
  /// code wants [String: Any].
  private static func dictWithStringKeys(_ d: [AnyHashable: Any]) -> [String: Any] {
    var out: [String: Any] = [:]
    for (k, v) in d {
      if let key = k as? String { out[key] = v }
    }
    return out
  }

  // MARK: — Test affordances

  /// Test-only: reset internal state between cases.
  func _reset() {
    recentCommands.removeAll()
    hasJSListener = false
  }

  /// Test-only: simulate a JS listener attaching, so process()
  /// exercises the sendEvent path. Production code calls this via
  /// startObserving from the RN bridge.
  func _attachListener() {
    hasJSListener = true
  }
}
