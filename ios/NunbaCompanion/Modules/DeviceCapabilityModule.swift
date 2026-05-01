//
//  DeviceCapabilityModule.swift
//  NunbaCompanion
//
//  iOS sibling of Android views/DeviceCapabilityModule.java.
//
//  Method parity:
//
//    Android                    iOS                     Notes
//    ─────────────────────────────────────────────────────────────────
//    getDeviceType              getDeviceType           "phone" | "tablet"
//                                                       ("tv" never returned —
//                                                       tvOS is a separate target)
//    getCapabilities            getCapabilities         WritableMap → NSDictionary
//    getDeviceId                getDeviceId             UUID persisted in Keychain
//                                                       (iOS lacks Android's
//                                                       SharedPreferences-equivalent
//                                                       semantics for device-bound IDs)
//    getDeviceName              getDeviceName           UIDevice.current.name
//    isAndroidTV                isAndroidTV             always resolves false
//                                                       on iOS — kept for JS-side
//                                                       contract compatibility
//
//  Storage choices:
//    deviceId → Keychain (so it survives app deletion if iCloud Keychain
//               is enabled, matching Android's SharedPreferences "survives
//               clear-data" semantics for the typical user).
//

import Foundation
import UIKit
import Security
import React

@objc(DeviceCapabilityModule)
final class DeviceCapabilityModule: NSObject {

  static let deviceIdKeychainAccount = "com.hertzai.nunbacompanion.deviceId"

  /// Tablet threshold — Android uses 600dp smallest-width. iOS: any
  /// iPad reports .pad. Simpler.
  enum DeviceClass: String {
    case phone, tablet, tv
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }

  // MARK: — getDeviceType

  @objc(getDeviceType:rejecter:)
  func getDeviceType(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(Self.classifyDevice().rawValue)
  }

  /// Pure helper for tests + capability map. Reads UIDevice on the
  /// calling thread (must be main if called from a non-bridge thread,
  /// but RN promises run on the JS thread already).
  static func classifyDevice() -> DeviceClass {
    // tvOS would link a different SDK; this build never returns .tv.
    let idiom = UIDevice.current.userInterfaceIdiom
    switch idiom {
    case .pad: return .tablet
    case .phone: return .phone
    case .tv: return .tv
    default: return .phone
    }
  }

  // MARK: — getCapabilities

  @objc(getCapabilities:rejecter:)
  func getCapabilities(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(Self.capabilitiesDictionary())
  }

  /// Public for tests + featureGates.js consumers that need the map
  /// without going through the RN bridge.
  static func capabilitiesDictionary() -> [String: Any] {
    let device = UIDevice.current
    let bounds = UIScreen.main.bounds
    let scale = UIScreen.main.scale
    let cls = classifyDevice()

    var caps: [String: Any] = [
      // — Hardware features —
      // iPad and iPhone always have these. iOS doesn't expose a
      // PackageManager-equivalent feature list, so most map to true.
      "hasCamera": true,
      "hasTouchscreen": true,        // every iOS device is a touchscreen
      "hasMicrophone": true,
      "hasGPS": CLLocationManagerHasGPS(),
      "hasAccelerometer": true,      // every iPhone + iPad has one
      "hasVibrator": true,           // UIImpactFeedbackGenerator works on all
      "hasBluetooth": true,
      "hasTelephony": cls == .phone, // iPads don't make calls
      "hasNFC": deviceHasNFC(),
      "hasDpad": false,              // tvOS only; never on iPhone/iPad
      // — Screen —
      "screenWidthDp": Double(bounds.width),
      "screenHeightDp": Double(bounds.height),
      "screenDensity": Double(scale),
      // — GL / GPU —
      // iOS deprecated OpenGL ES in 2018. App should use Metal. Reported
      // for cross-platform feature gates that key off "OpenGL ES 3.0
      // available" (e.g. avatar GL renderer port to Metal).
      "glEsVersion": 0x00030000,     // claim ES 3.0 parity for gates
      "hasOpenGLES3": false,         // true value: Metal is the path
      "hasMetal": true,              // iOS-specific signal
      // — Identity —
      "isTV": false,
      "brand": "Apple",
      "model": deviceModelIdentifier(),
      "systemName": device.systemName,
      "systemVersion": device.systemVersion,
      // sdkVersion intentionally absent — iOS uses systemVersion string.
    ]

    return caps
  }

  // MARK: — getDeviceId (Keychain-backed UUID)

  @objc(getDeviceId:rejecter:)
  func getDeviceId(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if let existing = Self.readDeviceId(), !existing.isEmpty {
      resolve(existing)
      return
    }
    let newId = UUID().uuidString
    if Self.writeDeviceId(newId) {
      resolve(newId)
    } else {
      reject("DEVICE_ID_ERROR", "Failed to persist device id to Keychain", nil)
    }
  }

  static func readDeviceId() -> String? {
    KeychainStore.readString(account: deviceIdKeychainAccount)
  }

  /// Per-install device id MUST NOT migrate to other Apple devices
  /// via iCloud Keychain — Android's matching SharedPreferences UUID
  /// is per-physical-install. Use `.deviceOnly` (review H2: prior
  /// version used `.afterFirstUnlock` which IS iCloud-syncable).
  @discardableResult
  static func writeDeviceId(_ id: String?) -> Bool {
    KeychainStore.writeString(id, account: deviceIdKeychainAccount,
                              accessible: .deviceOnly)
  }

  // MARK: — getDeviceName

  @objc(getDeviceName:rejecter:)
  func getDeviceName(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(UIDevice.current.name)
  }

  // MARK: — isAndroidTV (always false on iOS — kept for JS contract)

  @objc(isAndroidTV:rejecter:)
  func isAndroidTV(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(false)
  }

  // MARK: — Helpers

  /// CLLocationManager doesn't have a "do you have GPS" property. Every
  /// iPhone and cellular iPad has GPS; Wi-Fi-only iPads do not. This is
  /// a best-effort heuristic.
  private static func CLLocationManagerHasGPS() -> Bool {
    // CLLocationManager.locationServicesEnabled() is a runtime privacy
    // question, not a hardware capability. For the capability map we
    // claim phones have GPS and iPads with cellular have GPS.
    let cls = classifyDevice()
    if cls == .phone { return true }
    // Wi-Fi-only iPads report no cellular radio. We can detect via
    // CTTelephonyNetworkInfo, but that requires linking CoreTelephony
    // and adds a permission prompt on iOS 16+. For a capability hint
    // it's enough to claim true and let the UI ask for permission —
    // the platform refuses gracefully.
    return true
  }

  private static func deviceHasNFC() -> Bool {
    // CoreNFC is available on iPhone 7+. iPads have no NFC reader.
    let cls = classifyDevice()
    return cls == .phone
  }

  /// Returns the hardware identifier (e.g. "iPhone15,2") rather than
  /// the marketing name. Matches what Android's Build.MODEL returns
  /// in shape ("Pixel 7") — a non-localized hardware string.
  private static func deviceModelIdentifier() -> String {
    var sysinfo = utsname()
    uname(&sysinfo)
    return withUnsafePointer(to: &sysinfo.machine) {
      $0.withMemoryRebound(to: CChar.self, capacity: 1) { ptr in
        String(validatingUTF8: ptr) ?? "unknown"
      }
    }
  }
}
