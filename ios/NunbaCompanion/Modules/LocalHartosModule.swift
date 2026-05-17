//
//  LocalHartosModule.swift
//  NunbaCompanion
//
//  iOS sibling of Android localhartos/LocalHartosModule.java.
//
//  Bridges JS-side compute-policy queries to native readings:
//
//    getLocalStatus()           — is local LLM running (HTTP or in-process)
//    checkComputeConditions()   — battery/thermal/RAM gates
//    getModelCatalog()          — known GGUF models we know how to run
//    getRecommendedModel()      — default for first-launch
//    downloadModel(id)          — kick off background GGUF fetch
//    cancelDownload()           — abort in-progress download
//    deleteModel(id)            — wipe a cached model from disk
//    startLocal(id)             — load model into LocalInferenceEngine
//    stopLocal()                — unload the engine
//    isLocalRunning()           — engine loaded OR HTTP /health is up
//    generate(prompt,maxTokens) — single-shot inference, returns text
//    getAvailableStorage()      — bytes free on documents volume
//
//  Architecture (post Hevolve→Nunba consolidation):
//
//    • LocalInferenceEngine.swift  — actor wrapping llama.cpp.
//    • LlamaModelManager.swift     — GGUF download/cache manager.
//    • This module                — RN bridge + compute-policy gates.
//
//  Inference runs in-process — there is no separate HTTP server like
//  Android's LocalHttpServer.kt (yet).  ``getLocalStatus`` therefore
//  reports the union of two signals:
//    1. The in-process LocalInferenceEngine.shared.isLoaded.
//    2. (Legacy) An HTTP probe to http://localhost:6777/health for
//       dev/test setups that run a Python sidecar.
//
//  iOS-specific divergences from Android:
//
//    • Inference runs IN the RN process (no Python sidecar).  The
//      JS layer's computePolicy.js doesn't need to care — same
//      `activeModel='local'` signal either way.
//    • Battery monitoring requires UIDevice.isBatteryMonitoringEnabled
//      = true; we enable it on first checkComputeConditions call and
//      leave it on (cost is negligible, ~1mAh/hr per Apple docs).
//    • RAM availability uses host_statistics64 / vm_statistics64_data_t.
//      A more conservative bound than the JVM ActivityManager.MemoryInfo
//      Android reads — iOS reports free + inactive page counts.
//

import Foundation
import UIKit
import React

@objc(LocalHartosModule)
final class LocalHartosModule: NSObject {

  /// Local Hartos default URL — must match the shared JS expectation
  /// (computePolicy.js uses 'http://localhost:6777' for tier 1).
  static let localBaseURL = URL(string: "http://localhost:6777")!

  /// Conditions thresholds — mirror Android contract:
  /// computePolicy.js documents "Battery ≥40% OR charging, no
  /// power-save, thermal OK, RAM ≥1200MB". We surface the same
  /// rules here so behavior across platforms stays consistent.
  static let minBatteryPct: Double = 40.0
  static let minRamAvailableMb: Double = 1200.0

  @objc static func requiresMainQueueSetup() -> Bool { false }

  // MARK: — getLocalStatus

  /// Hits the local Hartos /health endpoint with a 500ms timeout.
  /// Mirror of computePolicy.js HTTP-fallback shape so the JS layer
  /// gets the same 4 keys regardless of whether a native model
  /// catalog exists.
  @objc(getLocalStatus:rejecter:)
  func getLocalStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Self.fetchHealthStatus { status in
      resolve(status.toDictionary())
    }
  }

  /// Pure helper for tests + non-bridge callers.
  ///
  /// Uses a dedicated ephemeral URLSession with bounded timeouts
  /// so a busy CI runner can't queue-starve the request past the
  /// XCTest wait deadline. URLSession.shared shares timers with
  /// other in-flight requests, which has been observed flaky on
  /// macos-15 simulators.
  static func fetchHealthStatus(
    session: URLSession? = nil,
    timeout: TimeInterval = 0.5,
    completion: @escaping (LocalStatus) -> Void
  ) {
    let usedSession: URLSession = {
      if let session { return session }
      let cfg = URLSessionConfiguration.ephemeral
      cfg.timeoutIntervalForRequest = timeout
      cfg.timeoutIntervalForResource = timeout * 2
      return URLSession(configuration: cfg)
    }()

    var req = URLRequest(url: localBaseURL.appendingPathComponent("health"))
    req.timeoutInterval = timeout

    let task = usedSession.dataTask(with: req) { data, response, error in
      guard error == nil,
            let http = response as? HTTPURLResponse,
            http.statusCode == 200,
            let data,
            let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
      else {
        completion(.notRunning)
        return
      }

      // Match Android's parse: data.llama_health?.status === 'ok' → activeModel='local'
      let llamaOk = (json["llama_health"] as? [String: Any])?["status"] as? String == "ok"
      let activeModel = llamaOk ? "local" : nil

      completion(LocalStatus(
        serviceRunning: true,
        modelDownloaded: activeModel != nil,
        activeModel: activeModel,
        modelSizeMb: 550   // Android assumes 0.8B if health passes; same here.
      ))
    }
    task.resume()

    // Hard cancellation deadline as a safety net — if the task
    // never even starts (queue starvation), cancel after timeout
    // so the completion fires with .notRunning rather than
    // hanging the test forever.
    DispatchQueue.global().asyncAfter(deadline: .now() + timeout + 0.1) { [weak task] in
      task?.cancel()
    }
  }

  struct LocalStatus {
    let serviceRunning: Bool
    let modelDownloaded: Bool
    let activeModel: String?
    let modelSizeMb: Int

    static let notRunning = LocalStatus(
      serviceRunning: false, modelDownloaded: false,
      activeModel: nil, modelSizeMb: 0
    )

    func toDictionary() -> [String: Any] {
      [
        "serviceRunning": serviceRunning,
        "modelDownloaded": modelDownloaded,
        "activeModel": activeModel as Any? ?? NSNull(),
        "modelSizeMb": modelSizeMb,
      ]
    }
  }

  // MARK: — checkComputeConditions

  /// Returns a dict matching the Android shape:
  ///   { canRun: Bool, reason?: String, batteryPct: Double,
  ///     isCharging: Bool, thermalOk: Bool, ramAvailableMb: Double }
  ///
  /// computePolicy.js consults this BEFORE routing to LOCAL tier 1.
  /// Conservative: we return canRun=false unless ALL conditions hold.
  @objc(checkComputeConditions:rejecter:)
  func checkComputeConditions(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(Self.computeConditions())
  }

  static func computeConditions() -> [String: Any] {
    // UIDevice mutations are documented main-thread-only. RN
    // promises run on the JS thread; XCTest's wait() can spin
    // nested run loops on other queues. Bounce to main here so
    // we never trip an UIKit thread assertion on busy CI runners.
    if !Thread.isMainThread {
      return DispatchQueue.main.sync { computeConditions() }
    }
    // Battery monitoring is opt-in on iOS; turning it on is cheap.
    UIDevice.current.isBatteryMonitoringEnabled = true

    var batteryPct = Double(UIDevice.current.batteryLevel) * 100.0
    var isCharging = UIDevice.current.batteryState == .charging
                    || UIDevice.current.batteryState == .full

    // Simulator workaround (review H8): UIDevice.batteryLevel returns
    // -1 on the iOS Simulator (no battery). Without an override the
    // computePolicy.js LOCAL tier is unreachable in dev/CI. Treat
    // simulator as "always healthy" so the local-tier path is
    // testable. Real devices fall through to actual readings.
    #if targetEnvironment(simulator)
    if batteryPct < 0 {
      batteryPct = 100
      isCharging = true
    }
    #endif

    let thermalOk = ProcessInfo.processInfo.thermalState != .serious
                  && ProcessInfo.processInfo.thermalState != .critical
    let ramAvailableMb = availableRamMb()

    var reasons: [String] = []
    if batteryPct < minBatteryPct && !isCharging {
      reasons.append("battery \(Int(batteryPct))% not charging")
    }
    if !thermalOk {
      reasons.append("thermal \(thermalLabel())")
    }
    if ramAvailableMb < minRamAvailableMb {
      reasons.append("RAM \(Int(ramAvailableMb))MB < \(Int(minRamAvailableMb))MB")
    }

    let canRun = reasons.isEmpty

    var dict: [String: Any] = [
      "canRun": canRun,
      "batteryPct": batteryPct,
      "isCharging": isCharging,
      "thermalOk": thermalOk,
      "ramAvailableMb": ramAvailableMb,
    ]
    if !reasons.isEmpty {
      dict["reason"] = reasons.joined(separator: ", ")
    }
    return dict
  }

  /// Human-readable label for the current thermal state.
  private static func thermalLabel() -> String {
    switch ProcessInfo.processInfo.thermalState {
    case .nominal: return "nominal"
    case .fair: return "fair"
    case .serious: return "serious"
    case .critical: return "critical"
    @unknown default: return "unknown"
    }
  }

  /// Available physical RAM in MB. Uses host_statistics64 with
  /// vm_statistics64_data_t — the canonical iOS approach.
  /// Returns 0 on error.
  static func availableRamMb() -> Double {
    var info = vm_statistics64_data_t()
    var count = mach_msg_type_number_t(MemoryLayout.size(ofValue: info) / MemoryLayout<integer_t>.size)
    let result = withUnsafeMutablePointer(to: &info) {
      $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
        host_statistics64(mach_host_self(), HOST_VM_INFO64, $0, &count)
      }
    }
    guard result == KERN_SUCCESS else { return 0 }

    let pageSize = vm_kernel_page_size
    let freePages = UInt64(info.free_count) + UInt64(info.inactive_count)
    let freeBytes = freePages * UInt64(pageSize)
    return Double(freeBytes) / (1024.0 * 1024.0)
  }

  // MARK: — Model management (backed by LocalInferenceEngine + LlamaModelManager)
  //
  // Replaces the previous stub block.  All methods delegate to the
  // ported HevolveLocal scaffold (LocalInferenceEngine.swift +
  // LlamaModelManager.swift).  Until the llama.cpp xcframework is
  // dropped under ios/Frameworks/, ``generate`` returns a clearly-
  // labelled placeholder string ("[NunbaLocal scaffold]…") rather
  // than failing — same contract HevolveLocal had so end-to-end JS
  // tests pass before the Mac-side framework build runs.

  /// Catalog of GGUF models we know how to run on-device.  Currently
  /// a single entry (Qwen3-0.8B Q4_K_M).  Shape mirrors Android's
  /// LocalHartosModule.getModelCatalog so JS treats both platforms
  /// identically.
  @objc(getModelCatalog:rejecter:)
  func getModelCatalog(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve([ModelDescriptor.qwen3_08b_q4.toJSDict()])
  }

  @objc(getRecommendedModel:rejecter:)
  func getRecommendedModel(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(ModelDescriptor.qwen3_08b_q4.toJSDict())
  }

  /// Resolve a model id to its descriptor.  Currently a 1-entry
  /// lookup; will expand when the catalog grows.
  static func descriptor(for id: String) -> ModelDescriptor? {
    switch id {
    case ModelDescriptor.qwen3_08b_q4.id: return .qwen3_08b_q4
    default: return nil
    }
  }

  @objc(downloadModel:resolver:rejecter:)
  func downloadModel(
    _ modelId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let desc = Self.descriptor(for: modelId) else {
      reject("UNKNOWN_MODEL", "Unknown model id: \(modelId)", nil)
      return
    }
    Task { @MainActor in
      LlamaModelManager.shared.ensureDownloaded(desc)
      // The download runs in the background URLSession; JS polls
      // getLocalStatus() / getModelStatus() for progress.  TODO:
      // once an RCTEventEmitter sibling is added, push the
      // .downloading / .ready / .failed states up as events.
      resolve([
        "started": true,
        "modelId": modelId,
        "sizeBytes": desc.sizeBytes,
      ])
    }
  }

  @objc(cancelDownload:rejecter:)
  func cancelDownload(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      LlamaModelManager.shared.cancel()
      resolve(true)
    }
  }

  @objc(deleteModel:resolver:rejecter:)
  func deleteModel(
    _ modelId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      // If the engine is currently using this model, unload first so
      // the file is closed before we delete it (Foundation tolerates
      // unlinking an open file on iOS, but better hygiene).
      let info = await LocalInferenceEngine.shared.info
      if let info, info.path.lastPathComponent.hasPrefix(modelId) {
        await LocalInferenceEngine.shared.unload()
      }
      let removed = LlamaModelManager.shared.deleteCached(id: modelId)
      resolve(removed)
    }
  }

  /// Load a model into the inference engine.  After this returns
  /// successfully, ``isLocalRunning`` reports true and ``generate``
  /// can be called.
  @objc(startLocal:resolver:rejecter:)
  func startLocal(
    _ modelId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let _ = Self.descriptor(for: modelId) else {
      reject("UNKNOWN_MODEL", "Unknown model id: \(modelId)", nil)
      return
    }
    Task {
      do {
        let path = await MainActor.run {
          LlamaModelManager.shared.cachedFileURL(for: modelId)
        }
        guard FileManager.default.fileExists(atPath: path.path) else {
          reject(
            "MODEL_NOT_DOWNLOADED",
            "Model \(modelId) not downloaded; call downloadModel first.",
            nil
          )
          return
        }
        try await LocalInferenceEngine.shared.loadModel(at: path)
        let info = await LocalInferenceEngine.shared.info
        resolve([
          "loaded": true,
          "modelId": modelId,
          "name": info?.name ?? "",
          "contextSize": info?.contextSize ?? 0,
        ])
      } catch {
        reject("LOAD_FAILED", error.localizedDescription, error)
      }
    }
  }

  @objc(stopLocal:rejecter:)
  func stopLocal(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      await LocalInferenceEngine.shared.unload()
      resolve(true)
    }
  }

  /// Reports true when EITHER the in-process inference engine has a
  /// model loaded OR a localhost:6777 HTTP server is responding
  /// (legacy / Python-sidecar dev setups).  computePolicy.js only
  /// cares about the union — it routes to tier 1 in either case.
  @objc(isLocalRunning:rejecter:)
  func isLocalRunning(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      let engineUp = await LocalInferenceEngine.shared.isLoaded
      if engineUp {
        resolve(true)
        return
      }
      // Fall back to the legacy HTTP probe so dev setups running a
      // Python sidecar at :6777 still report running.
      Self.fetchHealthStatus { status in
        resolve(status.serviceRunning)
      }
    }
  }

  /// Single-shot inference.  Returns ``{ text: String }`` on success.
  /// Until the llama.cpp xcframework lands, ``text`` is a clearly-
  /// labelled scaffold placeholder so JS end-to-end tests don't
  /// block on the Mac-side framework build.
  @objc(generate:maxTokens:resolver:rejecter:)
  func generate(
    _ prompt: String,
    maxTokens: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task {
      do {
        let reply = try await LocalInferenceEngine.shared.generate(
          prompt: prompt,
          maxTokens: maxTokens.intValue
        )
        resolve(["text": reply])
      } catch {
        reject("GENERATE_FAILED", error.localizedDescription, error)
      }
    }
  }

  // MARK: — Storage

  /// Available storage at the user's documents-mount, in bytes.
  @objc(getAvailableStorage:rejecter:)
  func getAvailableStorage(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(Self.availableStorageBytes())
  }

  static func availableStorageBytes() -> Int64 {
    let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
    guard let url else { return 0 }
    let values = try? url.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
    return values?.volumeAvailableCapacityForImportantUsage ?? 0
  }
}
