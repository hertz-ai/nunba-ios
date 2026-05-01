//
//  AutobahnConnectionManager.swift
//  NunbaCompanion
//
//  iOS sibling of Android managers/AutobahnConnectionManager.java.
//  Owns the long-lived WAMP session over a single WebSocket connection
//  to the Crossbar router (azurekong.hertzai.com:8445/wss by default).
//
//  THIS FILE IS A STUB. The real implementation lands under task #169
//  (Port AutobahnConnectionManager (Swift WAMP) + XCTest). What's here
//  today provides:
//
//    - The .shared singleton + .publish(topic:payload:) entrypoint that
//      OnboardingModule.publishToWamp forwards to. Stubbed to log only.
//    - An installPublishProbe() / uninstallPublishProbe() pattern so
//      OnboardingModuleTests can verify forwarding without standing up
//      a real WAMP transport.
//    - The PublishProbe struct with a .calls log.
//
//  The full WAMP client (subscribe to fleet topics, emit fleetCommand
//  DeviceEvents, exponential reconnect, etc.) lands separately so this
//  port can be reviewed in small pieces.
//

import Foundation

@objc(AutobahnConnectionManager)
final class AutobahnConnectionManager: NSObject {

  /// Process-wide singleton. JS-side bridges (OnboardingModule) reach
  /// for .shared rather than receiving an instance, matching the
  /// Android `getInstance()` pattern.
  @objc static let shared = AutobahnConnectionManager()

  // MARK: — Public WAMP API (stubbed)

  /// Publish a WAMP event. Stub for now — logs and forwards to any
  /// installed test probe.
  func publish(topic: String, payload: String) {
    if let probe = Self.activeProbe {
      probe.calls.append(.init(topic: topic, payload: payload))
      return
    }
    NSLog("[AutobahnConnectionManager STUB] publish topic=\(topic) bytes=\(payload.utf8.count)")
    // TODO(#169): call into real WAMP client (URLSessionWebSocketTask).
  }

  func subscribe(topic: String, handler: @escaping (String) -> Void) {
    NSLog("[AutobahnConnectionManager STUB] subscribe topic=\(topic)")
    // TODO(#169): register subscription, replay current session.
  }

  // MARK: — Test probe (used by XCTests only)

  /// Recording probe for unit tests. Replaces the publish path so
  /// tests don't have to spin up a real WebSocket. Install in
  /// setUp, uninstall in tearDown.
  final class PublishProbe {
    struct Call: Equatable {
      let topic: String
      let payload: String
    }
    var calls: [Call] = []
  }

  private static var activeProbe: PublishProbe?

  static func installPublishProbe() -> PublishProbe {
    let probe = PublishProbe()
    activeProbe = probe
    return probe
  }

  static func uninstallPublishProbe() {
    activeProbe = nil
  }
}
