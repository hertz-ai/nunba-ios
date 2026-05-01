//
//  FleetCommandReceiver.swift
//  NunbaCompanion
//
//  iOS sibling of MyFirebaseMessagingService.onMessageReceived
//  + LocalBroadcastManager fan-out (Android).
//
//  ARCHITECTURE — FIXES REVIEW C1:
//
//  React Native instantiates RCTEventEmitter modules itself (via the
//  Obj-C bridge factory). If we put `static let shared` on the
//  emitter class, AppDelegate's calls go to ONE instance and JS
//  attaches to a DIFFERENT instance — events never reach JS.
//
//  Fix: split into two classes.
//
//    • `FleetCommandDispatcher` (this file, top): a process-wide
//      pure singleton. AppDelegate calls .shared on it. Holds the
//      validated payload list + invokes any registered emitter.
//
//    • `FleetCommandEventEmitter` (RCTEventEmitter, below): the
//      class RN's bridge instantiates. On startObserving it
//      registers ITSELF with the dispatcher. On stopObserving it
//      unregisters. Multiple instances are safe (each sends events
//      to its own JS bridge).
//
//  Recognized cmd_types — kept on the dispatcher so the contract is
//  in one place:
//      tts_stream, agent_consent, ui_navigate,
//      ui_overlay_show, ui_overlay_dismiss, notification_unconfirmed
//

import Foundation
import React

// MARK: — Pure dispatcher (process-wide singleton)

final class FleetCommandDispatcher {

  /// Process-wide singleton. AppDelegate.didReceiveRemoteNotification
  /// reaches for .shared.handleRemoteNotification.
  static let shared = FleetCommandDispatcher()

  /// All cmd_types we accept. Single source of truth for the
  /// allowlist — both Android RN and HARTOS publishers must agree.
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
  /// layer can replay missed events on cold start before the
  /// bridge was wired.
  private(set) var recentCommands: [[String: Any]] = []
  private let maxHistory = 20

  /// Active emitters, weakly held so a torn-down RN bridge
  /// instance doesn't keep us pinned. Each emitter forwards
  /// events to its own JS bridge.
  private final class WeakEmitterRef {
    weak var emitter: FleetCommandEventEmitter?
    init(_ e: FleetCommandEventEmitter) { self.emitter = e }
  }
  private var emitters: [WeakEmitterRef] = []
  private let q = DispatchQueue(
    label: "com.hertzai.nunbacompanion.fleet",
    qos: .userInitiated
  )

  // MARK: — Emitter registration

  func register(emitter: FleetCommandEventEmitter) {
    q.sync {
      // Drop dead refs while we're here.
      emitters.removeAll { $0.emitter == nil }
      emitters.append(WeakEmitterRef(emitter))
    }
  }

  func unregister(emitter: FleetCommandEventEmitter) {
    q.sync {
      emitters.removeAll { $0.emitter === emitter || $0.emitter == nil }
    }
  }

  // MARK: — APNs entry

  /// Called from AppDelegate.didReceiveRemoteNotification.
  /// Returns: true → fetched useful data; iOS reports .newData
  ///          false → no useful data; iOS reports .noData
  @discardableResult
  func handleRemoteNotification(
    userInfo: [AnyHashable: Any],
    completion: @escaping (Bool) -> Void = { _ in }
  ) -> Bool {
    let result = process(userInfo: userInfo)
    completion(result)
    return result
  }

  /// Synchronous core. Public so AutobahnConnectionManager (the
  /// in-foreground WAMP path) can also feed payloads here.
  @discardableResult
  func process(userInfo: [AnyHashable: Any]) -> Bool {
    let payload = extractPayload(from: userInfo)

    guard let payload else {
      NSLog("[FleetCommandDispatcher] payload missing or unparseable")
      return false
    }

    guard let cmdType = payload["cmd_type"] as? String else {
      NSLog("[FleetCommandDispatcher] no cmd_type — ignoring")
      return false
    }

    guard Self.recognizedCommandTypes.contains(cmdType) else {
      NSLog("[FleetCommandDispatcher] unknown cmd_type=\(cmdType) — ignoring")
      return false
    }

    let snapshotEmitters: [FleetCommandEventEmitter] = q.sync {
      // Append history under the queue so we don't race with
      // concurrent process() calls.
      recentCommands.append(payload)
      if recentCommands.count > maxHistory {
        recentCommands.removeFirst(recentCommands.count - maxHistory)
      }
      return emitters.compactMap { $0.emitter }
    }

    // Emit OUTSIDE the queue so a slow JS handler can't back-pressure
    // the dispatcher.
    for emitter in snapshotEmitters {
      emitter.emit(payload: payload)
    }

    return true
  }

  /// Pulls the cmd_type-bearing payload out of userInfo.
  private func extractPayload(from userInfo: [AnyHashable: Any]) -> [String: Any]? {
    if userInfo["cmd_type"] != nil {
      return Self.dictWithStringKeys(userInfo)
    }
    if let raw = userInfo["data"] {
      if let str = raw as? String,
         let data = str.data(using: .utf8),
         let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
        return json
      }
      if let dict = raw as? [String: Any] {
        return dict
      }
      return nil
    }
    return nil
  }

  private static func dictWithStringKeys(_ d: [AnyHashable: Any]) -> [String: Any] {
    var out: [String: Any] = [:]
    for (k, v) in d {
      if let key = k as? String { out[key] = v }
    }
    return out
  }

  #if DEBUG
  /// Test-only: reset internal state between cases.
  func _reset() {
    q.sync {
      recentCommands.removeAll()
      emitters.removeAll()
    }
  }

  /// Test-only count of registered emitters.
  func _registeredEmitterCount() -> Int {
    q.sync {
      emitters.removeAll { $0.emitter == nil }
      return emitters.count
    }
  }
  #endif
}

// MARK: — RN-bridged emitter (instantiated by RN's bridge)

@objc(FleetCommandEventEmitter)
final class FleetCommandEventEmitter: RCTEventEmitter {

  private var hasJSListener = false

  override func supportedEvents() -> [String] {
    ["fleetCommand"]
  }

  override static func requiresMainQueueSetup() -> Bool { false }

  override func startObserving() {
    hasJSListener = true
    FleetCommandDispatcher.shared.register(emitter: self)
  }

  override func stopObserving() {
    hasJSListener = false
    FleetCommandDispatcher.shared.unregister(emitter: self)
  }

  override init() {
    super.init()
  }

  /// Called by FleetCommandDispatcher when a payload should be
  /// pushed to JS. Guarded by hasJSListener so RCTEventEmitter
  /// doesn't spam its "no observer" warning, AND by bridge != nil
  /// so direct-instantiation XCTests don't trip the RCTAssert
  /// in sendEvent's _callableJSModules check.
  func emit(payload: [String: Any]) {
    guard hasJSListener, bridge != nil else { return }
    sendEvent(withName: "fleetCommand", body: ["data": payload])
  }
}

// MARK: — Backwards-compat shim

/// Old code (AppDelegate, AutobahnConnectionManager) referenced
/// `FleetCommandReceiver.shared` — keep the old API as a thin alias
/// so existing call sites compile + behave the same way.
enum FleetCommandReceiver {
  static var shared: FleetCommandDispatcher { FleetCommandDispatcher.shared }
}
