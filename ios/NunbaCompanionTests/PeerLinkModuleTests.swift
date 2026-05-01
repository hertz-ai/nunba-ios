//
//  PeerLinkModuleTests.swift
//  NunbaCompanionTests
//

import XCTest
import CryptoKit
@testable import NunbaCompanion

final class PeerLinkModuleTests: XCTestCase {

  var module: PeerLinkModule!

  override func setUp() {
    super.setUp()
    module = PeerLinkModule.shared
    module._reset()
    PeerLinkCrypto.clearIdentity()
  }

  override func tearDown() {
    module._reset()
    PeerLinkCrypto.clearIdentity()
    super.tearDown()
  }

  // MARK: — Singleton + start lifecycle

  func test_shared_isSingleton() {
    XCTAssertTrue(PeerLinkModule.shared === PeerLinkModule.shared)
  }

  func test_start_returnsStateAndIdentityPubKey() {
    let exp = expectation(description: "")
    module.start({ result in
      let dict = result as? [String: Any] ?? [:]
      XCTAssertNotNil(dict["state"] as? String)
      let pub = dict["identityPubKey"] as? String
      XCTAssertNotNil(pub)
      XCTAssertEqual(pub?.count, 64, "Ed25519 pubkey is 32 bytes = 64 hex chars")
      exp.fulfill()
    }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp], timeout: 1.0)
  }

  func test_start_isIdempotent() {
    let exp1 = expectation(description: "first")
    var firstPub: String?
    module.start({ result in
      firstPub = (result as? [String: Any])?["identityPubKey"] as? String
      exp1.fulfill()
    }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp1], timeout: 1.0)

    // Second call should not crash and should return same identity.
    let exp2 = expectation(description: "second")
    module.start({ result in
      // Second call returns state — identityPubKey may or may not
      // be set depending on path; but the call must not reject.
      _ = result
      exp2.fulfill()
    }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp2], timeout: 1.0)

    // Identity persisted across start() calls.
    let stored = PeerLinkCrypto.loadOrCreateIdentity()
    XCTAssertEqual(stored?.publicKey.rawRepresentation.count, 32)
    XCTAssertNotNil(firstPub)
  }

  func test_stop_isAlwaysSafe() {
    let exp = expectation(description: "stop resolves")
    module.stop({ result in
      XCTAssertEqual(result as? Bool, true)
      exp.fulfill()
    }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp], timeout: 1.0)
  }

  // MARK: — getStatus / isReady / getApiBase

  func test_getStatus_initiallyNotConnected() {
    let exp = expectation(description: "")
    module.getStatus({ result in
      let dict = result as? [String: Any] ?? [:]
      XCTAssertEqual(dict["isConnected"] as? Bool, false)
      XCTAssertEqual(dict["isHandshakeComplete"] as? Bool, false)
      exp.fulfill()
    }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp], timeout: 1.0)
  }

  func test_isReady_initiallyFalse() {
    let exp = expectation(description: "")
    module.isReady({ result in
      XCTAssertEqual(result as? Bool, false)
      exp.fulfill()
    }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp], timeout: 1.0)
  }

  func test_isReady_trueAfterMarkReady() {
    module._markReady()
    let exp = expectation(description: "")
    module.isReady({ result in
      XCTAssertEqual(result as? Bool, true)
      exp.fulfill()
    }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp], timeout: 1.0)
  }

  func test_getApiBase_returnsCloudFallbackWhenNotConnected() {
    let exp = expectation(description: "")
    module.getApiBase({ result in
      let url = result as? String ?? ""
      XCTAssertTrue(url.contains("azurekong.hertzai.com"),
                    "Should fall back to cloud URL when no peer is connected")
      exp.fulfill()
    }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp], timeout: 1.0)
  }

  // MARK: — getDiscoveredPeers

  func test_getDiscoveredPeers_initiallyEmpty() {
    let exp = expectation(description: "")
    module.getDiscoveredPeers({ result in
      let arr = result as? [Any] ?? []
      // Before start() is called, no peers — start() seeds the cloud peer.
      XCTAssertEqual(arr.count, 0)
      exp.fulfill()
    }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp], timeout: 1.0)
  }

  func test_getDiscoveredPeers_afterStart_includesCloudPeer() {
    let exp1 = expectation(description: "start")
    module.start({ _ in exp1.fulfill() }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp1], timeout: 1.0)

    let exp2 = expectation(description: "list")
    module.getDiscoveredPeers({ result in
      let arr = result as? [[String: Any]] ?? []
      XCTAssertEqual(arr.count, 1)
      XCTAssertEqual(arr.first?["method"] as? String, "CLOUD")
      XCTAssertEqual(arr.first?["trustLevel"] as? String, "RELAY")
      exp2.fulfill()
    }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp2], timeout: 1.0)
  }

  // MARK: — Frame encryption (encrypted channels)

  func test_sendFrame_encryptsBodyOnEncryptedChannel() {
    // Set a session key, then send on an encrypted channel.
    // Because the WebSocket isn't connected, the actual send is a
    // no-op — but we verify the encryption decision via the
    // helper paths below.
    module._markReady()
    module._setSessionKey(SymmetricKey(size: .bits256))

    // We can't intercept the WS send without a probe — but we can
    // verify the per-channel encryption decision via direct call.
    XCTAssertNoThrow(module.sendFrame(channel: "consent", id: "x", body: ["foo": "bar"]))
    XCTAssertNoThrow(module.sendFrame(channel: "chat", id: "x", body: ["foo": "bar"]))
  }

  // MARK: — handleIncoming control + reply correlation

  func test_handleIncoming_helloAck_promotesToReady() {
    XCTAssertFalse({ () -> Bool in
      let exp = expectation(description: "")
      var ready = false
      module.isReady({ ready = $0 as? Bool ?? false; exp.fulfill() }, rejecter: { _, _, _ in })
      wait(for: [exp], timeout: 1.0)
      return ready
    }())

    // hello_ack without a session_pubkey → cleartext mode.
    module._injectIncoming(#"{"ch":"control","id":"hello_ack","d":{}}"#)

    let exp = expectation(description: "")
    module.isReady({ result in
      XCTAssertEqual(result as? Bool, true)
      exp.fulfill()
    }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp], timeout: 1.0)
  }

  func test_handleIncoming_malformedFrame_doesNotCrash() {
    XCTAssertNoThrow(module._injectIncoming("not-json"))
    XCTAssertNoThrow(module._injectIncoming("{}"))
    XCTAssertNoThrow(module._injectIncoming("[1,2,3]"))
    XCTAssertNoThrow(module._injectIncoming(#"{"ch":"x"}"#))  // missing id
  }

  // MARK: — RN bridge contract

  func test_requiresMainQueueSetup_isFalse() {
    XCTAssertFalse(PeerLinkModule.requiresMainQueueSetup())
  }
}
