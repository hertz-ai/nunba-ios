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
  static let keychainService = "com.hertzai.nunbacompanion"

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
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: keychainService,
      kSecAttrAccount as String: accessTokenKeychainAccount,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    guard status == errSecSuccess, let data = item as? Data,
          let token = String(data: data, encoding: .utf8) else {
      return nil
    }
    return token
  }

  @discardableResult
  static func writeToken(_ token: String?) -> Bool {
    let baseQuery: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: keychainService,
      kSecAttrAccount as String: accessTokenKeychainAccount,
    ]

    // Always delete first to avoid duplicate-item errors. SecItemUpdate
    // would also work but the read-after-update path is messier.
    SecItemDelete(baseQuery as CFDictionary)

    guard let token, !token.isEmpty else {
      return true  // delete-only path
    }

    var addQuery = baseQuery
    addQuery[kSecValueData as String] = token.data(using: .utf8)
    addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
    let status = SecItemAdd(addQuery as CFDictionary, nil)
    return status == errSecSuccess
  }

  // MARK: — WAMP publish bridge

  /// publishToWamp(topic, payload) — JS calls this from computePolicy.js
  /// to push a compute request through the long-lived WAMP session that
  /// AutobahnConnectionManager owns. The Swift WAMP client lives in
  /// AutobahnConnectionManager.swift; we just forward.
  @objc(publishToWamp:payload:)
  func publishToWamp(_ topic: String, payload: String) {
    guard !topic.isEmpty else {
      RCTLogWarn("OnboardingModule.publishToWamp: empty topic, ignored")
      return
    }
    AutobahnConnectionManager.shared.publish(topic: topic, payload: payload)
  }
}
