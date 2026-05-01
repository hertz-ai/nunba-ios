//
//  LocalHartosModuleTests.swift
//  NunbaCompanionTests
//

import XCTest
@testable import NunbaCompanion

final class LocalHartosModuleTests: XCTestCase {

  var module: LocalHartosModule!

  override func setUp() {
    super.setUp()
    module = LocalHartosModule()
  }

  override func tearDown() {
    module = nil
    super.tearDown()
  }

  // MARK: — getLocalStatus

  func test_getLocalStatus_returnsNotRunningWhenServerAbsent() {
    // Real network call to localhost:6777/health. No server is running
    // in the test sim, so the request times out → notRunning.
    let exp = expectation(description: "promise resolves")
    module.getLocalStatus({ result in
      let dict = result as? [String: Any] ?? [:]
      XCTAssertEqual(dict["serviceRunning"] as? Bool, false)
      XCTAssertEqual(dict["modelDownloaded"] as? Bool, false)
      XCTAssertEqual(dict["modelSizeMb"] as? Int, 0)
      // activeModel is NSNull when not running.
      XCTAssertTrue(dict["activeModel"] is NSNull)
      exp.fulfill()
    }, rejecter: { _, _, _ in
      XCTFail("getLocalStatus must never reject")
    })
    wait(for: [exp], timeout: 3.0)
  }

  func test_localStatus_notRunning_constant() {
    let s = LocalHartosModule.LocalStatus.notRunning
    XCTAssertFalse(s.serviceRunning)
    XCTAssertFalse(s.modelDownloaded)
    XCTAssertNil(s.activeModel)
    XCTAssertEqual(s.modelSizeMb, 0)
  }

  func test_localStatus_toDictionary_shape() {
    let s = LocalHartosModule.LocalStatus(
      serviceRunning: true, modelDownloaded: true,
      activeModel: "local", modelSizeMb: 550
    )
    let dict = s.toDictionary()
    XCTAssertEqual(dict["serviceRunning"] as? Bool, true)
    XCTAssertEqual(dict["modelDownloaded"] as? Bool, true)
    XCTAssertEqual(dict["activeModel"] as? String, "local")
    XCTAssertEqual(dict["modelSizeMb"] as? Int, 550)
  }

  func test_localStatus_toDictionary_nilActiveModelBecomesNSNull() {
    let s = LocalHartosModule.LocalStatus.notRunning
    let dict = s.toDictionary()
    XCTAssertTrue(dict["activeModel"] is NSNull,
                  "RN bridge requires NSNull for nil — JS sees null, not undefined")
  }

  // MARK: — checkComputeConditions

  func test_checkComputeConditions_returnsAllExpectedKeys() {
    let conds = LocalHartosModule.computeConditions()
    let expected: Set<String> = [
      "canRun", "batteryPct", "isCharging", "thermalOk", "ramAvailableMb",
    ]
    XCTAssertTrue(expected.isSubset(of: Set(conds.keys)))
  }

  func test_checkComputeConditions_onSimulator_canRunMayBeFalse() {
    // Simulators always report battery -1 (no battery) so batteryPct
    // becomes -100. This test just verifies the function returns
    // structurally valid output without crashing — actual values
    // depend on the runtime environment.
    let conds = LocalHartosModule.computeConditions()
    XCTAssertNotNil(conds["canRun"] as? Bool)
    XCTAssertNotNil(conds["batteryPct"] as? Double)
    XCTAssertNotNil(conds["isCharging"] as? Bool)
    XCTAssertNotNil(conds["thermalOk"] as? Bool)
    XCTAssertNotNil(conds["ramAvailableMb"] as? Double)
  }

  func test_checkComputeConditions_includesReasonWhenCannotRun() {
    let conds = LocalHartosModule.computeConditions()
    if let canRun = conds["canRun"] as? Bool, !canRun {
      XCTAssertNotNil(conds["reason"] as? String,
                      "When canRun=false, a human-readable reason MUST be present")
    }
    // If canRun=true (real device, charging, cool, lots of RAM),
    // 'reason' is optional and may be absent. Both are valid.
  }

  func test_checkComputeConditions_thermalOkReadsProcessInfo() {
    let conds = LocalHartosModule.computeConditions()
    let thermalOk = conds["thermalOk"] as? Bool ?? false
    let actual = ProcessInfo.processInfo.thermalState
    let expected = actual != .serious && actual != .critical
    XCTAssertEqual(thermalOk, expected)
  }

  // MARK: — Model management stubs (no on-device LLM in this build)

  func test_getModelCatalog_returnsEmptyArray() {
    let exp = expectation(description: "")
    module.getModelCatalog({ result in
      XCTAssertEqual((result as? [Any])?.count, 0)
      exp.fulfill()
    }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp], timeout: 1.0)
  }

  func test_getRecommendedModel_returnsNull() {
    let exp = expectation(description: "")
    module.getRecommendedModel({ result in
      XCTAssertTrue(result is NSNull,
                    "No recommended model in this build — JS expects null")
      exp.fulfill()
    }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp], timeout: 1.0)
  }

  func test_downloadModel_rejectsWithLocalLLMUnavailable() {
    let exp = expectation(description: "rejects")
    module.downloadModel("any-model-id", resolve: { _ in
      XCTFail("Should not resolve — local LLM unavailable in this build")
    }, rejecter: { code, message, _ in
      XCTAssertEqual(code, "LOCAL_LLM_UNAVAILABLE")
      XCTAssertNotNil(message)
      exp.fulfill()
    })
    wait(for: [exp], timeout: 1.0)
  }

  func test_startLocal_rejectsWithLocalLLMUnavailable() {
    let exp = expectation(description: "rejects")
    module.startLocal("any-model-id", resolve: { _ in
      XCTFail("Should not resolve")
    }, rejecter: { code, _, _ in
      XCTAssertEqual(code, "LOCAL_LLM_UNAVAILABLE")
      exp.fulfill()
    })
    wait(for: [exp], timeout: 1.0)
  }

  func test_stopLocal_resolvesTrue() {
    // Stopping a non-running service is a no-op success.
    let exp = expectation(description: "")
    module.stopLocal({ result in
      XCTAssertEqual(result as? Bool, true)
      exp.fulfill()
    }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp], timeout: 1.0)
  }

  // MARK: — Storage

  func test_availableStorageBytes_returnsPositive() {
    let bytes = LocalHartosModule.availableStorageBytes()
    XCTAssertGreaterThan(bytes, 0,
                         "iOS Simulator + real device both have nonzero free space")
  }

  func test_getAvailableStorage_resolvesPositive() {
    let exp = expectation(description: "")
    module.getAvailableStorage({ result in
      let bytes = result as? Int64 ?? 0
      XCTAssertGreaterThan(bytes, 0)
      exp.fulfill()
    }, rejecter: { _, _, _ in XCTFail() })
    wait(for: [exp], timeout: 1.0)
  }

  // MARK: — RAM probe (host_statistics64)

  func test_availableRamMb_returnsReasonableValue() {
    let mb = LocalHartosModule.availableRamMb()
    // Even pressured simulators report >50MB free pages.
    XCTAssertGreaterThan(mb, 50, "Simulator should always have some free pages")
    // Sanity upper bound — Mac M3 Max has 128GB; simulator process
    // wouldn't see more than the host's free pool.
    XCTAssertLessThan(mb, 200_000)
  }

  // MARK: — RN bridge contract

  func test_requiresMainQueueSetup_isFalse() {
    XCTAssertFalse(LocalHartosModule.requiresMainQueueSetup())
  }
}
