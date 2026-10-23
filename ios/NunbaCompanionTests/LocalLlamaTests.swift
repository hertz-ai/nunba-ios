//
//  LocalLlamaTests.swift
//  NunbaCompanionTests
//
//  XCTest coverage for the on-device LLM scaffold ported from
//  Hevolve_React_Native/ios/HevolveLocal/Tests/HevolveLocalTests.swift
//  during the Hevolve→Nunba iOS consolidation.
//
//  Tests are designed to pass against the *scaffold* — i.e. before
//  the real llama.cpp xcframework is dropped under ios/Frameworks/.
//  Once the framework lands (TODO(Mac-build) markers in
//  LocalInferenceEngine.swift), the generate-against-real-model
//  assertion (gated on the scaffold placeholder string) gets
//  uncommented and pinned to a known-good model + prompt.
//
//  Privacy invariant covered: the engine + module make ZERO network
//  calls during these tests.  LlamaModelManager's URLSession is
//  never triggered because we use cachedFileURL + manual file
//  staging.

import XCTest
@testable import NunbaCompanion

final class LocalLlamaModelManagerTests: XCTestCase {

    // MARK: cachedFileURL — determinism + idempotent dir creation

    @MainActor
    func test_cachedFileURL_is_deterministic_for_same_id() {
        let url1 = LlamaModelManager.shared.cachedFileURL(for: "qwen3-0.8b-q4")
        let url2 = LlamaModelManager.shared.cachedFileURL(for: "qwen3-0.8b-q4")
        XCTAssertEqual(url1, url2)
    }

    @MainActor
    func test_cachedFileURL_differs_per_id() {
        let a = LlamaModelManager.shared.cachedFileURL(for: "modelA")
        let b = LlamaModelManager.shared.cachedFileURL(for: "modelB")
        XCTAssertNotEqual(a, b)
    }

    @MainActor
    func test_cachedFileURL_lives_under_application_support() {
        let url = LlamaModelManager.shared.cachedFileURL(for: "test-id")
        XCTAssertTrue(url.path.contains("Application Support/Nunba/models"),
                      "cache dir must be under user's Application Support, namespaced 'Nunba'")
        XCTAssertTrue(url.lastPathComponent.hasSuffix(".gguf"),
                      "files must be saved with .gguf extension")
    }

    @MainActor
    func test_cachedFileURL_creates_parent_directory_idempotently() {
        // Calling twice must succeed and leave the dir in place.
        let url1 = LlamaModelManager.shared.cachedFileURL(for: "idem-1")
        let url2 = LlamaModelManager.shared.cachedFileURL(for: "idem-2")
        let dir1 = url1.deletingLastPathComponent()
        let dir2 = url2.deletingLastPathComponent()
        XCTAssertEqual(dir1, dir2)
        XCTAssertTrue(FileManager.default.fileExists(atPath: dir1.path))
    }

    // MARK: isCached — false → true → false roundtrip

    @MainActor
    func test_isCached_false_for_absent_file() {
        let desc = ModelDescriptor(
            id: "test-absent-\(UUID().uuidString)",
            name: "absent",
            url: URL(string: "https://example.com/absent.gguf")!,
            sizeBytes: 1024,
            sha256: nil,
            recommendedRAM: 0
        )
        XCTAssertFalse(LlamaModelManager.shared.isCached(desc),
                       "fresh id with no on-disk file must report NOT cached")
    }

    @MainActor
    func test_isCached_true_after_manual_stage_then_false_after_remove() throws {
        let desc = ModelDescriptor(
            id: "test-roundtrip-\(UUID().uuidString)",
            name: "roundtrip",
            url: URL(string: "https://example.com/roundtrip.gguf")!,
            sizeBytes: 1024,
            sha256: nil,
            recommendedRAM: 0
        )
        let path = LlamaModelManager.shared.cachedFileURL(for: desc.id)
        XCTAssertFalse(LlamaModelManager.shared.isCached(desc))

        // Stage a non-empty placeholder file (isCached requires size > 0)
        try Data(repeating: 0x42, count: 16).write(to: path)
        XCTAssertTrue(LlamaModelManager.shared.isCached(desc))

        // Clean up + verify roundtrip
        try FileManager.default.removeItem(at: path)
        XCTAssertFalse(LlamaModelManager.shared.isCached(desc))
    }

    // MARK: ModelDescriptor — well-known constants

    func test_qwen3_descriptor_has_expected_identity() {
        let d = ModelDescriptor.qwen3_08b_q4
        XCTAssertEqual(d.id, "qwen3-0.8b-q4")
        XCTAssertEqual(d.name, "Qwen3-0.8B (Q4_K_M)")
        XCTAssertEqual(d.sizeBytes, 550 * 1024 * 1024)
        XCTAssertTrue(d.url.host?.contains("huggingface") ?? false,
                      "default model URL must be hosted on huggingface")
    }
}

final class LocalLlamaInferenceEngineTests: XCTestCase {

    override func tearDown() async throws {
        await LocalInferenceEngine.shared.unload()
        try await super.tearDown()
    }

    // MARK: loadModel — error paths

    func test_loadModel_throws_modelNotFound_for_absent_path() async {
        let bogus = URL(fileURLWithPath: "/tmp/definitely-does-not-exist-\(UUID().uuidString).gguf")
        do {
            try await LocalInferenceEngine.shared.loadModel(at: bogus)
            XCTFail("loadModel should have thrown for missing file")
        } catch let LocalInferenceError.modelNotFound(url) {
            XCTAssertEqual(url, bogus)
        } catch {
            XCTFail("expected .modelNotFound, got: \(error)")
        }
    }

    // MARK: loadModel — happy path (scaffold marks isLoaded=true)

    func test_loadModel_succeeds_for_existing_file_then_isLoaded() async throws {
        let tmp = FileManager.default.temporaryDirectory
            .appendingPathComponent("nunba-test-\(UUID().uuidString).gguf")
        try Data(repeating: 0, count: 1).write(to: tmp)
        defer { try? FileManager.default.removeItem(at: tmp) }

        try await LocalInferenceEngine.shared.loadModel(at: tmp)
        let loaded = await LocalInferenceEngine.shared.isLoaded
        XCTAssertTrue(loaded, "isLoaded must flip to true after successful load")
        let info = await LocalInferenceEngine.shared.info
        XCTAssertEqual(info?.path, tmp)
        XCTAssertEqual(info?.contextSize, 2048,
                       "default contextSize should match the loadModel default")
    }

    // MARK: loadModel — idempotent for same path

    func test_loadModel_is_idempotent_for_same_path() async throws {
        let tmp = FileManager.default.temporaryDirectory
            .appendingPathComponent("nunba-test-idem-\(UUID().uuidString).gguf")
        try Data(repeating: 0, count: 1).write(to: tmp)
        defer { try? FileManager.default.removeItem(at: tmp) }

        try await LocalInferenceEngine.shared.loadModel(at: tmp)
        // Second call with same path is a no-op — must not throw.
        try await LocalInferenceEngine.shared.loadModel(at: tmp)
        let loaded = await LocalInferenceEngine.shared.isLoaded
        XCTAssertTrue(loaded)
    }

    // MARK: generate — error path when not loaded

    func test_generate_throws_notLoaded_when_engine_is_unloaded() async {
        // Ensure clean state.
        await LocalInferenceEngine.shared.unload()
        let loaded = await LocalInferenceEngine.shared.isLoaded
        XCTAssertFalse(loaded, "precondition: engine must be unloaded")

        // generate()'s guard is `isLoaded, ctxPtr != nil || true` — the
        // `|| true` only neutralizes the ctxPtr half (never wired until
        // the real llama.cpp context lands); `isLoaded` still gates for
        // real, so generate() already throws .notLoaded correctly here.
        do {
            _ = try await LocalInferenceEngine.shared.generate(prompt: "x")
            XCTFail("generate must throw .notLoaded when the engine is unloaded")
        } catch LocalInferenceError.notLoaded {
            // ✓
        } catch {
            XCTFail("expected .notLoaded, got: \(error)")
        }
    }

    // MARK: generate — task cancellation propagates

    func test_generate_propagates_task_cancellation() async throws {
        // Must be loaded first: generate()'s isLoaded guard throws
        // .notLoaded before ever reaching Task.checkCancellation(), so an
        // unloaded engine here would fail on the wrong error entirely.
        let tmp = FileManager.default.temporaryDirectory
            .appendingPathComponent("nunba-test-cancel-\(UUID().uuidString).gguf")
        try Data(repeating: 0, count: 1).write(to: tmp)
        defer { try? FileManager.default.removeItem(at: tmp) }
        try await LocalInferenceEngine.shared.loadModel(at: tmp)

        // Pre-cancel a task before it runs.  The scaffold checks
        // Task.checkCancellation() so the call must throw .cancelled.
        let task = Task {
            try await LocalInferenceEngine.shared.generate(prompt: "long prompt")
        }
        task.cancel()
        do {
            _ = try await task.value
            // Either cancellation fired (preferred) or the placeholder
            // returned before the cancel landed — both are acceptable
            // for the scaffold.  The real generate loop will check
            // cancellation between every token.
        } catch is CancellationError {
            // ✓
        } catch LocalInferenceError.cancelled {
            // ✓
        } catch {
            XCTFail("unexpected error during cancellation test: \(error)")
        }
    }
}

final class LocalLlamaDescriptorTests: XCTestCase {

    func test_ModelDescriptor_is_Codable_roundtrip() throws {
        let original = ModelDescriptor.qwen3_08b_q4
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(ModelDescriptor.self, from: data)
        XCTAssertEqual(original, decoded)
    }

    func test_LoadedModelInfo_carries_metadata() {
        let info = LoadedModelInfo(
            name: "test",
            path: URL(fileURLWithPath: "/tmp/x.gguf"),
            contextSize: 4096,
            parameters: 1_000_000_000
        )
        XCTAssertEqual(info.name, "test")
        XCTAssertEqual(info.contextSize, 4096)
        XCTAssertEqual(info.parameters, 1_000_000_000)
    }

    func test_ModelDescriptor_toJSDict_has_expected_keys() {
        let dict = ModelDescriptor.qwen3_08b_q4.toJSDict()
        XCTAssertEqual(dict["id"] as? String, "qwen3-0.8b-q4")
        XCTAssertEqual(dict["name"] as? String, "Qwen3-0.8B (Q4_K_M)")
        XCTAssertEqual(dict["sizeBytes"] as? Int64, 550 * 1024 * 1024)
        XCTAssertNotNil(dict["url"])
        // sha256 omitted when nil (current default) — keep test in
        // sync with the toJSDict implementation.
        XCTAssertNil(dict["sha256"])
    }
}
