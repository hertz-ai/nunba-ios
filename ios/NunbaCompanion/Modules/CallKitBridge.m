//
//  CallKitBridge.m
//  Objective-C bridge declaration for CallKitBridge.swift.  Exposes the
//  Swift class to React Native's bridge under the same name JS sees.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(CallKitBridge, RCTEventEmitter)

RCT_EXTERN_METHOD(reportIncomingCall:(NSString *)callId
                  callerName:(NSString *)callerName
                  kind:(NSString *)kind
                  resolver:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(endCall:(NSString *)callKitUuid
                  resolver:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(endCallByCallId:(NSString *)callId
                  resolver:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)rejecter)

@end

// methodQueue + requiresMainQueueSetup are declared in CallKitBridge.swift
// via @objc methods.  Apple docs explicitly say
// `CXProvider.reportNewIncomingCall(...)` must be called on main; the
// same queue is used for the CXProviderDelegate callbacks (we pass
// `queue: nil` to setDelegate, which means main).  Forcing both
// surfaces to main eliminates the race on `callIdsByUuid` that would
// otherwise need an explicit NSLock.
