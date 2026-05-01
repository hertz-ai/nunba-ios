//
//  PeerLinkCryptoTests.swift
//  NunbaCompanionTests
//

import XCTest
import CryptoKit
@testable import NunbaCompanion

final class PeerLinkCryptoTests: XCTestCase {

  override func setUp() {
    super.setUp()
    PeerLinkCrypto.clearIdentity()
  }

  override func tearDown() {
    PeerLinkCrypto.clearIdentity()
    super.tearDown()
  }

  // MARK: — Identity persistence

  func test_loadOrCreateIdentity_returnsKeyOnFirstCall() {
    let key = PeerLinkCrypto.loadOrCreateIdentity()
    XCTAssertNotNil(key)
    XCTAssertEqual(key?.rawRepresentation.count, 32)
  }

  func test_loadOrCreateIdentity_persistsAcrossCalls() {
    let k1 = PeerLinkCrypto.loadOrCreateIdentity()
    let k2 = PeerLinkCrypto.loadOrCreateIdentity()
    XCTAssertEqual(k1?.rawRepresentation, k2?.rawRepresentation)
  }

  func test_clearIdentity_thenLoad_returnsNewKey() {
    let k1 = PeerLinkCrypto.loadOrCreateIdentity()
    PeerLinkCrypto.clearIdentity()
    let k2 = PeerLinkCrypto.loadOrCreateIdentity()
    XCTAssertNotEqual(k1?.rawRepresentation, k2?.rawRepresentation)
  }

  // MARK: — Sign / verify

  func test_signAndVerify_roundTrip() {
    let key = PeerLinkCrypto.loadOrCreateIdentity()!
    let msg = Data("hello peerlink".utf8)
    let sig = PeerLinkCrypto.sign(msg, with: key)
    XCTAssertFalse(sig.isEmpty)
    XCTAssertTrue(PeerLinkCrypto.verify(sig, of: msg, by: key.publicKey))
  }

  func test_verify_rejectsTamperedMessage() {
    let key = PeerLinkCrypto.loadOrCreateIdentity()!
    let msg = Data("original".utf8)
    let sig = PeerLinkCrypto.sign(msg, with: key)
    let tampered = Data("modified".utf8)
    XCTAssertFalse(PeerLinkCrypto.verify(sig, of: tampered, by: key.publicKey))
  }

  func test_verify_rejectsWrongSignerKey() {
    let key1 = PeerLinkCrypto.loadOrCreateIdentity()!
    let key2 = Curve25519.Signing.PrivateKey()
    let msg = Data("hi".utf8)
    let sig = PeerLinkCrypto.sign(msg, with: key1)
    XCTAssertFalse(PeerLinkCrypto.verify(sig, of: msg, by: key2.publicKey))
  }

  func test_publicKey_fromRaw_roundTrips() {
    let key = Curve25519.Signing.PrivateKey()
    let raw = key.publicKey.rawRepresentation
    let parsed = PeerLinkCrypto.publicKey(fromRaw: raw)
    XCTAssertNotNil(parsed)
    XCTAssertEqual(parsed?.rawRepresentation, raw)
  }

  func test_publicKey_fromInvalidRaw_returnsNil() {
    XCTAssertNil(PeerLinkCrypto.publicKey(fromRaw: Data([0, 1, 2])))
  }

  // MARK: — X25519 ECDH + HKDF

  func test_deriveSessionKey_bothPartiesAgree() throws {
    // Two parties exchange ephemerals → derive same shared key.
    let alice = PeerLinkCrypto.newEphemeral()
    let bob = PeerLinkCrypto.newEphemeral()

    let aliceKey = try PeerLinkCrypto.deriveSessionKey(
      privateKey: alice,
      peerPublicRaw: bob.publicKey.rawRepresentation
    )
    let bobKey = try PeerLinkCrypto.deriveSessionKey(
      privateKey: bob,
      peerPublicRaw: alice.publicKey.rawRepresentation
    )
    XCTAssertEqual(
      aliceKey.withUnsafeBytes { Data($0) },
      bobKey.withUnsafeBytes { Data($0) }
    )
  }

  func test_deriveSessionKey_invalidPeerKeyThrows() {
    let alice = PeerLinkCrypto.newEphemeral()
    XCTAssertThrowsError(try PeerLinkCrypto.deriveSessionKey(
      privateKey: alice,
      peerPublicRaw: Data([0, 1, 2])  // not 32 bytes
    ))
  }

  func test_deriveSessionKey_yields32ByteKey() throws {
    let a = PeerLinkCrypto.newEphemeral()
    let b = PeerLinkCrypto.newEphemeral()
    let key = try PeerLinkCrypto.deriveSessionKey(
      privateKey: a,
      peerPublicRaw: b.publicKey.rawRepresentation
    )
    let bytes = key.withUnsafeBytes { Data($0) }
    XCTAssertEqual(bytes.count, 32)
  }

  // MARK: — AES-GCM

  func test_encryptDecrypt_roundTrip() throws {
    let key = SymmetricKey(size: .bits256)
    let plaintext = Data("super secret message 🤫".utf8)
    let sealed = try PeerLinkCrypto.encrypt(plaintext, with: key)
    let opened = try PeerLinkCrypto.decrypt(sealed, with: key)
    XCTAssertEqual(opened, plaintext)
  }

  func test_decrypt_withWrongKeyFails() throws {
    let k1 = SymmetricKey(size: .bits256)
    let k2 = SymmetricKey(size: .bits256)
    let sealed = try PeerLinkCrypto.encrypt(Data("hi".utf8), with: k1)
    XCTAssertThrowsError(try PeerLinkCrypto.decrypt(sealed, with: k2))
  }

  func test_decrypt_withTamperedCiphertextFails() throws {
    let key = SymmetricKey(size: .bits256)
    var sealed = try PeerLinkCrypto.encrypt(Data("hi".utf8), with: key)
    sealed[sealed.count - 1] ^= 0xFF  // flip last byte (the auth tag)
    XCTAssertThrowsError(try PeerLinkCrypto.decrypt(sealed, with: key))
  }

  func test_encrypt_emptyPlaintextRoundTrips() throws {
    let key = SymmetricKey(size: .bits256)
    let sealed = try PeerLinkCrypto.encrypt(Data(), with: key)
    XCTAssertEqual(try PeerLinkCrypto.decrypt(sealed, with: key), Data())
  }

  // MARK: — Hex helpers

  func test_toHex_emptyData() {
    XCTAssertEqual(PeerLinkCrypto.toHex(Data()), "")
  }

  func test_toHex_knownBytes() {
    let data = Data([0x00, 0xff, 0xab, 0x12])
    XCTAssertEqual(PeerLinkCrypto.toHex(data), "00ffab12")
  }

  func test_fromHex_roundTripsKnownBytes() {
    let hex = "deadbeef"
    let data = PeerLinkCrypto.fromHex(hex)
    XCTAssertEqual(data, Data([0xde, 0xad, 0xbe, 0xef]))
  }

  func test_fromHex_acceptsPrefix0x() {
    XCTAssertEqual(PeerLinkCrypto.fromHex("0xab"), Data([0xab]))
  }

  func test_fromHex_oddLengthReturnsNil() {
    XCTAssertNil(PeerLinkCrypto.fromHex("abc"))
  }

  func test_fromHex_invalidCharsReturnsNil() {
    XCTAssertNil(PeerLinkCrypto.fromHex("zzzz"))
  }

  func test_hex_roundTrip() {
    let data = Data((0..<32).map { _ in UInt8.random(in: 0...255) })
    let hex = PeerLinkCrypto.toHex(data)
    XCTAssertEqual(PeerLinkCrypto.fromHex(hex), data)
  }
}
