//
//  MicAmplitudeModule.swift
//  NunbaCompanion
//
//  iOS sibling of Android mic/MicAmplitudeModule.java.
//  Streams a 0.0-1.0 amplitude value to JS at ~10Hz so the UI can
//  draw mic visualizers (used by the voice-input ring on the home
//  screen, kids learning voice games, etc.).
//
//  Audio capture: AVAudioEngine input tap.
//  RMS calc:      sqrt(sum(sample^2) / N) → mapped to 0..1 with a
//                 dB floor of -60 (anything quieter clips to 0).
//  Emit cadence:  10Hz (every 100ms). Higher rates flood the JS
//                 bridge; lower rates feel laggy on the visualizer.
//
//  JS contract:
//      MicAmplitudeModule.start()   → starts engine + emits
//      MicAmplitudeModule.stop()    → stops + releases mic
//      DeviceEvent 'micAmplitude'   → { value: 0..1 }
//

import Foundation
import AVFoundation
import React

@objc(MicAmplitudeModule)
final class MicAmplitudeModule: RCTEventEmitter {

  private let engine = AVAudioEngine()
  private var lastEmitAt: TimeInterval = 0
  private static let emitIntervalSec: TimeInterval = 0.1  // 10Hz
  private static let dbFloor: Float = -60.0

  private var hasJSListener = false
  private(set) var isRunning = false

  override func supportedEvents() -> [String] {
    ["micAmplitude"]
  }

  override static func requiresMainQueueSetup() -> Bool { false }

  override func startObserving() { hasJSListener = true }
  override func stopObserving() { hasJSListener = false }

  // MARK: — JS-callable

  @objc func start() {
    guard !isRunning else { return }
    isRunning = true

    // Configure session for record + playback so mic + TTS coexist.
    let session = AVAudioSession.sharedInstance()
    try? session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker])
    try? session.setActive(true, options: .notifyOthersOnDeactivation)

    let input = engine.inputNode
    let format = input.outputFormat(forBus: 0)

    input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
      guard let self else { return }
      let value = Self.amplitude(from: buffer)
      self.maybeEmit(value: value)
    }

    do {
      try engine.start()
    } catch {
      NSLog("[MicAmplitudeModule] engine start failed: \(error)")
      stop()
    }
  }

  @objc func stop() {
    guard isRunning else { return }
    isRunning = false

    engine.inputNode.removeTap(onBus: 0)
    engine.stop()
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  // MARK: — Amplitude calculation

  /// RMS of a buffer mapped to 0..1 via the dB floor.
  /// Pure function so it's trivially testable without an engine.
  static func amplitude(from buffer: AVAudioPCMBuffer) -> Float {
    guard let channelData = buffer.floatChannelData else { return 0 }
    let frameLength = Int(buffer.frameLength)
    guard frameLength > 0 else { return 0 }

    let samples = channelData[0]
    var sumSq: Float = 0
    for i in 0..<frameLength {
      let s = samples[i]
      sumSq += s * s
    }
    let rms = sqrt(sumSq / Float(frameLength))
    return amplitudeFromRMS(rms)
  }

  /// Map raw RMS (0..1 linear) to a perceptual 0..1 via dB.
  /// Public for tests.
  static func amplitudeFromRMS(_ rms: Float) -> Float {
    if rms <= 1e-7 { return 0 }
    let db = 20.0 * log10f(rms)        // dB, typically -100..0
    if db <= dbFloor { return 0 }
    let normalized = (db - dbFloor) / -dbFloor   // (db + 60) / 60
    return max(0, min(1, normalized))
  }

  /// Throttled emit — drops samples that arrive faster than 10Hz.
  private func maybeEmit(value: Float) {
    let now = CFAbsoluteTimeGetCurrent()
    guard now - lastEmitAt >= Self.emitIntervalSec else { return }
    lastEmitAt = now

    if hasJSListener {
      sendEvent(withName: "micAmplitude", body: ["value": value])
    }
  }

  // MARK: — Test affordances

  /// Test-only — synthesize an emit without an engine. Lets tests
  /// verify the throttle + JS listener guards.
  func _testEmit(_ value: Float) {
    maybeEmit(value: value)
  }

  func _resetEmitTimer() {
    lastEmitAt = 0
  }

  func _setListenerAttached(_ attached: Bool) {
    hasJSListener = attached
  }
}
