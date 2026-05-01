//
//  AutobahnConnectionManager.swift
//  NunbaCompanion
//
//  iOS sibling of Android managers/AutobahnConnectionManager.java.
//  Owns the long-lived WAMP-2 session over a single WebSocket
//  connection to the Crossbar router.
//
//  WAMP-2 message types we implement (the subset our app uses):
//
//      [1, realm, details]                       HELLO         → router
//      [2, sessionId, details]                   WELCOME       ← router
//      [3, details, reason]                      ABORT         ↔
//      [6, details, reason]                      GOODBYE       ↔
//      [16, requestId, options, topic, args]     PUBLISH       → router
//      [17, requestId, publicationId]            PUBLISHED     ← router
//      [32, requestId, options, topic]           SUBSCRIBE     → router
//      [33, requestId, subscriptionId]           SUBSCRIBED    ← router
//      [36, subscriptionId, publicationId,       EVENT         ← router
//           details, args, kwargs]
//
//  Transport: URLSessionWebSocketTask with ws/wss support.
//  Subprotocol: "wamp.2.json" (we don't bother with msgpack).
//
//  Reconnect: exponential backoff with jitter, capped at 60s.
//  On (re)connect, re-subscribes to all previously-subscribed topics
//  so subscribe-once-from-JS contracts hold across drops.
//
//  Topic auto-subscriptions on connect (per fleet command contract):
//    com.hertzai.hevolve.fleet.{deviceId}      — per-device
//    com.hertzai.hevolve.fleet.user.{userId}   — user fan-out
//
//  Each EVENT on those topics is forwarded to FleetCommandReceiver
//  which re-emits a JS 'fleetCommand' DeviceEvent. Same dispatch
//  contract as Android.
//

import Foundation

@objc(AutobahnConnectionManager)
final class AutobahnConnectionManager: NSObject {

  /// Process-wide singleton.
  @objc static let shared = AutobahnConnectionManager()

  // MARK: — Configuration

  /// Default Crossbar URL — matches Android constant. Override via
  /// configure() before connect() to point at a different router.
  private(set) var routerURL = URL(string: "wss://azurekong.hertzai.com:8445/wss")!
  private(set) var realm = "realm1"

  /// Subprotocol for WAMP-2 over WebSocket (RFC compliance — Crossbar
  /// only honors connections that advertise this subprotocol).
  private static let subprotocol = "wamp.2.json"

  // MARK: — State

  /// Tracks lifecycle so observers can know whether publish() will
  /// actually go on the wire.
  enum State: String {
    case disconnected, connecting, joined, reconnecting
  }
  private(set) var state: State = .disconnected

  /// Active WebSocket task. Held strongly so URLSession doesn't
  /// release it; receiveMessage chain keeps it pumping.
  private var ws: URLSessionWebSocketTask?
  private var session: URLSession?

  /// Crossbar-assigned session ID after WELCOME. Reset to 0 on
  /// disconnect so stale callers don't think they're still joined.
  private(set) var sessionId: UInt64 = 0

  /// Topic → (subscriptionId, handler). Replayed on reconnect.
  private struct Subscription {
    var subscriptionId: UInt64?
    let handler: (String) -> Void
  }
  private var subscriptions: [String: Subscription] = [:]

  /// Pending requests keyed by request_id, used to correlate
  /// SUBSCRIBE/SUBSCRIBED + PUBLISH/PUBLISHED.
  private var pendingSubscribes: [UInt64: String] = [:]   // reqId → topic
  private var nextRequestId: UInt64 = 1

  // MARK: — Reconnect

  private var reconnectAttempt: Int = 0
  private static let maxBackoff: TimeInterval = 60

  // MARK: — Public API

  /// Configure the router endpoint + realm. Safe to call any time;
  /// next connect() will use the new values.
  func configure(routerURL: URL? = nil, realm: String? = nil) {
    if let routerURL { self.routerURL = routerURL }
    if let realm { self.realm = realm }
  }

  /// Open the WebSocket and send HELLO. Idempotent — calling while
  /// already connecting / joined is a no-op.
  func connect() {
    guard state == .disconnected || state == .reconnecting else { return }
    if Self.activePublishProbe != nil {
      // In probe mode we skip transport entirely; tests verify
      // higher-level behavior without a router.
      return
    }
    state = .connecting

    let config = URLSessionConfiguration.default
    let session = URLSession(configuration: config, delegate: nil, delegateQueue: nil)
    var req = URLRequest(url: routerURL)
    req.setValue(Self.subprotocol, forHTTPHeaderField: "Sec-WebSocket-Protocol")

    let task = session.webSocketTask(with: req)
    task.resume()
    self.ws = task
    self.session = session

    sendHello()
    receiveLoop()
  }

  /// Send GOODBYE and close the WebSocket. Subscriptions are dropped.
  func disconnect() {
    state = .disconnected
    if !subscriptions.isEmpty {
      // Polite close — tell Crossbar we're leaving so it can
      // release session resources promptly.
      send(message: [6, [:], "wamp.close.normal"] as [Any])
    }
    ws?.cancel(with: .normalClosure, reason: nil)
    ws = nil
    session?.invalidateAndCancel()
    session = nil
    sessionId = 0
    subscriptions.removeAll()
    pendingSubscribes.removeAll()
  }

  /// Publish a JSON-encoded payload to a topic.
  /// Idempotent fan-out: if not connected, the publish is dropped
  /// silently (matches Android best-effort fleet semantics — there
  /// is no offline queue).
  func publish(topic: String, payload: String) {
    if let probe = Self.activePublishProbe {
      probe.calls.append(.init(topic: topic, payload: payload))
      return
    }

    guard state == .joined else {
      NSLog("[AutobahnConnectionManager] publish dropped (state=\(state.rawValue)) topic=\(topic)")
      return
    }

    // PUBLISH = [16, requestId, options, topic, args, kwargs]
    // We send payload as a single positional arg (args[0]) so
    // server-side handlers see args[0] === payload string.
    let reqId = nextRequestId
    nextRequestId += 1
    let msg: [Any] = [16, reqId, [:] as [String: Any], topic, [payload]]
    send(message: msg)
  }

  /// Subscribe to a topic. Handler receives the JSON string of the
  /// first positional argument from each EVENT.
  /// Idempotent: re-subscribing to the same topic replaces the handler.
  func subscribe(topic: String, handler: @escaping (String) -> Void) {
    subscriptions[topic] = Subscription(subscriptionId: nil, handler: handler)
    if state == .joined {
      sendSubscribe(topic: topic)
    }
    // If not joined, the subscription will be sent on the next
    // WELCOME via replayAllSubscriptions().
  }

  // MARK: — WAMP message handlers

  private func sendHello() {
    // HELLO = [1, realm, details]
    let details: [String: Any] = [
      "roles": [
        "subscriber": [:],
        "publisher": [:],
      ],
    ]
    send(message: [1, realm, details] as [Any])
  }

  private func sendSubscribe(topic: String) {
    let reqId = nextRequestId
    nextRequestId += 1
    pendingSubscribes[reqId] = topic
    // SUBSCRIBE = [32, requestId, options, topic]
    send(message: [32, reqId, [:] as [String: Any], topic] as [Any])
  }

  /// Handles every message off the wire.
  private func handleIncoming(_ raw: String) {
    guard let data = raw.data(using: .utf8),
          let arr = (try? JSONSerialization.jsonObject(with: data)) as? [Any],
          let typeNum = arr.first as? Int else {
      NSLog("[AutobahnConnectionManager] malformed message: \(raw)")
      return
    }

    switch typeNum {
    case 2:  // WELCOME = [2, sessionId, details]
      if let sid = arr[safe: 1] as? UInt64 {
        sessionId = sid
      } else if let sid = arr[safe: 1] as? Int {
        sessionId = UInt64(sid)
      }
      state = .joined
      reconnectAttempt = 0
      replayAllSubscriptions()
      autoSubscribeFleetTopics()

    case 3:  // ABORT — router refused connection
      NSLog("[AutobahnConnectionManager] ABORT: \(arr)")
      scheduleReconnect()

    case 33: // SUBSCRIBED = [33, requestId, subscriptionId]
      if let reqId = arr[safe: 1] as? UInt64 ?? (arr[safe: 1] as? Int).map(UInt64.init),
         let topic = pendingSubscribes.removeValue(forKey: reqId) {
        let subId = (arr[safe: 2] as? UInt64) ?? UInt64((arr[safe: 2] as? Int) ?? 0)
        if var sub = subscriptions[topic] {
          sub.subscriptionId = subId
          subscriptions[topic] = sub
        }
      }

    case 36: // EVENT = [36, subscriptionId, publicationId, details, args, kwargs?]
      handleEvent(arr)

    default:
      // PUBLISHED (17), GOODBYE (6), ERROR (8), etc. — log but
      // don't forward; we only care about the contract subset.
      break
    }
  }

  private func handleEvent(_ arr: [Any]) {
    guard let subId = (arr[safe: 1] as? UInt64) ?? (arr[safe: 1] as? Int).map(UInt64.init),
          let args = arr[safe: 4] as? [Any] else { return }

    // Find the topic this subscription corresponds to.
    let topic = subscriptions.first(where: { $0.value.subscriptionId == subId })?.key
    guard let topic, let handler = subscriptions[topic]?.handler else { return }

    // Pull the first positional argument as a JSON string. We
    // accept three shapes: pre-stringified JSON, dict, or anything
    // else that can be JSON-encoded.
    let payload: String
    if let s = args.first as? String {
      payload = s
    } else if let dict = args.first as? [String: Any],
              let data = try? JSONSerialization.data(withJSONObject: dict),
              let s = String(data: data, encoding: .utf8) {
      payload = s
    } else {
      NSLog("[AutobahnConnectionManager] event with no string/dict arg on topic=\(topic)")
      return
    }

    handler(payload)
  }

  /// Auto-subscribe to fleet command topics on (re)join. Pulls
  /// device_id + user_id from their respective stores.
  private func autoSubscribeFleetTopics() {
    if let deviceId = DeviceCapabilityModule.readDeviceId(), !deviceId.isEmpty {
      let topic = "com.hertzai.hevolve.fleet.\(deviceId)"
      subscribe(topic: topic) { payload in
        FleetCommandReceiver.shared.process(userInfo: ["data": payload])
      }
    }
    if let userId = OnboardingModule.persistedUserId(), !userId.isEmpty {
      let topic = "com.hertzai.hevolve.fleet.user.\(userId)"
      subscribe(topic: topic) { payload in
        FleetCommandReceiver.shared.process(userInfo: ["data": payload])
      }
    }
  }

  /// On reconnect, re-send SUBSCRIBE for every previously-joined topic.
  private func replayAllSubscriptions() {
    for topic in subscriptions.keys {
      sendSubscribe(topic: topic)
    }
  }

  // MARK: — Transport plumbing

  private func send(message: [Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: message),
          let s = String(data: data, encoding: .utf8) else {
      NSLog("[AutobahnConnectionManager] failed to encode \(message)")
      return
    }
    ws?.send(.string(s)) { err in
      if let err {
        NSLog("[AutobahnConnectionManager] send error: \(err)")
      }
    }
  }

  private func receiveLoop() {
    ws?.receive { [weak self] result in
      guard let self else { return }
      switch result {
      case .success(.string(let s)):
        self.handleIncoming(s)
        self.receiveLoop()
      case .success(.data(let data)):
        if let s = String(data: data, encoding: .utf8) {
          self.handleIncoming(s)
        }
        self.receiveLoop()
      case .success:
        self.receiveLoop()  // unknown variant; keep pumping
      case .failure(let err):
        NSLog("[AutobahnConnectionManager] receive failure: \(err)")
        self.scheduleReconnect()
      }
    }
  }

  private func scheduleReconnect() {
    guard state != .disconnected else { return }
    state = .reconnecting
    ws?.cancel(with: .abnormalClosure, reason: nil)
    ws = nil

    reconnectAttempt += 1
    let backoff = Self.backoffSeconds(attempt: reconnectAttempt)
    DispatchQueue.global().asyncAfter(deadline: .now() + backoff) { [weak self] in
      self?.connect()
    }
  }

  /// Exponential backoff with full jitter, capped at 60s.
  /// attempt=1 → ~1s, attempt=2 → ~2s, attempt=3 → ~4s, ... → 60s
  static func backoffSeconds(attempt: Int) -> TimeInterval {
    let exp = min(Double(attempt), 7)  // cap exponent so 2^attempt doesn't overflow
    let base = pow(2.0, exp)
    let withJitter = TimeInterval.random(in: 0...base)
    return min(withJitter, maxBackoff)
  }

  // MARK: — Test probe (used by XCTests only)

  /// Recording probe for unit tests. When installed, publish() is
  /// captured into the probe's call log instead of being sent on
  /// the wire — tests don't have to spin up a real WebSocket.
  final class PublishProbe {
    struct Call: Equatable {
      let topic: String
      let payload: String
    }
    var calls: [Call] = []
  }

  private static var activePublishProbe: PublishProbe?

  static func installPublishProbe() -> PublishProbe {
    let probe = PublishProbe()
    activePublishProbe = probe
    return probe
  }

  static func uninstallPublishProbe() {
    activePublishProbe = nil
  }

  /// Test-only entry to feed a synthetic incoming WAMP message
  /// without a real WebSocket. Lets unit tests exercise the parser
  /// + handler dispatch.
  func _injectIncoming(_ message: String) {
    handleIncoming(message)
  }

  /// Test-only — mark the manager as joined so subscribe()/publish()
  /// take the on-wire branches (calls fall into the probe instead
  /// of the network when activePublishProbe is set).
  func _markJoined(sessionId: UInt64 = 1) {
    self.sessionId = sessionId
    self.state = .joined
  }

  /// Test-only — full reset of state.
  func _reset() {
    state = .disconnected
    sessionId = 0
    subscriptions.removeAll()
    pendingSubscribes.removeAll()
    reconnectAttempt = 0
    nextRequestId = 1
  }
}

// MARK: — Tiny helper

private extension Array {
  subscript(safe i: Int) -> Element? {
    indices.contains(i) ? self[i] : nil
  }
}
