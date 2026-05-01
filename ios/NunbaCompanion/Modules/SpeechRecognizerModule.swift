//
//  SpeechRecognizerModule.swift
//  NunbaCompanion
//
//  iOS sibling of Android mic/SpeechRecognizerModule.java.
//
//  iOS uses the Speech framework (SFSpeechRecognizer + on-device
//  transcription on iOS 13+ / Apple Silicon Macs). Differences from
//  Android's SpeechRecognizer:
//
//    • Permission model: TWO permissions required at runtime —
//      Speech Recognition (NSSpeechRecognitionUsageDescription) +
//      Microphone (NSMicrophoneUsageDescription).
//    • Result shape: SFSpeechRecognitionResult exposes incremental
//      `bestTranscription` updates for partial results, mirroring
//      Android's onPartialResults / onResults.
//    • Timeouts: SFSpeechRecognitionTask has a default timeout of
//      ~1min idle; we don't customize.
//    • Locale: caller-provided BCP-47 (e.g., "en-US"); falls back
//      to the system default if recognizer for that locale is
//      unavailable.
//
//  JS contract:
//      start(locale)             — request permissions, begin
//      stop()                    — finalize current task
//      DeviceEvent 'speechPartial' { transcript: String, isFinal: false }
//      DeviceEvent 'speechResult' { transcript: String, isFinal: true }
//      DeviceEvent 'speechError'  { code: String, message: String }
//

import Foundation
import Speech
import AVFoundation
import React

@objc(SpeechRecognizerModule)
final class SpeechRecognizerModule: RCTEventEmitter {

  private var recognizer: SFSpeechRecognizer?
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private let engine = AVAudioEngine()

  private var hasJSListener = false
  private(set) var isRunning = false

  override func supportedEvents() -> [String] {
    ["speechPartial", "speechResult", "speechError"]
  }

  override static func requiresMainQueueSetup() -> Bool { false }

  override func startObserving() { hasJSListener = true }
  override func stopObserving() { hasJSListener = false }

  // MARK: — JS-callable

  /// Start recognition. Idempotent — calling while already running
  /// is a no-op.
  /// - Parameter locale: BCP-47 string ("en-US", "hi-IN", etc.).
  ///   nil/empty falls back to system default.
  @objc(start:)
  func start(_ locale: NSString) {
    guard !isRunning else { return }

    // Request both permissions sequentially. Speech first because
    // its denial is more user-visible (the OS prompt is distinct).
    SFSpeechRecognizer.requestAuthorization { [weak self] status in
      guard let self else { return }
      guard status == .authorized else {
        self.emitError(code: "SPEECH_PERMISSION_DENIED",
                       message: "Speech recognition permission denied")
        return
      }
      // AVAudioApplication.requestRecordPermission is iOS 17+ only;
      // we deploy to iOS 15. Branch by availability so the build
      // succeeds AND iOS 15/16 users still see the prompt.
      let micGranted: (Bool) -> Void = { granted in
        guard granted else {
          self.emitError(code: "MIC_PERMISSION_DENIED",
                         message: "Microphone permission denied")
          return
        }
        self.startRecognition(localeString: locale as String)
      }
      if #available(iOS 17.0, *) {
        AVAudioApplication.requestRecordPermission(completionHandler: micGranted)
      } else {
        AVAudioSession.sharedInstance().requestRecordPermission(micGranted)
      }
    }
  }

  @objc func stop() {
    guard isRunning else { return }
    isRunning = false

    request?.endAudio()
    task?.cancel()
    task = nil
    request = nil

    if engine.isRunning {
      engine.inputNode.removeTap(onBus: 0)
      engine.stop()
    }
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  // MARK: — Recognition pipeline

  private func startRecognition(localeString: String) {
    let locale: Locale
    if localeString.isEmpty {
      locale = Locale.current
    } else {
      locale = Locale(identifier: localeString)
    }

    guard let recognizer = SFSpeechRecognizer(locale: locale), recognizer.isAvailable else {
      emitError(code: "RECOGNIZER_UNAVAILABLE",
                message: "No SFSpeechRecognizer for locale \(localeString)")
      return
    }
    self.recognizer = recognizer

    // Audio session: record-only is enough; we don't play back.
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.record, mode: .measurement, options: .duckOthers)
      try session.setActive(true, options: .notifyOthersOnDeactivation)
    } catch {
      emitError(code: "AUDIO_SESSION_FAILED", message: error.localizedDescription)
      return
    }

    let req = SFSpeechAudioBufferRecognitionRequest()
    req.shouldReportPartialResults = true
    self.request = req

    task = recognizer.recognitionTask(with: req) { [weak self] result, error in
      guard let self else { return }
      if let result {
        let transcript = result.bestTranscription.formattedString
        if result.isFinal {
          self.emit(name: "speechResult",
                    body: ["transcript": transcript, "isFinal": true])
          self.stop()
        } else {
          self.emit(name: "speechPartial",
                    body: ["transcript": transcript, "isFinal": false])
        }
      }
      if let error {
        self.emitError(code: "RECOGNITION_ERROR",
                       message: error.localizedDescription)
        self.stop()
      }
    }

    let input = engine.inputNode
    let format = input.outputFormat(forBus: 0)
    input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
      self?.request?.append(buffer)
    }

    engine.prepare()
    do {
      try engine.start()
      isRunning = true
    } catch {
      emitError(code: "ENGINE_START_FAILED", message: error.localizedDescription)
      stop()
    }
  }

  // MARK: — Helpers

  private func emit(name: String, body: [String: Any]) {
    guard hasJSListener else { return }
    sendEvent(withName: name, body: body)
  }

  private func emitError(code: String, message: String) {
    NSLog("[SpeechRecognizerModule] \(code): \(message)")
    emit(name: "speechError", body: ["code": code, "message": message])
  }

  // MARK: — Test affordances

  /// Test-only — feed a synthetic event into the emit path so unit
  /// tests can verify the JS-listener guard without invoking the
  /// recognizer.
  func _testEmit(name: String, body: [String: Any]) {
    emit(name: name, body: body)
  }

  func _setListenerAttached(_ attached: Bool) {
    hasJSListener = attached
  }
}
