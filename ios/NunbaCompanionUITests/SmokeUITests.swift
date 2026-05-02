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
  /// Combines a polled SpringBoard alert dismiss with the
  /// "Nunba Companion" text wait — a single waitForExistence isn't
  /// reliable because system alerts (Speech Recognition, etc.) can
  /// pop up mid-launch and stop XCUI from recognising the text.
  func test_appLaunches_andRendersRoot() throws {
    let app = XCUIApplication()
    app.launch()

    let appeared = waitForRootText(app, timeout: 60)

    let screenshot = XCUIScreen.main.screenshot()
    let attachment = XCTAttachment(screenshot: screenshot)
    attachment.name = appeared
      ? "app-launched-\(deviceLabel())"
      : "app-FAILED-\(deviceLabel())"
    attachment.lifetime = .keepAlways
    add(attachment)

    if !appeared {
      let hierarchy = app.debugDescription
      let hierAttachment = XCTAttachment(string: hierarchy)
      hierAttachment.name = "ui-hierarchy-on-failure"
      hierAttachment.lifetime = .keepAlways
      add(hierAttachment)

      let allStaticTexts = app.staticTexts.allElementsBoundByIndex.map { $0.label }
      let textsAttachment = XCTAttachment(string: allStaticTexts.joined(separator: "\n"))
      textsAttachment.name = "all-static-texts-on-failure"
      textsAttachment.lifetime = .keepAlways
      add(textsAttachment)

      print("== ALL STATIC TEXTS ==")
      print(allStaticTexts.joined(separator: "\n"))
      print("== APP HIERARCHY ==")
      print(hierarchy)
    }

    XCTAssertTrue(
      appeared,
      "Expected 'Nunba Companion' text to render within 60s. " +
      "See attached screenshot + UI hierarchy."
    )
  }

  /// Cold-launch twice. Catches AppDelegate idempotency bugs +
  /// state-leak issues + JS bundle caching errors.
  func test_appLaunches_twice_withoutCrash() throws {
    let app = XCUIApplication()

    app.launch()
    XCTAssertTrue(waitForRootText(app, timeout: 60), "First launch failed")

    app.terminate()

    // Second cold launch — RN bundle should be cached, faster.
    app.launch()
    XCTAssertTrue(waitForRootText(app, timeout: 45),
                  "Second launch failed — possible state-leak or AppDelegate idempotency bug")
  }

  /// App stays running for 5s after the initial render. Catches
  /// crashes that fire AFTER first paint (e.g. AutobahnConnectionManager
  /// connect() throwing on the WAMP queue, FleetCommandReceiver
  /// crash on remote-notification registration error).
  func test_appStaysAlive_fiveSecondsAfterRender() throws {
    let app = XCUIApplication()
    app.launch()

    XCTAssertTrue(waitForRootText(app, timeout: 60), "Initial render failed")

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
    XCTAssertTrue(waitForRootText(app, timeout: 60), "Initial render failed")

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

  /// Poll for "Nunba Companion" StaticText while also dismissing any
  /// SpringBoard system alerts that pop up mid-launch (Speech
  /// Recognition, Microphone, Notifications). UIInterruptionMonitor
  /// is unreliable for alerts that appear DURING a wait — they
  /// require a fresh app interaction to fire, which polling provides.
  ///
  /// Returns true as soon as the text is visible OR the polling
  /// succeeds in dismissing alerts and the text appears next tick.
  private func waitForRootText(_ app: XCUIApplication, timeout: TimeInterval) -> Bool {
    let title = app.staticTexts["Nunba Companion"].firstMatch
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let allowLabels = ["Allow", "OK", "Allow While Using App", "Allow Once"]
    let denyLabels = ["Don't Allow"]

    let deadline = Date(timeIntervalSinceNow: timeout)
    while Date() < deadline {
      // Fast path: text is in the a11y tree — done. We don't gate
      // on isHittable because it returns false when an alert is on
      // top, which is exactly the situation we're trying to recover
      // from in the dismiss loop below.
      if title.exists {
        return true
      }

      // Dismiss any SpringBoard alert by tapping the most permissive
      // button we can find. Loop through likely labels.
      for label in allowLabels + denyLabels {
        let btn = springboard.buttons[label]
        if btn.exists {
          btn.tap()
          break
        }
      }

      Thread.sleep(forTimeInterval: 0.5)
    }
    // One last check after timeout.
    return title.exists
  }
}
