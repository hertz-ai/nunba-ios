//
//  KeychainStore.swift
//  NunbaCompanion
//
//  Single keychain helper used by every module that persists a
//  small piece of secret/identity data (auth token, device UUID,
//  PeerLink identity key). Replaces the three near-identical
//  read/write helpers that were scattered across modules — each
//  with subtly different accessibility classes (review H2).
//
//  Design choices:
//
//    • Per-install semantics by default: kSecAttrAccessibleAfter
//      FirstUnlockThisDeviceOnly. iCloud Keychain WILL NOT sync
//      these. Matches Android's SharedPreferences semantics —
//      device IDs and identity keys are tied to ONE physical
//      install, not to the user's Apple ID.
//
//    • Each module uses its own `account` string so failures
//      are isolated. `service` is shared across the app.
//
//    • All operations are blocking but fast (single keychain
//      query). They run on whatever thread the caller is on.
//
//  Threading: Keychain is thread-safe per Apple docs.
//

import Foundation
import Security

enum KeychainStore {

  static let service = "com.hertzai.nunbacompanion"

  /// iOS keychain accessibility classes we care about.
  /// `.deviceOnly` is the right choice for almost every per-install
  /// secret (device IDs, identity keys, refresh tokens) since these
  /// shouldn't migrate to a user's other Apple devices via iCloud
  /// Keychain restore.
  enum Accessibility {
    case deviceOnly      // afterFirstUnlock, NEVER syncs
    case afterFirstUnlock // afterFirstUnlock (iCloud-syncable)

    var attribute: CFString {
      switch self {
      case .deviceOnly:
        return kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
      case .afterFirstUnlock:
        return kSecAttrAccessibleAfterFirstUnlock
      }
    }
  }

  // MARK: — Read / write / delete

  /// Read raw bytes for an account. Returns nil on miss or error.
  static func readData(account: String) -> Data? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    return status == errSecSuccess ? (item as? Data) : nil
  }

  /// Read a UTF-8 string. Convenience wrapper.
  static func readString(account: String) -> String? {
    guard let data = readData(account: account) else { return nil }
    return String(data: data, encoding: .utf8)
  }

  /// Write raw bytes for an account. Idempotent: deletes any
  /// existing entry before adding (avoids duplicate-item errors
  /// from SecItemAdd).
  ///
  /// Returns true on success.
  @discardableResult
  static func writeData(
    _ data: Data?,
    account: String,
    accessible: Accessibility = .deviceOnly
  ) -> Bool {
    let baseQuery: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
    SecItemDelete(baseQuery as CFDictionary)

    guard let data, !data.isEmpty else { return true }  // delete-only

    var addQuery = baseQuery
    addQuery[kSecValueData as String] = data
    addQuery[kSecAttrAccessible as String] = accessible.attribute
    let status = SecItemAdd(addQuery as CFDictionary, nil)
    if status != errSecSuccess {
      // -34018 = errSecMissingEntitlement (iOS Simulator without
      // keychain-access-groups entitlement on macos-15+ rejects
      // writes that pin accessibility class). Logging the OSStatus
      // makes test failures diagnosable without re-running.
      NSLog("[KeychainStore] SecItemAdd failed account=\(account) status=\(status)")
    }
    return status == errSecSuccess
  }

  /// Write a UTF-8 string.
  @discardableResult
  static func writeString(
    _ value: String?,
    account: String,
    accessible: Accessibility = .deviceOnly
  ) -> Bool {
    let data = value?.data(using: .utf8)
    return writeData(data, account: account, accessible: accessible)
  }

  /// Convenience: nil-safe delete.
  @discardableResult
  static func delete(account: String) -> Bool {
    return writeData(nil, account: account)
  }
}
