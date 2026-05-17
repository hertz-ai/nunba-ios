//
//  LlamaModelManager.swift
//  NunbaCompanion / LocalLlama
//
//  Downloads + caches GGUF models for on-device inference.  Mirrors
//  android/.../localhartos/ModelManager.kt — same model registry,
//  same cache-path semantics, same resumable-download contract.
//
//  Default model: Qwen3-0.8B Q4_K_M GGUF (~550MB) — the smallest
//  Qwen3 quantization that runs comfortably on iPhone 12+ with
//  Metal acceleration.  Identical to what Android uses so multi-
//  device users get consistent reply quality.
//
//  Cache layout:
//    ~/Library/Application Support/Nunba/models/<id>.gguf
//    ~/Library/Application Support/Nunba/models/<id>.gguf.partial
//    ~/Library/Application Support/Nunba/models/<id>.json   (manifest)
//
//  Ported from Hevolve_React_Native/ios/HevolveLocal/ModelManager.swift
//  during the Hevolve→Nunba iOS consolidation.  Renamed
//  ``ModelManager`` → ``LlamaModelManager`` to disambiguate inside
//  the broader NunbaCompanion module surface (which has several
//  "Manager" classes); cache directory + URLSession identifier
//  updated to Nunba's namespace.

import Foundation

public struct ModelDescriptor: Codable, Equatable {
    public let id: String
    public let name: String
    public let url: URL
    public let sizeBytes: Int64
    public let sha256: String?  // nil = no integrity check (devnet)
    public let recommendedRAM: Int64

    public static let qwen3_08b_q4 = ModelDescriptor(
        id: "qwen3-0.8b-q4",
        name: "Qwen3-0.8B (Q4_K_M)",
        url: URL(string: "https://huggingface.co/Qwen/Qwen3-0.8B-GGUF/resolve/main/qwen3-0.8b-q4_k_m.gguf")!,
        sizeBytes: 550 * 1024 * 1024,
        sha256: nil,    // pin once we settle on the exact build
        recommendedRAM: 2 * 1024 * 1024 * 1024
    )

    /// Round-trippable JS-bridge representation.  Used by
    /// LocalHartosModule.getModelCatalog / getRecommendedModel so the
    /// JS side gets the same shape Android's
    /// LocalHartosModule.java#toJSDict produces.
    public func toJSDict() -> [String: Any] {
        var d: [String: Any] = [
            "id": id,
            "name": name,
            "url": url.absoluteString,
            "sizeBytes": sizeBytes,
            "recommendedRAM": recommendedRAM,
        ]
        if let sha256 { d["sha256"] = sha256 }
        return d
    }
}

public enum ModelDownloadState {
    case notStarted
    case downloading(bytesReceived: Int64, totalBytes: Int64)
    case ready(URL)
    case failed(Error)
}

@MainActor
public final class LlamaModelManager: NSObject, URLSessionDownloadDelegate {

    public static let shared = LlamaModelManager()

    private(set) public var state: ModelDownloadState = .notStarted

    /// Per-state notification.  RN bridge subscribes to surface
    /// progress to the JS side.
    public var onStateChange: ((ModelDownloadState) -> Void)?

    private var session: URLSession!
    private var activeTask: URLSessionDownloadTask?
    private var activeDescriptor: ModelDescriptor?

    private override init() {
        super.init()
        let config = URLSessionConfiguration.background(
            withIdentifier: "com.hertzai.nunba.LlamaModelManager"
        )
        config.allowsCellularAccess = false  // privacy: WiFi-only by default
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }

    /// Returns the on-disk path for a model id, regardless of whether
    /// the file exists yet.
    public func cachedFileURL(for id: String) -> URL {
        let support = FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        ).first!
        let dir = support.appendingPathComponent("Nunba/models", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("\(id).gguf")
    }

    public func isCached(_ desc: ModelDescriptor) -> Bool {
        let url = cachedFileURL(for: desc.id)
        guard FileManager.default.fileExists(atPath: url.path) else { return false }
        if let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
           let size = attrs[.size] as? Int64 {
            return size > 0
        }
        return false
    }

    /// Begin a background download.  Idempotent: re-calling while in
    /// progress is a no-op; calling after .ready is a no-op.
    public func ensureDownloaded(_ desc: ModelDescriptor = .qwen3_08b_q4) {
        if isCached(desc) {
            state = .ready(cachedFileURL(for: desc.id))
            onStateChange?(state)
            return
        }
        if case .downloading = state { return }

        activeDescriptor = desc
        let task = session.downloadTask(with: desc.url)
        activeTask = task
        state = .downloading(bytesReceived: 0, totalBytes: desc.sizeBytes)
        onStateChange?(state)
        task.resume()
    }

    public func cancel() {
        activeTask?.cancel()
        activeTask = nil
        state = .notStarted
        onStateChange?(state)
    }

    /// Best-effort delete of the cached model file for a given id.
    /// Returns true if the file existed and was removed; false if
    /// nothing was there (idempotent).  Surfaces by LocalHartosModule.deleteModel.
    @discardableResult
    public func deleteCached(id: String) -> Bool {
        let url = cachedFileURL(for: id)
        guard FileManager.default.fileExists(atPath: url.path) else { return false }
        do {
            try FileManager.default.removeItem(at: url)
            return true
        } catch {
            return false
        }
    }

    // MARK: - URLSessionDownloadDelegate

    public func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        let total = totalBytesExpectedToWrite > 0
            ? totalBytesExpectedToWrite
            : (activeDescriptor?.sizeBytes ?? -1)
        Task { @MainActor in
            self.state = .downloading(bytesReceived: totalBytesWritten, totalBytes: total)
            self.onStateChange?(self.state)
        }
    }

    public func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        guard let desc = activeDescriptor else { return }
        let dest = cachedFileURL(for: desc.id)
        do {
            try? FileManager.default.removeItem(at: dest)
            try FileManager.default.moveItem(at: location, to: dest)
            // TODO(Mac-build): SHA-256 verify if desc.sha256 != nil.
            Task { @MainActor in
                self.state = .ready(dest)
                self.onStateChange?(self.state)
            }
        } catch {
            Task { @MainActor in
                self.state = .failed(error)
                self.onStateChange?(self.state)
            }
        }
        activeTask = nil
    }

    public func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: Error?
    ) {
        if let error = error {
            Task { @MainActor in
                self.state = .failed(error)
                self.onStateChange?(self.state)
            }
        }
        activeTask = nil
    }
}
