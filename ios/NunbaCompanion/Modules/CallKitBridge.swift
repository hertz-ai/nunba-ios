//
//  CallKitBridge.swift
//  iOS lock-screen incoming-call UI wired to JS via RCTEventEmitter.
//
//  Phase 7d, plan reference: sunny-gliding-eich.md, Part G.5.
//
//  Why CallKit at all:
//    - When the app is backgrounded or the screen is locked, an
//      incoming Phase-7d call invite (delivered via APNs or WAMP)
//      otherwise just sits in the user's notifications list with no
//      ringer.  CallKit gives us the system-level full-screen
//      incoming-call UI plus a Decline/Answer that wakes the JS bundle
//      and routes to CallChannelScreen on accept.
//    - JS calls `CallKitBridge.reportIncomingCall(callId, callerName,
//      kind)` when a fleetCommand of type 'call_invite' arrives.  The
//      bridge calls into CXProvider; iOS shows the UI; user taps
//      Answer → providerDelegate emits `callKitAnswerCall` event;
//      `services/fleetCommandHandler.js` listens for that event and
//      navigates to CallChannel.
//
//  Stub-but-real:  the file compiles with the Frameworks already on
//  the iOS app target (CallKit + AVFoundation are system frameworks,
//  no pod needed).  When the JS layer doesn't call reportIncomingCall
//  the provider stays idle — zero behavior change for users not yet
//  on Phase 7d builds.
//

import Foundation
import UIKit
import CallKit
import AVFoundation
import React

@objc(CallKitBridge)
final class CallKitBridge: RCTEventEmitter, CXProviderDelegate {

    // MARK: - Singletons / state

    private static let providerConfiguration: CXProviderConfiguration = {
        let cfg = CXProviderConfiguration(localizedName: "Nunba")
        cfg.supportsVideo = true
        cfg.maximumCallsPerCallGroup = 1
        cfg.maximumCallGroups = 1
        cfg.supportedHandleTypes = [.generic, .phoneNumber]
        if let img = UIImage(named: "AppIcon") {
            cfg.iconTemplateImageData = img.pngData()
        }
        return cfg
    }()

    private lazy var provider: CXProvider = {
        let p = CXProvider(configuration: Self.providerConfiguration)
        p.setDelegate(self, queue: nil)
        return p
    }()

    private let callController = CXCallController()
    // call-uuid → call-id mapping so JS-side string IDs survive the
    // CallKit boundary which only deals in UUIDs.
    private var callIdsByUuid: [UUID: String] = [:]

    private var hasListeners = false

    // MARK: - RCTEventEmitter overrides
    //
    // Threading: every RCT_EXTERN_METHOD (reportIncomingCall, endCall) AND
    // every CXProviderDelegate callback runs on main.  Apple's CallKit docs
    // require `reportNewIncomingCall` to be called on main; the delegate is
    // set with `queue: nil` which means main per CXProvider docs.  Pinning
    // the bridge's methodQueue to main below makes every JS->native and
    // native->JS event in this module single-threaded — `callIdsByUuid`
    // accesses don't need a lock.

    override static func requiresMainQueueSetup() -> Bool { true }
    override static func moduleName() -> String! { "CallKitBridge" }

    // RCTBridgeModule declares `methodQueue` as an @optional protocol
    // requirement (not a property on RCTEventEmitter), so Swift can't
    // use `override` here — that would fail to compile with "method
    // does not override any method from its superclass".  `@objc` is
    // sufficient: the bridge factory looks up the selector at runtime
    // via the Objective-C protocol conformance.
    @objc var methodQueue: DispatchQueue { DispatchQueue.main }

    override func supportedEvents() -> [String]! {
        return [
            "callKitAnswerCall",
            "callKitEndCall",
            "callKitMute",
        ]
    }

    override func startObserving() { hasListeners = true }
    override func stopObserving()  { hasListeners = false }

    // MARK: - Bridge methods (callable from JS)

    /// Surface an incoming call to iOS.  JS calls this when an APNs
    /// fleetCommand 'call_invite' arrives.  iOS shows the lock-screen
    /// ringer; on Answer the providerDelegate emits 'callKitAnswerCall'.
    @objc(reportIncomingCall:callerName:kind:resolver:rejecter:)
    func reportIncomingCall(
        _ callId: String,
        callerName: String,
        kind: String,
        resolver: @escaping RCTPromiseResolveBlock,
        rejecter: @escaping RCTPromiseRejectBlock
    ) {
        let uuid = UUID()
        callIdsByUuid[uuid] = callId

        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: callerName)
        update.localizedCallerName = callerName
        update.hasVideo = (kind == "video" || kind == "screen_share" || kind == "mixed")
        update.supportsHolding = false
        update.supportsGrouping = false
        update.supportsUngrouping = false
        update.supportsDTMF = false

        provider.reportNewIncomingCall(with: uuid, update: update) { [weak self] error in
            if let error = error {
                self?.callIdsByUuid.removeValue(forKey: uuid)
                rejecter("CALLKIT_REPORT_FAIL", error.localizedDescription, error)
            } else {
                resolver(uuid.uuidString)
            }
        }
    }

    /// JS tells iOS the call has ended (other side hung up, network drop,
    /// user hangs up via in-app UI not CallKit).  iOS dismisses any
    /// system-level UI bound to this call.
    @objc(endCall:resolver:rejecter:)
    func endCall(
        _ callKitUuid: String,
        resolver: @escaping RCTPromiseResolveBlock,
        rejecter: @escaping RCTPromiseRejectBlock
    ) {
        guard let uuid = UUID(uuidString: callKitUuid) else {
            rejecter("CALLKIT_BAD_UUID", "Invalid CallKit UUID: \(callKitUuid)", nil)
            return
        }
        let action = CXEndCallAction(call: uuid)
        let transaction = CXTransaction(action: action)
        callController.request(transaction) { error in
            if let error = error {
                rejecter("CALLKIT_END_FAIL", error.localizedDescription, error)
            } else {
                resolver(true)
            }
        }
    }

    /// JS-friendlier counterpart to `endCall(uuid)` — looks the UUID up
    /// from `callIdsByUuid` so callers don't have to thread UUIDs
    /// through their state.  Resolves with `true` if a CallKit session
    /// was found and ended; resolves with `false` (NOT rejection) when
    /// no session matched the call_id (the user joined directly via
    /// in-app UI without a CallKit ringer ever appearing).  CallChannelScreen
    /// calls this on every unmount so iOS doesn't accumulate orphan
    /// active calls in the system Phone app's recents.
    @objc(endCallByCallId:resolver:rejecter:)
    func endCallByCallId(
        _ callId: String,
        resolver: @escaping RCTPromiseResolveBlock,
        rejecter: @escaping RCTPromiseRejectBlock
    ) {
        guard let pair = callIdsByUuid.first(where: { $0.value == callId }) else {
            resolver(false)
            return
        }
        let action = CXEndCallAction(call: pair.key)
        let transaction = CXTransaction(action: action)
        callController.request(transaction) { error in
            if let error = error {
                rejecter("CALLKIT_END_FAIL", error.localizedDescription, error)
            } else {
                resolver(true)
            }
        }
    }

    // MARK: - CXProviderDelegate

    func providerDidReset(_ provider: CXProvider) {
        callIdsByUuid.removeAll()
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        let callId = callIdsByUuid[action.callUUID] ?? ""
        if hasListeners {
            sendEvent(withName: "callKitAnswerCall", body: [
                "callId": callId,
                "callKitUuid": action.callUUID.uuidString,
            ])
        }
        // Configure audio session for VoIP — CallKit will activate it.
        configureAudioSessionForVoIP()
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        let callId = callIdsByUuid.removeValue(forKey: action.callUUID) ?? ""
        if hasListeners {
            sendEvent(withName: "callKitEndCall", body: [
                "callId": callId,
                "callKitUuid": action.callUUID.uuidString,
            ])
        }
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        let callId = callIdsByUuid[action.callUUID] ?? ""
        if hasListeners {
            sendEvent(withName: "callKitMute", body: [
                "callId": callId,
                "callKitUuid": action.callUUID.uuidString,
                "muted": action.isMuted,
            ])
        }
        action.fulfill()
    }

    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        // CallKit successfully activated the AVAudioSession — LiveKit
        // RTC audio will now route through it.
    }

    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        // Audio session torn down — JS layer should disconnect Room.
    }

    // MARK: - Helpers

    private func configureAudioSessionForVoIP() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playAndRecord,
                                    mode: .voiceChat,
                                    options: [.allowBluetooth, .duckOthers])
        } catch {
            // Best-effort — LiveKit will retry its own configuration.
        }
    }
}
