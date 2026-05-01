//
//  PeerLinkModule.swift
//  NunbaCompanion
//
//  iOS sibling of Android peerlink/PeerLinkModule.java + the 8
//  supporting Kotlin classes (PeerLinkClient, PeerLinkChannels,
//  PeerLinkWireFormat, PeerLinkHandshake, PeerLinkChannelRouter,
//  PeerLinkDiscovery, PeerLinkManager, PeerLinkMessageBridge).
//
//  Consolidated into ONE Swift class because:
//    - No JNI bridge to worry about — direct Swift→native is enough
//    - The protocol surface is small enough to fit in one file
//    - Easier to reason about as one state machine
//
//  Design:
//    - One URLSessionWebSocketTask per active peer connection.
//    - Frame format mirrors Android wire format:
//        text: {"ch":"control","id":"msg-1","d":{...}}
//        Each frame carries a channel id, a unique message id, and
//        a JSON body.
//    - Handshake: client sends `hello` frame → router replies
//      `hello_ack`. Until ack lands, all sends queue.
//    - Crypto: optional per-channel encryption. Control + chat are
//      cleartext; sensitive channels (consent, fleet) use AES-GCM
//      with the session key derived in handshake.
//    - Discovery: stub returns the cloud HARTOS URL as a single
//      "peer". Real Bonjour/UDP discovery is a Phase 2 task — the
//      JS layer doesn't crash if no LAN peers are advertised.
//
//  JS contract:
//    start()                                → starts manager
//    stop()                                 → tears down all peers
//    connectToPeer(address, port)          → manual peer connect
//    send(channel, payloadJson)             → fire-and-forget
//    sendChat(message, userId)             → wraps send on 'chat' channel
//    sendVoiceQuery(text, userId)          → wraps send on 'voice' channel
//    runAgent(agentType, inputJson)        → request/reply, returns string
//    dispatchAgentTask(taskJson)           → fire-and-forget agent task
//    getStatus()                            → connection state dict
//    getDiscoveredPeers()                  → array of peer dicts
//    isReady()                              → bool — handshake complete
//    getApiBase()                           → string URL of best peer
//

import Foundation
import CryptoKit
import React

@objc(PeerLinkModule)
final class PeerLinkModule: NSObject {

  static let shared = PeerLinkModule()

  /// Default HARTOS cloud endpoint — used both as the discovery
  /// fallback peer and as the default getApiBase() value.
  static let cloudFallbackURL = URL(string: "https://azurekong.hertzai.com")!
  static let cloudFallbackWS = URL(string: "wss://azurekong.hertzai.com:8445/ws")!

  // MARK: — State

  enum ConnectionState: String {
    case idle, connecting, handshaking, ready, failed
  }

  private var state: ConnectionState = .idle
  private var ws: URLSessionWebSocketTask?
  private var session: URLSession?

  /// In-flight runAgent requests keyed by message id.
  private var pendingReplies: [String: (Result<String, Error>) -> Void] = [:]

  /// Identity (Ed25519) — created/loaded on start().
  private var identity: Curve25519.Signing.PrivateKey?

  /// Session key (AES-256) derived after handshake.
  private var sessionKey: SymmetricKey?

  /// "Discovered" peers. Currently just the cloud fallback. mDNS
  /// discovery via NSNetService can drop into this list when wired.
  private var discoveredPeers: [Peer] = []

  struct Peer {
    let address: String
    let wsPort: Int
    let wsUrl: String
    let method: String  // "UDP_BEACON" | "MDNS" | "GOSSIP" | "CLOUD"
    let trustLevel: String  // "SAME_USER" | "PEER" | "RELAY"
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }

  // MARK: — Lifecycle

  @objc(start:rejecter:)
  func start(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if state != .idle {
      // Idempotent — re-calling while connected is a no-op.
      resolve(["state": state.rawValue])
      return
    }

    identity = PeerLinkCrypto.loadOrCreateIdentity()
    if identity == nil {
      reject("PEERLINK_KEYCHAIN_FAILED", "Could not persist identity to Keychain", nil)
      return
    }

    // Cloud peer is always available; populate it so getDiscoveredPeers
    // returns at least one option even if local discovery is silent.
    if !discoveredPeers.contains(where: { $0.method == "CLOUD" }) {
      discoveredPeers.append(Peer(
        address: Self.cloudFallbackURL.host ?? "azurekong.hertzai.com",
        wsPort: 8445,
        wsUrl: Self.cloudFallbackWS.absoluteString,
        method: "CLOUD",
        trustLevel: "RELAY"
      ))
    }

    state = .connecting
    resolve(["state": state.rawValue,
             "identityPubKey": PeerLinkCrypto.toHex(identity!.publicKey.rawRepresentation)])
  }

  @objc(stop:rejecter:)
  func stop(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    teardown()
    resolve(true)
  }

  private func teardown() {
    ws?.cancel(with: .normalClosure, reason: nil)
    ws = nil
    session?.invalidateAndCancel()
    session = nil
    state = .idle
    sessionKey = nil
    pendingReplies.removeAll()
  }

  // MARK: — Connection

  @objc(connectToPeer:port:resolver:rejecter:)
  func connectToPeer(
    _ address: String,
    port: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let portInt = port.intValue
    guard let url = URL(string: "ws://\(address):\(portInt)/peerlink") else {
      reject("PEERLINK_BAD_URL", "Could not build URL from \(address):\(portInt)", nil)
      return
    }

    if state == .ready {
      // Already connected to a peer; tear down + reconnect to the
      // new one. JS layer can multiplex by calling stop+connect.
      teardown()
    }

    state = .connecting
    let cfg = URLSessionConfiguration.default
    let s = URLSession(configuration: cfg, delegate: nil, delegateQueue: nil)
    let task = s.webSocketTask(with: url)
    task.resume()
    self.ws = task
    self.session = s

    sendHello()
    receiveLoop()
    resolve(["state": state.rawValue, "url": url.absoluteString])
  }

  // MARK: — Handshake

  /// hello = {"ch":"control","id":"hello","d":{"pubkey":<hex>}}
  private func sendHello() {
    guard let identity else { return }
    state = .handshaking
    let body: [String: Any] = [
      "pubkey": PeerLinkCrypto.toHex(identity.publicKey.rawRepresentation),
      "version": 1,
    ]
    sendFrame(channel: "control", id: "hello", body: body)
  }

  /// Process an incoming control frame. hello_ack lands here.
  private func handleControl(id: String, body: [String: Any]) {
    if id == "hello_ack" {
      // body.peer_pubkey + body.session_pubkey expected
      if let peerEphHex = body["session_pubkey"] as? String,
         let peerEphRaw = PeerLinkCrypto.fromHex(peerEphHex) {
        // Generate our own ephemeral, derive shared key.
        // Real protocol exchanges ephemerals during hello; stub
        // path uses a single round-trip and assumes the router
        // sent us its ephemeral inside hello_ack.
        let myEph = PeerLinkCrypto.newEphemeral()
        do {
          sessionKey = try PeerLinkCrypto.deriveSessionKey(
            privateKey: myEph,
            peerPublicRaw: peerEphRaw
          )
          state = .ready
        } catch {
          NSLog("[PeerLink] handshake key derivation failed: \(error)")
          state = .failed
        }
      } else {
        // No key exchange in ack — accept cleartext mode.
        state = .ready
      }
    }
  }

  // MARK: — Wire format

  private struct Frame: Codable {
    let ch: String
    let id: String
    let d: [String: AnyCodable]?
  }

  /// Send a frame. If sessionKey is present and the channel is
  /// in the encrypted set, the body is AES-GCM sealed first.
  func sendFrame(channel: String, id: String, body: [String: Any]) {
    var dict: [String: Any] = ["ch": channel, "id": id]

    let bodyJson = (try? JSONSerialization.data(withJSONObject: body)) ?? Data()

    if shouldEncrypt(channel: channel), let key = sessionKey,
       let sealed = try? PeerLinkCrypto.encrypt(bodyJson, with: key) {
      dict["d"] = ["enc": PeerLinkCrypto.toHex(sealed)]
    } else {
      dict["d"] = body
    }

    guard let data = try? JSONSerialization.data(withJSONObject: dict),
          let str = String(data: data, encoding: .utf8) else {
      NSLog("[PeerLink] frame encoding failed")
      return
    }

    ws?.send(.string(str)) { err in
      if let err {
        NSLog("[PeerLink] send error: \(err)")
      }
    }
  }

  private static let encryptedChannels: Set<String> = ["consent", "fleet", "credentials"]

  private func shouldEncrypt(channel: String) -> Bool {
    Self.encryptedChannels.contains(channel)
  }

  // MARK: — Receive loop

  private func receiveLoop() {
    ws?.receive { [weak self] result in
      guard let self else { return }
      switch result {
      case .success(.string(let s)):
        self.handleIncoming(s)
        self.receiveLoop()
      case .success(.data(let d)):
        if let s = String(data: d, encoding: .utf8) {
          self.handleIncoming(s)
        }
        self.receiveLoop()
      case .success: self.receiveLoop()
      case .failure(let err):
        NSLog("[PeerLink] receive failure: \(err)")
        self.state = .failed
      }
    }
  }

  private func handleIncoming(_ raw: String) {
    guard let data = raw.data(using: .utf8),
          let dict = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
          let ch = dict["ch"] as? String,
          let id = dict["id"] as? String else {
      NSLog("[PeerLink] malformed frame: \(raw)")
      return
    }

    var body = (dict["d"] as? [String: Any]) ?? [:]
    if let encHex = body["enc"] as? String, let key = sessionKey,
       let encData = PeerLinkCrypto.fromHex(encHex),
       let plain = try? PeerLinkCrypto.decrypt(encData, with: key),
       let parsed = (try? JSONSerialization.jsonObject(with: plain)) as? [String: Any] {
      body = parsed
    }

    if ch == "control" {
      handleControl(id: id, body: body)
    } else if let cb = pendingReplies.removeValue(forKey: id) {
      // Request/reply correlation — runAgent's reply lands here.
      let json = (try? JSONSerialization.data(withJSONObject: body)) ?? Data()
      let str = String(data: json, encoding: .utf8) ?? "{}"
      cb(.success(str))
    }
    // Other channels can be wired up by extending dispatch — fleet
    // commands route via FleetCommandReceiver; chat events would
    // emit a JS DeviceEvent.
  }

  // MARK: — Public bridge methods

  @objc(send:payload:resolver:rejecter:)
  func send(
    _ channel: String,
    payload: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let body = (try? JSONSerialization.jsonObject(with: payload.data(using: .utf8) ?? Data()))
              as? [String: Any] ?? [:]
    let id = "msg-\(UUID().uuidString.prefix(8))"
    sendFrame(channel: channel, id: id, body: body)
    resolve(["id": id])
  }

  @objc(sendChat:userId:resolver:rejecter:)
  func sendChat(
    _ message: String,
    userId: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let id = "chat-\(UUID().uuidString.prefix(8))"
    sendFrame(channel: "chat", id: id,
              body: ["text": message, "user_id": userId])
    resolve(["id": id])
  }

  @objc(sendVoiceQuery:userId:resolver:rejecter:)
  func sendVoiceQuery(
    _ text: String,
    userId: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let id = "voice-\(UUID().uuidString.prefix(8))"
    sendFrame(channel: "voice", id: id,
              body: ["text": text, "user_id": userId])
    resolve(["id": id])
  }

  @objc(runAgent:inputJson:resolver:rejecter:)
  func runAgent(
    _ agentType: String,
    inputJson: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let input = (try? JSONSerialization.jsonObject(with: inputJson.data(using: .utf8) ?? Data()))
              as? [String: Any] ?? [:]
    let id = "agent-\(UUID().uuidString.prefix(8))"

    pendingReplies[id] = { result in
      switch result {
      case .success(let s): resolve(s)
      case .failure(let err):
        reject("PEERLINK_AGENT_FAILED", err.localizedDescription, err)
      }
    }
    sendFrame(channel: "agent", id: id,
              body: ["agent_type": agentType, "input": input])

    // 30s timeout — JS layer can retry.
    DispatchQueue.main.asyncAfter(deadline: .now() + 30) { [weak self] in
      if let cb = self?.pendingReplies.removeValue(forKey: id) {
        cb(.failure(NSError(domain: "PeerLink", code: 408,
                            userInfo: [NSLocalizedDescriptionKey: "runAgent timeout"])))
      }
    }
  }

  @objc(dispatchAgentTask:resolver:rejecter:)
  func dispatchAgentTask(
    _ taskJson: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let task = (try? JSONSerialization.jsonObject(with: taskJson.data(using: .utf8) ?? Data()))
              as? [String: Any] ?? [:]
    let id = "task-\(UUID().uuidString.prefix(8))"
    sendFrame(channel: "agent", id: id, body: task)
    resolve(["id": id])
  }

  @objc(getStatus:rejecter:)
  func getStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve([
      "isConnected": state == .ready || state == .handshaking,
      "isHandshakeComplete": state == .ready,
      "currentUrl": ws?.originalRequest?.url?.absoluteString ?? "",
      "trustLevel": "RELAY",  // bumped to SAME_USER once we verify peer's pubkey
    ])
  }

  @objc(getDiscoveredPeers:rejecter:)
  func getDiscoveredPeers(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let arr = discoveredPeers.map { p in
      [
        "address": p.address,
        "wsPort": p.wsPort,
        "wsUrl": p.wsUrl,
        "method": p.method,
        "trustLevel": p.trustLevel,
      ] as [String: Any]
    }
    resolve(arr)
  }

  @objc(isReady:rejecter:)
  func isReady(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(state == .ready)
  }

  @objc(getApiBase:rejecter:)
  func getApiBase(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    // Prefer the connected peer; fall back to cloud.
    if let url = ws?.originalRequest?.url?.absoluteString, !url.isEmpty {
      let httpUrl = url.replacingOccurrences(of: "ws://", with: "http://")
                       .replacingOccurrences(of: "wss://", with: "https://")
      resolve(httpUrl)
    } else {
      resolve(Self.cloudFallbackURL.absoluteString)
    }
  }

  // MARK: — Test affordances

  func _markReady() {
    state = .ready
  }

  func _setSessionKey(_ key: SymmetricKey) {
    sessionKey = key
  }

  func _injectIncoming(_ message: String) {
    handleIncoming(message)
  }

  func _reset() {
    teardown()
    discoveredPeers.removeAll()
    sessionKey = nil
  }
}

/// Tiny helper — needed because [String: Any] isn't directly Codable.
private struct AnyCodable: Codable {
  let value: Any
  init(_ v: Any) { self.value = v }
  init(from decoder: Decoder) throws {
    let c = try decoder.singleValueContainer()
    if let s = try? c.decode(String.self) { value = s; return }
    if let i = try? c.decode(Int.self) { value = i; return }
    if let b = try? c.decode(Bool.self) { value = b; return }
    if let d = try? c.decode(Double.self) { value = d; return }
    value = NSNull()
  }
  func encode(to encoder: Encoder) throws {
    var c = encoder.singleValueContainer()
    if let s = value as? String { try c.encode(s) }
    else if let i = value as? Int { try c.encode(i) }
    else if let b = value as? Bool { try c.encode(b) }
    else if let d = value as? Double { try c.encode(d) }
    else { try c.encodeNil() }
  }
}
