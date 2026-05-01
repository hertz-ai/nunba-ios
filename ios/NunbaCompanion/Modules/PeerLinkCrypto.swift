//
//  PeerLinkCrypto.swift
//  NunbaCompanion
//
//  iOS sibling of Android peerlink/PeerLinkCrypto.kt.
//
//  CryptoKit-based primitives for the PeerLink protocol:
//
//    Ed25519        — node identity signing (one keypair per install)
//    X25519         — ECDH ephemeral keys for session establishment
//    HKDF-SHA256    — derive AES key from shared secret
//    AES-256-GCM    — symmetric encrypt/decrypt for the data channel
//
//  Identity keypair persistence: the Ed25519 secret key is stored in
//  Keychain (kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly) so it
//  survives app restarts but doesn't sync to other devices through
//  iCloud. The matching public key is derived on demand.
//
//  All public APIs are pure functions (modulo Keychain I/O for
//  identity persistence) so unit tests don't need a network.
//

import Foundation
import CryptoKit
import Security

enum PeerLinkCrypto {

  // MARK: — Identity (Ed25519, persisted in Keychain)

  static let identityKeychainAccount = "com.hertzai.nunbacompanion.peerlink.identity"

  /// Read the persisted Ed25519 signing key. Generates + persists a
  /// new one on first call. Returns nil only on Keychain error.
  static func loadOrCreateIdentity() -> Curve25519.Signing.PrivateKey? {
    if let raw = KeychainStore.readData(account: identityKeychainAccount),
       let key = try? Curve25519.Signing.PrivateKey(rawRepresentation: raw) {
      return key
    }
    let new = Curve25519.Signing.PrivateKey()
    // PeerLink identity is strictly per-install — never migrate to
    // a new device via iCloud Keychain. Use .deviceOnly.
    if KeychainStore.writeData(new.rawRepresentation,
                               account: identityKeychainAccount,
                               accessible: .deviceOnly) {
      return new
    }
    return nil
  }

  static func clearIdentity() {
    KeychainStore.delete(account: identityKeychainAccount)
  }

  // MARK: — Ed25519 sign / verify

  static func sign(_ data: Data, with key: Curve25519.Signing.PrivateKey) -> Data {
    return (try? key.signature(for: data)) ?? Data()
  }

  static func verify(
    _ signature: Data,
    of data: Data,
    by publicKey: Curve25519.Signing.PublicKey
  ) -> Bool {
    return publicKey.isValidSignature(signature, for: data)
  }

  /// Convenience: parse a 32-byte raw public-key into a verifier.
  static func publicKey(fromRaw raw: Data) -> Curve25519.Signing.PublicKey? {
    return try? Curve25519.Signing.PublicKey(rawRepresentation: raw)
  }

  // MARK: — X25519 ephemeral ECDH

  /// Generate an ephemeral X25519 keypair for one-shot ECDH.
  static func newEphemeral() -> Curve25519.KeyAgreement.PrivateKey {
    return Curve25519.KeyAgreement.PrivateKey()
  }

  /// Compute the shared secret + derive a 32-byte AES key via HKDF.
  /// info string matches the Kotlin side ("peerlink-session-v1").
  static func deriveSessionKey(
    privateKey: Curve25519.KeyAgreement.PrivateKey,
    peerPublicRaw: Data,
    salt: Data = Data()
  ) throws -> SymmetricKey {
    let peerPublic = try Curve25519.KeyAgreement.PublicKey(rawRepresentation: peerPublicRaw)
    let shared = try privateKey.sharedSecretFromKeyAgreement(with: peerPublic)
    let info = Data("peerlink-session-v1".utf8)
    let key = shared.hkdfDerivedSymmetricKey(
      using: SHA256.self,
      salt: salt,
      sharedInfo: info,
      outputByteCount: 32
    )
    return key
  }

  // MARK: — AES-256-GCM

  /// Encrypt with a 12-byte random nonce. Returns sealed combined
  /// representation: nonce || ciphertext || tag.
  static func encrypt(_ plaintext: Data, with key: SymmetricKey) throws -> Data {
    let sealed = try AES.GCM.seal(plaintext, using: key)
    guard let combined = sealed.combined else {
      throw NSError(domain: "PeerLinkCrypto", code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "AES seal produced no combined form"])
    }
    return combined
  }

  /// Decrypt a combined-form ciphertext (nonce || ct || tag).
  static func decrypt(_ combined: Data, with key: SymmetricKey) throws -> Data {
    let box = try AES.GCM.SealedBox(combined: combined)
    return try AES.GCM.open(box, using: key)
  }

  // MARK: — Hex helpers

  static func toHex(_ data: Data) -> String {
    return data.map { String(format: "%02x", $0) }.joined()
  }

  static func fromHex(_ string: String) -> Data? {
    let s = string.hasPrefix("0x") ? String(string.dropFirst(2)) : string
    guard s.count % 2 == 0 else { return nil }
    var out = Data(capacity: s.count / 2)
    var idx = s.startIndex
    while idx < s.endIndex {
      let next = s.index(idx, offsetBy: 2)
      guard let byte = UInt8(s[idx..<next], radix: 16) else { return nil }
      out.append(byte)
      idx = next
    }
    return out
  }
}
