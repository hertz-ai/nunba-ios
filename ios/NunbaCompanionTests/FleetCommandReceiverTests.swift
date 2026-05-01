//
//  FleetCommandReceiverTests.swift
//  NunbaCompanionTests
//

import XCTest
@testable import NunbaCompanion

final class FleetCommandReceiverTests: XCTestCase {

  var receiver: FleetCommandReceiver!

  override func setUp() {
    super.setUp()
    // Use the singleton — that's the actual production code path.
    // Reset between tests for isolation.
    receiver = FleetCommandReceiver.shared
    receiver._reset()
  }

  override func tearDown() {
    receiver._reset()
    super.tearDown()
  }

  // MARK: — Recognized cmd_types are the contract source-of-truth

  func test_recognizedCommandTypes_includesAllExpected() {
    let expected: Set<String> = [
      "tts_stream", "agent_consent", "ui_navigate",
      "ui_overlay_show", "ui_overlay_dismiss",
      "notification_unconfirmed",
    ]
    XCTAssertEqual(FleetCommandReceiver.recognizedCommandTypes, expected,
                   "If you add a cmd_type, also add it to RN Android side AND HARTOS publisher to keep contract synced")
  }

  // MARK: — process() — direct payload shape

  func test_process_acceptsDirectShape_returnsTrue() {
    let payload: [AnyHashable: Any] = [
      "cmd_type": "ui_navigate",
      "id": "ui-12345",
      "screen": "KidsHub",
      "params": ["foo": "bar"],
    ]
    XCTAssertTrue(receiver.process(userInfo: payload))
    XCTAssertEqual(receiver.recentCommands.count, 1)
    XCTAssertEqual(receiver.recentCommands.first?["cmd_type"] as? String, "ui_navigate")
    XCTAssertEqual(receiver.recentCommands.first?["screen"] as? String, "KidsHub")
  }

  func test_process_unknownCmdType_returnsFalse_noHistoryEntry() {
    let payload: [AnyHashable: Any] = [
      "cmd_type": "totally_made_up_cmd",
      "id": "x-1",
    ]
    XCTAssertFalse(receiver.process(userInfo: payload))
    XCTAssertEqual(receiver.recentCommands.count, 0)
  }

  func test_process_missingCmdType_returnsFalse() {
    let payload: [AnyHashable: Any] = [
      "id": "x-1",
      "screen": "KidsHub",
    ]
    XCTAssertFalse(receiver.process(userInfo: payload))
    XCTAssertEqual(receiver.recentCommands.count, 0)
  }

  func test_process_emptyPayload_returnsFalse() {
    XCTAssertFalse(receiver.process(userInfo: [:]))
  }

  // MARK: — process() — nested 'data' shape (FCM relay style)

  func test_process_acceptsDataAsJSONString() {
    let inner = #"{"cmd_type":"tts_stream","id":"tts-9","text":"hello"}"#
    let payload: [AnyHashable: Any] = ["data": inner]
    XCTAssertTrue(receiver.process(userInfo: payload))
    XCTAssertEqual(receiver.recentCommands.first?["text"] as? String, "hello")
  }

  func test_process_acceptsDataAsDict() {
    let payload: [AnyHashable: Any] = [
      "data": [
        "cmd_type": "agent_consent",
        "action": "use_camera",
        "agent_id": "vision-agent",
      ],
    ]
    XCTAssertTrue(receiver.process(userInfo: payload))
    XCTAssertEqual(receiver.recentCommands.first?["action"] as? String, "use_camera")
  }

  func test_process_dataAsMalformedJSONString_returnsFalse() {
    let payload: [AnyHashable: Any] = ["data": "{not json"]
    XCTAssertFalse(receiver.process(userInfo: payload))
  }

  func test_process_dataAsUnsupportedType_returnsFalse() {
    let payload: [AnyHashable: Any] = ["data": 42]
    XCTAssertFalse(receiver.process(userInfo: payload))
  }

  // MARK: — recentCommands history cap

  func test_recentCommands_capsAt20() {
    for i in 0..<25 {
      let payload: [AnyHashable: Any] = [
        "cmd_type": "ui_navigate",
        "id": "ui-\(i)",
        "screen": "KidsHub",
      ]
      _ = receiver.process(userInfo: payload)
    }
    XCTAssertEqual(receiver.recentCommands.count, 20,
                   "history must cap at maxHistory=20")
    // Oldest 5 (ui-0 through ui-4) should be evicted; ui-5 should be first.
    XCTAssertEqual(receiver.recentCommands.first?["id"] as? String, "ui-5")
    XCTAssertEqual(receiver.recentCommands.last?["id"] as? String, "ui-24")
  }

  // MARK: — handleRemoteNotification (the AppDelegate entrypoint)

  func test_handleRemoteNotification_validPayload_callsCompletionWithTrue() {
    let payload: [AnyHashable: Any] = [
      "cmd_type": "ui_overlay_dismiss",
      "id": "u-1",
    ]
    let exp = expectation(description: "completion called")
    receiver.handleRemoteNotification(userInfo: payload) { fetched in
      XCTAssertTrue(fetched)
      exp.fulfill()
    }
    wait(for: [exp], timeout: 1.0)
  }

  func test_handleRemoteNotification_invalidPayload_callsCompletionWithFalse() {
    let exp = expectation(description: "completion called")
    receiver.handleRemoteNotification(userInfo: ["foo": "bar"]) { fetched in
      XCTAssertFalse(fetched)
      exp.fulfill()
    }
    wait(for: [exp], timeout: 1.0)
  }

  // MARK: — RCTEventEmitter contract

  func test_supportedEvents_includesFleetCommand() {
    XCTAssertEqual(receiver.supportedEvents(), ["fleetCommand"])
  }

  func test_requiresMainQueueSetup_isFalse() {
    XCTAssertFalse(FleetCommandReceiver.requiresMainQueueSetup())
  }

  // MARK: — Idempotency / state isolation

  func test_reset_clearsHistory() {
    _ = receiver.process(userInfo: [
      "cmd_type": "ui_navigate", "id": "x", "screen": "Home",
    ])
    XCTAssertEqual(receiver.recentCommands.count, 1)
    receiver._reset()
    XCTAssertEqual(receiver.recentCommands.count, 0)
  }

  // MARK: — Singleton identity

  func test_shared_isProcessWideSingleton() {
    XCTAssertTrue(FleetCommandReceiver.shared === FleetCommandReceiver.shared)
  }
}
