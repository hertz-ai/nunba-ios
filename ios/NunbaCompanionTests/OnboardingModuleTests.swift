//
//  OnboardingModuleTests.swift
//  NunbaCompanionTests
//
//  XCTest coverage for OnboardingModule — runs against the real
//  Keychain + UserDefaults on the simulator. Each test cleans up
//  its own state in setUp/tearDown so order-independence holds.
//

import XCTest
@testable import NunbaCompanion

final class OnboardingModuleTests: XCTestCase {

  var module: OnboardingModule!

  override func setUp() {
    super.setUp()
    module = OnboardingModule()
    // Clean slate: nuke any token + user_id left over from prior tests
    // (or from a previously installed copy of the host app on the
    // simulator).
    OnboardingModule.setPersistedUserId(nil)
    OnboardingModule.writeToken(nil)
  }

  override func tearDown() {
    OnboardingModule.setPersistedUserId(nil)
    OnboardingModule.writeToken(nil)
    module = nil
    super.tearDown()
  }

  // MARK: — getUser_id

  func test_getUser_id_returnsEmptyStringWhenNotSet() {
    let exp = expectation(description: "callback fires")
    // RCTResponseSenderBlock is typed `(NSArray) -> Void` in ObjC,
    // which bridges to `([Any]?) -> Void` in Swift — args is
    // optional. Unwrap before indexing.
    module.getUser_id { args in
      let unwrapped = args ?? []
      XCTAssertEqual(unwrapped.count, 1)
      XCTAssertEqual(unwrapped[0] as? String, "")
      exp.fulfill()
    }
    wait(for: [exp], timeout: 1.0)
  }

  func test_getUser_id_returnsPersistedValue() {
    OnboardingModule.setPersistedUserId("user-42")
    let exp = expectation(description: "callback fires with persisted id")
    module.getUser_id { args in
      XCTAssertEqual((args ?? [])[0] as? String, "user-42")
      exp.fulfill()
    }
    wait(for: [exp], timeout: 1.0)
  }

  func test_setPersistedUserId_overwritesExistingValue() {
    OnboardingModule.setPersistedUserId("first")
    OnboardingModule.setPersistedUserId("second")
    XCTAssertEqual(OnboardingModule.persistedUserId(), "second")
  }

  func test_setPersistedUserId_nilClearsValue() {
    OnboardingModule.setPersistedUserId("user-1")
    OnboardingModule.setPersistedUserId(nil)
    XCTAssertNil(OnboardingModule.persistedUserId())
  }

  func test_setPersistedUserId_emptyStringClearsValue() {
    OnboardingModule.setPersistedUserId("user-1")
    OnboardingModule.setPersistedUserId("")
    XCTAssertNil(OnboardingModule.persistedUserId())
  }

  // MARK: — getAccessToken (Keychain)

  func test_getAccessToken_returnsEmptyStringWhenNotSet() {
    let exp = expectation(description: "callback fires")
    module.getAccessToken { args in
      let unwrapped = args ?? []
      XCTAssertEqual(unwrapped.count, 1)
      XCTAssertEqual(unwrapped[0] as? String, "")
      exp.fulfill()
    }
    wait(for: [exp], timeout: 1.0)
  }

  func test_writeToken_thenRead_roundTrips() {
    let ok = OnboardingModule.writeToken("Bearer.eyJabc.xyz")
    XCTAssertTrue(ok)
    XCTAssertEqual(OnboardingModule.readToken(), "Bearer.eyJabc.xyz")
  }

  func test_writeToken_overwritesExistingValue() {
    XCTAssertTrue(OnboardingModule.writeToken("first-token"))
    XCTAssertTrue(OnboardingModule.writeToken("second-token"))
    XCTAssertEqual(OnboardingModule.readToken(), "second-token")
  }

  func test_writeToken_nilClearsKeychain() {
    XCTAssertTrue(OnboardingModule.writeToken("token"))
    XCTAssertEqual(OnboardingModule.readToken(), "token")

    XCTAssertTrue(OnboardingModule.writeToken(nil))
    XCTAssertNil(OnboardingModule.readToken())
  }

  func test_writeToken_emptyStringClearsKeychain() {
    XCTAssertTrue(OnboardingModule.writeToken("token"))
    XCTAssertTrue(OnboardingModule.writeToken(""))
    XCTAssertNil(OnboardingModule.readToken())
  }

  func test_writeToken_handlesUnicode() {
    let unicodeToken = "🔐.token.with.émojis.и.中文"
    XCTAssertTrue(OnboardingModule.writeToken(unicodeToken))
    XCTAssertEqual(OnboardingModule.readToken(), unicodeToken)
  }

  func test_getAccessToken_returnsKeychainValue() {
    OnboardingModule.writeToken("xctest.bearer.token")
    let exp = expectation(description: "callback fires")
    module.getAccessToken { args in
      XCTAssertEqual((args ?? [])[0] as? String, "xctest.bearer.token")
      exp.fulfill()
    }
    wait(for: [exp], timeout: 1.0)
  }

  // MARK: — publishToWamp

  func test_publishToWamp_emptyTopicResolvesPublishedFalse() {
    // The H10/H1 fix changed publishToWamp to a Promise-returning
    // method. Empty topic resolves with {published: false, reason}
    // rather than throwing or being a void no-op.
    let exp = expectation(description: "promise resolves")
    module.publishToWamp("", payload: "{}",
                        resolver: { result in
                          let dict = result as? [String: Any] ?? [:]
                          XCTAssertEqual(dict["published"] as? Bool, false)
                          XCTAssertNotNil(dict["reason"] as? String)
                          exp.fulfill()
                        },
                        rejecter: { _, _, _ in
                          XCTFail("Empty topic should resolve, not reject")
                        })
    wait(for: [exp], timeout: 1.0)
  }

  func test_publishToWamp_forwardsToConnectionManager() {
    // Inject a stub onto AutobahnConnectionManager.shared for this
    // test. The real connection manager's tests cover transport
    // behavior; here we only verify the bridge call.
    let probe = AutobahnConnectionManager.installPublishProbe()
    defer { AutobahnConnectionManager.uninstallPublishProbe() }

    let exp = expectation(description: "promise resolves")
    module.publishToWamp("com.hertzai.test.topic",
                        payload: #"{"hello":"world"}"#,
                        resolver: { result in
                          let dict = result as? [String: Any] ?? [:]
                          // Probe is installed → publish() returns
                          // true (captured), so resolver gets
                          // {published: true}.
                          XCTAssertEqual(dict["published"] as? Bool, true)
                          exp.fulfill()
                        },
                        rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp], timeout: 1.0)

    XCTAssertEqual(probe.calls.count, 1)
    XCTAssertEqual(probe.calls.first?.topic, "com.hertzai.test.topic")
    XCTAssertEqual(probe.calls.first?.payload, #"{"hello":"world"}"#)
  }

  // MARK: — RN bridge contract

  func test_requiresMainQueueSetup_isFalse() {
    // OnboardingModule does no UIKit work at init — must opt out of
    // main-queue setup so the bridge can construct it on the JS thread.
    XCTAssertFalse(OnboardingModule.requiresMainQueueSetup())
  }
}
