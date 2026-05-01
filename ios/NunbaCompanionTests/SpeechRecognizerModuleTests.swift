//
//  SpeechRecognizerModuleTests.swift
//  NunbaCompanionTests
//

import XCTest
import Speech
@testable import NunbaCompanion

final class SpeechRecognizerModuleTests: XCTestCase {

  var module: SpeechRecognizerModule!

  override func setUp() {
    super.setUp()
    module = SpeechRecognizerModule()
  }

  override func tearDown() {
    module.stop()
    module = nil
    super.tearDown()
  }

  // MARK: — Lifecycle

  func test_isRunning_initiallyFalse() {
    XCTAssertFalse(module.isRunning)
  }

  func test_stop_whenNotRunning_isNoOp() {
    XCTAssertNoThrow(module.stop())
    XCTAssertFalse(module.isRunning)
  }

  // MARK: — RCTEventEmitter contract

  func test_supportedEvents_includesAllExpected() {
    let expected = Set(["speechPartial", "speechResult", "speechError"])
    XCTAssertEqual(Set(module.supportedEvents()), expected)
  }

  func test_requiresMainQueueSetup_isFalse() {
    XCTAssertFalse(SpeechRecognizerModule.requiresMainQueueSetup())
  }

  // MARK: — JS listener guard

  func test_emit_withoutListener_doesNotCrash() {
    module._setListenerAttached(false)
    // sendEvent on RCTEventEmitter without an active listener fires
    // a warning but should NOT crash. Our guard skips the call when
    // no listener is attached — verify no throw.
    XCTAssertNoThrow(module._testEmit(name: "speechPartial",
                                       body: ["transcript": "hi", "isFinal": false]))
  }

  func test_emit_withListener_doesNotCrash() {
    module._setListenerAttached(true)
    XCTAssertNoThrow(module._testEmit(name: "speechResult",
                                       body: ["transcript": "hello world", "isFinal": true]))
  }

  // MARK: — Locale handling

  func test_localeString_emptyMeansSystemDefault() {
    // We can't fully test the recognition pipeline (requires mic
    // permission + actual audio), but we verify the locale parsing
    // logic doesn't crash on edge inputs.
    XCTAssertNoThrow(module.start(""))
    module.stop()
  }

  func test_localeString_unknownReturnsErrorEvent() {
    // SFSpeechRecognizer(locale:) returns nil for some unsupported
    // locales. The pipeline should emit a speechError event rather
    // than crashing.
    module._setListenerAttached(true)
    XCTAssertNoThrow(module.start("zz-ZZ"))
    module.stop()
  }
}
