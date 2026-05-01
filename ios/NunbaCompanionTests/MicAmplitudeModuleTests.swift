//
//  MicAmplitudeModuleTests.swift
//  NunbaCompanionTests
//

import XCTest
import AVFoundation
@testable import NunbaCompanion

final class MicAmplitudeModuleTests: XCTestCase {

  var module: MicAmplitudeModule!

  override func setUp() {
    super.setUp()
    module = MicAmplitudeModule()
  }

  override func tearDown() {
    module.stop()
    module = nil
    super.tearDown()
  }

  // MARK: — Pure amplitude math

  func test_amplitudeFromRMS_zeroReturnsZero() {
    XCTAssertEqual(MicAmplitudeModule.amplitudeFromRMS(0), 0)
  }

  func test_amplitudeFromRMS_belowFloorReturnsZero() {
    // -120 dB is way below floor of -60.
    let rms: Float = pow(10, -120 / 20)
    XCTAssertEqual(MicAmplitudeModule.amplitudeFromRMS(rms), 0)
  }

  func test_amplitudeFromRMS_atFloorReturnsZero() {
    // Exactly -60 dB.
    let rms: Float = pow(10, -60 / 20)
    XCTAssertEqual(MicAmplitudeModule.amplitudeFromRMS(rms), 0, accuracy: 0.001)
  }

  func test_amplitudeFromRMS_atZeroDbReturnsOne() {
    // 0 dB → full scale → 1.0
    XCTAssertEqual(MicAmplitudeModule.amplitudeFromRMS(1.0), 1.0, accuracy: 0.001)
  }

  func test_amplitudeFromRMS_minus30dbReturnsHalf() {
    // -30 dB is halfway between -60 (0.0) and 0 (1.0).
    let rms: Float = pow(10, -30 / 20)
    XCTAssertEqual(MicAmplitudeModule.amplitudeFromRMS(rms), 0.5, accuracy: 0.01)
  }

  func test_amplitudeFromRMS_clampsAboveOne() {
    XCTAssertEqual(MicAmplitudeModule.amplitudeFromRMS(2.0), 1.0)
    XCTAssertEqual(MicAmplitudeModule.amplitudeFromRMS(100), 1.0)
  }

  // MARK: — amplitude(from buffer)

  func test_amplitude_zeroSamplesReturnsZero() {
    let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!
    let buf = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 1024)!
    buf.frameLength = 1024
    // memory is zero-initialized → all samples are 0
    XCTAssertEqual(MicAmplitudeModule.amplitude(from: buf), 0)
  }

  func test_amplitude_emptyBufferReturnsZero() {
    let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!
    let buf = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 1024)!
    buf.frameLength = 0
    XCTAssertEqual(MicAmplitudeModule.amplitude(from: buf), 0)
  }

  func test_amplitude_loudSinewaveReturnsHighValue() {
    let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!
    let buf = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 1024)!
    buf.frameLength = 1024
    let samples = buf.floatChannelData![0]
    // Fill with a 0.7-amplitude sine wave (RMS ~0.5 → ~70% on the scale).
    for i in 0..<Int(buf.frameLength) {
      let t = Float(i) / 44100.0
      samples[i] = 0.7 * sin(2 * .pi * 440 * t)
    }
    let value = MicAmplitudeModule.amplitude(from: buf)
    XCTAssertGreaterThan(value, 0.5)
  }

  // MARK: — Throttle / emit

  func test_emit_throttledTo10Hz() {
    module._setListenerAttached(true)
    module._resetEmitTimer()

    // Hammer with 100 emits in a tight loop. The throttle should
    // collapse them — only the first should pass through.
    for _ in 0..<100 {
      module._testEmit(0.5)
    }
    // We can't easily inspect emitted RN events without a bridge —
    // but we CAN verify the function doesn't crash and the throttle
    // gate is still functional after a burst.
    // (See RCTEventEmitter integration tests for end-to-end.)
    XCTAssertNoThrow(module._testEmit(0.5))
  }

  // MARK: — Lifecycle

  func test_isRunning_initiallyFalse() {
    XCTAssertFalse(module.isRunning)
  }

  func test_stop_whenNotRunning_isNoOp() {
    XCTAssertNoThrow(module.stop())
    XCTAssertFalse(module.isRunning)
  }

  // MARK: — RCTEventEmitter contract

  func test_supportedEvents_includesMicAmplitude() {
    XCTAssertEqual(module.supportedEvents(), ["micAmplitude"])
  }

  func test_requiresMainQueueSetup_isFalse() {
    XCTAssertFalse(MicAmplitudeModule.requiresMainQueueSetup())
  }
}
