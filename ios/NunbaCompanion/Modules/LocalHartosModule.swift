//
//  LocalHartosModule.swift
//  NunbaCompanion
//
//  iOS sibling of Android localhartos/LocalHartosModule.java.
//
//  Bridges JS-side compute-policy queries to native readings:
//
//    getLocalStatus()           — is local LLM service running?
//    checkComputeConditions()   — battery/thermal/RAM gates
//
//  iOS-specific divergences from Android:
//
//    • There is no on-device llama.cpp service running on iOS in this
//      build. Model management methods are stubs that return "no model
//      installed" — they preserve the JS contract so computePolicy.js
//      cleanly falls through to LAN/WAN/cloud tiers without crashing.
//      A future XCFramework-wrapped llama.cpp build can fill these in.
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

  // MARK: — Model management stubs (no on-device LLM in this build)

  @objc(getModelCatalog:rejecter:)
  func getModelCatalog(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    // Empty catalog — no on-device model in this build. JS layer
    // treats this as "no local model available" and routes to cloud.
    resolve([])
  }

  @objc(getRecommendedModel:rejecter:)
  func getRecommendedModel(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(NSNull())
  }

  @objc(downloadModel:resolver:rejecter:)
  func downloadModel(
    _ modelId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    reject(
      "LOCAL_LLM_UNAVAILABLE",
      "On-device LLM not available in this iOS build. Use cloud tier.",
      nil
    )
  }

  @objc(cancelDownload:rejecter:)
  func cancelDownload(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(false)
  }

  @objc(deleteModel:resolver:rejecter:)
  func deleteModel(
    _ modelId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(false)
  }

  @objc(startLocal:resolver:rejecter:)
  func startLocal(
    _ modelId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    reject(
      "LOCAL_LLM_UNAVAILABLE",
      "On-device LLM not available in this iOS build. Use cloud tier.",
      nil
    )
  }

  @objc(stopLocal:rejecter:)
  func stopLocal(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(true)
  }

  @objc(isLocalRunning:rejecter:)
  func isLocalRunning(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Self.fetchHealthStatus { status in
      resolve(status.serviceRunning)
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
