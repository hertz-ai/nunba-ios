//
//  LocalInferenceEngine.swift
//  NunbaCompanion / LocalLlama
//
//  On-device LLM via llama.cpp xcframework.  Mirrors Android's
//  android/.../localhartos/LocalInferenceEngine.kt 1:1 so the JS-side
//  RN code can treat both platforms identically.
//
//  Privacy contract: this engine NEVER makes a network call.  All
//  inference happens on-device using the GGUF model loaded by
//  LlamaModelManager.  When this engine reports `isLoaded == true`,
//  the iOS-side base-URL resolver returns the on-device endpoint and
//  chat traffic stays on-device.
//
//  Threading: model load is one-shot blocking; generate(prompt:) is
//  cancellable via Swift Concurrency's task cancellation.  The llama
//  context itself is single-threaded — serialized via an actor.
//
//  Status: scaffold.  Mac dev runs:
//     1. Drop xcframework artifact under ios/Frameworks/
//     2. pod install
//     3. The bridging header conditionally imports <llama/llama.h>
//        via __has_include so non-Mac builds (and the simulator
//        without the framework dropped in) keep compiling without
//        the real header.
//
//  Ported from Hevolve_React_Native/ios/HevolveLocal/LocalInferenceEngine.swift
//  during the Hevolve→Nunba iOS consolidation.  Symbol + comment
//  renames only — no behavior change.

import Foundation

/// Lightweight metadata about a loaded model.
public struct LoadedModelInfo {
    public let name: String        // human-readable, e.g. "Qwen3-0.8B-Q4"
    public let path: URL           // GGUF file on disk
    public let contextSize: Int    // tokens
    public let parameters: Int64   // total parameter count, ~800_000_000
}

/// Errors surfaced to RN as { code: String, message: String }.
public enum LocalInferenceError: LocalizedError {
    case modelNotFound(URL)
    case modelLoadFailed(String)
    case notLoaded
    case generationFailed(String)
    case cancelled

    public var errorDescription: String? {
        switch self {
        case .modelNotFound(let u):       return "Model file not found at \(u.path)"
        case .modelLoadFailed(let m):     return "llama_load_model failed: \(m)"
        case .notLoaded:                  return "Model is not loaded — call loadModel() first"
        case .generationFailed(let m):    return "Generation failed: \(m)"
        case .cancelled:                  return "Generation was cancelled"
        }
    }
}

/// Single-instance actor — only one model loaded per process.
public actor LocalInferenceEngine {

    public static let shared = LocalInferenceEngine()

    public private(set) var isLoaded: Bool = false
    public private(set) var info: LoadedModelInfo? = nil

    // Opaque pointers to llama_model + llama_context.  Initialised
    // by loadModel(), released in unload().
    //
    // TODO(Mac-build): replace OpaquePointer? placeholders with the
    // real llama_model* / llama_context* once the bridging header is
    // wired and llama.h becomes visible to the Swift compiler.
    private var modelPtr: OpaquePointer? = nil
    private var ctxPtr:   OpaquePointer? = nil

    private init() {}

    /// Load a GGUF model from disk.  Idempotent: re-calling with the
    /// same path is a no-op.  Different path triggers unload + reload.
    public func loadModel(at url: URL, contextSize: Int = 2048) throws {
        if isLoaded, let current = info?.path, current == url { return }
        if isLoaded { unload() }

        guard FileManager.default.fileExists(atPath: url.path) else {
            throw LocalInferenceError.modelNotFound(url)
        }

        // TODO(Mac-build): real impl:
        //   var params = llama_model_default_params()
        //   modelPtr = llama_load_model_from_file(url.path, params)
        //   guard let m = modelPtr else { throw .modelLoadFailed("nil") }
        //   var cparams = llama_context_default_params()
        //   cparams.n_ctx = UInt32(contextSize)
        //   ctxPtr = llama_new_context_with_model(m, cparams)
        // For now, the scaffold marks the model as loaded so the RN
        // bridge wiring can be exercised without the framework.
        info = LoadedModelInfo(
            name: url.deletingPathExtension().lastPathComponent,
            path: url,
            contextSize: contextSize,
            parameters: 800_000_000
        )
        isLoaded = true
    }

    /// Free model + context.
    public func unload() {
        // TODO(Mac-build):
        //   if let c = ctxPtr   { llama_free(c) }
        //   if let m = modelPtr { llama_free_model(m) }
        ctxPtr = nil
        modelPtr = nil
        info = nil
        isLoaded = false
    }

    /// Synchronous-style generate.  Returns the full reply text.
    /// Honours Task.checkCancellation between tokens so the RN side
    /// can abort by cancelling the Task.
    public func generate(
        prompt: String,
        maxTokens: Int = 256,
        temperature: Float = 0.7
    ) async throws -> String {
        guard isLoaded, ctxPtr != nil || true /* placeholder */ else {
            throw LocalInferenceError.notLoaded
        }

        // TODO(Mac-build): real token-by-token decode loop.  Outline:
        //   1. tokenize prompt → [llama_token]
        //   2. llama_decode in batches of n_batch
        //   3. sample next token (temperature/top-p)
        //   4. detokenize, append to result
        //   5. stop on EOS or maxTokens or Task.isCancelled
        //
        // The scaffold returns a deterministic placeholder so the RN
        // bridge end-to-end test ("send prompt, receive reply") passes
        // before the real model is wired.  The placeholder is OBVIOUSLY
        // synthetic so it can't be mistaken for a real reply in QA.
        try Task.checkCancellation()
        return "[NunbaLocal scaffold] received prompt: \(prompt.prefix(60))…"
    }
}
