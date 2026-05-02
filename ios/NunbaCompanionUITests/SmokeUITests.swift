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

    // Auto-dismiss every system permission alert (Speech
    // Recognition, Microphone, Notifications, etc) so they don't
    // hover above the JS-rendered "Nunba Companion" text and
    // block XCUI from finding it. Tap "Allow" if present, else
    // "OK", else the first button — gets us past the alert
    // without locking grants.
    addUIInterruptionMonitor(withDescription: "System permission alerts") { alert in
      let buttons = ["Allow", "OK", "Don't Allow", "Allow While Using App", "Allow Once"]
      for label in buttons {
        let btn = alert.buttons[label]
        if btn.exists {
          btn.tap()
          return true
        }
      }
      // Fallback: tap the first available button.
      if alert.buttons.count > 0 {
        alert.buttons.element(boundBy: 0).tap()
        return true
      }
      return false
    }
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

    // Force UIInterruptionMonitor evaluation — it only fires on
    // app interaction, not on plain query reads. Tapping the
    // (1, 1) coordinate is innocuous: hits a SafeAreaView edge
    // that's not interactive but counts as an "interaction" for
    // purposes of dispatching pending interruption handlers.
    app.coordinate(withNormalizedOffset: CGVector(dx: 0.01, dy: 0.01)).tap()

    // Generous boot window. On a cold simulator, RN's first launch
    // can take 8-10s to compile the JS bundle. Real device is faster.
    let bootDeadline: TimeInterval = 45

    let title = app.staticTexts["Nunba Companion"].firstMatch
    let appeared = title.waitForExistence(timeout: bootDeadline)

    // Always attach a screenshot — including on failure, so we can
    // see what the app actually showed (red error screen, blank,
    // SignUp screen with different copy, etc).
    let screenshot = XCUIScreen.main.screenshot()
    let attachment = XCTAttachment(screenshot: screenshot)
    attachment.name = appeared
      ? "app-launched-\(deviceLabel())"
      : "app-FAILED-\(deviceLabel())"
    attachment.lifetime = .keepAlways
    add(attachment)

    if !appeared {
      // Dump the entire accessibility hierarchy so we can see what
      // text IS present. RN exposes most rendered text as
      // staticTexts[] on iOS. If the app launched and rendered at
      // all, this dump will show it.
      let hierarchy = app.debugDescription
      let hierAttachment = XCTAttachment(string: hierarchy)
      hierAttachment.name = "ui-hierarchy-on-failure"
      hierAttachment.lifetime = .keepAlways
      add(hierAttachment)

      // Also dump every staticText label for quick scan in CI logs.
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
      "Expected 'Nunba Companion' text to render within \(bootDeadline)s — " +
      "app may have crashed on boot, the JS bundle failed to load, or " +
      "the auth-loading screen never rendered. See attached screenshot + UI hierarchy."
    )
  }

  /// Cold-launch twice. Catches AppDelegate idempotency bugs +
  /// state-leak issues + JS bundle caching errors.
  func test_appLaunches_twice_withoutCrash() throws {
    let app = XCUIApplication()

    app.launch()
    triggerInterruptionMonitor(app)
    XCTAssertTrue(
      app.staticTexts["Nunba Companion"].firstMatch.waitForExistence(timeout: 45),
      "First launch failed"
    )

    app.terminate()

    // Second cold launch — RN bundle should be cached, faster.
    app.launch()
    triggerInterruptionMonitor(app)
    XCTAssertTrue(
      app.staticTexts["Nunba Companion"].firstMatch.waitForExistence(timeout: 30),
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
    triggerInterruptionMonitor(app)

    XCTAssertTrue(
      app.staticTexts["Nunba Companion"].firstMatch.waitForExistence(timeout: 45),
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
    triggerInterruptionMonitor(app)
    XCTAssertTrue(
      app.staticTexts["Nunba Companion"].firstMatch.waitForExistence(timeout: 45),
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

  /// UIInterruptionMonitor only fires when the test code interacts
  /// with the app — not on plain query reads. A no-op tap at the
  /// near-corner of the screen flushes any pending alerts that
  /// queued up between launch and the first real assertion.
  private func triggerInterruptionMonitor(_ app: XCUIApplication) {
    app.coordinate(withNormalizedOffset: CGVector(dx: 0.01, dy: 0.01)).tap()
  }
}
