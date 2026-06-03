//
//  PeerLinkDiscovery.swift
//  NunbaCompanion
//
//  iOS UDP-6780 discovery implementation per
//  HARTOS/docs/architecture/peer_discovery_spec.md
//
//  Wire format (MUST match Android Kotlin + HARTOS Python verbatim):
//
//      ┌──────────────────────────┬──────────────────────────────────┐
//      │ MAGIC PREFIX (16 bytes)  │ JSON BODY (UTF-8, ≤ 2 KiB)        │
//      │ "HEVOLVE_DISCO_V1"       │ {"type":"hevolve-discovery", ...} │
//      └──────────────────────────┴──────────────────────────────────┘
//
//  The previous PeerLinkModule.swift was a stub that always returned
//  the cloud peer ("Real Bonjour/UDP discovery is a Phase 2 task").
//  This brings iOS to parity with the Android Kotlin implementation.
//
//  Listens on UDP 6780 with SO_REUSEADDR; sends a probe packet on
//  start and once every 60 s; advertises discovered peers via the
//  onPeerDiscovered closure so PeerLinkModule can fold them into
//  discoveredPeers.
//

import Foundation
import Network

@available(iOS 13.0, *)
final class PeerLinkDiscovery {

    // MARK: — Wire format constants (canonical spec)

    private static let discoveryPort: UInt16 = 6780
    private static let peerlinkPort: Int = 5460
    private static let backendPort: Int = 6777
    private static let beaconMagic: Data = "HEVOLVE_DISCO_V1".data(using: .utf8)!
    private static let beaconType: String = "hevolve-discovery"
    private static let probeInterval: TimeInterval = 60.0
    private static let maxPacketBytes: Int = 2048

    // MARK: — Public types

    struct DiscoveredPeer: Hashable {
        let nodeId: String
        let address: String
        let wsPort: Int
        let backendPort: Int
        let tier: String          // "flat" | "regional" | "central"
        let platform: String
        let discoveredAt: Date

        var backendUrl: String { "http://\(address):\(backendPort)" }
        var wsUrl: String { "ws://\(address):\(wsPort)/peer_link" }
    }

    // MARK: — Internal state

    private let queue = DispatchQueue(label: "com.hevolve.peerlink.discovery")
    private var listener: NWListener?
    private var probeTimer: DispatchSourceTimer?
    private var isRunning = false
    private var ownNodeId: String

    /// Caller-supplied callback fired once per unique node_id seen.
    var onPeerDiscovered: ((DiscoveredPeer) -> Void)?

    /// Snapshot of everything found so far (key = node_id).
    private(set) var peers: [String: DiscoveredPeer] = [:]

    init(ownNodeId: String) {
        self.ownNodeId = ownNodeId
    }

    // MARK: — Lifecycle

    func start() {
        queue.async { [weak self] in
            guard let self = self, !self.isRunning else { return }
            self.isRunning = true
            self.startListener()
            self.scheduleProbe()
            self.sendProbe()  // initial probe so we don't wait 60 s on cold start
        }
    }

    func stop() {
        queue.async { [weak self] in
            guard let self = self else { return }
            self.isRunning = false
            self.probeTimer?.cancel()
            self.probeTimer = nil
            self.listener?.cancel()
            self.listener = nil
        }
    }

    // MARK: — UDP listener

    private func startListener() {
        do {
            let params = NWParameters.udp
            params.allowLocalEndpointReuse = true
            params.includePeerToPeer = true

            let port = NWEndpoint.Port(rawValue: Self.discoveryPort)!
            let listener = try NWListener(using: params, on: port)

            listener.newConnectionHandler = { [weak self] connection in
                self?.handleIncoming(connection: connection)
            }

            listener.stateUpdateHandler = { state in
                switch state {
                case .failed(let err):
                    NSLog("PeerLinkDiscovery: listener failed: \(err)")
                case .ready:
                    NSLog("PeerLinkDiscovery: listening on UDP \(Self.discoveryPort)")
                default: break
                }
            }

            listener.start(queue: queue)
            self.listener = listener
        } catch {
            NSLog("PeerLinkDiscovery: could not bind UDP \(Self.discoveryPort): \(error)")
        }
    }

    private func handleIncoming(connection: NWConnection) {
        connection.start(queue: queue)
        receiveOne(on: connection)
    }

    private func receiveOne(on connection: NWConnection) {
        connection.receiveMessage { [weak self] data, _, _, _ in
            guard let self = self, let data = data else {
                connection.cancel()
                return
            }
            self.parseBeacon(data, from: connection.endpoint)
            connection.cancel()
        }
    }

    // MARK: — Probe sender

    private func scheduleProbe() {
        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now() + Self.probeInterval, repeating: Self.probeInterval)
        timer.setEventHandler { [weak self] in self?.sendProbe() }
        timer.resume()
        probeTimer = timer
    }

    private func sendProbe() {
        // Build canonical probe body: "HEVOLVE_DISCO_V1" + JSON
        var body: [String: Any] = [
            "type": Self.beaconType,
            "node_id": ownNodeId,
            "platform": "ios",
            "kind": "probe",
        ]
        // ws/backend ports are informational on probes but populating them
        // makes us a useful discoverable peer too once the spec allows it.
        body["ws_port"] = Self.peerlinkPort
        body["backend_port"] = Self.backendPort

        guard let json = try? JSONSerialization.data(
                withJSONObject: body, options: [.sortedKeys]) else {
            return
        }
        let packet = Self.beaconMagic + json

        // Broadcast to the LAN.  NWConnection doesn't accept 255.255.255.255
        // for the IPv4 broadcast directly; fall back to a raw POSIX socket
        // so the SO_BROADCAST flag works the same way HARTOS + Android do.
        sendBroadcast(packet)
    }

    private func sendBroadcast(_ data: Data) {
        var fd: Int32 = -1
        do {
            fd = socket(AF_INET, SOCK_DGRAM, 0)
            guard fd >= 0 else {
                NSLog("PeerLinkDiscovery: socket() failed")
                return
            }
            var yes: Int32 = 1
            _ = withUnsafePointer(to: &yes) { ptr -> Int32 in
                setsockopt(fd, SOL_SOCKET, SO_BROADCAST,
                           ptr, socklen_t(MemoryLayout<Int32>.size))
            }
            var addr = sockaddr_in()
            addr.sin_family = sa_family_t(AF_INET)
            addr.sin_port = in_port_t(Self.discoveryPort).bigEndian
            addr.sin_addr.s_addr = INADDR_BROADCAST.bigEndian
            let sent = data.withUnsafeBytes { (buf: UnsafeRawBufferPointer) -> Int in
                withUnsafePointer(to: &addr) { addrPtr -> Int in
                    addrPtr.withMemoryRebound(to: sockaddr.self, capacity: 1) { rawAddr in
                        Darwin.sendto(fd, buf.baseAddress, data.count, 0,
                                      rawAddr, socklen_t(MemoryLayout<sockaddr_in>.size))
                    }
                }
            }
            if sent < 0 {
                NSLog("PeerLinkDiscovery: sendto failed errno=\(errno)")
            }
        }
        if fd >= 0 { close(fd) }
    }

    // MARK: — Beacon parser

    private func parseBeacon(_ data: Data, from endpoint: NWEndpoint) {
        // 1. Validate raw HEVOLVE_DISCO_V1 prefix before any UTF-8 work.
        //    Drops Avahi / SSDP / random UDP noise without parsing.
        guard data.count > Self.beaconMagic.count else { return }
        guard data.prefix(Self.beaconMagic.count) == Self.beaconMagic else { return }

        let jsonSlice = data.suffix(from: Self.beaconMagic.count)
        guard let parsed = try? JSONSerialization.jsonObject(
                with: jsonSlice, options: []) as? [String: Any] else {
            return
        }
        // 2. Per spec: type field MUST be "hevolve-discovery".
        guard (parsed["type"] as? String) == Self.beaconType else { return }
        // 3. Reject our own probes echoing back.
        let nodeId = (parsed["node_id"] as? String) ?? ""
        guard !nodeId.isEmpty, nodeId != ownNodeId else { return }

        let fromAddress = endpointHost(endpoint) ?? "unknown"
        let wsPort = (parsed["ws_port"] as? Int) ?? Self.peerlinkPort
        let backendPort = (parsed["backend_port"] as? Int) ?? Self.backendPort
        let tier = (parsed["tier"] as? String) ?? "regional"
        let platform = (parsed["platform"] as? String) ?? "unknown"

        let peer = DiscoveredPeer(
            nodeId: nodeId,
            address: fromAddress,
            wsPort: wsPort,
            backendPort: backendPort,
            tier: tier,
            platform: platform,
            discoveredAt: Date()
        )

        // De-dupe by node_id; fire onPeerDiscovered only on first sight.
        let isNew = peers[nodeId] == nil
        peers[nodeId] = peer
        if isNew {
            NSLog("PeerLinkDiscovery: discovered \(nodeId.prefix(8)) at \(fromAddress) (\(tier)/\(platform))")
            DispatchQueue.main.async { [weak self] in
                self?.onPeerDiscovered?(peer)
            }
        }
    }

    private func endpointHost(_ endpoint: NWEndpoint) -> String? {
        switch endpoint {
        case .hostPort(let host, _):
            switch host {
            case .ipv4(let v4): return v4.debugDescription
            case .ipv6(let v6): return v6.debugDescription
            case .name(let name, _): return name
            @unknown default: return nil
            }
        default: return nil
        }
    }

    // MARK: — Test seam

    /// Test-only entry point: drives parseBeacon directly without
    /// requiring an actual UDP socket bind.  Locks the wire-format
    /// contract from XCTest without flakiness.  See
    /// PeerLinkDiscoveryTests.swift.
    func injectBeaconForTesting(data: Data, fromHost: String) {
        guard let host = NWEndpoint.Host(fromHost) as NWEndpoint.Host? else { return }
        let endpoint = NWEndpoint.hostPort(host: host,
                                           port: NWEndpoint.Port(rawValue: Self.discoveryPort)!)
        // Sync path so XCTest expectations stay deterministic.
        queue.sync { [weak self] in
            self?.parseBeacon(data, from: endpoint)
        }
    }
}
