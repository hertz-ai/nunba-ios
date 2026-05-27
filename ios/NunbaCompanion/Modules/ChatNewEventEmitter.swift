//
//  ChatNewEventEmitter.swift
//  P2-S5 (2026-05-26) — RN-bridged emitter for the canonical
//  HARTOS chat.new fan-out (com.hertzai.hevolve.chat.new.{user_id}).
//
//  AutobahnConnectionManager.autoSubscribeFleetTopicsLocked subscribes
//  to the chat.new topic on (re)join and forwards every payload here
//  via ChatNewEventEmitter.shared.emit(payload:).  This emitter then
//  pushes the row to JS under the "chatNew" event name so the React
//  Native chat surface can render it the same way web + Android do.
//
//  Mirrors FleetCommandEventEmitter exactly so there's a single
//  pattern for "RN-bridged WAMP fan-out emitter" in this app:
//    - hasJSListener guard suppresses no-observer warnings
//    - bridge != nil guard lets XCTests direct-instantiate without
//      tripping RCTAssert in sendEvent
//    - emit() is the public surface; transport plumbing is private
//
//  Why a separate emitter (not "reuse fleetCommand"): chat.new
//  carries ConversationEntry rows (role/content/channel_type/...).
//  fleetCommand carries cmd_type-shaped device commands.  Different
//  schemas + different JS consumers — collapsing them would be a
//  parallel-path violation, not a reuse.
//

import Foundation
import React

@objc(ChatNewEventEmitter)
final class ChatNewEventEmitter: RCTEventEmitter {

  /// Process-wide shared instance.  Mirrors FleetCommandDispatcher's
  /// register-emitter pattern but inline since chat.new has no
  /// dedicated dispatcher today — RN bridge factory creates one
  /// instance per startObserving and AutobahnConnectionManager
  /// emits through this static accessor.
  static let shared = ChatNewEventEmitter()

  private var hasJSListener = false

  override func supportedEvents() -> [String] {
    ["chatNew"]
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

  /// Push one chat.new payload to the JS side.  Guarded so XCTests
  /// that instantiate this directly (no RCTBridge attached) don't
  /// crash on the sendEvent RCTAssert, and so we don't spam
  /// "no observer" warnings before the RN runtime starts listening.
  func emit(payload: Any) {
    guard hasJSListener, bridge != nil else { return }
    sendEvent(withName: "chatNew", body: ["data": payload])
  }
}
