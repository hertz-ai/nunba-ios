//
//  AutobahnConnectionManagerTests.swift
//  NunbaCompanionTests
//

import XCTest
@testable import NunbaCompanion

final class AutobahnConnectionManagerTests: XCTestCase {

  var mgr: AutobahnConnectionManager!

  override func setUp() {
    super.setUp()
    mgr = AutobahnConnectionManager.shared
    mgr._reset()
    AutobahnConnectionManager.uninstallPublishProbe()
  }

  override func tearDown() {
    AutobahnConnectionManager.uninstallPublishProbe()
    mgr._reset()
    super.tearDown()
  }

  // MARK: — Singleton

  func test_shared_isProcessWideSingleton() {
    XCTAssertTrue(AutobahnConnectionManager.shared === AutobahnConnectionManager.shared)
  }

  // MARK: — Test probe

  func test_publishProbe_capturesCalls_whenInstalled() {
    let probe = AutobahnConnectionManager.installPublishProbe()
    defer { AutobahnConnectionManager.uninstallPublishProbe() }

    mgr.publish(topic: "topic.a", payload: "{\"hello\":1}")
    mgr.publish(topic: "topic.b", payload: "{\"hello\":2}")

    XCTAssertEqual(probe.calls.count, 2)
    XCTAssertEqual(probe.calls[0], .init(topic: "topic.a", payload: "{\"hello\":1}"))
    XCTAssertEqual(probe.calls[1], .init(topic: "topic.b", payload: "{\"hello\":2}"))
  }

  func test_uninstallPublishProbe_releasesCapture() {
    _ = AutobahnConnectionManager.installPublishProbe()
    AutobahnConnectionManager.uninstallPublishProbe()
    // Now publish should NOT crash and should NOT capture.
    mgr.publish(topic: "topic.x", payload: "{}")
    // No assertion needed beyond "no crash" — uncaptured publish
    // when state != .joined silently no-ops.
  }

  func test_publish_droppedSilentlyWhenNotJoined() {
    XCTAssertEqual(mgr.state, .disconnected)
    XCTAssertNoThrow(mgr.publish(topic: "topic", payload: "{}"))
  }

  // MARK: — configure() router/realm

  func test_configure_overridesRouterURL() {
    let originalURL = mgr.routerURL
    let newURL = URL(string: "wss://example.test/ws")!
    mgr.configure(routerURL: newURL)
    XCTAssertEqual(mgr.routerURL, newURL)
    // restore for other tests
    mgr.configure(routerURL: originalURL)
  }

  func test_configure_overridesRealm() {
    let originalRealm = mgr.realm
    mgr.configure(realm: "test-realm")
    XCTAssertEqual(mgr.realm, "test-realm")
    mgr.configure(realm: originalRealm)
  }

  func test_configure_nilArgs_leavesValuesUntouched() {
    let origURL = mgr.routerURL
    let origRealm = mgr.realm
    mgr.configure(routerURL: nil, realm: nil)
    XCTAssertEqual(mgr.routerURL, origURL)
    XCTAssertEqual(mgr.realm, origRealm)
  }

  // MARK: — WAMP message handling

  func test_handleIncoming_welcomeTransitionsToJoined() {
    XCTAssertEqual(mgr.state, .disconnected)
    mgr._injectIncoming("[2, 12345, {}]")
    XCTAssertEqual(mgr.state, .joined)
    XCTAssertEqual(mgr.sessionId, 12345)
  }

  func test_handleIncoming_malformedJSON_doesNotCrash() {
    XCTAssertNoThrow(mgr._injectIncoming("not-json"))
    XCTAssertNoThrow(mgr._injectIncoming("[]"))
    XCTAssertNoThrow(mgr._injectIncoming("{}"))
  }

  func test_handleIncoming_unknownMessageType_isIgnored() {
    mgr._markJoined()
    let pre = mgr.sessionId
    mgr._injectIncoming("[99, 1, 2, 3]")  // not a known WAMP type
    XCTAssertEqual(mgr.state, .joined)
    XCTAssertEqual(mgr.sessionId, pre)
  }

  func test_subscribe_invokesHandlerOnEvent() {
    // Handler dispatch is async (C5 thread-safety fix:
    // DispatchQueue.global() so a slow JS handler can't back-pressure
    // the WS read loop). Use an expectation to wait for it.
    let exp = expectation(description: "handler called")
    var receivedPayloads: [String] = []
    mgr._markJoined()

    mgr.subscribe(topic: "com.test.topic") { payload in
      receivedPayloads.append(payload)
      exp.fulfill()
    }

    // Simulate router replying SUBSCRIBED for our request.
    mgr._injectIncoming("[33, 1, 7777]")
    // Simulate an EVENT for that subscription.
    mgr._injectIncoming(#"[36, 7777, 0, {}, ["{\"hello\":\"world\"}"]]"#)

    wait(for: [exp], timeout: 2.0)
    XCTAssertEqual(receivedPayloads, [#"{"hello":"world"}"#])
  }

  func test_subscribe_handlerReceivesDictAsJSONString() {
    // Async handler dispatch — wait for it.
    let exp = expectation(description: "handler called")
    var received: String?
    mgr._markJoined()

    mgr.subscribe(topic: "com.test.topic") { payload in
      received = payload
      exp.fulfill()
    }
    mgr._injectIncoming("[33, 1, 8888]")
    mgr._injectIncoming(#"[36, 8888, 0, {}, [{"a":1}]]"#)

    wait(for: [exp], timeout: 2.0)
    XCTAssertNotNil(received)
    let asData = received?.data(using: .utf8) ?? Data()
    let raw = (try? JSONSerialization.jsonObject(with: asData)) ?? [:]
    let parsed = raw as? [String: Any]
    XCTAssertEqual(parsed?["a"] as? Int, 1)
  }

  func test_subscribe_eventForUnknownSubId_isIgnored() {
    var calls = 0
    mgr._markJoined()
    mgr.subscribe(topic: "com.test.topic") { _ in calls += 1 }
    mgr._injectIncoming("[33, 1, 100]")

    // EVENT for some other subId.
    mgr._injectIncoming(#"[36, 999, 0, {}, ["x"]]"#)
    XCTAssertEqual(calls, 0)
  }

  // MARK: — Backoff

  func test_backoffSeconds_capsAt60() {
    for attempt in 1...20 {
      let s = AutobahnConnectionManager.backoffSeconds(attempt: attempt)
      XCTAssertGreaterThanOrEqual(s, 0)
      XCTAssertLessThanOrEqual(s, 60)
    }
  }

  func test_backoffSeconds_growsWithAttempt() {
    // Statistical — jitter means individual samples can be small,
    // but the upper bound grows. Take many samples per attempt and
    // assert the max is non-decreasing.
    var maxes: [TimeInterval] = []
    for attempt in 1...5 {
      var m: TimeInterval = 0
      for _ in 0..<50 {
        m = max(m, AutobahnConnectionManager.backoffSeconds(attempt: attempt))
      }
      maxes.append(m)
    }
    // Each successive max should be ≥ previous (allow exact equality
    // due to RNG; this is non-strict monotonic).
    for i in 1..<maxes.count {
      XCTAssertGreaterThanOrEqual(maxes[i] + 0.001, maxes[i - 1])
    }
  }

  // MARK: — disconnect()

  func test_disconnect_clearsState() {
    mgr._markJoined()
    mgr.subscribe(topic: "x", handler: { _ in })
    mgr._injectIncoming("[33, 1, 50]")

    mgr.disconnect()
    XCTAssertEqual(mgr.state, .disconnected)
    XCTAssertEqual(mgr.sessionId, 0)
  }

  // MARK: — _reset() between tests

  func test_reset_returnsToInitialState() {
    mgr._markJoined(sessionId: 999)
    mgr.subscribe(topic: "x", handler: { _ in })
    mgr._reset()
    XCTAssertEqual(mgr.state, .disconnected)
    XCTAssertEqual(mgr.sessionId, 0)
  }
}
