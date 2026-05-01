//
//  DeviceCapabilityModuleTests.swift
//  NunbaCompanionTests
//

import XCTest
import UIKit
@testable import NunbaCompanion

final class DeviceCapabilityModuleTests: XCTestCase {

  var module: DeviceCapabilityModule!

  override func setUp() {
    super.setUp()
    module = DeviceCapabilityModule()
    DeviceCapabilityModule.writeDeviceId(nil)
  }

  override func tearDown() {
    DeviceCapabilityModule.writeDeviceId(nil)
    module = nil
    super.tearDown()
  }

  // MARK: — getDeviceType

  func test_classifyDevice_returnsPhoneOrTabletOnIOS() {
    let cls = DeviceCapabilityModule.classifyDevice()
    XCTAssertTrue([.phone, .tablet, .tv].contains(cls),
                  "Got unexpected device class: \(cls)")
    // tvOS is not a target — the simulator we run on is always
    // .phone or .tablet.
    XCTAssertNotEqual(cls, .tv,
                      "tvOS is out of scope for this build")
  }

  func test_getDeviceType_resolvesString() {
    let exp = expectation(description: "promise resolves")
    module.getDeviceType({ result in
      XCTAssertTrue(result is String)
      let s = result as! String
      XCTAssertTrue(["phone", "tablet"].contains(s))
      exp.fulfill()
    }, rejecter: { _, _, _ in
      XCTFail("getDeviceType should never reject on iOS simulator")
    })
    wait(for: [exp], timeout: 1.0)
  }

  // MARK: — getCapabilities

  func test_getCapabilities_returnsExpectedKeys() {
    let caps = DeviceCapabilityModule.capabilitiesDictionary()
    let expectedKeys: Set<String> = [
      "hasCamera", "hasTouchscreen", "hasMicrophone", "hasGPS",
      "hasAccelerometer", "hasVibrator", "hasBluetooth",
      "hasTelephony", "hasNFC", "hasDpad",
      "screenWidthDp", "screenHeightDp", "screenDensity",
      "glEsVersion", "hasOpenGLES3", "hasMetal",
      "isTV", "brand", "model", "systemName", "systemVersion",
    ]
    let actualKeys = Set(caps.keys)
    XCTAssertTrue(expectedKeys.isSubset(of: actualKeys),
                  "Missing keys: \(expectedKeys.subtracting(actualKeys))")
  }

  func test_getCapabilities_brandIsApple() {
    let caps = DeviceCapabilityModule.capabilitiesDictionary()
    XCTAssertEqual(caps["brand"] as? String, "Apple")
  }

  func test_getCapabilities_isTVisFalse() {
    let caps = DeviceCapabilityModule.capabilitiesDictionary()
    XCTAssertEqual(caps["isTV"] as? Bool, false)
  }

  func test_getCapabilities_hasMetalIsTrue() {
    let caps = DeviceCapabilityModule.capabilitiesDictionary()
    XCTAssertEqual(caps["hasMetal"] as? Bool, true)
  }

  func test_getCapabilities_hasDpadIsFalse() {
    // No D-pad on iPhone/iPad. tvOS-only.
    let caps = DeviceCapabilityModule.capabilitiesDictionary()
    XCTAssertEqual(caps["hasDpad"] as? Bool, false)
  }

  func test_getCapabilities_hasTouchscreenIsTrue() {
    let caps = DeviceCapabilityModule.capabilitiesDictionary()
    XCTAssertEqual(caps["hasTouchscreen"] as? Bool, true)
  }

  func test_getCapabilities_hasTelephonyMatchesDeviceClass() {
    let caps = DeviceCapabilityModule.capabilitiesDictionary()
    let cls = DeviceCapabilityModule.classifyDevice()
    let hasTelephony = caps["hasTelephony"] as? Bool
    if cls == .phone {
      XCTAssertEqual(hasTelephony, true)
    } else {
      XCTAssertEqual(hasTelephony, false)
    }
  }

  func test_getCapabilities_screenDimensionsArePositive() {
    let caps = DeviceCapabilityModule.capabilitiesDictionary()
    XCTAssertGreaterThan(caps["screenWidthDp"] as? Double ?? 0, 0)
    XCTAssertGreaterThan(caps["screenHeightDp"] as? Double ?? 0, 0)
    XCTAssertGreaterThan(caps["screenDensity"] as? Double ?? 0, 0)
  }

  func test_getCapabilities_modelIdentifierLooksLikeAppleHardware() {
    let caps = DeviceCapabilityModule.capabilitiesDictionary()
    let model = caps["model"] as? String ?? ""
    // Examples: "iPhone15,2", "iPad14,1", "x86_64" (sim), "arm64" (sim)
    XCTAssertFalse(model.isEmpty)
  }

  // MARK: — getDeviceId (Keychain)

  func test_getDeviceId_generatesAndPersistsUUID() {
    let exp1 = expectation(description: "first call")
    var firstId: String?
    module.getDeviceId({ result in
      firstId = result as? String
      exp1.fulfill()
    }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp1], timeout: 1.0)

    XCTAssertNotNil(firstId)
    XCTAssertEqual(firstId?.count, 36, "Expected UUID format (36 chars w/ dashes)")
    XCTAssertNotNil(UUID(uuidString: firstId ?? ""))

    // Second call must return the SAME id — Keychain persistence
    // is the contract.
    let exp2 = expectation(description: "second call")
    var secondId: String?
    module.getDeviceId({ result in
      secondId = result as? String
      exp2.fulfill()
    }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp2], timeout: 1.0)

    XCTAssertEqual(firstId, secondId, "Device id must be stable across calls")
  }

  func test_writeDeviceId_thenRead_roundTrips() {
    XCTAssertTrue(DeviceCapabilityModule.writeDeviceId("custom-id-123"))
    XCTAssertEqual(DeviceCapabilityModule.readDeviceId(), "custom-id-123")
  }

  func test_writeDeviceId_nilClears() {
    XCTAssertTrue(DeviceCapabilityModule.writeDeviceId("temp"))
    XCTAssertTrue(DeviceCapabilityModule.writeDeviceId(nil))
    XCTAssertNil(DeviceCapabilityModule.readDeviceId())
  }

  // MARK: — getDeviceName

  func test_getDeviceName_returnsNonEmptyString() {
    let exp = expectation(description: "name resolves")
    module.getDeviceName({ result in
      let name = result as? String ?? ""
      XCTAssertFalse(name.isEmpty,
                     "UIDevice.current.name should always have a value")
      exp.fulfill()
    }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp], timeout: 1.0)
  }

  // MARK: — isAndroidTV (always false on iOS)

  func test_isAndroidTV_alwaysResolvesFalse() {
    let exp = expectation(description: "resolves")
    module.isAndroidTV({ result in
      XCTAssertEqual(result as? Bool, false)
      exp.fulfill()
    }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp], timeout: 1.0)
  }

  // MARK: — RN bridge contract

  func test_requiresMainQueueSetup_isFalse() {
    XCTAssertFalse(DeviceCapabilityModule.requiresMainQueueSetup())
  }
}
