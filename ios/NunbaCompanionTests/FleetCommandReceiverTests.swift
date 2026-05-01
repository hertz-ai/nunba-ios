//
//  FleetCommandReceiverTests.swift
//  NunbaCompanionTests
//
//  Tests for the dispatcher + event-emitter pair (post-C1 fix).
//

import XCTest
@testable import NunbaCompanion

final class FleetCommandDispatcherTests: XCTestCase {

  var dispatcher: FleetCommandDispatcher!

  override func setUp() {
    super.setUp()
    dispatcher = FleetCommandDispatcher.shared
    dispatcher._reset()
  }

  override func tearDown() {
    dispatcher._reset()
    super.tearDown()
  }

  // MARK: — Recognized cmd_types

  func test_recognizedCommandTypes_includesAllExpected() {
    let expected: Set<String> = [
      "tts_stream", "agent_consent", "ui_navigate",
      "ui_overlay_show", "ui_overlay_dismiss",
      "notification_unconfirmed",
    ]
    XCTAssertEqual(FleetCommandDispatcher.recognizedCommandTypes, expected)
  }

  // MARK: — process() — direct + nested payload shapes

  func test_process_acceptsDirectShape_returnsTrue() {
    let payload: [AnyHashable: Any] = [
      "cmd_type": "ui_navigate",
      "id": "ui-12345",
      "screen": "KidsHub",
      "params": ["foo": "bar"],
    ]
    XCTAssertTrue(dispatcher.process(userInfo: payload))
    XCTAssertEqual(dispatcher.recentCommands.count, 1)
    XCTAssertEqual(dispatcher.recentCommands.first?["cmd_type"] as? String, "ui_navigate")
  }

  func test_process_unknownCmdType_returnsFalse() {
    let payload: [AnyHashable: Any] = ["cmd_type": "totally_made_up_cmd"]
    XCTAssertFalse(dispatcher.process(userInfo: payload))
    XCTAssertEqual(dispatcher.recentCommands.count, 0)
  }

  func test_process_missingCmdType_returnsFalse() {
    XCTAssertFalse(dispatcher.process(userInfo: ["screen": "KidsHub"]))
  }

  func test_process_emptyPayload_returnsFalse() {
    XCTAssertFalse(dispatcher.process(userInfo: [:]))
  }

  func test_process_acceptsDataAsJSONString() {
    let inner = #"{"cmd_type":"tts_stream","id":"tts-9","text":"hello"}"#
    XCTAssertTrue(dispatcher.process(userInfo: ["data": inner]))
    XCTAssertEqual(dispatcher.recentCommands.first?["text"] as? String, "hello")
  }

  func test_process_acceptsDataAsDict() {
    XCTAssertTrue(dispatcher.process(userInfo: [
      "data": [
        "cmd_type": "agent_consent",
        "action": "use_camera",
      ],
    ]))
    XCTAssertEqual(dispatcher.recentCommands.first?["action"] as? String, "use_camera")
  }

  func test_process_dataAsMalformedJSONString_returnsFalse() {
    XCTAssertFalse(dispatcher.process(userInfo: ["data": "{not json"]))
  }

  // MARK: — recentCommands history cap

  func test_recentCommands_capsAt20() {
    for i in 0..<25 {
      _ = dispatcher.process(userInfo: [
        "cmd_type": "ui_navigate",
        "id": "ui-\(i)",
        "screen": "KidsHub",
      ])
    }
    XCTAssertEqual(dispatcher.recentCommands.count, 20)
    XCTAssertEqual(dispatcher.recentCommands.first?["id"] as? String, "ui-5")
    XCTAssertEqual(dispatcher.recentCommands.last?["id"] as? String, "ui-24")
  }

  // MARK: — handleRemoteNotification

  func test_handleRemoteNotification_validPayload_callsCompletionWithTrue() {
    let exp = expectation(description: "completion")
    dispatcher.handleRemoteNotification(
      userInfo: ["cmd_type": "ui_overlay_dismiss", "id": "u-1"]
    ) { fetched in
      XCTAssertTrue(fetched)
      exp.fulfill()
    }
    wait(for: [exp], timeout: 1.0)
  }

  func test_handleRemoteNotification_invalidPayload_callsCompletionWithFalse() {
    let exp = expectation(description: "completion")
    dispatcher.handleRemoteNotification(userInfo: ["foo": "bar"]) { fetched in
      XCTAssertFalse(fetched)
      exp.fulfill()
    }
    wait(for: [exp], timeout: 1.0)
  }

  // MARK: — Emitter registration (the C1-fix architecture)

  func test_register_addsEmitterToDispatcher() {
    XCTAssertEqual(dispatcher._registeredEmitterCount(), 0)
    let e1 = FleetCommandEventEmitter()
    dispatcher.register(emitter: e1)
    XCTAssertEqual(dispatcher._registeredEmitterCount(), 1)
  }

  func test_unregister_removesEmitter() {
    let e1 = FleetCommandEventEmitter()
    dispatcher.register(emitter: e1)
    XCTAssertEqual(dispatcher._registeredEmitterCount(), 1)
    dispatcher.unregister(emitter: e1)
    XCTAssertEqual(dispatcher._registeredEmitterCount(), 0)
  }

  func test_register_acceptsMultipleEmitters() {
    let e1 = FleetCommandEventEmitter()
    let e2 = FleetCommandEventEmitter()
    dispatcher.register(emitter: e1)
    dispatcher.register(emitter: e2)
    XCTAssertEqual(dispatcher._registeredEmitterCount(), 2)
  }

  func test_emitterRefs_areWeak_dyingEmitterDoesNotPin() {
    autoreleasepool {
      let e = FleetCommandEventEmitter()
      dispatcher.register(emitter: e)
      XCTAssertEqual(dispatcher._registeredEmitterCount(), 1)
    }
    // Trigger another register so the dispatcher prunes dead refs.
    let surviving = FleetCommandEventEmitter()
    dispatcher.register(emitter: surviving)
    XCTAssertEqual(dispatcher._registeredEmitterCount(), 1,
                   "Dead weak refs should not stack — dispatcher prunes on register")
  }

  // MARK: — Singleton + back-compat

  func test_FleetCommandReceiver_sharedAliasesDispatcher() {
    XCTAssertTrue(FleetCommandReceiver.shared === FleetCommandDispatcher.shared)
  }

  func test_dispatcher_isProcessWideSingleton() {
    XCTAssertTrue(FleetCommandDispatcher.shared === FleetCommandDispatcher.shared)
  }

  // MARK: — Reset / state isolation

  func test_reset_clearsHistoryAndEmitters() {
    let e1 = FleetCommandEventEmitter()
    dispatcher.register(emitter: e1)
    _ = dispatcher.process(userInfo: ["cmd_type": "ui_navigate", "id": "x", "screen": "Home"])

    dispatcher._reset()
    XCTAssertEqual(dispatcher.recentCommands.count, 0)
    XCTAssertEqual(dispatcher._registeredEmitterCount(), 0)
  }
}

final class FleetCommandEventEmitterTests: XCTestCase {

  func test_supportedEvents_includesFleetCommand() {
    let emitter = FleetCommandEventEmitter()
    XCTAssertEqual(emitter.supportedEvents(), ["fleetCommand"])
  }

  func test_requiresMainQueueSetup_isFalse() {
    XCTAssertFalse(FleetCommandEventEmitter.requiresMainQueueSetup())
  }

  func test_startObserving_registersWithDispatcher() {
    FleetCommandDispatcher.shared._reset()
    let emitter = FleetCommandEventEmitter()
    XCTAssertEqual(FleetCommandDispatcher.shared._registeredEmitterCount(), 0)
    emitter.startObserving()
    XCTAssertEqual(FleetCommandDispatcher.shared._registeredEmitterCount(), 1)
    emitter.stopObserving()
    XCTAssertEqual(FleetCommandDispatcher.shared._registeredEmitterCount(), 0)
  }
}
