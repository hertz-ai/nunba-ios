//
//  PeerLinkDiscoveryTests.swift
//  NunbaCompanionTests
//
//  Wire-format conformance tests for the iOS PeerLinkDiscovery class.
//  Locks the implementation to HARTOS/docs/architecture/peer_discovery_spec.md
//  so the next refactor can't silently drift from HARTOS Python +
//  Android Kotlin (which is what produced the original parity bug).
//

import XCTest
@testable import NunbaCompanion

@available(iOS 13.0, *)
final class PeerLinkDiscoveryTests: XCTestCase {

    // MARK: — Magic prefix shape (the value that has to match HARTOS verbatim)

    func test_magicPrefix_isExactlyHEVOLVE_DISCO_V1() {
        // Use reflection to read the private constant.  If we ever bump the
        // version (V2), update both Android + HARTOS in the same PR and
        // change this assertion — that's the deliberate fail-mode.
        let expected = "HEVOLVE_DISCO_V1".data(using: .utf8)!
        XCTAssertEqual(expected.count, 16,
                       "Magic prefix must be exactly 16 bytes per spec")

        // Encode a probe with our discovery instance and check the bytes.
        let disco = PeerLinkDiscovery(ownNodeId: "test-node-aaaa")
        let mirror = Mirror(reflecting: type(of: disco))
        _ = mirror // touched so the unused-binding warning silences

        // We can't easily access the private static constant from here,
        // so we drive the assertion through a round-trip: parseBeacon
        // accepts a manually-crafted packet with the right prefix and
        // rejects one with the wrong prefix.
        let goodPacket = expected + #"{"type":"hevolve-discovery","node_id":"abc","platform":"linux"}"#.data(using: .utf8)!
        let badPacket  = "DIFFERENT_MAGIC_!!".data(using: .utf8)! + #"{"type":"hevolve-discovery","node_id":"abc"}"#.data(using: .utf8)!

        // The discovery class fires onPeerDiscovered only on accepted beacons.
        let goodExpectation = expectation(description: "good packet fires callback")
        let badExpectation = expectation(description: "bad packet must NOT fire callback")
        badExpectation.isInverted = true

        disco.onPeerDiscovered = { peer in
            XCTAssertEqual(peer.nodeId, "abc")
            goodExpectation.fulfill()
        }

        // Call the private parseBeacon via the mirror.  Since Swift
        // doesn't expose private methods, route through the same
        // path the listener uses by injecting via an internal hook.
        // Simplest reliable way: extend the class with @testable
        // access by exposing a test-only `injectBeaconForTesting`.
        disco.injectBeaconForTesting(data: goodPacket, fromHost: "10.0.0.5")
        disco.injectBeaconForTesting(data: badPacket, fromHost: "10.0.0.5")

        wait(for: [goodExpectation, badExpectation], timeout: 1.0)
    }

    func test_beaconType_mustBe_hevolveDiscovery() {
        let prefix = "HEVOLVE_DISCO_V1".data(using: .utf8)!
        let disco = PeerLinkDiscovery(ownNodeId: "test-node-bbbb")
        let wrongType = prefix + #"{"type":"some-other-protocol","node_id":"xyz"}"#.data(using: .utf8)!

        let exp = expectation(description: "wrong type must NOT fire callback")
        exp.isInverted = true
        disco.onPeerDiscovered = { _ in exp.fulfill() }
        disco.injectBeaconForTesting(data: wrongType, fromHost: "10.0.0.6")
        wait(for: [exp], timeout: 0.5)
    }

    func test_selfEcho_isRejected() {
        let prefix = "HEVOLVE_DISCO_V1".data(using: .utf8)!
        let nodeId = "self-echo-node"
        let disco = PeerLinkDiscovery(ownNodeId: nodeId)
        let selfEcho = prefix + #"{"type":"hevolve-discovery","node_id":"\#(nodeId)"}"#.data(using: .utf8)!

        let exp = expectation(description: "our own node_id must be ignored")
        exp.isInverted = true
        disco.onPeerDiscovered = { _ in exp.fulfill() }
        disco.injectBeaconForTesting(data: selfEcho, fromHost: "10.0.0.7")
        wait(for: [exp], timeout: 0.5)
    }

    func test_capturesPortsTierAndPlatform() {
        let prefix = "HEVOLVE_DISCO_V1".data(using: .utf8)!
        let disco = PeerLinkDiscovery(ownNodeId: "listener")
        let beacon = prefix + #"{"type":"hevolve-discovery","node_id":"central-1","ws_port":5460,"backend_port":6777,"tier":"central","platform":"linux"}"#.data(using: .utf8)!

        let exp = expectation(description: "beacon parsed with all fields")
        disco.onPeerDiscovered = { peer in
            XCTAssertEqual(peer.nodeId, "central-1")
            XCTAssertEqual(peer.wsPort, 5460)
            XCTAssertEqual(peer.backendPort, 6777)
            XCTAssertEqual(peer.tier, "central")
            XCTAssertEqual(peer.platform, "linux")
            exp.fulfill()
        }
        disco.injectBeaconForTesting(data: beacon, fromHost: "192.168.0.9")
        wait(for: [exp], timeout: 1.0)
    }
}
