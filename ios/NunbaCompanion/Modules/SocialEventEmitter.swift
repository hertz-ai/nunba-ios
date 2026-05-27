//
//  SocialEventEmitter.swift
//  #50 (2026-05-27) — RN-bridged emitter for the canonical HARTOS
//  social fan-out (com.hertzai.hevolve.social.{user_id}).
//
//  AutobahnConnectionManager.autoSubscribeFleetTopicsLocked subscribes
//  to the social topic on (re)join and forwards every payload here
//  via SocialEventEmitter.shared.emit(payload:).  This emitter then
//  pushes the row to JS under the "socialEvent" event name so the
//  React Native notification + community surfaces can render it the
//  same way web + Android do.
//
//  Topic shape:
//    com.hertzai.hevolve.social.{userId}
//  Payloads (discriminated by `type` field):
//    - notification         — NotificationService.create + on_notification
//    - notification.read    — mark_read / mark_all_read fan-out (P1-S1)
//    - post.new / post.update / post.delete   — post lifecycle (#51)
//    - comment.new / comment.delete           — comment lifecycle (#49/#52)
//
//  Mirrors ChatNewEventEmitter exactly — same "single RN-bridged WAMP
//  emitter" pattern, different topic + different JS consumer.  Why a
//  separate emitter (not reuse chatNew): different schemas + different
//  JS consumers — collapsing would be parallel-path, not reuse.
//

import Foundation
import React

@objc(SocialEventEmitter)
final class SocialEventEmitter: RCTEventEmitter {

  /// Process-wide shared instance.
  static let shared = SocialEventEmitter()

  private var hasJSListener = false

  override func supportedEvents() -> [String] {
    ["socialEvent"]
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

  /// Push one social-topic payload to the JS side.  Same guards as
  /// ChatNewEventEmitter so XCTests can direct-instantiate and we
  /// don't warn before RN starts listening.
  func emit(payload: Any) {
    guard hasJSListener, bridge != nil else { return }
    sendEvent(withName: "socialEvent", body: ["data": payload])
  }
}
