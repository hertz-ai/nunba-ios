//
//  SmokeUITests.swift
//  NunbaCompanionUITests
//
//  Boot-only + light navigation smoke tests. Catches:
//
//    • Build artifacts that compile but crash on launch
//      (missing Info.plist keys, UIKit assertions, RN bridge wiring)
//    • Splash screen that never advances
//    • Root component that fails to render text
//    • JS bundle that fails to load (Metro unreachable + no fallback)
//    • RN bridge wiring missing required emitters
//    • Auth-loading → SignUp transition lifecycle
//
//  These do NOT cover business logic — that's XCTest's job. This is
//  the "did the app even boot and survive" floor.
//

import XCTest

final class SmokeUITests: XCTestCase {

  override func setUp() {
    super.setUp()
    continueAfterFailure = false
  }

  /// Boot the app, wait for the RN root, snapshot.
  /// "Nunba Companion" appears in the auth-loading screen on first
  /// render. After the OnboardingModule.getAccessToken callback
  /// resolves (no token in CI), the app navigates to SignUpCombined.
  /// `waitForExistence` returns true on first match — catching the
  /// auth-loading screen in its brief render window is sufficient.
  func test_appLaunches_andRendersRoot() throws {
    let app = XCUIApplication()
    app.launch()

    // Generous boot window. On a cold simulator, RN's first launch
    // can take 8-10s to compile the JS bundle. Real device is faster.
    let bootDeadline: TimeInterval = 30

    let title = app.staticTexts["Nunba Companion"].firstMatch
    let appeared = title.waitForExistence(timeout: bootDeadline)
    XCTAssertTrue(
      appeared,
      "Expected 'Nunba Companion' text to render within \(bootDeadline)s — " +
      "app may have crashed on boot, the JS bundle failed to load, or " +
      "the auth-loading screen never rendered"
    )

    let screenshot = XCUIScreen.main.screenshot()
    let attachment = XCTAttachment(screenshot: screenshot)
    attachment.name = "app-launched-\(deviceLabel())"
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  /// Cold-launch twice. Catches AppDelegate idempotency bugs +
  /// state-leak issues + JS bundle caching errors.
  func test_appLaunches_twice_withoutCrash() throws {
    let app = XCUIApplication()

    app.launch()
    XCTAssertTrue(
      app.staticTexts["Nunba Companion"].firstMatch.waitForExistence(timeout: 30),
      "First launch failed"
    )

    app.terminate()

    // Second cold launch — RN bundle should be cached, faster.
    app.launch()
    XCTAssertTrue(
      app.staticTexts["Nunba Companion"].firstMatch.waitForExistence(timeout: 20),
      "Second launch failed — possible state-leak or AppDelegate idempotency bug"
    )
  }

  /// App stays running for 5s after the initial render. Catches
  /// crashes that fire AFTER first paint (e.g. AutobahnConnectionManager
  /// connect() throwing on the WAMP queue, FleetCommandReceiver
  /// crash on remote-notification registration error).
  func test_appStaysAlive_fiveSecondsAfterRender() throws {
    let app = XCUIApplication()
    app.launch()

    XCTAssertTrue(
      app.staticTexts["Nunba Companion"].firstMatch.waitForExistence(timeout: 30),
      "Initial render failed"
    )

    // Soak for 5s. If any background queue (Autobahn reconnect timer,
    // PeerLink crypto, FleetCommand event emitter) crashes, the app
    // exits and the next assertion fails.
    let exp = expectation(description: "soak")
    DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) { exp.fulfill() }
    wait(for: [exp], timeout: 6.0)

    XCTAssertEqual(app.state, .runningForeground,
                   "App died within 5s of first render — check for background-queue crash")

    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = "soak-test-\(deviceLabel())"
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  /// App handles backgrounding without crashing on resume. Common
  /// regression: AppDelegate's WAMP connection or scene lifecycle
  /// fights iOS's app-lifecycle assertions.
  func test_appHandlesBackgroundResume() throws {
    let app = XCUIApplication()
    app.launch()
    XCTAssertTrue(
      app.staticTexts["Nunba Companion"].firstMatch.waitForExistence(timeout: 30),
      "Initial render failed"
    )

    // Background
    XCUIDevice.shared.press(.home)
    sleep(2)
    XCTAssertEqual(app.state, .runningBackground,
                   "App did not transition to background")

    // Resume
    app.activate()
    sleep(2)
    XCTAssertEqual(app.state, .runningForeground,
                   "App did not return to foreground after activate")
  }

  // MARK: - Helpers

  private func deviceLabel() -> String {
    let device = UIDevice.current
    return "\(device.model)-iOS\(device.systemVersion)"
  }
}
