//
//  OnboardingModule.swift
//  NunbaCompanion
//
//  iOS sibling of Android views/OnboardingModule.java.
//
//  The Android module has ~50 methods covering signup state, theme,
//  parental info, etc. — most of which are no-ops once the user has
//  logged in. This iOS port covers the THREE methods that the shared
//  JS (js/shared/services/) actually calls at runtime today:
//
//      getUser_id(callback)       — returns persisted user_id string
//      getAccessToken(callback)   — returns persisted Bearer token
//      publishToWamp(topic, payload) — fan-out to AutobahnConnectionManager
//
//  Storage choices:
//    user_id     → UserDefaults (non-sensitive, shared across launches)
//    accessToken → Keychain     (sensitive, survives reinstalls only if
//                                  iCloud Keychain is enabled)
//
//  Adding a new method = add it here AND mirror in OnboardingModule.m.
//  Adding stub returns for legacy methods is a no-op pattern — see
//  the bottom of this file.
//

import Foundation
import Security
import React

@objc(OnboardingModule)
final class OnboardingModule: NSObject {

  // ─── Storage keys ──────────────────────────────────────────────

  static let userIdDefaultsKey = "com.hertzai.nunbacompanion.userId"
  static let accessTokenKeychainAccount = "com.hertzai.nunbacompanion.accessToken"

  // ─── React Native bridge requirements ──────────────────────────

  @objc static func requiresMainQueueSetup() -> Bool { false }

  // MARK: — User ID

  @objc(getUser_id:)
  func getUser_id(_ callback: @escaping RCTResponseSenderBlock) {
    let userId = Self.persistedUserId() ?? ""
    callback([userId])
  }

  /// Test-friendly accessor used by XCTests and by the FleetCommandReceiver
  /// to scope incoming notifications. Public on the class so tests don't
  /// have to reach through the RN bridge.
  static func persistedUserId() -> String? {
    UserDefaults.standard.string(forKey: userIdDefaultsKey)
  }

  static func setPersistedUserId(_ id: String?) {
    if let id, !id.isEmpty {
      UserDefaults.standard.set(id, forKey: userIdDefaultsKey)
    } else {
      UserDefaults.standard.removeObject(forKey: userIdDefaultsKey)
    }
  }

  // MARK: — Access token (Keychain-backed)

  @objc(getAccessToken:)
  func getAccessToken(_ callback: @escaping RCTResponseSenderBlock) {
    let token = Self.readToken() ?? ""
    callback([token])
  }

  /// Public for tests + for FCM bootstrap to seed a token after login.
  static func readToken() -> String? {
    KeychainStore.readString(account: accessTokenKeychainAccount)
  }

  @discardableResult
  static func writeToken(_ token: String?) -> Bool {
    // Per-install: don't migrate the user's session token to a new
    // device via iCloud Keychain backup. They should re-authenticate
    // on the new device.
    KeychainStore.writeString(token, account: accessTokenKeychainAccount,
                              accessible: .deviceOnly)
  }

  /// Persist a Bearer token from JS (login response handler).
  /// Without this, getAccessToken() always returns "" and every
  /// authenticated REST call from socialApi.js gets a 401 (review H3).
  @objc(setAccessToken:resolver:rejecter:)
  func setAccessToken(
    _ token: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let ok = Self.writeToken(token.isEmpty ? nil : token)
    if ok {
      resolve(["stored": true])
    } else {
      reject("KEYCHAIN_WRITE_FAILED", "Could not persist access token", nil)
    }
  }

  /// Persist a user id from JS (login flow). Mirror of
  /// setAccessToken — covers the contract gap on the read side.
  @objc(setUser_id:resolver:rejecter:)
  func setUser_id(
    _ userId: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Self.setPersistedUserId(userId.isEmpty ? nil : userId)
    resolve(["stored": true])
  }

  // MARK: — WAMP publish bridge

  /// publishToWamp(topic, payload) — JS calls this from computePolicy.js
  /// to push a compute request through the long-lived WAMP session that
  /// AutobahnConnectionManager owns. The Swift WAMP client lives in
  /// AutobahnConnectionManager.swift; we just forward.
  /// Returns a promise resolving { published: true/false } so JS gets
  /// back-pressure on dropped publishes (H10).
  @objc(publishToWamp:payload:resolver:rejecter:)
  func publishToWamp(
    _ topic: String,
    payload: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard !topic.isEmpty else {
      // RCTLogWarn is a C macro — not Swift-callable. Use NSLog.
      NSLog("[OnboardingModule] publishToWamp: empty topic, ignored")
      resolve(["published": false, "reason": "empty topic"])
      return
    }
    let attempted = AutobahnConnectionManager.shared.publish(
      topic: topic, payload: payload
    )
    resolve(["published": attempted])
  }
}
