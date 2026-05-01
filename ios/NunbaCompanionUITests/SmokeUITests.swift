//
//  SmokeUITests.swift
//  NunbaCompanionUITests
//
//  Boot-only smoke test — launches the app on a simulator, waits for
//  the React Native bridge + root component to render, and captures
//  a screenshot. Catches:
//
//    • Build artifacts that compile but crash on launch
//      (missing Info.plist keys, UIKit assertions, RN bridge wiring)
//    • Splash screen that never advances
//    • Root component that fails to render text
//    • Required permission strings that block app launch on iOS
//      (privacy keys missing → SIGABRT immediately)
//
//  Does NOT cover business logic — that's XCTest's job. This is the
//  "did the app even start" floor.
//

import XCTest

final class SmokeUITests: XCTestCase {

  override func setUp() {
    super.setUp()
    // Surface failures the moment they happen; the test will still
    // tear down cleanly, but the screenshot we capture below is more
    // useful when taken at the failure point.
    continueAfterFailure = false
  }

  /// Boot the app, wait for the RN root, snapshot, exit.
  /// Runs on whichever simulator the test bundle is launched against —
  /// the workflow runs this twice (iPhone + iPad).
  func test_appLaunches_andRendersRoot() throws {
    let app = XCUIApplication()
    app.launch()

    // Give the JS bundle + RN bridge a generous boot window. On a
    // cold simulator, RN's first launch can take 8-10s while it
    // compiles the bundle. A real device is faster.
    let bootDeadline: TimeInterval = 30

    // The App.tsx scaffold renders a Text node with content
    // "Nunba Companion". XCUITest finds it as a static text element.
    let title = app.staticTexts["Nunba Companion"]
    let appeared = title.waitForExistence(timeout: bootDeadline)
    XCTAssertTrue(
      appeared,
      "Expected 'Nunba Companion' title to render within \(bootDeadline)s — app may have crashed on boot or the JS bundle failed to load"
    )

    // Subtitle confirms the App.tsx component (not just an OS
    // placeholder) is the one rendering.
    XCTAssertTrue(
      app.staticTexts["iOS port — scaffold"].exists,
      "App.tsx subtitle missing — RN root may not have mounted correctly"
    )

    // Capture a screenshot so reviewers + workflow artifacts have
    // visual evidence the app rendered.
    let screenshot = XCUIScreen.main.screenshot()
    let attachment = XCTAttachment(screenshot: screenshot)
    attachment.name = "app-launched-\(deviceLabel())"
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  /// Launches twice in a row — guards against stale state, JS bundle
  /// caching issues, and "first run only" bugs in AppDelegate.
  func test_appLaunches_twice_withoutCrash() throws {
    let app = XCUIApplication()

    app.launch()
    XCTAssertTrue(
      app.staticTexts["Nunba Companion"].waitForExistence(timeout: 30),
      "First launch failed"
    )

    app.terminate()

    // Second cold launch — RN bundle should be cached, faster.
    app.launch()
    XCTAssertTrue(
      app.staticTexts["Nunba Companion"].waitForExistence(timeout: 15),
      "Second launch failed — possible state-leak or AppDelegate idempotency bug"
    )
  }

  // MARK: - Helpers

  private func deviceLabel() -> String {
    // Tag screenshot with device + OS so the attachment name shows
    // which simulator captured it (workflow uploads from both
    // iPhone + iPad).
    let device = UIDevice.current
    return "\(device.model)-iOS\(device.systemVersion)"
  }
}
