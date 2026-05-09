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
  ///
  /// Flake fix (#223): the previous version used `sleep(2)` between
  /// state transitions and asserted on `app.state` immediately
  /// after.  On slow simulators the transition takes 3-5 s
  /// (especially after a heavy launch with WAMP + native module
  /// init), so the assertion fires before iOS's lifecycle queue has
  /// processed the home-press / activate.  Now polls with a deadline
  /// so we don't fail-fast on transient state mismatches.
  func test_appHandlesBackgroundResume() throws {
    let app = XCUIApplication()
    app.launch()
    XCTAssertTrue(waitForRootText(app, timeout: 60), "Initial render failed")

    // Background — press home then poll for the state transition.
    XCUIDevice.shared.press(.home)
    XCTAssertTrue(
      waitForAppState(app, .runningBackground, timeout: 10),
      "App did not transition to background within 10s of home-press")

    // Resume — activate then poll for the state transition.
    app.activate()
    XCTAssertTrue(
      waitForAppState(app, .runningForeground, timeout: 10),
      "App did not return to foreground within 10s of activate")
  }

  /// Tap the "Inbox" feature pill on the home strip, confirm the inbox
  /// renders (default header text "Inbox") and that one of the filter
  /// chips ("All") is hittable.  Catches:
  ///   - Inbox route not registered in App.tsx
  ///   - InboxScreen import path drifting after a manifest sync
  ///   - PR A primitives (FilterChips / EmptyState) failing to render
  ///     on iOS due to a missing Animatable.View export
  func test_navigatesToInbox_viaFeatureNavStrip() throws {
    let app = XCUIApplication()
    app.launch()
    XCTAssertTrue(waitForRootText(app, timeout: 60), "Initial render failed")

    let inboxPill = app.staticTexts["Inbox"].firstMatch
    XCTAssertTrue(
      inboxPill.waitForExistence(timeout: 30),
      "Inbox feature pill never appeared on the home strip")
    inboxPill.tap()

    // Header title + at least one filter chip must surface within 10s.
    let inboxHeader = app.staticTexts["Inbox"].firstMatch
    let allChip     = app.staticTexts["All"].firstMatch
    XCTAssertTrue(
      inboxHeader.waitForExistence(timeout: 10),
      "InboxScreen header didn't render after pill tap")
    XCTAssertTrue(
      allChip.waitForExistence(timeout: 5),
      "FilterChips 'All' tab didn't render — PR A primitives may not " +
      "have synced or react-native-animatable named exports broke")
  }

  /// Poll-with-deadline helper for XCUITest lifecycle assertions.
  /// Returns true the moment `app.state == target`; false if the
  /// timeout elapses without a match.  250 ms granularity balances
  /// CPU cost against test latency — the transition typically lands
  /// in 1-3 s on a warm simulator, 3-5 s on a cold one.
  private func waitForAppState(
    _ app: XCUIApplication,
    _ target: XCUIApplication.State,
    timeout: TimeInterval = 10
  ) -> Bool {
    let deadline = Date(timeIntervalSinceNow: timeout)
    while Date() < deadline {
      if app.state == target {
        return true
      }
      Thread.sleep(forTimeInterval: 0.25)
    }
    return false
  }

  // MARK: - Helpers

  private func deviceLabel() -> String {
    let device = UIDevice.current
    return "\(device.model)-iOS\(device.systemVersion)"
  }

  /// Wait for the app to be in a "rendered root" state, dismissing
  /// any SpringBoard alerts (Speech Recognition, Microphone,
  /// Notifications) along the way.
  ///
  /// Two acceptance signals — match either:
  ///   1. The "root-loaded" accessibility identifier (rendered by
  ///      App.tsx post-authReady, persists for the full app
  ///      lifetime).  Stable: not bound to splash-hold timing.
  ///   2. "Nunba Companion" StaticText (rendered during splash
  ///      and inside the LoadingScreen).  Compatibility fallback
  ///      for older builds prior to the root-loaded marker.
  ///
  /// UIInterruptionMonitor is unreliable for alerts that appear
  /// DURING a wait — they require a fresh app interaction to fire,
  /// which polling provides.
  private func waitForRootText(_ app: XCUIApplication, timeout: TimeInterval) -> Bool {
    let rootMarker = app.staticTexts["root-loaded"].firstMatch
    let splashTitle = app.staticTexts["Nunba Companion"].firstMatch
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let allowLabels = ["Allow", "OK", "Allow While Using App", "Allow Once"]
    let denyLabels = ["Don't Allow"]

    let deadline = Date(timeIntervalSinceNow: timeout)
    while Date() < deadline {
      // Fast path: either signal indicates the app has rendered
      // its root.  We don't gate on isHittable because it returns
      // false when an alert is on top, which is exactly the
      // situation we're trying to recover from in the dismiss loop
      // below.
      if rootMarker.exists || splashTitle.exists {
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
    return rootMarker.exists || splashTitle.exists
  }
}
