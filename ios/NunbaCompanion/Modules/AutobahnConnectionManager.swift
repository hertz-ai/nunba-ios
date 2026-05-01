//
//  AutobahnConnectionManager.swift
//  NunbaCompanion
//
//  iOS sibling of Android managers/AutobahnConnectionManager.java.
//
//  Owns a long-lived WAMP-2 session over a single WebSocket
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
//  Reconnect: exponential backoff with full jitter, capped at 60s.
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
//  THREAD SAFETY (review C5):
//    All mutable state — `state`, `subscriptions`, `pendingSubscribes`,
//    `nextRequestId`, `sessionId`, `ws`, `session`, `reconnectAttempt`
//    — lives behind a single serial queue (`stateQueue`). Public API
//    bounces onto that queue before reading or mutating; the receive
//    loop's callback also bounces. This eliminates the data races
//    that would otherwise crash under concurrent JS calls + WS reads.
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
  private var pendingSubscribes: [UInt64: String] = [:]
  private var nextRequestId: UInt64 = 1

  // MARK: — Reconnect

  private var reconnectAttempt: Int = 0
  private static let maxBackoff: TimeInterval = 60

  /// Serial queue gating ALL mutable state. Public methods bounce
  /// onto this queue; the receive callback also bounces here before
  /// touching anything. Without this, the WS-callback queue + JS
  /// thread + reconnect dispatch would race on the dicts.
  private let stateQueue = DispatchQueue(
    label: "com.hertzai.nunbacompanion.autobahn",
    qos: .userInitiated
  )

  // MARK: — Public API (queue-safe)

  /// Configure the router endpoint + realm. Safe to call any time;
  /// next connect() will use the new values.
  func configure(routerURL: URL? = nil, realm: String? = nil) {
    stateQueue.sync {
      if let routerURL { self.routerURL = routerURL }
      if let realm { self.realm = realm }
    }
  }

  /// Open the WebSocket and send HELLO. Idempotent — calling while
  /// already connecting / joined is a no-op.
  @objc func connect() {
    stateQueue.async { [weak self] in
      self?._connectLocked()
    }
  }

  private func _connectLocked() {
    // Caller must already be on stateQueue.
    guard state == .disconnected || state == .reconnecting else { return }
    if Self.activePublishProbe != nil {
      // In probe mode we skip transport entirely; tests verify
      // higher-level behavior without a router.
      return
    }
    state = .connecting

    let config = URLSessionConfiguration.default
    let sess = URLSession(configuration: config, delegate: nil, delegateQueue: nil)
    var req = URLRequest(url: routerURL)
    req.setValue(Self.subprotocol, forHTTPHeaderField: "Sec-WebSocket-Protocol")

    let task = sess.webSocketTask(with: req)
    task.resume()
    self.ws = task
    self.session = sess

    sendHelloLocked()
    receiveLoop()
  }

  /// Send GOODBYE and close the WebSocket. Subscriptions are dropped.
  func disconnect() {
    stateQueue.sync { [weak self] in
      self?._disconnectLocked()
    }
  }

  private func _disconnectLocked() {
    state = .disconnected
    if !subscriptions.isEmpty {
      sendLocked(message: [6, [:], "wamp.close.normal"] as [Any])
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
  ///
  /// Returns `true` if the publish was attempted on the wire (or
  /// captured by an installed test probe), `false` if it was dropped
  /// because the session isn't joined yet.
  ///
  /// JS layer (services/computePolicy.js) uses the boolean to detect
  /// silent drops and route to a different tier. Without this signal
  /// the publish failure was invisible (review C4 / H10).
  @discardableResult
  func publish(topic: String, payload: String) -> Bool {
    if let probe = Self.activePublishProbe {
      probe.calls.append(.init(topic: topic, payload: payload))
      return true
    }

    return stateQueue.sync { [weak self] () -> Bool in
      guard let self else { return false }
      guard self.state == .joined else {
        NSLog("[AutobahnConnectionManager] publish dropped (state=\(self.state.rawValue)) topic=\(topic)")
        return false
      }
      let reqId = self.nextRequestId
      self.nextRequestId += 1
      let msg: [Any] = [16, reqId, [:] as [String: Any], topic, [payload]]
      self.sendLocked(message: msg)
      return true
    }
  }

  /// Subscribe to a topic. Handler receives the JSON string of the
  /// first positional argument from each EVENT.
  /// Idempotent: re-subscribing to the same topic replaces the handler.
  func subscribe(topic: String, handler: @escaping (String) -> Void) {
    stateQueue.async { [weak self] in
      guard let self else { return }
      self.subscriptions[topic] = Subscription(subscriptionId: nil, handler: handler)
      if self.state == .joined {
        self.sendSubscribeLocked(topic: topic)
      }
      // If not joined, the subscription will be sent on the next
      // WELCOME via replayAllSubscriptions().
    }
  }

  // MARK: — WAMP message handlers (all assume stateQueue ownership)

  private func sendHelloLocked() {
    let details: [String: Any] = [
      "roles": [
        "subscriber": [:],
        "publisher": [:],
      ],
    ]
    sendLocked(message: [1, realm, details] as [Any])
  }

  private func sendSubscribeLocked(topic: String) {
    let reqId = nextRequestId
    nextRequestId += 1
    pendingSubscribes[reqId] = topic
    sendLocked(message: [32, reqId, [:] as [String: Any], topic] as [Any])
  }

  /// Handles every message off the wire. Bounces to stateQueue first.
  private func handleIncoming(_ raw: String) {
    stateQueue.async { [weak self] in
      self?.handleIncomingLocked(raw)
    }
  }

  private func handleIncomingLocked(_ raw: String) {
    guard let data = raw.data(using: .utf8),
          let arr = (try? JSONSerialization.jsonObject(with: data)) as? [Any],
          let typeNum = Self.parseInt(arr.first) else {
      NSLog("[AutobahnConnectionManager] malformed message: \(raw)")
      return
    }

    switch typeNum {
    case 2:  // WELCOME = [2, sessionId, details]
      if let sid = Self.parseUInt64(arr[safe: 1]) {
        sessionId = sid
      }
      state = .joined
      reconnectAttempt = 0
      replayAllSubscriptionsLocked()
      autoSubscribeFleetTopicsLocked()

    case 3:  // ABORT — router refused connection
      NSLog("[AutobahnConnectionManager] ABORT: \(arr)")
      scheduleReconnectLocked()

    case 33: // SUBSCRIBED = [33, requestId, subscriptionId]
      if let reqId = Self.parseUInt64(arr[safe: 1]),
         let topic = pendingSubscribes.removeValue(forKey: reqId),
         let subId = Self.parseUInt64(arr[safe: 2]) {
        if var sub = subscriptions[topic] {
          sub.subscriptionId = subId
          subscriptions[topic] = sub
        }
      }

    case 36: // EVENT = [36, subscriptionId, publicationId, details, args, kwargs?]
      handleEventLocked(arr)

    default:
      // PUBLISHED (17), GOODBYE (6), ERROR (8), etc. — log but
      // don't forward; we only care about the contract subset.
      break
    }
  }

  private func handleEventLocked(_ arr: [Any]) {
    guard let subId = Self.parseUInt64(arr[safe: 1]),
          let args = arr[safe: 4] as? [Any] else { return }

    let topic = subscriptions.first(where: { $0.value.subscriptionId == subId })?.key
    guard let topic, let handler = subscriptions[topic]?.handler else { return }

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

    // Hop the handler off the queue so a slow JS handler doesn't
    // back-pressure the WAMP read loop.
    DispatchQueue.global(qos: .utility).async {
      handler(payload)
    }
  }

  /// Auto-subscribe to fleet command topics on (re)join. Pulls
  /// device_id + user_id from their respective stores.
  private func autoSubscribeFleetTopicsLocked() {
    if let deviceId = DeviceCapabilityModule.readDeviceId(), !deviceId.isEmpty {
      let topic = "com.hertzai.hevolve.fleet.\(deviceId)"
      subscriptions[topic] = Subscription(subscriptionId: nil) { payload in
        FleetCommandReceiver.shared.process(userInfo: ["data": payload])
      }
      sendSubscribeLocked(topic: topic)
    }
    if let userId = OnboardingModule.persistedUserId(), !userId.isEmpty {
      let topic = "com.hertzai.hevolve.fleet.user.\(userId)"
      subscriptions[topic] = Subscription(subscriptionId: nil) { payload in
        FleetCommandReceiver.shared.process(userInfo: ["data": payload])
      }
      sendSubscribeLocked(topic: topic)
    }
  }

  /// On reconnect, re-send SUBSCRIBE for every previously-joined topic.
  private func replayAllSubscriptionsLocked() {
    for topic in subscriptions.keys {
      sendSubscribeLocked(topic: topic)
    }
  }

  // MARK: — Transport plumbing (assume stateQueue ownership)

  private func sendLocked(message: [Any]) {
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

  /// receiveLoop drains the WS task. The completion fires off the
  /// URLSession callback queue — we hop to stateQueue inside.
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
        self.receiveLoop()
      case .failure(let err):
        NSLog("[AutobahnConnectionManager] receive failure: \(err)")
        self.stateQueue.async { [weak self] in
          self?.scheduleReconnectLocked()
        }
      }
    }
  }

  private func scheduleReconnectLocked() {
    guard state != .disconnected else { return }
    state = .reconnecting
    ws?.cancel(with: .abnormalClosure, reason: nil)
    ws = nil

    reconnectAttempt += 1
    let backoff = Self.backoffSeconds(attempt: reconnectAttempt)
    stateQueue.asyncAfter(deadline: .now() + backoff) { [weak self] in
      self?._connectLocked()
    }
  }

  /// Exponential backoff with full jitter, capped at 60s.
  /// attempt=1 → ~1s, attempt=2 → ~2s, attempt=3 → ~4s, ... → 60s
  static func backoffSeconds(attempt: Int) -> TimeInterval {
    let exp = min(Double(attempt), 7)
    let base = pow(2.0, exp)
    let withJitter = TimeInterval.random(in: 0...base)
    return min(withJitter, maxBackoff)
  }

  // MARK: — Numeric parsing (JSONSerialization gives us NSNumber-bridged Ints,
  //          not UInt64. Centralizing fixes review M1.)

  static func parseInt(_ any: Any?) -> Int? {
    if let i = any as? Int { return i }
    if let n = any as? NSNumber { return n.intValue }
    return nil
  }

  static func parseUInt64(_ any: Any?) -> UInt64? {
    if let u = any as? UInt64 { return u }
    if let i = any as? Int, i >= 0 { return UInt64(i) }
    if let n = any as? NSNumber { return n.uint64Value }
    return nil
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

  // ── Test affordances (DEBUG-only). Production code path never
  //    reaches these — they're guarded by #if DEBUG.

  #if DEBUG
  /// Test-only entry to feed a synthetic incoming WAMP message
  /// without a real WebSocket. Lets unit tests exercise the parser
  /// + handler dispatch.
  func _injectIncoming(_ message: String) {
    stateQueue.sync { [weak self] in
      self?.handleIncomingLocked(message)
    }
  }

  /// Test-only — mark the manager as joined so subscribe()/publish()
  /// take the on-wire branches.
  func _markJoined(sessionId: UInt64 = 1) {
    stateQueue.sync {
      self.sessionId = sessionId
      self.state = .joined
    }
  }

  /// Test-only — full reset of state.
  func _reset() {
    stateQueue.sync { [weak self] in
      guard let self else { return }
      self.state = .disconnected
      self.sessionId = 0
      self.subscriptions.removeAll()
      self.pendingSubscribes.removeAll()
      self.reconnectAttempt = 0
      self.nextRequestId = 1
      self.ws?.cancel(with: .normalClosure, reason: nil)
      self.ws = nil
      self.session?.invalidateAndCancel()
      self.session = nil
    }
  }
  #endif
}

// MARK: — Tiny helper

private extension Array {
  subscript(safe i: Int) -> Element? {
    indices.contains(i) ? self[i] : nil
  }
}
